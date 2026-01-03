const puppeteer = require('puppeteer');
const { saveChannel, saveProgram, getProgram, getMetadata, setMetadata } = require('./db');
const dayjs = require('dayjs');

const SELECTORS = {
    AD_BLOCK_CLOSE: 'span.zw3zih',
    ADD_LINEUP_ICON: 'img[title="Click to Add a New Lineup"]',
    ZIP_INPUT: 'input[placeholder="Enter Your ZIP Code"]',
    ZIP_SUBMIT: 'input[placeholder="Enter Your ZIP Code"] + img',
    BROADCAST_OPTION: 'img[alt="Broadcast"]',
    NEXT_BUTTON: 'img[title="Next"]',
    CHANNEL_ROW: 'div.sc-sasBe',
    CHANNEL_BOX: 'a.sc-fsvrPk',
    PROGRAM_CELL: 'div.sc-kCMLfs'
};

let capturedChannelData = null;
let capturedScheduleBaseInfo = null;

async function startScrape(fullDay = false, zipCode = null) {
    console.log(`Starting scrape (API Mode). Mode: Continuous 24h Blocks, Zip: ${zipCode || 'Default'}`);
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();

    // Reset captured state
    capturedChannelData = null;
    capturedScheduleBaseInfo = null;

    // enable request interception to find the API keys
    await page.setRequestInterception(true);
    page.on('request', req => req.continue());

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api/channel') && !capturedChannelData) {
            try {
                const data = await response.json();
                if (data.channels && data.channels.length > 0) {
                    console.log(`Captured Channel Data (${data.channels.length} channels)`);
                    capturedChannelData = data.channels;
                }
            } catch (e) { }
        }

        if (url.includes('api/schedule') && !capturedScheduleBaseInfo) {
            // Regex to extract params: api/schedule/{userId}/{lineupId}/{date}/{duration}
            const match = url.match(/api\/schedule\/([^\/]+)\/([^\/]+)\/(\d+)\/(\d+)/);
            if (match) {
                console.log('Captured Schedule Base Info from URL:', url);
                capturedScheduleBaseInfo = {
                    userId: match[1],
                    lineupId: match[2],
                    originalDate: match[3],
                    duration: parseInt(match[4])
                };
            }
        }
    });

    try {
        console.log("Navigating to TitanTV...");
        await page.goto('https://titantv.com', { waitUntil: 'networkidle2' });

        // 1. Ad Blocker
        try {
            const adClose = await page.waitForSelector(SELECTORS.AD_BLOCK_CLOSE, { timeout: 5000 });
            if (adClose) {
                console.log('Closing ad blocker...');
                await adClose.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }

        // 2. Setup (Click Add Lineup -> Zip -> Market)
        // This triggers the API calls for the desired lineup
        try {
            const plus = await page.waitForSelector(SELECTORS.ADD_LINEUP_ICON, { timeout: 3000 });
            if (plus) {
                console.log("Setting up lineup...");
                await plus.click();
                await new Promise(r => setTimeout(r, 2000));

                const guestBtn = await page.$('::-p-xpath(//button[contains(., "View as Guest")])');
                if (guestBtn) {
                    await guestBtn.click();
                    await new Promise(r => setTimeout(r, 2000));
                }

                await page.waitForSelector(SELECTORS.BROADCAST_OPTION, { timeout: 5000 });
                await page.click(SELECTORS.BROADCAST_OPTION);
                await new Promise(r => setTimeout(r, 2000));

                await page.waitForSelector(SELECTORS.ZIP_INPUT, { timeout: 5000 });
                await page.type(SELECTORS.ZIP_INPUT, zipCode || process.env.ZIP_CODE || '46725');
                await page.click(SELECTORS.ZIP_SUBMIT);
                await new Promise(r => setTimeout(r, 3000));

                const market = process.env.MARKET_NAME || 'Fort Wayne';
                const marketBtn = await page.$(`::-p-xpath(//div[contains(text(), "${market}")])`);
                if (marketBtn) {
                    await marketBtn.click();
                    // Reset captured info because the new lineup will trigger new requests
                    capturedChannelData = null;
                    capturedScheduleBaseInfo = null;

                    await marketBtn.click();
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        } catch (e) {
            console.log("Setup skipped or failed:", e.message);
        }

        // 3. Wait for API interception
        console.log("Waiting for API data...");
        const startWait = Date.now();
        while ((!capturedChannelData || !capturedScheduleBaseInfo) && (Date.now() - startWait < 15000)) {
            await new Promise(r => setTimeout(r, 500));
        }

        if (!capturedChannelData || !capturedScheduleBaseInfo) {
            throw new Error("Failed to capture API credentials/data. The site structure might have changed.");
        }

        // 4. Process Data
        // Map channelIndex -> Channel DB Object
        const channelIndexMap = new Map(); // channelIndex -> { dbId, details }

        for (const ch of capturedChannelData) {
            const channelNum = `${ch.majorChannel}${ch.minorChannel ? '.' + ch.minorChannel : ''}`;
            const dbChannel = saveChannel({
                external_id: String(ch.channelId),
                channel_number: channelNum,
                callsign: ch.callSign,
                name: ch.description,
                logo_url: ch.logo
            });
            channelIndexMap.set(ch.channelIndex, dbChannel.id);
        }

        console.log(`Saved/Updated ${channelIndexMap.size} channels.`);

        // 5. Fetch Schedule Blocks
        // Determine start time based on DB cursor
        let currentStart = dayjs().startOf('hour');

        try {
            const cursorRow = getMetadata('last_scrape_cursor');
            if (cursorRow && cursorRow.value) {
                const cursorDate = dayjs(cursorRow.value);
                if (cursorDate.isValid() && cursorDate.isAfter(currentStart)) {
                    console.log(`Resuming scrape from cursor: ${cursorDate.format()}`);
                    currentStart = cursorDate;
                }
            }
        } catch (e) { console.log('Metadata read error:', e); }

        // Always scrape 24 hours (4 blocks of 6 hours)
        const iterations = 4;
        const durationMins = 360; // 6 hours per block

        for (let i = 0; i < iterations; i++) {
            const dateStr = currentStart.format('YYYYMMDDHHmm');
            console.log(`Fetching schedule block ${i + 1}/${iterations}: ${dateStr}`);

            const url = `https://titantv.com/api/schedule/${capturedScheduleBaseInfo.userId}/${capturedScheduleBaseInfo.lineupId}/${dateStr}/${durationMins}`;

            // Use page.evaluate to fetch so we share cookies and headers
            const scheduleData = await page.evaluate(async (fetchUrl) => {
                const res = await fetch(fetchUrl);
                return res.json();
            }, url);

            if (scheduleData && scheduleData.channels) {
                let progCount = 0;
                for (const chEntry of scheduleData.channels) {
                    const dbChId = channelIndexMap.get(chEntry.channelIndex);
                    if (!dbChId) continue; // Channel not in our list?

                    if (chEntry.days) {
                        for (const day of chEntry.days) {
                            if (day.events) {
                                for (const evt of day.events) {
                                    // Parse start/end
                                    // evt.startTime is likely ISO: "2026-01-03T19:00:00"
                                    const startUnix = dayjs(evt.startTime).unix();
                                    const endUnix = dayjs(evt.endTime).unix();

                                    saveProgram({
                                        channel_id: dbChId,
                                        title: evt.title,
                                        sub_title: evt.episodeTitle || evt.subTitle || '',
                                        description: evt.description,
                                        image_url: evt.showCard || null,
                                        start_time: startUnix,
                                        end_time: endUnix
                                    });
                                    progCount++;
                                }
                            }
                        }
                    }
                }
                console.log(`Processed ${progCount} programs in this block.`);
            }

            // Advance time
            currentStart = currentStart.add(durationMins, 'minute');

            // Save Progress (Cursor)
            setMetadata('last_scrape_cursor', currentStart.toISOString());

            // Small pause to be nice
            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (e) {
        console.error('Fatal scrape error:', e);
    } finally {
        await browser.close();
    }
}

module.exports = { startScrape };
