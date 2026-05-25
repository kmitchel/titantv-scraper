# TitanTV Scraper

A Node.js tool that scrapes TV listings from TitanTV and serves them as an XMLTV file compatible with Plex, Jellyfin, Emby, and other DVR software.

## Features

- Scrapes channel and program data via TitanTV's internal JSON API
- Generates `xmltv.xml` compatible with Plex, Jellyfin, Emby, etc.
- Configurable guide window — fetch 1 to 14+ days of data per run
- Correct timezone handling — times are output in your local timezone with proper DST support
- Serves `xmltv.xml` over HTTP on port 8000 (Docker mode)
- Automatic re-scrape on a configurable interval (Docker mode)
- Clears stale data before each run so old lineups never bleed into output

## Configuration

All configuration is done via environment variables. For local development, create a `.env` file in the project root:

```env
ZIP_CODE=78015
MARKET_NAME="San Antonio"
GUIDE_DAYS=3
SCRAPE_INTERVAL_HOURS=6
SERVER_PORT=8000
TZ=America/Chicago
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `ZIP_CODE` | Yes | `46725` | ZIP code for the TV market to scrape |
| `MARKET_NAME` | Yes | `Fort Wayne` | Market name as it appears on TitanTV |
| `GUIDE_DAYS` | No | `1` | Number of days of guide data to fetch per run |
| `SCRAPE_INTERVAL_HOURS` | No | `6` | How often to re-scrape (Docker only) |
| `SERVER_PORT` | No | `8000` | Port to serve xmltv.xml on (Docker only) |
| `TZ` | No | `America/Chicago` | IANA timezone name for your market |

### Timezone

The `TZ` value must be a valid [IANA timezone name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) matching the timezone of your ZIP code. Common values:

| Region | TZ value |
|---|---|
| Eastern | `America/New_York` |
| Central | `America/Chicago` |
| Mountain | `America/Denver` |
| Pacific | `America/Los_Angeles` |
| UK | `Europe/London` |
| Central Europe | `Europe/Berlin` |
| Japan | `Asia/Tokyo` |
| Australia Eastern | `Australia/Sydney` |

Daylight saving time transitions are handled automatically when using IANA timezone names.

## Running with Docker (Recommended)

Docker is the recommended way to run the scraper. The container runs the scraper on startup, serves `xmltv.xml` over HTTP, and automatically re-scrapes on the configured interval.

### Build

```powershell
docker build -t titantv-scraper .
```

### Run

```powershell
docker run -d `
  --name titantv `
  -p 8000:8000 `
  -v titantv-data:/app/data `
  -e ZIP_CODE=78015 `
  -e "MARKET_NAME=San Antonio" `
  -e GUIDE_DAYS=3 `
  -e SCRAPE_INTERVAL_HOURS=6 `
  -e TZ=America/Chicago `
  titantv-scraper
```

The guide data will be available at `http://<host>:8000/xmltv.xml` once the initial scrape completes. The server returns a `503` response while the first scrape is still running.

### Notes

- The `/app/data` volume persists the SQLite database across container restarts
- `TZ` must be passed as a `-e` flag — it is not read from a `.env` file inside the container
- To change your ZIP code or market, stop the container, remove it, and run again with the new values — the database is cleared automatically on each run

### Useful commands

```powershell
# View logs
docker logs titantv

# Check the container timezone
docker exec titantv date

# Stop and remove the container
docker stop titantv
docker rm titantv
```

## Running Locally

### Installation

```bash
git clone https://github.com/kmitchel/titantv-scraper.git
cd titantv-scraper
npm install
```

Create a `.env` file with your configuration (see above), then run:

```bash
npm start
```

The script generates `xmltv.xml` in the project root.

### Passing a ZIP code via CLI

You can override the ZIP code from the command line. This also resets the scrape cursor:

```bash
node src/index.js 78015
```

ZIP code priority order: CLI argument → saved database value → `.env` value → hardcoded default.

## Automation with systemd (Linux)

To run the scraper automatically on a schedule without Docker:

1. Edit `systemd/titantv-scrape.service` and update `User` and `WorkingDirectory` to match your environment.

2. Copy the files to systemd:
   ```bash
   sudo cp systemd/titantv-scrape.service /etc/systemd/system/
   sudo cp systemd/titantv-scrape.timer /etc/systemd/system/
   ```

3. Set permissions:
   ```bash
   sudo chown -R youruser:youruser /opt/titantv-scraper
   ```

4. Enable and start the timer:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now titantv-scrape.timer
   ```

The timer runs 5 minutes after boot and every 24 hours thereafter.

## Data Storage

- SQLite database: `data/titantv.db`
- XMLTV output: `xmltv.xml` (project root, or `/app/xmltv.xml` in Docker)
- Both paths are excluded from git via `.gitignore`
