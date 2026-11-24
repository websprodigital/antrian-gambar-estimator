(function () {
  'use strict';

  const desktopBridge = (typeof window !== 'undefined' && window.EstimatorDesktop) ? window.EstimatorDesktop : null;
  const androidBridge = (typeof window !== 'undefined' && window.EstimatorAndroid) ? window.EstimatorAndroid : null;
  const iosMessageHandler = (
    typeof window !== 'undefined' &&
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.EstimatorIOS
  ) ? window.webkit.messageHandlers.EstimatorIOS : null;
  const capPlatform = (
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.getPlatform === 'function'
  ) ? window.Capacitor.getPlatform() : '';
  const isCapacitorNative = Boolean(
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  );

  const isDesktopApp = Boolean(desktopBridge);
  const isIosApp = Boolean(!isDesktopApp && !androidBridge && (iosMessageHandler || (isCapacitorNative && capPlatform === 'ios')));
  const isMobileApp = Boolean(androidBridge || isIosApp || isCapacitorNative);
  const isNativeApp = isDesktopApp || isMobileApp;

  window.__ESTIMATOR_NATIVE_ENV = {
    isNativeApp: isNativeApp,
    isDesktopApp: isDesktopApp,
    isMobileApp: isMobileApp,
    platform: isDesktopApp ? 'windows' : (isIosApp ? 'ios' : (isMobileApp ? 'android' : 'web'))
  };

  if (typeof document !== 'undefined' && document.documentElement) {
    if (isDesktopApp) {
      document.documentElement.classList.add('is-native-app', 'is-desktop-app', 'is-windows-app');
    } else if (isIosApp) {
      document.documentElement.classList.add('is-native-app', 'is-mobile-app', 'is-ios-app');
    } else if (isMobileApp) {
      document.documentElement.classList.add('is-native-app', 'is-mobile-app', 'is-android-app');
    }
  }

  // Inject subtle native safe-area, desktop ergonomics, and Live Refresh UI CSS
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
      .btn-native-refresh {
        background: #eff6ff !important;
        border-color: #93c5fd !important;
        color: #1d4ed8 !important;
        position: relative;
      }
      .btn-native-refresh:hover {
        background: #dbeafe !important;
      }
      .btn-native-refresh.has-update {
        background: #ecfdf5 !important;
        border-color: #34d399 !important;
        color: #047857 !important;
      }
      .btn-native-refresh.is-loading .native-refresh-icon {
        display: inline-block;
        animation: nativeSpinRefresh 0.85s linear infinite;
      }
      .native-refresh-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #10b981;
        display: none;
      }
      .btn-native-refresh.has-update .native-refresh-dot {
        display: inline-block;
      }
      @keyframes nativeSpinRefresh {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .native-login-refresh-wrap,
      #btnLoginNativeRefresh {
        margin-top: 0.75rem;
        display: none !important;
        justify-content: center;
      }
      .native-live-update-banner {
        position: fixed;
        bottom: max(18px, calc(12px + env(safe-area-inset-bottom)));
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.55rem 0.75rem 0.55rem 0.95rem;
        border-radius: 999px;
        z-index: 9990;
        box-shadow: 0 10px 28px rgba(30, 58, 138, 0.35);
        display: none;
        align-items: center;
        gap: 0.6rem;
        max-width: calc(100vw - 24px);
      }
      .native-live-update-banner.visible {
        display: inline-flex;
      }
      body.chat-drawer-open .native-live-update-banner {
        display: none !important;
      }
      .native-live-update-btn {
        background: #ffffff;
        color: #1e3a8a;
        border: none;
        border-radius: 999px;
        padding: 0.28rem 0.72rem;
        font-size: 0.74rem;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }
      .native-live-update-close {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
        border: none;
        border-radius: 999px;
        width: 22px;
        height: 22px;
        font-size: 0.8rem;
        line-height: 1;
        cursor: pointer;
      }
      .native-pull-refresh-pill {
        position: fixed;
        top: max(10px, env(safe-area-inset-top));
        left: 50%;
        transform: translateX(-50%) translateY(-80px);
        background: #1e40af;
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.42rem 0.9rem;
        border-radius: 999px;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
        z-index: 1000002;
        transition: transform 0.15s ease;
        pointer-events: none;
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
      if (isIosApp) {
        return 'Aplikasi Mobile iOS (' + (base || 'iOS') + ')';
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
          modalOsBtn.textContent = isDesktopApp
            ? '✅ Notif Windows Desktop Aktif'
            : (isIosApp ? '✅ Notif Aplikasi iOS Aktif' : '✅ Notif Aplikasi Android Aktif');
        }
        if (bgStatusPill && bgStatusText) {
          bgStatusPill.style.background = '#dcfce7';
          bgStatusPill.style.color = '#166534';
          bgStatusPill.style.borderColor = '#86efac';
          bgStatusText.textContent = isDesktopApp
            ? '🟢 Aplikasi Windows Desktop: Notifikasi, Suara MP3 & System Tray Latar Belakang Aktif'
            : (isIosApp
              ? '🟢 Aplikasi Mobile iOS: Auto-Update HTML & Suara MP3 Aktif'
              : '🟢 Aplikasi Mobile Android: Notifikasi & Suara MP3 Real-Time Aktif');
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
      if (iosMessageHandler && typeof iosMessageHandler.postMessage === 'function') {
        iosMessageHandler.postMessage({ action: 'openExternal', url: urlStr });
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
      const chatModal = document.getElementById('modalNotesHistory');
      if (chatModal && chatModal.classList.contains('open')) {
        const liveCamOverlay = document.getElementById('chatLiveCameraOverlay');
        if (liveCamOverlay && (liveCamOverlay.classList.contains('open') || (liveCamOverlay.style.display && liveCamOverlay.style.display !== 'none'))) {
          if (typeof window.closeChatLiveCamera === 'function') {
            window.closeChatLiveCamera();
            return 'handled';
          }
        }
        const mediaViewer = document.getElementById('chatMediaInlineViewer');
        if (mediaViewer && (mediaViewer.classList.contains('open') || (mediaViewer.style.display && mediaViewer.style.display !== 'none'))) {
          if (typeof window.closeChatMediaViewer === 'function') {
            window.closeChatMediaViewer();
            return 'handled';
          }
        }
        const topReplyBar = document.getElementById('chatTopReplyActionBar');
        if (topReplyBar && (topReplyBar.classList.contains('visible') || topReplyBar.classList.contains('open') || (topReplyBar.style.display && topReplyBar.style.display !== 'none'))) {
          if (typeof window.clearChatSelectionMode === 'function') {
            window.clearChatSelectionMode();
            return 'handled';
          }
        }
        const camMenu = document.getElementById('chatCameraMenu');
        if (camMenu && (camMenu.classList.contains('open') || (camMenu.style.display && camMenu.style.display !== 'none'))) {
          if (typeof window.toggleChatCameraMenu === 'function') {
            window.toggleChatCameraMenu(false);
            return 'handled';
          }
        }
        const tautkanDrawer = document.getElementById('chatTautkanDrawer');
        if (tautkanDrawer && tautkanDrawer.style.display !== 'none' && tautkanDrawer.style.display !== '') {
          if (typeof window.toggleChatTautkanDrawer === 'function') {
            window.toggleChatTautkanDrawer(false);
            return 'handled';
          }
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

  // Live HTML Update & One-Tap Refresh helpers (Windows, Android & iOS)
  let refreshInProgress = false;
  let dismissedUpdateHash = '';

  function setRefreshButtonsLoading(loading) {
    refreshInProgress = Boolean(loading);
    const ids = ['btnNativeRefreshApp', 'btnLoginNativeRefresh'];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('is-loading', refreshInProgress);
      el.disabled = refreshInProgress;
      const lbl = el.querySelector('.native-refresh-label');
      if (lbl) {
        lbl.textContent = refreshInProgress
          ? 'Memeriksa...'
          : (id === 'btnLoginNativeRefresh' ? 'Refresh & Cek Update HTML' : 'Refresh');
      }
    });
  }

  function showLiveToast(msg) {
    if (typeof window.showSpreadsheetSyncToast === 'function') {
      window.showSpreadsheetSyncToast(msg);
    }
  }

  window.__estimatorRefreshApp = async function () {
    if (refreshInProgress) return;
    setRefreshButtonsLoading(true);
    const safetyTimer = setTimeout(function () {
      setRefreshButtonsLoading(false);
    }, 12000);

    try {
      if (desktopBridge && typeof desktopBridge.checkAndRefresh === 'function') {
        const res = await desktopBridge.checkAndRefresh();
        if (res && res.status === 'offline') {
          showLiveToast('Tidak ada koneksi internet — memuat cache lokal');
        }
        return;
      }
      if (androidBridge && typeof androidBridge.checkAndRefresh === 'function') {
        androidBridge.checkAndRefresh();
        return;
      }
      if (iosMessageHandler && typeof iosMessageHandler.postMessage === 'function') {
        iosMessageHandler.postMessage({ action: 'checkAndRefresh' });
        return;
      }
      clearTimeout(safetyTimer);
      setRefreshButtonsLoading(false);
      window.location.reload();
    } catch (e) {
      clearTimeout(safetyTimer);
      setRefreshButtonsLoading(false);
      showLiveToast('Gagal memeriksa pembaruan aplikasi.');
    }
  };

  window.__estimatorOnLiveUpdateAvailable = function (rawInfo) {
    try {
      const info = (typeof rawInfo === 'string') ? JSON.parse(rawInfo) : (rawInfo || {});
      const hash = String(info.hash || 'new');
      ['btnNativeRefreshApp', 'btnLoginNativeRefresh'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('has-update');
      });
      if (dismissedUpdateHash && dismissedUpdateHash === hash) return;
      const bannerEl = document.getElementById('nativeLiveUpdateBanner');
      if (bannerEl) {
        bannerEl.setAttribute('data-update-hash', hash);
        bannerEl.classList.add('visible');
      }
    } catch (e) {}
  };

  window.__estimatorOnLiveRefreshStatus = function (rawInfo) {
    try {
      setRefreshButtonsLoading(false);
      const info = (typeof rawInfo === 'string') ? JSON.parse(rawInfo) : (rawInfo || {});
      if (info && info.status === 'offline') {
        showLiveToast('Mode Offline — menggunakan versi HTML tersimpan.');
      } else if (info && info.status === 'up-to-date' && info.fromManualRefresh) {
        showLiveToast('Aplikasi sudah menggunakan versi HTML terbaru.');
      }
    } catch (e) {
      setRefreshButtonsLoading(false);
    }
  };

  function setupNativeRefreshUiAndGestures() {
    // 1. Offline banner
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

    // 2. Live Update Ready Banner
    const updateBanner = document.createElement('div');
    updateBanner.id = 'nativeLiveUpdateBanner';
    updateBanner.className = 'native-live-update-banner';
    updateBanner.innerHTML =
      '<span>✨ Pembaruan HTML terbaru tersedia!</span>' +
      '<button type="button" class="native-live-update-btn" id="btnApplyLiveUpdate">🔄 Refresh</button>' +
      '<button type="button" class="native-live-update-close" id="btnDismissLiveUpdate" aria-label="Tutup">×</button>';
    document.body.appendChild(updateBanner);

    const applyBtn = document.getElementById('btnApplyLiveUpdate');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        updateBanner.classList.remove('visible');
        window.__estimatorRefreshApp();
      });
    }
    const closeBtn = document.getElementById('btnDismissLiveUpdate');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        dismissedUpdateHash = updateBanner.getAttribute('data-update-hash') || 'dismissed';
        updateBanner.classList.remove('visible');
      });
    }

    // 3. Refresh button inside Top Header
    const headerWrap = document.getElementById('headerActionsWrap');
    if (headerWrap && !document.getElementById('btnNativeRefreshApp')) {
      const refreshBtn = document.createElement('button');
      refreshBtn.type = 'button';
      refreshBtn.id = 'btnNativeRefreshApp';
      refreshBtn.className = 'btn-notif-pill btn-native-refresh';
      refreshBtn.title = 'Cek update HTML terbaru & Refresh aplikasi (F5)';
      refreshBtn.innerHTML =
        '<span class="native-refresh-icon">🔄</span>' +
        '<span class="native-refresh-label hide-on-xs">Refresh</span>' +
        '<span class="native-refresh-dot" aria-hidden="true"></span>';
      refreshBtn.addEventListener('click', function () {
        window.__estimatorRefreshApp();
      });
      headerWrap.insertBefore(refreshBtn, headerWrap.firstChild);
    }

    // 4. Keep login refresh trigger hidden from UI while background/pull-to-refresh/F5 remain active
    const existingLoginRefresh = document.getElementById('btnLoginNativeRefresh');
    if (existingLoginRefresh && existingLoginRefresh.parentElement) {
      existingLoginRefresh.parentElement.style.display = 'none';
    }

    // 5. Desktop F5 / Ctrl+R shortcut fallback at DOM level
    if (isDesktopApp) {
      window.addEventListener('keydown', function (ev) {
        const key = (ev.key || '').toLowerCase();
        if (ev.key === 'F5' || ((ev.ctrlKey || ev.metaKey) && key === 'r')) {
          ev.preventDefault();
          window.__estimatorRefreshApp();
        }
      });
    }

    // 6. Mobile Pull-to-Refresh gesture when at very top of page
    if (isMobileApp) {
      const pullPill = document.createElement('div');
      pullPill.id = 'nativePullRefreshPill';
      pullPill.className = 'native-pull-refresh-pill';
      pullPill.textContent = '⬇️ Tarik untuk cek update & refresh...';
      document.body.appendChild(pullPill);

      let startY = 0;
      let pulling = false;
      let readyToTrigger = false;

      function hasScrolledAncestor(el) {
        let cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
          if (cur.classList && cur.classList.contains('modal-backdrop') && cur.classList.contains('open')) {
            return true;
          }
          if (cur.scrollTop > 2) return true;
          cur = cur.parentElement;
        }
        return (window.scrollY || document.documentElement.scrollTop || 0) > 2;
      }

      document.addEventListener('touchstart', function (ev) {
        if (refreshInProgress || !ev.touches || ev.touches.length !== 1) return;
        if (hasScrolledAncestor(ev.target)) {
          pulling = false;
          return;
        }
        startY = ev.touches[0].clientY;
        pulling = true;
        readyToTrigger = false;
      }, { passive: true });

      document.addEventListener('touchmove', function (ev) {
        if (!pulling || !ev.touches || ev.touches.length !== 1) return;
        const dy = ev.touches[0].clientY - startY;
        if (dy <= 0 || (window.scrollY || 0) > 2) {
          pulling = false;
          pullPill.style.transform = 'translateX(-50%) translateY(-80px)';
          return;
        }
        if (dy > 25) {
          const offset = Math.min(20, -60 + dy * 0.7);
          pullPill.style.transform = 'translateX(-50%) translateY(' + offset + 'px)';
          readyToTrigger = dy >= 95;
          pullPill.textContent = readyToTrigger
            ? '🔄 Lepas untuk Refresh & Update HTML!'
            : '⬇️ Tarik ke bawah untuk Refresh...';
        }
      }, { passive: true });

      document.addEventListener('touchend', function () {
        if (!pulling) return;
        pulling = false;
        pullPill.style.transform = 'translateX(-50%) translateY(-80px)';
        if (readyToTrigger) {
          readyToTrigger = false;
          window.__estimatorRefreshApp();
        }
      }, { passive: true });
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    try {
      setupNativeRefreshUiAndGestures();

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
          } else if (action === 'live-update-available') {
            window.__estimatorOnLiveUpdateAvailable(data);
          } else if (action === 'live-refresh-status') {
            window.__estimatorOnLiveRefreshStatus(data);
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
