const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  shell,
  dialog,
  nativeImage,
  net
} = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ID = 'com.websprodigital.antrianestimator';
const APP_TITLE = 'Antrian Gambar Estimator | Portal Operasional Proyek';
const PREFERRED_PORT = 48271;
const LIVE_HTML_PRIMARY_URL =
  'https://raw.githubusercontent.com/websprodigital/antrian-gambar-estimator/gh-pages/index.html';
const LIVE_HTML_FALLBACK_URL =
  'https://websprodigital.github.io/antrian-gambar-estimator/index.html';

app.setAppUserModelId(APP_ID);
app.setName('Antrian Gambar Estimator');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let localServer = null;
let localBaseUrl = '';
let isQuitting = false;
let hasShownTrayHint = false;
let unreadCount = 0;
let inFlightSyncPromise = null;
let lastAutoCheckAt = 0;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

function getLiveWebPaths() {
  const liveWebDir = path.join(app.getPath('userData'), 'live-web');
  const bundledWwwDir = path.join(__dirname, 'www');
  return {
    liveWebDir: liveWebDir,
    liveIndexPath: path.join(liveWebDir, 'index.html'),
    liveMetaPath: path.join(liveWebDir, 'meta.json'),
    bundledWwwDir: bundledWwwDir,
    bundledIndexPath: path.join(bundledWwwDir, 'index.html')
  };
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function isValidPortalHtml(html) {
  if (!html || typeof html !== 'string' || html.length < 20000) return false;
  const lower = html.toLowerCase();
  if (!lower.includes('<html') || !lower.includes('</body>') || !lower.includes('</html>')) return false;
  return html.includes('GOOGLE_SCRIPT_WEB_APP_URL') || html.includes('loginScreen');
}

function transformLiveHtml(rawHtml) {
  let html = String(rawHtml || '');
  html = html.replace(
    /<meta name="viewport" content="([^"]*)">/i,
    function (_, content) {
      if (content.includes('viewport-fit=cover')) return '<meta name="viewport" content="' + content + '">';
      return '<meta name="viewport" content="' + content + ', viewport-fit=cover">';
    }
  );
  if (!html.includes('native-bridge.js')) {
    const closeIdx = html.toLowerCase().lastIndexOf('</body>');
    if (closeIdx !== -1) {
      html =
        html.slice(0, closeIdx) +
        '  <script src="native-bridge.js"></script>\n' +
        html.slice(closeIdx);
    }
  }
  return html;
}

function readLiveMeta() {
  const { liveMetaPath } = getLiveWebPaths();
  try {
    if (fs.existsSync(liveMetaPath)) {
      return JSON.parse(fs.readFileSync(liveMetaPath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function writeLiveMeta(metaObj) {
  const { liveWebDir, liveMetaPath } = getLiveWebPaths();
  fs.mkdirSync(liveWebDir, { recursive: true });
  const tmpMeta = liveMetaPath + '.tmp';
  fs.writeFileSync(tmpMeta, JSON.stringify(metaObj, null, 2), 'utf8');
  fs.renameSync(tmpMeta, liveMetaPath);
}

function getBundledIndexHash() {
  const { bundledIndexPath } = getLiveWebPaths();
  try {
    return sha256Text(fs.readFileSync(bundledIndexPath, 'utf8'));
  } catch (e) {
    return '';
  }
}

function ensureLiveCacheMatchesBinary() {
  const { liveIndexPath } = getLiveWebPaths();
  const bundledHash = getBundledIndexHash();
  const meta = readLiveMeta();
  if (bundledHash && meta.bundledHash && meta.bundledHash !== bundledHash) {
    try {
      if (fs.existsSync(liveIndexPath)) {
        fs.unlinkSync(liveIndexPath);
      }
      writeLiveMeta({ bundledHash: bundledHash, liveHash: '', updatedAt: '' });
    } catch (e) {}
  } else if (bundledHash && !meta.bundledHash) {
    try {
      writeLiveMeta(Object.assign({}, meta, { bundledHash: bundledHash }));
    } catch (e) {}
  }
}

function getCurrentActiveHtmlHash() {
  const { liveIndexPath, bundledIndexPath } = getLiveWebPaths();
  try {
    if (fs.existsSync(liveIndexPath)) {
      return sha256Text(fs.readFileSync(liveIndexPath, 'utf8'));
    }
    if (fs.existsSync(bundledIndexPath)) {
      return sha256Text(fs.readFileSync(bundledIndexPath, 'utf8'));
    }
  } catch (e) {}
  return '';
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, timeoutMs);
  try {
    const sep = url.includes('?') ? '&' : '?';
    const bustUrl = url + sep + 'live_t=' + Date.now();
    const res = await net.fetch(bustUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      },
      signal: controller.signal
    });
    if (!res || !res.ok) {
      throw new Error('HTTP ' + (res ? res.status : 'error'));
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function syncLiveHtmlFromCloud(reason) {
  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async function () {
    const { liveWebDir, liveIndexPath } = getLiveWebPaths();
    const urls = [
      { url: LIVE_HTML_PRIMARY_URL, timeout: 5500 },
      { url: LIVE_HTML_FALLBACK_URL, timeout: 6500 }
    ];

    let rawHtml = '';
    let usedUrl = '';
    let lastError = null;

    for (let i = 0; i < urls.length; i++) {
      try {
        const txt = await fetchTextWithTimeout(urls[i].url, urls[i].timeout);
        if (isValidPortalHtml(txt)) {
          rawHtml = txt;
          usedUrl = urls[i].url;
          break;
        }
        lastError = new Error('Respons HTML tidak lengkap');
      } catch (err) {
        lastError = err;
      }
    }

    if (!rawHtml) {
      return {
        ok: false,
        status: 'offline',
        updated: false,
        reason: reason || 'manual',
        error: lastError ? String(lastError.message || lastError) : 'Gagal menghubungi server'
      };
    }

    const transformed = transformLiveHtml(rawHtml);
    const nextHash = sha256Text(transformed);
    const activeHash = getCurrentActiveHtmlHash();

    if (nextHash && nextHash === activeHash) {
      return {
        ok: true,
        status: 'up-to-date',
        updated: false,
        hash: nextHash,
        reason: reason || 'manual',
        sourceUrl: usedUrl
      };
    }

    fs.mkdirSync(liveWebDir, { recursive: true });
    const tmpIndex = liveIndexPath + '.tmp';
    fs.writeFileSync(tmpIndex, transformed, 'utf8');
    fs.renameSync(tmpIndex, liveIndexPath);

    const updatedAt = new Date().toISOString();
    writeLiveMeta({
      bundledHash: getBundledIndexHash(),
      liveHash: nextHash,
      updatedAt: updatedAt,
      sourceUrl: usedUrl
    });

    return {
      ok: true,
      status: 'updated',
      updated: true,
      hash: nextHash,
      updatedAt: updatedAt,
      reason: reason || 'manual',
      sourceUrl: usedUrl
    };
  })();

  try {
    return await inFlightSyncPromise;
  } finally {
    inFlightSyncPromise = null;
  }
}

async function performLiveRefresh(fromManual) {
  const result = await syncLiveHtmlFromCloud(fromManual ? 'manual' : 'auto');
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (result.ok) {
      mainWindow.webContents.reloadIgnoringCache();
    } else {
      mainWindow.webContents.send('main-action', 'live-refresh-status', {
        status: result.status,
        error: result.error,
        fromManualRefresh: Boolean(fromManual)
      });
    }
  }
  return result;
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      width: Math.max(960, Number(parsed.width) || 1366),
      height: Math.max(640, Number(parsed.height) || 840),
      isMaximized: Boolean(parsed.isMaximized)
    };
  } catch (e) {
    return { width: 1366, height: 840, isMaximized: true };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getNormalBounds();
    fs.writeFileSync(
      getWindowStatePath(),
      JSON.stringify({
        width: bounds.width,
        height: bounds.height,
        isMaximized: isMaximized
      }),
      'utf8'
    );
  } catch (e) {}
}

function startLocalWebServer() {
  return new Promise(function (resolve, reject) {
    const { liveWebDir, liveIndexPath, bundledWwwDir, bundledIndexPath } = getLiveWebPaths();
    const server = http.createServer(function (req, res) {
      const reqUrl = (req.url || '/').split('?')[0].split('#')[0];
      let relPath = decodeURIComponent(reqUrl === '/' ? '/index.html' : reqUrl);
      relPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');

      let filePath = '';
      if (relPath === path.sep + 'index.html' || relPath === 'index.html' || relPath === '/index.html') {
        filePath = fs.existsSync(liveIndexPath) ? liveIndexPath : bundledIndexPath;
      } else if (relPath === path.sep + 'native-bridge.js' || relPath === 'native-bridge.js' || relPath === '/native-bridge.js') {
        // Keep native Electron bridge aligned with desktop shell version
        filePath = path.join(bundledWwwDir, 'native-bridge.js');
      } else {
        const liveCandidate = path.join(liveWebDir, relPath);
        const bundledCandidate = path.join(bundledWwwDir, relPath);
        if (liveCandidate.startsWith(liveWebDir) && fs.existsSync(liveCandidate) && !fs.statSync(liveCandidate).isDirectory()) {
          filePath = liveCandidate;
        } else if (bundledCandidate.startsWith(bundledWwwDir) && fs.existsSync(bundledCandidate) && !fs.statSync(bundledCandidate).isDirectory()) {
          filePath = bundledCandidate;
        } else {
          filePath = fs.existsSync(liveIndexPath) ? liveIndexPath : bundledIndexPath;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, function (err, data) {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache'
        });
        res.end(data);
      });
    });

    server.on('error', function (err) {
      if (err && err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.on('listening', function () {
      const addr = server.address();
      localServer = server;
      localBaseUrl = 'http://127.0.0.1:' + addr.port + '/';
      resolve(localBaseUrl);
    });

    server.listen(PREFERRED_PORT, '127.0.0.1');
  });
}

function getAppIconPath(preferIco) {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, 'assets', 'icon-256.png');
  if (preferIco && process.platform === 'win32' && fs.existsSync(icoPath)) {
    return icoPath;
  }
  return fs.existsSync(pngPath) ? pngPath : icoPath;
}

async function triggerBackgroundUpdateCheck(force) {
  const now = Date.now();
  if (!force && now - lastAutoCheckAt < 30000) return null;
  lastAutoCheckAt = now;
  try {
    const res = await syncLiveHtmlFromCloud('auto');
    if (res && res.ok && res.updated && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-action', 'live-update-available', res);
    }
    return res;
  } catch (e) {
    return null;
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  triggerBackgroundUpdateCheck(false);
}

function updateTrayTooltip() {
  if (!tray) return;
  const suffix = unreadCount > 0 ? ' (' + unreadCount + ' notifikasi baru)' : ' (Online & Siaga)';
  tray.setToolTip('Antrian Gambar Estimator' + suffix);
}

function buildAppMenu() {
  const template = [
    {
      label: 'Aplikasi',
      submenu: [
        {
          label: 'Refresh & Cek Update HTML',
          accelerator: 'F5',
          click: function () {
            performLiveRefresh(true);
          }
        },
        {
          label: 'Muat Ulang Paksa (Tanpa Cache)',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: function () {
            performLiveRefresh(true);
          }
        },
        {
          label: 'Sinkronkan Data Sekarang',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: function () {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('main-action', 'force-sync');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Sembunyikan ke System Tray',
          accelerator: 'CmdOrCtrl+W',
          click: function () {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.hide();
            }
          }
        },
        {
          label: 'Keluar Aplikasi',
          accelerator: 'CmdOrCtrl+Q',
          click: function () {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Perbesar (Zoom In)', role: 'zoomIn' },
        { label: 'Perkecil (Zoom Out)', role: 'zoomOut' },
        { label: 'Ukuran Normal (100%)', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Layar Penuh', role: 'togglefullscreen' },
        { label: 'Developer Tools', role: 'toggleDevTools', visible: !app.isPackaged }
      ]
    },
    {
      label: 'Bantuan',
      submenu: [
        {
          label: 'Buka Folder Unduhan',
          click: function () {
            shell.openPath(app.getPath('downloads'));
          }
        },
        {
          label: 'Tes Notifikasi & Suara',
          click: function () {
            showMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('main-action', 'test-notif');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Tentang Antrian Gambar Estimator',
          click: function () {
            const meta = readLiveMeta();
            const liveInfo = meta && meta.updatedAt
              ? '\nPembaruan HTML Live terakhir: ' + meta.updatedAt
              : '\nMode HTML Live Auto-Update saat Refresh aktif.';
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Tentang Aplikasi',
              message: 'Antrian Gambar Estimator & Admin Kontrak',
              detail:
                'Versi Desktop Windows ' +
                app.getVersion() +
                '\nPortal operasional terintegrasi Sales, Estimator & Admin Kontrak dengan sinkronisasi Google Spreadsheet, Google Drive, System Tray real-time, dan Live Update HTML saat Refresh.' +
                liveInfo
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(
    fs.existsSync(trayIconPath) ? trayIconPath : getAppIconPath(false)
  );
  tray = new Tray(icon);
  updateTrayTooltip();

  function refreshTrayMenu() {
    let openAtLogin = false;
    try {
      openAtLogin = Boolean(app.getLoginItemSettings().openAtLogin);
    } catch (e) {}

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Buka Antrian Gambar Estimator',
        click: function () {
          showMainWindow();
        }
      },
      {
        label: 'Refresh & Cek Update HTML',
        click: function () {
          showMainWindow();
          performLiveRefresh(true);
        }
      },
      {
        label: 'Sinkronisasi Data Sekarang',
        click: function () {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('main-action', 'force-sync');
          }
        }
      },
      {
        label: 'Tes Notifikasi & Suara',
        click: function () {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('main-action', 'test-notif');
          }
        }
      },
      {
        label: 'Buka Folder Unduhan',
        click: function () {
          shell.openPath(app.getPath('downloads'));
        }
      },
      { type: 'separator' },
      {
        label: 'Jalankan Otomatis Saat Windows Menyala',
        type: 'checkbox',
        checked: openAtLogin,
        enabled: app.isPackaged,
        click: function (item) {
          try {
            app.setLoginItemSettings({ openAtLogin: item.checked });
          } catch (e) {}
          refreshTrayMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Keluar Aplikasi (Tutup Total)',
        click: function () {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  }

  refreshTrayMenu();
  tray.on('click', function () {
    showMainWindow();
  });
  tray.on('double-click', function () {
    showMainWindow();
  });
}

function getUniqueDownloadPath(downloadsDir, fileName) {
  const safeName = (fileName || 'Dokumen_Antrian_Estimator')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim() || 'Dokumen_Antrian_Estimator';
  const parsed = path.parse(safeName);
  let candidate = path.join(downloadsDir, safeName);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(downloadsDir, parsed.name + ' (' + counter + ')' + parsed.ext);
    counter++;
  }
  return candidate;
}

function createMainWindow() {
  const winState = loadWindowState();
  mainWindow = new BrowserWindow({
    width: winState.width,
    height: winState.height,
    minWidth: 960,
    minHeight: 620,
    title: APP_TITLE,
    icon: getAppIconPath(true),
    backgroundColor: '#f1f5f9',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  if (winState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', function () {
    triggerBackgroundUpdateCheck(false);
  });

  mainWindow.webContents.on('before-input-event', function (event, input) {
    if (input && input.type === 'keyDown') {
      const keyLower = (input.key || '').toLowerCase();
      if (input.key === 'F5' || ((input.control || input.meta) && keyLower === 'r')) {
        event.preventDefault();
        performLiveRefresh(true);
      }
    }
  });

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('focus', function () {
    mainWindow.flashFrame(false);
    triggerBackgroundUpdateCheck(false);
  });

  mainWindow.on('close', function (event) {
    saveWindowState();
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (!hasShownTrayHint && Notification.isSupported()) {
        hasShownTrayHint = true;
        try {
          const hint = new Notification({
            title: 'Antrian Gambar Estimator Berjalan di System Tray',
            body: 'Aplikasi tetap memantau antrian, chat & notifikasi real-time di latar belakang.',
            icon: getAppIconPath(false),
            silent: true
          });
          hint.on('click', showMainWindow);
          hint.show();
        } catch (e) {}
      }
    }
  });

  // External Google Drive / Sheets links open cleanly in default Windows browser
  mainWindow.webContents.setWindowOpenHandler(function (details) {
    const targetUrl = details && details.url ? details.url : '';
    if (targetUrl && /^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith(localBaseUrl)) {
      shell.openExternal(targetUrl);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', function (event, url) {
    if (url && !url.startsWith(localBaseUrl) && !url.startsWith('blob:') && !url.startsWith('data:')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
    }
  });

  // Handle permissions automatically for local app origin
  const ses = mainWindow.webContents.session;
  ses.setPermissionRequestHandler(function (webContents, permission, callback) {
    if (
      permission === 'notifications' ||
      permission === 'media' ||
      permission === 'clipboard-read' ||
      permission === 'clipboard-sanitized-write'
    ) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Save CSV / PDF / Drive downloads seamlessly to Windows Downloads folder
  ses.on('will-download', function (_event, item) {
    const downloadsDir = app.getPath('downloads');
    const savePath = getUniqueDownloadPath(downloadsDir, item.getFilename());
    item.setSavePath(savePath);
    item.once('done', function (_e, state) {
      if (state === 'completed' && Notification.isSupported()) {
        try {
          const dlNotif = new Notification({
            title: 'Unduhan Selesai',
            body: path.basename(savePath) + ' tersimpan di folder Downloads. Klik untuk membuka.',
            icon: getAppIconPath(false),
            silent: true
          });
          dlNotif.on('click', function () {
            shell.showItemInFolder(savePath);
          });
          dlNotif.show();
        } catch (err) {}
      }
    });
  });

  mainWindow.loadURL(localBaseUrl);
}

app.on('second-instance', function () {
  showMainWindow();
});

app.whenReady().then(async function () {
  ensureLiveCacheMatchesBinary();
  await startLocalWebServer();
  buildAppMenu();
  createTray();
  createMainWindow();
});

app.on('before-quit', function () {
  isQuitting = true;
  saveWindowState();
  if (localServer) {
    try {
      localServer.close();
    } catch (e) {}
  }
});

app.on('window-all-closed', function () {
  if (isQuitting) {
    app.quit();
  }
});

ipcMain.on('show-notification', function (_event, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }
    if (!Notification.isSupported()) return;
    const n = new Notification({
      title: String((payload && payload.title) || 'Notifikasi Antrian Gambar Estimator'),
      body: String((payload && payload.message) || 'Ada pembaruan data baru.'),
      icon: getAppIconPath(false),
      silent: true
    });
    n.on('click', function () {
      showMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('main-action', 'notif-click', payload || {});
      }
    });
    n.show();
  } catch (e) {}
});

ipcMain.on('open-external', function (_event, targetUrl) {
  if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
    shell.openExternal(targetUrl);
  }
});

ipcMain.on('set-unread-count', function (_event, count) {
  unreadCount = Math.max(0, Number(count) || 0);
  updateTrayTooltip();
});

ipcMain.on('sync-config', function () {
  // Reserved for future background daemon telemetry
});

ipcMain.handle('check-live-update', async function () {
  return await syncLiveHtmlFromCloud('manual-check');
});

ipcMain.handle('check-and-refresh', async function () {
  return await performLiveRefresh(true);
});

ipcMain.handle('get-live-update-status', function () {
  const { liveIndexPath } = getLiveWebPaths();
  return {
    usingLiveCache: fs.existsSync(liveIndexPath),
    activeHash: getCurrentActiveHtmlHash(),
    meta: readLiveMeta(),
    primaryUrl: LIVE_HTML_PRIMARY_URL,
    fallbackUrl: LIVE_HTML_FALLBACK_URL
  };
});
