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
    const envZipCode = process.env.ZIP_CODE;
    const defaultZipCode = '46725';

    console.log("TitanTV Scraper CLI");

    if (cliZipCode) {
        console.log(`Zip Code argument provided: ${cliZipCode}. Saving preference.`);
        try {
            setMetadata('last_zip_code', cliZipCode);
        } catch (e) {
            console.error("Failed to update metadata:", e);
        }
    } else {
        // Prefer runtime env config over the persisted value so Docker env changes
        // take effect even when /app/data is reused across container restarts.
        try {
            const savedZip = getMetadata('last_zip_code');
            const previousZip = savedZip && savedZip.value;

            if (envZipCode) {
                console.log(`No argument provided. Using ZIP_CODE from environment: ${envZipCode}`);
                effectiveZipCode = envZipCode;
                if (previousZip !== envZipCode) {
                    setMetadata('last_zip_code', envZipCode);
                }
            } else if (previousZip) {
                console.log(`No argument provided. Using saved zip code: ${previousZip}`);
                effectiveZipCode = previousZip;
            } else {
                console.log("No argument, saved zip code, or .env ZIP_CODE found. Using hardcoded default.");
                effectiveZipCode = defaultZipCode;
            }
        } catch (e) {
            console.log("Could not read saved zip code.", e);
            effectiveZipCode = envZipCode || defaultZipCode;
        }
    }

    try {
        const outputPath = path.resolve(__dirname, '../xmltv.xml');
        const tmpOutputPath = `${outputPath}.tmp`;

        // Always clear stale channel and program data before scraping.
        // The scraper fetches a full fresh window every run, so old data is never needed.
        console.log("Clearing previous channel and program data...");
        clearAllData();

        await startScrape(true, effectiveZipCode);

        console.log("Generating XMLTV...");
        const xml = generateXMLTV();

        fs.writeFileSync(tmpOutputPath, xml);
        fs.renameSync(tmpOutputPath, outputPath);

        console.log(`Success! XMLTV file written to: ${outputPath}`);
        process.exit(0);
    } catch (err) {
        console.error("Error during execution:", err);
        process.exit(1);
    }
}

main();
