const { create } = require('xmlbuilder2');
const { getChannels, getProgramsForChannel } = require('./db');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

function generateXMLTV() {
    const root = create({ version: '1.0' }).ele('tv');

    const channels = getChannels();
    for (const channel of channels) {
        const chEle = root.ele('channel', { id: channel.channel_number });
        chEle.ele('display-name').txt(`${channel.channel_number} ${channel.callsign}`);
        if (channel.logo_url) {
            chEle.ele('icon', { src: channel.logo_url });
        }
    }

    // Query the same window configured for scraping (default 1 day)
    const guideDays = Math.max(1, parseInt(process.env.GUIDE_DAYS) || 1);
    const start = dayjs().subtract(2, 'hours').unix(); // small buffer for in-progress programs
    const end = dayjs().add(guideDays, 'day').unix();

    for (const channel of channels) {
        const programs = getProgramsForChannel(channel.id, start, end);
        for (const prog of programs) {
            const tz = process.env.TZ || 'America/Chicago';
            const progEle = root.ele('programme', {
                start: dayjs.unix(prog.start_time).tz(tz).format('YYYYMMDDHHmmss ZZ'),
                stop: dayjs.unix(prog.end_time).tz(tz).format('YYYYMMDDHHmmss ZZ'),
                channel: channel.channel_number
            });
            progEle.ele('title').txt(prog.title);
            if (prog.sub_title) progEle.ele('sub-title').txt(prog.sub_title);
            if (prog.description) progEle.ele('desc').txt(prog.description);
            if (prog.image_url) {
                progEle.ele('icon', { src: prog.image_url });
            }
        }
    }

    return root.end({ prettyPrint: true });
}

module.exports = { generateXMLTV };
