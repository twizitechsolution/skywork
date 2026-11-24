// Sky Work Unified Local Development Server
// Serves Backend (port 5000), User Web App (port 3000), and Admin Panel (port 3001)

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const BACKEND_PORT = 5000;
const WEB_PORT = 3000;
const ADMIN_PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function proxyRequest(req, res, targetPort) {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` }
  };

  const proxy = http.request(options, (targetRes) => {
    res.writeHead(targetRes.statusCode, targetRes.headers);
    targetRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error(`[Proxy Error] Unable to forward ${req.method} ${req.url}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: Backend server unreachable');
  });

  req.pipe(proxy, { end: true });
}

function createStaticServer(rootDir, name, port) {
  return http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // Forward API and upload requests to backend
    if (pathname.startsWith('/api') || pathname.startsWith('/uploads')) {
      return proxyRequest(req, res, BACKEND_PORT);
    }

    let filePath = path.join(rootDir, pathname === '/' ? 'index.html' : pathname);

    // Security check: prevent directory traversal
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        // SPA Fallback for React Router: serve index.html for non-asset routes
        const isAsset = pathname.includes('.') && !pathname.endsWith('.html');
        if (isAsset) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('File Not Found');
        }

        const indexPath = path.join(rootDir, 'index.html');
        fs.readFile(indexPath, (errIndex, content) => {
          if (errIndex) {
            res.writeHead(500);
            return res.end('Error loading index.html');
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
      }
    });
  });
}

// 1. Verify/Start Backend Server
function ensureBackend() {
  http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      console.log(`[Backend] Already running at http://localhost:${BACKEND_PORT}`);
      startFrontends();
    } else {
      bootBackendProcess();
    }
  }).on('error', () => {
    bootBackendProcess();
  });
}

function bootBackendProcess() {
  console.log('[Backend] Starting Express backend process...');
  const { fork } = require('child_process');
  const serverPath = path.join(__dirname, 'backend', 'src', 'server.js');
  const backendProc = fork(serverPath, [], {
    cwd: path.join(__dirname, 'backend'),
    env: { ...process.env, PORT: BACKEND_PORT }
  });

  backendProc.on('message', (msg) => {
    console.log('[Backend Msg]', msg);
  });

  // Give backend 2 seconds to initialize then start frontends
  setTimeout(startFrontends, 2000);
}

function startFrontends() {
  const webDir = path.join(__dirname, 'web');
  const adminDir = path.join(__dirname, 'admin');

  const webServer = createStaticServer(webDir, 'User Web App', WEB_PORT);
  webServer.listen(WEB_PORT, () => {
    console.log(`[Web App] Running at http://localhost:${WEB_PORT}`);
    console.log(`[Simulator] Mobile Simulator at http://localhost:${WEB_PORT}/invapp.html`);
    console.log(`[APK] Android APK download at http://localhost:${WEB_PORT}/SkyWork.apk`);
  });

  const adminServer = createStaticServer(adminDir, 'Admin Dashboard', ADMIN_PORT);
  adminServer.listen(ADMIN_PORT, () => {
    console.log(`[Admin] Admin Panel running at http://localhost:${ADMIN_PORT}`);
    console.log(`[Admin Login] User: admin | Pass: 123456`);
    console.log('\n======================================================');
    console.log('   SKY WORK PLATFORM IS FULLY OPERATIONAL LOCALLY');
    console.log('======================================================');
    console.log(` -> User Web App:       http://localhost:${WEB_PORT}`);
    console.log(` -> Mobile Simulator:   http://localhost:${WEB_PORT}/invapp.html`);
    console.log(` -> Admin Dashboard:    http://localhost:${ADMIN_PORT}`);
    console.log(` -> Backend API:        http://localhost:${BACKEND_PORT}`);
    console.log(` -> APK Direct Link:    http://localhost:${WEB_PORT}/SkyWork.apk`);
    console.log('======================================================\n');
  });
}

ensureBackend();
