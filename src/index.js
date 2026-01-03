const { startScrape } = require('./scraper');
const { generateXMLTV } = require('./xmltv');
const { cleanupOldPrograms, setMetadata, getMetadata } = require('./db');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const cliZipCode = args[0];
    let effectiveZipCode = cliZipCode;

    console.log("TitanTV Scraper CLI");

    if (cliZipCode) {
        console.log(`Zip Code argument provided: ${cliZipCode}. Resetting cursor and saving preference.`);
        // Reset the cursor because a new zip/lineup implies a fresh start
        try {
            setMetadata('last_scrape_cursor', '');
            setMetadata('last_zip_code', cliZipCode);
        } catch (e) {
            console.error("Failed to update metadata:", e);
        }
    } else {
        // Try to load from DB
        try {
            const savedZip = getMetadata('last_zip_code');
            if (savedZip && savedZip.value) {
                console.log(`No argument provided. Using saved zip code: ${savedZip.value}`);
                effectiveZipCode = savedZip.value;
            } else {
                console.log("No argument provided and no saved zip code found. Using defaults.");
            }
        } catch (e) {
            console.log("Could not read saved zip code.", e);
        }
    }

    try {
        // Cleanup old data (older than 24 hours to keep some history, or just strict past)
        // Let's remove anything that ENDED more than 6 hours ago.
        const cleanupThreshold = dayjs().subtract(6, 'hours').unix();
        const result = cleanupOldPrograms(cleanupThreshold);
        console.log(`Cleaned up old programs. Deleted info:`, result);

        await startScrape(true, effectiveZipCode);

        console.log("Generating XMLTV...");
        const xml = generateXMLTV();

        const outputPath = path.resolve(__dirname, '../xmltv.xml');
        fs.writeFileSync(outputPath, xml);

        console.log(`Success! XMLTV file written to: ${outputPath}`);
        process.exit(0);
    } catch (err) {
        console.error("Error during execution:", err);
        process.exit(1);
    }
}

main();
