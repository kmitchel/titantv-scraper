require('dotenv').config();
const { startScrape } = require('./scraper');
const { generateXMLTV } = require('./xmltv');
const { setMetadata, getMetadata, clearAllData } = require('./db');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const cliZipCode = args[0];
    let effectiveZipCode = cliZipCode;

    console.log("TitanTV Scraper CLI");

    if (cliZipCode) {
        console.log(`Zip Code argument provided: ${cliZipCode}. Saving preference.`);
        try {
            setMetadata('last_zip_code', cliZipCode);
        } catch (e) {
            console.error("Failed to update metadata:", e);
        }
    } else {
        // Try to load from DB first, then fall back to .env
        try {
            const savedZip = getMetadata('last_zip_code');
            const previousZip = savedZip && savedZip.value;
            const envZip = process.env.ZIP_CODE;

            if (previousZip) {
                console.log(`No argument provided. Using saved zip code: ${previousZip}`);
                effectiveZipCode = previousZip;
            } else if (envZip) {
                console.log(`No argument or saved zip code. Using ZIP_CODE from .env: ${envZip}`);
                effectiveZipCode = envZip;
                setMetadata('last_zip_code', envZip);
            } else {
                console.log("No argument, saved zip code, or .env ZIP_CODE found. Using hardcoded default.");
            }
        } catch (e) {
            console.log("Could not read saved zip code.", e);
            if (process.env.ZIP_CODE) {
                effectiveZipCode = process.env.ZIP_CODE;
            }
        }
    }

    try {
        const outputPath = path.resolve(__dirname, '../xmltv.xml');

        // Always clear stale channel and program data before scraping.
        // The scraper fetches a full fresh window every run, so old data is never needed.
        console.log("Clearing previous channel and program data...");
        clearAllData();

        // Also clear the xmltv.xml so consumers don't read stale data during the scrape
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log('Cleared stale xmltv.xml.');
        }

        await startScrape(true, effectiveZipCode);

        console.log("Generating XMLTV...");
        const xml = generateXMLTV();

        fs.writeFileSync(outputPath, xml);

        console.log(`Success! XMLTV file written to: ${outputPath}`);
        process.exit(0);
    } catch (err) {
        console.error("Error during execution:", err);
        process.exit(1);
    }
}

main();
