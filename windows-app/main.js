const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  shell,
  dialog,
  nativeImage
} = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP_ID = 'com.websprodigital.antrianestimator';
const APP_TITLE = 'Antrian Gambar Estimator | Portal Operasional Proyek';
const PREFERRED_PORT = 48271;

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
    const wwwDir = path.join(__dirname, 'www');
    const server = http.createServer(function (req, res) {
      const reqUrl = (req.url || '/').split('?')[0].split('#')[0];
      let relPath = decodeURIComponent(reqUrl === '/' ? '/index.html' : reqUrl);
      relPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
      let filePath = path.join(wwwDir, relPath);

      if (!filePath.startsWith(wwwDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(wwwDir, 'index.html');
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
          'Cache-Control': 'no-cache'
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
          label: 'Sinkronkan Data Sekarang',
          accelerator: 'F5',
          click: function () {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('main-action', 'force-sync');
            }
          }
        },
        {
          label: 'Muat Ulang Tampilan',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: function () {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.reload();
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
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Tentang Aplikasi',
              message: 'Antrian Gambar Estimator & Admin Kontrak',
              detail:
                'Versi Desktop Windows ' +
                app.getVersion() +
                '\nPortal operasional terintegrasi Sales, Estimator & Admin Kontrak dengan sinkronisasi Google Spreadsheet, Google Drive, dan notifikasi System Tray real-time.'
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

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('focus', function () {
    mainWindow.flashFrame(false);
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
