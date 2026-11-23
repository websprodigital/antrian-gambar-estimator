(function () {
  'use strict';

  const desktopBridge = (typeof window !== 'undefined' && window.EstimatorDesktop) ? window.EstimatorDesktop : null;
  const androidBridge = (typeof window !== 'undefined' && window.EstimatorAndroid) ? window.EstimatorAndroid : null;
  const isCapacitorNative = Boolean(
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  );

  const isDesktopApp = Boolean(desktopBridge);
  const isMobileApp = Boolean(androidBridge || isCapacitorNative);
  const isNativeApp = isDesktopApp || isMobileApp;

  window.__ESTIMATOR_NATIVE_ENV = {
    isNativeApp: isNativeApp,
    isDesktopApp: isDesktopApp,
    isMobileApp: isMobileApp,
    platform: isDesktopApp ? 'windows' : (isMobileApp ? 'android' : 'web')
  };

  if (typeof document !== 'undefined' && document.documentElement) {
    if (isDesktopApp) {
      document.documentElement.classList.add('is-native-app', 'is-desktop-app', 'is-windows-app');
    } else if (isMobileApp) {
      document.documentElement.classList.add('is-native-app', 'is-mobile-app', 'is-android-app');
    }
  }

  // Inject subtle native safe-area & desktop ergonomics CSS
  if (isNativeApp && typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.id = 'estimatorNativeBridgeStyles';
    styleEl.textContent = `
      html, body {
        overscroll-behavior-y: contain;
      }
      .is-mobile-app .top-header {
        padding-top: max(0.45rem, env(safe-area-inset-top)) !important;
      }
      .is-mobile-app .sticky-chat-proyek-btn {
        bottom: max(16px, calc(12px + env(safe-area-inset-bottom))) !important;
      }
      .is-mobile-app #btnModalInstallPwa,
      .is-desktop-app #btnModalInstallPwa {
        display: none !important;
      }
      .is-desktop-app ::-webkit-scrollbar {
        width: 9px;
        height: 9px;
      }
      .is-desktop-app ::-webkit-scrollbar-thumb {
        background: #94a3b8;
        border-radius: 999px;
      }
      .is-desktop-app ::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      .native-offline-banner {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        background: #b91c1c;
        color: #ffffff;
        font-size: 0.74rem;
        font-weight: 700;
        padding: 0.3rem 0.9rem;
        border-radius: 0 0 10px 10px;
        z-index: 1000000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        display: none;
        align-items: center;
        gap: 0.4rem;
      }
      .native-offline-banner.visible {
        display: inline-flex;
      }
    `;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  if (!isNativeApp) {
    return;
  }

  // Polyfill Notification API on Android WebView so web code treats OS notification support as available
  if (isMobileApp && typeof window.Notification === 'undefined') {
    const FakeNotification = function (title, opts) {
      if (androidBridge && typeof androidBridge.showNotification === 'function') {
        const o = opts || {};
        const n = (o.data && o.data.notif) ? o.data.notif : {};
        androidBridge.showNotification(
          String(o.tag || n.id || ('NTF-' + Date.now())),
          String(title || 'Antrian Gambar Estimator'),
          String(o.body || n.message || ''),
          String(n.eventType || 'sales_form_new'),
          Boolean(o.silent),
          String(n.queueCode || '')
        );
      }
    };
    Object.defineProperty(FakeNotification, 'permission', {
      get: function () {
        if (androidBridge && typeof androidBridge.hasNotificationPermission === 'function') {
          return androidBridge.hasNotificationPermission() ? 'granted' : 'default';
        }
        return 'granted';
      }
    });
    FakeNotification.requestPermission = async function () {
      if (androidBridge && typeof androidBridge.requestNotificationPermission === 'function') {
        androidBridge.requestNotificationPermission();
      }
      return 'granted';
    };
    window.Notification = FakeNotification;
  }

  // Track foreground/active state accurately across platforms
  window.__nativeAppInForeground = !document.hidden;
  document.addEventListener('visibilitychange', function () {
    window.__nativeAppInForeground = !document.hidden;
  });
  window.addEventListener('focus', function () {
    window.__nativeAppInForeground = true;
  });
  window.addEventListener('blur', function () {
    window.__nativeAppInForeground = false;
  });

  // Override getDeviceSummary to identify Windows Desktop / Mobile App clearly in History & Users_Profiles
  if (typeof window.getDeviceSummary === 'function') {
    const origGetDeviceSummary = window.getDeviceSummary;
    window.getDeviceSummary = function () {
      const base = origGetDeviceSummary.apply(this, arguments);
      if (isDesktopApp) {
        return 'Aplikasi Windows Desktop (' + (base || 'Windows') + ')';
      }
      if (isMobileApp) {
        return 'Aplikasi Mobile Android (' + (base || 'Android') + ')';
      }
      return base;
    };
  }

  // Sync polling configuration to native background worker / tray
  function pushConfigToNativeHost() {
    try {
      const apiUrl = (typeof window.getEffectiveCloudNotifUrl === 'function')
        ? window.getEffectiveCloudNotifUrl()
        : ((typeof window.getGoogleScriptUrl === 'function') ? window.getGoogleScriptUrl() : '');
      const muted = (typeof window.isNotificationSoundMuted === 'function') ? window.isNotificationSoundMuted() : false;
      let baselineMs = Date.now() - 120000;
      try {
        const stored = Number(localStorage.getItem('ESTIMATOR_NOTIF_BASELINE_MS_V1') || '0');
        if (stored > 0) baselineMs = stored;
      } catch (e) {}
      let seenIds = [];
      try {
        const rawSeen = localStorage.getItem('ESTIMATOR_SEEN_NOTIF_IDS_V1');
        if (rawSeen) {
          const arr = JSON.parse(rawSeen);
          if (Array.isArray(arr)) seenIds = arr.slice(-250);
        }
      } catch (e) {}

      const payload = {
        apiUrl: String(apiUrl || ''),
        baselineMs: baselineMs,
        soundMuted: Boolean(muted),
        seenIds: seenIds
      };

      if (desktopBridge && typeof desktopBridge.syncConfig === 'function') {
        desktopBridge.syncConfig(payload);
      }
      if (androidBridge && typeof androidBridge.syncConfig === 'function') {
        androidBridge.syncConfig(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  if (typeof window.syncConfigToServiceWorker === 'function') {
    const origSyncSw = window.syncConfigToServiceWorker;
    window.syncConfigToServiceWorker = function () {
      try { origSyncSw.apply(this, arguments); } catch (e) {}
      pushConfigToNativeHost();
    };
  }

  // Wrap dispatchBrowserOsNotification so native OS Toast / Android Status Bar notification always triggers
  const origDispatchOsNotif = (typeof window.dispatchBrowserOsNotification === 'function')
    ? window.dispatchBrowserOsNotification
    : null;

  window.dispatchBrowserOsNotification = function (notif) {
    if (!notif) return;
    const muted = (typeof window.isNotificationSoundMuted === 'function') ? window.isNotificationSoundMuted() : false;
    const idStr = String(notif.id || ('NTF-' + Date.now()));
    const titleStr = String(notif.title || 'Notifikasi Antrian Gambar Estimator');
    const msgStr = String(notif.message || 'Ada pembaruan data baru.');
    const eventTypeStr = String(notif.eventType || 'sales_form_new');
    const queueCodeStr = String(notif.queueCode || '');
    const isTestNotif = idStr.startsWith('TEST-');

    if (desktopBridge && typeof desktopBridge.notify === 'function') {
      // Show Windows Desktop Toast when window is unfocused/minimized/in tray, or for explicit test notifications
      const shouldToast = isTestNotif || document.hidden || !document.hasFocus();
      if (shouldToast) {
        desktopBridge.notify({
          id: idStr,
          title: titleStr,
          message: msgStr,
          eventType: eventTypeStr,
          queueCode: queueCodeStr,
          muted: Boolean(muted),
          timestamp: String(notif.timestamp || '')
        });
      }
      return;
    }

    if (androidBridge && typeof androidBridge.showNotification === 'function') {
      const shouldShowShade = isTestNotif || document.hidden || !window.__nativeAppInForeground;
      if (shouldShowShade) {
        androidBridge.showNotification(idStr, titleStr, msgStr, eventTypeStr, Boolean(muted), queueCodeStr);
      }
      return;
    }

    if (origDispatchOsNotif) {
      origDispatchOsNotif.apply(this, arguments);
    }
  };

  // Wrap enableBrowserNotificationAndAudio for native permission + test
  if (typeof window.enableBrowserNotificationAndAudio === 'function') {
    const origEnable = window.enableBrowserNotificationAndAudio;
    window.enableBrowserNotificationAndAudio = async function () {
      try { localStorage.setItem('ESTIMATOR_NOTIF_SOUND_MUTED_V1', '0'); } catch (e) {}
      if (typeof window.unlockNotificationAudio === 'function') {
        window.unlockNotificationAudio();
      }
      if (androidBridge) {
        if (typeof androidBridge.requestNotificationPermission === 'function') {
          androidBridge.requestNotificationPermission();
        }
        if (typeof window.playNotificationSound === 'function') {
          window.playNotificationSound('estimator_edit');
        }
        window.dispatchBrowserOsNotification({
          id: 'TEST-PERM-' + Date.now(),
          eventType: 'sales_form_new',
          title: 'Notifikasi Aplikasi Mobile Aktif',
          message: 'Notifikasi dan suara MP3 siap memberi peringatan pembaruan proyek.',
          queueCode: 'SYSTEM'
        });
        if (typeof window.updateNotificationControlButtons === 'function') {
          window.updateNotificationControlButtons();
        }
        if (typeof window.showSpreadsheetSyncToast === 'function') {
          window.showSpreadsheetSyncToast('Notifikasi Aplikasi Android & Suara MP3 Aktif!');
        }
        pushConfigToNativeHost();
        return;
      }

      if (desktopBridge) {
        if (typeof window.playNotificationSound === 'function') {
          window.playNotificationSound('estimator_edit');
        }
        window.dispatchBrowserOsNotification({
          id: 'TEST-PERM-' + Date.now(),
          eventType: 'sales_form_new',
          title: 'Notifikasi Windows Desktop Aktif',
          message: 'Pop-up Windows, suara MP3, dan System Tray siap memantau antrian secara real-time.',
          queueCode: 'SYSTEM'
        });
        if (typeof window.updateNotificationControlButtons === 'function') {
          window.updateNotificationControlButtons();
        }
        if (typeof window.showSpreadsheetSyncToast === 'function') {
          window.showSpreadsheetSyncToast('Notifikasi Windows Desktop & System Tray Aktif!');
        }
        pushConfigToNativeHost();
        return;
      }

      return origEnable.apply(this, arguments);
    };
  }

  // Wrap updateNotificationControlButtons so native status pills reflect native app status
  if (typeof window.updateNotificationControlButtons === 'function') {
    const origUpdateBtns = window.updateNotificationControlButtons;
    window.updateNotificationControlButtons = function () {
      origUpdateBtns.apply(this, arguments);

      const headerOsBtn = document.getElementById('btnHeaderRequestOsNotif');
      const headerOsText = document.getElementById('headerOsNotifText');
      const modalOsBtn = document.getElementById('btnModalRequestOsNotif');
      const bgStatusText = document.getElementById('notifBgStatusText');
      const bgStatusPill = document.getElementById('notifBgStatusPill');
      const installBtn = document.getElementById('btnModalInstallPwa');

      if (installBtn) {
        installBtn.style.display = 'none';
      }

      const permGranted = isDesktopApp ||
        (androidBridge && typeof androidBridge.hasNotificationPermission === 'function'
          ? androidBridge.hasNotificationPermission()
          : true);

      if (permGranted) {
        if (headerOsBtn) headerOsBtn.classList.add('granted');
        if (headerOsText) {
          headerOsText.textContent = isDesktopApp ? 'Notif Windows Aktif' : 'Notif Aplikasi Aktif';
        }
        if (modalOsBtn) {
          modalOsBtn.classList.add('granted');
          modalOsBtn.textContent = isDesktopApp ? '✅ Notif Windows Desktop Aktif' : '✅ Notif Aplikasi Android Aktif';
        }
        if (bgStatusPill && bgStatusText) {
          bgStatusPill.style.background = '#dcfce7';
          bgStatusPill.style.color = '#166534';
          bgStatusPill.style.borderColor = '#86efac';
          bgStatusText.textContent = isDesktopApp
            ? '🟢 Aplikasi Windows Desktop: Notifikasi, Suara MP3 & System Tray Latar Belakang Aktif'
            : '🟢 Aplikasi Mobile Android: Notifikasi & Suara MP3 Real-Time Aktif';
        }
      } else {
        if (headerOsBtn) headerOsBtn.classList.remove('granted');
        if (headerOsText) headerOsText.textContent = 'Izinkan Notif HP';
        if (modalOsBtn) {
          modalOsBtn.classList.remove('granted');
          modalOsBtn.textContent = '🔔 Izinkan Notifikasi Aplikasi';
        }
      }

      if (desktopBridge && typeof desktopBridge.setUnreadCount === 'function') {
        const badgeEl = document.getElementById('headerNotifBadge');
        const txt = badgeEl ? (badgeEl.textContent || '0') : '0';
        const num = badgeEl && badgeEl.style.display !== 'none' ? (parseInt(txt, 10) || 1) : 0;
        desktopBridge.setUnreadCount(num);
      }
    };
  }

  // Intercept window.open so Drive/Sheets links open cleanly in system browser / Google Drive app
  const origWindowOpen = window.open ? window.open.bind(window) : null;
  window.open = function (url, target, features) {
    const urlStr = url ? String(url).trim() : '';
    if (urlStr && /^https?:\/\//i.test(urlStr)) {
      if (desktopBridge && typeof desktopBridge.openExternal === 'function') {
        desktopBridge.openExternal(urlStr);
        return null;
      }
      if (androidBridge && typeof androidBridge.openExternal === 'function') {
        androidBridge.openExternal(urlStr);
        return null;
      }
    }
    return origWindowOpen ? origWindowOpen(url, target, features) : null;
  };

  // Android-specific blob:/data: download & external link interception
  function handleAndroidAnchorAction(anchor) {
    if (!anchor || !androidBridge) return false;
    const rawHref = anchor.getAttribute('href') || anchor.href || '';
    if (!rawHref || rawHref === '#') return false;
    const hasDownload = anchor.hasAttribute('download');
    const fileName = anchor.getAttribute('download') || 'Dokumen_Antrian_Estimator';

    if (rawHref.startsWith('data:')) {
      if (typeof androidBridge.saveBase64File === 'function') {
        androidBridge.saveBase64File(rawHref, fileName, '');
        return true;
      }
    } else if (rawHref.startsWith('blob:')) {
      if (typeof androidBridge.saveBase64File === 'function') {
        fetch(rawHref)
          .then(function (r) { return r.blob(); })
          .then(function (blob) {
            const reader = new FileReader();
            reader.onload = function () {
              androidBridge.saveBase64File(String(reader.result || ''), fileName, blob.type || 'application/octet-stream');
            };
            reader.readAsDataURL(blob);
          })
          .catch(function () {
            if (typeof window.showSpreadsheetSyncToast === 'function') {
              window.showSpreadsheetSyncToast('Gagal membaca berkas unduhan.');
            }
          });
        return true;
      }
    } else if (hasDownload && /^https?:\/\//i.test(rawHref)) {
      if (typeof androidBridge.downloadUrl === 'function') {
        androidBridge.downloadUrl(rawHref, fileName);
        return true;
      }
    } else if (anchor.getAttribute('target') === '_blank' && /^https?:\/\//i.test(rawHref)) {
      if (typeof androidBridge.openExternal === 'function') {
        androidBridge.openExternal(rawHref);
        return true;
      }
    }
    return false;
  }

  if (isMobileApp && androidBridge) {
    const origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (handleAndroidAnchorAction(this)) {
        return;
      }
      return origAnchorClick.apply(this, arguments);
    };

    document.addEventListener('click', function (ev) {
      const target = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (target && handleAndroidAnchorAction(target)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
  }

  if (isDesktopApp && desktopBridge) {
    document.addEventListener('click', function (ev) {
      const target = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (!target) return;
      const rawHref = target.getAttribute('href') || '';
      if (
        !target.hasAttribute('download') &&
        target.getAttribute('target') === '_blank' &&
        /^https?:\/\//i.test(rawHref) &&
        !rawHref.startsWith(window.location.origin)
      ) {
        ev.preventDefault();
        ev.stopPropagation();
        desktopBridge.openExternal(rawHref);
      }
    }, true);
  }

  // Handler when user clicks a native notification (Windows Toast or Android Notification)
  window.__estimatorOnNativeNotifClick = function (payload) {
    try {
      if (typeof window.clearUnreadNotificationBadge === 'function') {
        window.clearUnreadNotificationBadge();
      }
      const p = (typeof payload === 'string') ? JSON.parse(payload) : (payload || {});
      if (p && p.eventType === 'project_chat' && p.queueCode && typeof window.openNotesHistoryModal === 'function') {
        window.openNotesHistoryModal(p.queueCode, 'chat');
      } else if (typeof window.openNotificationFeedModal === 'function') {
        window.openNotificationFeedModal();
      }
      if (window.currentUser && typeof window.syncFromGoogleSpreadsheet === 'function') {
        window.syncFromGoogleSpreadsheet(true);
      }
    } catch (e) {
      if (typeof window.openNotificationFeedModal === 'function') {
        window.openNotificationFeedModal();
      }
    }
  };

  // Sync trigger callable from Electron System Tray or Android lifecycle
  window.__estimatorForceSyncNow = function () {
    if (typeof window.pollCloudNotifications === 'function') {
      window.pollCloudNotifications();
    }
    if (window.currentUser && typeof window.syncFromGoogleSpreadsheet === 'function') {
      window.syncFromGoogleSpreadsheet(false);
    }
  };

  // Android Hardware Back Button state machine
  window.__estimatorHandleAndroidBack = function () {
    try {
      const tautkanDrawer = document.getElementById('chatTautkanDrawer');
      const chatModal = document.getElementById('modalNotesHistory');
      if (chatModal && chatModal.classList.contains('open') && tautkanDrawer && tautkanDrawer.style.display !== 'none') {
        if (typeof window.toggleChatTautkanDrawer === 'function') {
          window.toggleChatTautkanDrawer(false);
          return 'handled';
        }
      }

      const openModals = document.querySelectorAll('.modal-backdrop.open');
      if (openModals.length > 0) {
        const topModal = openModals[openModals.length - 1];
        if (topModal && topModal.id && typeof window.closeModal === 'function') {
          window.closeModal(topModal.id);
        } else if (topModal) {
          topModal.classList.remove('open');
        }
        return 'handled';
      }

      const sidebar = document.getElementById('sidebarMenu');
      if (sidebar && sidebar.classList.contains('mobile-open')) {
        if (typeof window.closeMobileSidebar === 'function') {
          window.closeMobileSidebar();
        } else {
          sidebar.classList.remove('mobile-open');
        }
        return 'handled';
      }

      const loginScreen = document.getElementById('loginScreen');
      const loginVisible = loginScreen && loginScreen.style.display !== 'none';
      if (!loginVisible) {
        const activePane = document.querySelector('.page-tab-pane.active');
        if (activePane && activePane.id !== 'pane-dashboard' && typeof window.switchNavPane === 'function') {
          window.switchNavPane('pane-dashboard');
          return 'handled';
        }
      }
    } catch (e) {}
    return 'exit_prompt';
  };

  // Show non-blocking offline indicator banner when device loses internet
  window.addEventListener('DOMContentLoaded', function () {
    try {
      const banner = document.createElement('div');
      banner.id = 'nativeOfflineBanner';
      banner.className = 'native-offline-banner';
      banner.innerHTML = '<span>📡</span><span>Mode Offline — Menampilkan data cache lokal, sinkronisasi otomatis saat online</span>';
      document.body.appendChild(banner);

      const syncOnlineBanner = function () {
        banner.classList.toggle('visible', navigator.onLine === false);
      };
      window.addEventListener('online', syncOnlineBanner);
      window.addEventListener('offline', syncOnlineBanner);
      syncOnlineBanner();

      if (desktopBridge && typeof desktopBridge.onMainAction === 'function') {
        desktopBridge.onMainAction(function (action, data) {
          if (action === 'notif-click') {
            window.__estimatorOnNativeNotifClick(data);
          } else if (action === 'force-sync') {
            window.__estimatorForceSyncNow();
          } else if (action === 'test-notif') {
            if (typeof window.testNotificationAndSound === 'function') {
              window.testNotificationAndSound();
            }
          }
        });
      }

      setTimeout(function () {
        if (typeof window.updateNotificationControlButtons === 'function') {
          window.updateNotificationControlButtons();
        }
        pushConfigToNativeHost();
      }, 600);
    } catch (e) {}
  });
})();
