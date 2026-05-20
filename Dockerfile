# Use the official Puppeteer image — includes Node 20 and a compatible Chromium install
FROM ghcr.io/puppeteer/puppeteer:22

# Run as root so we can write to /app/data and /app/xmltv.xml
USER root

WORKDIR /app

# Copy package files and install dependencies
# NODE_ENV=production skips devDependencies; puppeteer will reuse the
# bundled Chromium already present in the base image
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Persistent volume for the SQLite database
VOLUME ["/app/data"]

# Expose the XMLTV HTTP server port
EXPOSE 8000

# Tell Puppeteer to use the pre-installed Chromium from the base image
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

ENTRYPOINT ["./docker-entrypoint.sh"]
