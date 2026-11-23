// Service Worker Notifikasi Latar Belakang & Tab Tertutup (Komputer & Handphone) — v3 Logo A Estimator
// Mendukung Web Push (VAPID), Periodic Background Sync, Background Sync, dan OS Sound/Vibration
const SW_DB_NAME = 'EstimatorSwNotifStore_v1';
const SW_STORE_NAME = 'kv';
const NOTIF_ICON_URL = 'app-icon-192.png';

function openSwDb() {
  return new Promise(function(resolve, reject) {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(SW_DB_NAME, 1);
    req.onupgradeneeded = function(ev) {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(SW_STORE_NAME)) {
        db.createObjectStore(SW_STORE_NAME);
      }
    };
    req.onsuccess = function(ev) { resolve(ev.target.result); };
    req.onerror = function() { reject(req.error || new Error('SW DB error')); };
  });
}

async function swKvGet(key, fallbackVal) {
  try {
    const db = await openSwDb();
    return await new Promise(function(resolve) {
      const tx = db.transaction(SW_STORE_NAME, 'readonly');
      const req = tx.objectStore(SW_STORE_NAME).get(key);
      req.onsuccess = function() { resolve(req.result !== undefined ? req.result : fallbackVal); };
      req.onerror = function() { resolve(fallbackVal); };
    });
  } catch (e) {
    return fallbackVal;
  }
}

async function swKvSet(key, val) {
  try {
    const db = await openSwDb();
    return await new Promise(function(resolve) {
      const tx = db.transaction(SW_STORE_NAME, 'readwrite');
      tx.objectStore(SW_STORE_NAME).put(val, key);
      tx.oncomplete = function() { resolve(true); };
      tx.onerror = function() { resolve(false); };
    });
  } catch (e) {
    return false;
  }
}

function getSwNotifLabel(eventType) {
  if (eventType === 'sales_form_new') return 'Form Gambar Proyek';
  if (eventType === 'sales_form_edit') return 'Edit Perubahan Sales';
  if (eventType === 'estimator_edit') return 'Kelola Estimasi';
  if (eventType === 'contract_edit') return 'Penawaran Admin Kontrak';
  if (eventType === 'project_chat') return 'Chat Catatan Proyek';
  return 'Aktivitas Proyek';
}

async function hasSwSeenId(id) {
  if (!id) return false;
  const arr = await swKvGet('seenIds', []);
  return Array.isArray(arr) && arr.indexOf(String(id)) !== -1;
}

async function markSwSeenIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const cur = await swKvGet('seenIds', []);
  const set = new Set(Array.isArray(cur) ? cur.map(String) : []);
  ids.forEach(function(id) {
    if (id) set.add(String(id));
  });
  await swKvSet('seenIds', Array.from(set).slice(-350));
}

async function displayBackgroundOsNotification(notif, originClients) {
  if (!notif || typeof self.registration === 'undefined' || !self.registration.showNotification) return;
  const soundMuted = await swKvGet('soundMuted', false);
  const eventType = String(notif.eventType || 'sales_form_new');
  const title = String(notif.title || ('Notifikasi ' + getSwNotifLabel(eventType)));
  const body = String(notif.message || 'Ada pembaruan data atau chat baru pada antrian estimator.');
  const targetUrl = String(notif.url || (self.registration && self.registration.scope ? self.registration.scope : './'));

  const opts = {
    body: body,
    icon: NOTIF_ICON_URL,
    badge: NOTIF_ICON_URL,
    tag: String(notif.id || ('NTF-' + Date.now())),
    renotify: true,
    silent: Boolean(soundMuted),
    vibrate: soundMuted ? undefined : [250, 100, 250, 100, 250],
    requireInteraction: true,
    timestamp: Number(notif.createdAtMs || Date.now()),
    data: {
      url: targetUrl,
      notif: notif
    }
  };

  try {
    await self.registration.showNotification(title, opts);
  } catch (err) {
    // Fallback minimal options if platform rejects custom fields
    await self.registration.showNotification(title, {
      body: body,
      tag: opts.tag,
      silent: Boolean(soundMuted),
      data: opts.data
    });
  }

  // Forward ke jendela/tab terbuka atau background tab agar audio custom NOTIFIKASI WEB ESTIMATOR.MP3 ikut berbunyi
  const clientsList = originClients || await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientsList.forEach(function(client) {
    try {
      client.postMessage({
        kind: 'SW_PUSH_NOTIFICATION',
        notif: notif
      });
    } catch (e) {}
  });
}

async function pollNotificationsInSw() {
  const cfg = await swKvGet('cloudConfig', null);
  const apiUrl = (cfg && cfg.apiUrl) ? String(cfg.apiUrl).trim() : '';
  if (!apiUrl || !apiUrl.startsWith('http')) return 0;

  const baselineMs = Number((cfg && cfg.baselineMs) || (Date.now() - 3600000));
  const sep = apiUrl.indexOf('?') !== -1 ? '&' : '?';
  const fetchUrl = apiUrl + sep + 'action=get_notifications&t=' + Date.now();

  try {
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res || !res.ok) return 0;
    const json = await res.json();
    if (!json || json.status !== 'success' || !Array.isArray(json.notifications)) return 0;

    const seenArr = await swKvGet('seenIds', []);
    const seenSet = new Set(Array.isArray(seenArr) ? seenArr.map(String) : []);
    const aliveClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasVisibleClient = aliveClients.some(function(c) { return c.visibilityState === 'visible'; });

    const ordered = json.notifications.slice().sort(function(a, b) {
      return Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0);
    });

    const newlyProcessedIds = [];
    let pushedCount = 0;

    let maxCreatedMs = baselineMs;
    for (let i = 0; i < ordered.length; i++) {
      const nt = ordered[i];
      if (!nt || !nt.id) continue;
      const nid = String(nt.id);
      if (seenSet.has(nid)) continue;
      const createdAtMs = Number(nt.createdAtMs || 0);
      if (createdAtMs > maxCreatedMs) maxCreatedMs = createdAtMs;
      if (createdAtMs < baselineMs) continue;

      seenSet.add(nid);
      newlyProcessedIds.push(nid);

      // Jika tab sedang tertutup (0 clients) atau di tab lain (tidak visible), Service Worker langsung tampilkan pop-up OS + getar + suara
      if (!hasVisibleClient) {
        await displayBackgroundOsNotification(nt, aliveClients);
        pushedCount++;
      } else {
        aliveClients.forEach(function(client) {
          try {
            client.postMessage({ kind: 'SW_PUSH_NOTIFICATION', notif: nt });
          } catch (e) {}
        });
      }
    }

    if (newlyProcessedIds.length > 0) {
      await markSwSeenIds(newlyProcessedIds);
      if (maxCreatedMs > baselineMs) {
        await swKvSet('cloudConfig', Object.assign({}, cfg, { baselineMs: maxCreatedMs }));
      }
    }
    return pushedCount;
  } catch (e) {
    return 0;
  }
}

self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  const data = (event && event.data) ? event.data : {};
  if (data.kind === 'SW_SYNC_CONFIG') {
    event.waitUntil((async function() {
      const prevCfg = await swKvGet('cloudConfig', {}) || {};
      const nextCfg = {
        apiUrl: (data.apiUrl !== undefined) ? String(data.apiUrl || '') : (prevCfg.apiUrl || ''),
        baselineMs: Number(data.baselineMs || prevCfg.baselineMs || (Date.now() - 120000))
      };
      await swKvSet('cloudConfig', nextCfg);
      if (typeof data.soundMuted === 'boolean') {
        await swKvSet('soundMuted', data.soundMuted);
      }
      if (Array.isArray(data.seenIds) && data.seenIds.length > 0) {
        await markSwSeenIds(data.seenIds);
      }
      if (data.pollNow === true) {
        await pollNotificationsInSw();
      }
    })());
  } else if (data.kind === 'SW_SHOW_OS_NOTIF' && data.notif) {
    event.waitUntil(displayBackgroundOsNotification(data.notif));
  } else if (data.kind === 'SW_POLL_NOW') {
    event.waitUntil(pollNotificationsInSw());
  }
});

// Web Push Event: WAKES UP Service Worker INSTANTLY EVEN WHEN ALL BROWSER TABS ARE CLOSED!
self.addEventListener('push', function(event) {
  event.waitUntil((async function() {
    let payload = null;
    try {
      if (event.data) {
        payload = event.data.json();
      }
    } catch (e) {
      try {
        const txt = event.data ? event.data.text() : '';
        if (txt) payload = { title: 'Notifikasi Antrian Estimator', message: txt, id: 'PUSH-' + Date.now() };
      } catch (e2) {}
    }

    if (!payload) {
      const polled = await pollNotificationsInSw();
      if (polled === 0) {
        await displayBackgroundOsNotification({
          id: 'PUSH-GEN-' + Date.now(),
          eventType: 'sales_form_new',
          title: 'Pembaruan Antrian Gambar Estimator',
          message: 'Ada aktivitas baru pada antrian gambar / chat proyek. Ketuk untuk membuka.',
          createdAtMs: Date.now()
        });
      }
      return;
    }

    const notifObj = (payload && payload.notification && typeof payload.notification === 'object')
      ? Object.assign({}, payload.notification)
      : Object.assign({}, payload || {});
    if (!notifObj.title && payload && payload.title) notifObj.title = payload.title;
    if (!notifObj.message && payload && payload.body) notifObj.message = payload.body;
    const nid = String(notifObj.id || payload.id || ('PUSH-' + Date.now()));
    notifObj.id = nid;

    const alreadySeen = await hasSwSeenId(nid);
    if (!alreadySeen) {
      await markSwSeenIds([nid]);
      await displayBackgroundOsNotification(notifObj);
    }
  })());
});

// Background Sync & Periodic Background Sync: Wakes up closed/minimized PWA periodically
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'estimator-notif-poll') {
    event.waitUntil(pollNotificationsInSw());
  }
});

self.addEventListener('sync', function(event) {
  if (event.tag === 'estimator-notif-sync' || event.tag === 'estimator-notif-poll') {
    event.waitUntil(pollNotificationsInSw());
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const notifData = (event.notification && event.notification.data && event.notification.data.notif) ? event.notification.data.notif : null;
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : (self.registration && self.registration.scope ? self.registration.scope : './');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.focus().catch(function() {});
          if (notifData) {
            try { client.postMessage({ kind: 'SW_NOTIF_CLICKED', notif: notifData }); } catch (e) {}
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
