#!/bin/sh
set -e

SCRAPE_INTERVAL=${SCRAPE_INTERVAL_HOURS:-6}

echo "=== TitanTV Scraper Container ==="
echo "Scrape interval: every ${SCRAPE_INTERVAL} hours"

# Run the initial scrape before starting the server
echo "Running initial scrape..."
node src/index.js

# Start the HTTP server in the background
echo "Starting HTTP server..."
node src/server.js &

# Re-run the scraper on the configured interval
INTERVAL_SECS=$((SCRAPE_INTERVAL * 3600))
while true; do
    echo "Next scrape in ${SCRAPE_INTERVAL} hours..."
    sleep ${INTERVAL_SECS}
    echo "Running scheduled scrape..."
    node src/index.js
done
