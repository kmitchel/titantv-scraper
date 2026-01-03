# TitanTV Scraper

A Node.js tool to scrape TV listings from TitanTV and generate an XMLTV file.

## Features
- Scrapes channel and program data via TitanTV's internal JSON API.
- Generates `xmltv.xml` compatible with Plex, Jellyfin, Emby, etc.
- **Continuous Scraping**: Captures 24 hours of data per run. Consecutive runs pick up exactly where the previous run left off, allowing you to build up a large schedule over time.
- **Auto-Cleanup**: Automatically removes program data for shows that ended more than 6 hours ago to keep the XML file manageable.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kmitchel/titantv-scraper.git
   cd titantv-scraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### standard Run (Incremental)
Scrapes the next 24 hours of programming. If running for the first time, it starts from the current time. If run again, it continues from the last saved time block.

```bash
npm start
```

### Reset / New Location
To start fresh with a different zip code (this clears the previous scrape cursor):

```bash
# Using npm
npm start -- 46725

# Or directly with node
node src/index.js 46725
```

## Output
The script generates a file named `xmltv.xml` in the root directory.

## Configuration
- Data is stored in `data/titantv.db` (SQLite).
- You can manually set `ZIP_CODE` and `MARKET_NAME` in a `.env` file if desired, though the CLI argument is preferred for the zip code.

## Automation / Systemd Service

To run the scraper automatically every 24 hours:

1. **Edit the Service File**:
   Open `systemd/titantv-scrape.service` and modify the `User` and `WorkingDirectory` to match your environment.

2. **Copy Files to Systemd**:
   ```bash
   sudo cp systemd/titantv-scrape.service /etc/systemd/system/
   sudo cp systemd/titantv-scrape.timer /etc/systemd/system/
   ```

3. **Set Permissions**:
   Ensure the service user (e.g., `jellyfin`) has ownership of the installation directory so it can write to the database and generate the XML file.
   ```bash
   sudo chown -R jellyfin:jellyfin /opt/titantv-scraper
   ```

4. **Enable and Start the Timer**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now titantv-scrape.timer
   ```
   
   The timer is configured to run 5 minutes after boot, and then every 24 hours thereafter.
