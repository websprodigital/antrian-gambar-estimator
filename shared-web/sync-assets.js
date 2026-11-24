#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const targets = [
  path.join(repoRoot, 'mobile-app', 'www'),
  path.join(repoRoot, 'windows-app', 'www')
];

const rootAssets = [
  'logo.png',
  'app-icon-192.png',
  'app-icon-512.png',
  'app-icon-maskable-512.png',
  'favicon.png',
  'notif_sound.mp3',
  'manifest.webmanifest',
  'sw.js'
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildInjectedHtml(rawHtml) {
  let html = rawHtml;
  // Ensure viewport-fit=cover for mobile notch / safe-area handling
  html = html.replace(
    /<meta name="viewport" content="([^"]*)">/i,
    function (_, content) {
      if (content.includes('viewport-fit=cover')) return '<meta name="viewport" content="' + content + '">';
      return '<meta name="viewport" content="' + content + ', viewport-fit=cover">';
    }
  );
  // Inject native-bridge.js right before the closing </body>
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

const indexPath = path.join(repoRoot, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('index.html not found at:', indexPath);
  process.exit(1);
}

const rawIndexHtml = fs.readFileSync(indexPath, 'utf8');
const bundledHtml = buildInjectedHtml(rawIndexHtml);
const bridgeSrc = path.join(__dirname, 'native-bridge.js');

for (const targetDir of targets) {
  ensureDir(targetDir);
  fs.writeFileSync(path.join(targetDir, 'index.html'), bundledHtml, 'utf8');
  fs.copyFileSync(bridgeSrc, path.join(targetDir, 'native-bridge.js'));
  for (const asset of rootAssets) {
    const srcFile = path.join(repoRoot, asset);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(targetDir, asset));
    }
  }
  console.log('Synced web assets to:', targetDir);
}
