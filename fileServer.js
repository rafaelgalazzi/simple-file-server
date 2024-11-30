const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function loadMime() {
    const { default: mime } = await import('mime');
    return mime;
}

const certPath = '';
const keyPath = '';

const useHttps = process.argv.includes('--use-https');
if (useHttps && (!fs.existsSync(certPath) || !fs.existsSync(keyPath))) {
    console.error("Error: SSL certificate or key file not found.");
    process.exit(1);
}

const serverOptions = useHttps
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        passphrase: '',
        ciphers: ''
    }
    : {};

const serverHandler = async (req, res) => {
    console.log(`Received request: ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

    const filePath = `.${req.url}`;
    
    // Serve directory listing when accessing the root or any directory
    if (req.url === '/' || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        fs.readdir(filePath, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                return res.end('Error reading directory');
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            let htmlContent = '<h1>Directory Listing</h1><ul>';
            files.forEach((file) => {
                htmlContent += `<li><a href="${path.join(req.url, file)}">${file}</a></li>`;
            });
            htmlContent += '</ul>';
            res.end(htmlContent);
        });
    } else if (fs.existsSync(filePath))  {
        const mime = await loadMime();
        fileHandler(filePath, req, res, mime);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
    }
};

function fileHandler(filePath, req, res, mime) {
    const stat = fs.statSync(filePath);
    const mimeType = mime.getType(filePath) || 'application/octet-stream';
    const fileSize = stat.size;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': end - start + 1,
        });

        const videoStream = fs.createReadStream(filePath, { start, end });
        videoStream.pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': fileSize });
        const videoStream = fs.createReadStream(filePath);
        videoStream.pipe(res);
    }
}

const PORT_IPV6 = 8000;
const PORT_IPV4 = 8001;
const HOST_IPV6 = '';
const HOST_IPV4 = '';

const ipv6Server = useHttps
    ? https.createServer(serverOptions, serverHandler)
    : http.createServer(serverHandler); 

const ipv4Server = useHttps
    ? https.createServer(serverOptions, serverHandler) 
    : http.createServer(serverHandler);

ipv6Server.listen(PORT_IPV6, HOST_IPV6, () => {
    const protocol = useHttps ? 'HTTPS' : 'HTTP';
    console.log(`Serving ${protocol} on ${protocol.toLowerCase()}://[${HOST_IPV6}]:${PORT_IPV6} (IPv6)`);
});

ipv4Server.listen(PORT_IPV4, HOST_IPV4, () => {
    const protocol = useHttps ? 'HTTPS' : 'HTTP';
    console.log(`Serving ${protocol} on ${protocol.toLowerCase()}://${HOST_IPV4}:${PORT_IPV4} (IPv4)`);
});
