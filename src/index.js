const { startScrape } = require('./scraper');
const { generateXMLTV } = require('./xmltv');
const { cleanupOldPrograms, setMetadata } = require('./db');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const zipCode = args[0];

    console.log("TitanTV Scraper CLI");
    if (zipCode) {
        console.log(`Zip Code provided: ${zipCode}. Resetting cursor.`);
        // Reset the cursor because a new zip/lineup implies a fresh start
        try {
            setMetadata('last_scrape_cursor', '');
        } catch (e) {
            console.error("Failed to reset cursor:", e);
        }
    } else {
        console.log("No zip code provided, using default/env.");
    }

    try {
        // Cleanup old data (older than 24 hours to keep some history, or just strict past)
        // Let's remove anything that ENDED more than 6 hours ago.
        const cleanupThreshold = dayjs().subtract(6, 'hours').unix();
        const result = cleanupOldPrograms(cleanupThreshold);
        console.log(`Cleaned up old programs. Deleted info:`, result);

        await startScrape(true, zipCode);

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
