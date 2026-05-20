const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.SERVER_PORT) || 8000;
const xmltvPath = path.resolve(__dirname, '../xmltv.xml');

const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }

    // Only serve /xmltv.xml or /
    if (req.url !== '/xmltv.xml' && req.url !== '/') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }

    if (!fs.existsSync(xmltvPath)) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Guide data not yet available. The scraper may still be running.');
        return;
    }

    const stat = fs.statSync(xmltvPath);
    res.writeHead(200, {
        'Content-Type': 'application/xml',
        'Content-Length': stat.size,
        'Last-Modified': stat.mtime.toUTCString(),
    });

    fs.createReadStream(xmltvPath).pipe(res);
});

server.listen(PORT, () => {
    console.log(`XMLTV server listening on port ${PORT}`);
    console.log(`Guide data available at http://localhost:${PORT}/xmltv.xml`);
});
