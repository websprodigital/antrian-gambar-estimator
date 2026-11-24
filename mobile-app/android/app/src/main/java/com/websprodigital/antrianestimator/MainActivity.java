package com.websprodigital.antrianestimator;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.MediaStore;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.ProcessedRoute;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private ValueCallback<Uri[]> pendingFileCallback;
    private Uri pendingCameraImageUri;
    private ActivityResultLauncher<Intent> customFilePickerLauncher;
    private EstimatorAndroidBridge nativeBridge;
    private long lastBackPressAt = 0L;
    private long lastLiveCheckAt = 0L;
    private boolean hasCompletedInitialResume = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        LiveHtmlUpdater.ensureLiveCacheMatchesBinary(this);
        bridgeBuilder.setRouteProcessor((basePath, path) -> {
            ProcessedRoute route = new ProcessedRoute();
            File liveIndex = LiveHtmlUpdater.getLiveIndexFile(MainActivity.this);
            if (liveIndex.exists() && liveIndex.length() > 20000L && ("/".equals(path) || "/index.html".equals(path))) {
                route.setPath(liveIndex.getAbsolutePath());
                route.setAsset(false);
                route.setIgnoreAssetPath(true);
            } else {
                String effectivePath = "/".equals(path) ? "/index.html" : path;
                route.setPath((basePath != null && !basePath.isEmpty()) ? (basePath + effectivePath) : effectivePath);
                route.setAsset(true);
                route.setIgnoreAssetPath(false);
            }
            return route;
        });

        customFilePickerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (pendingFileCallback == null) {
                    return;
                }
                Uri[] results = null;
                try {
                    Intent data = result.getData();
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        if (data != null && data.getClipData() != null) {
                            int count = data.getClipData().getItemCount();
                            results = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                results[i] = data.getClipData().getItemAt(i).getUri();
                            }
                        } else if (data != null && data.getData() != null) {
                            results = new Uri[] { data.getData() };
                        } else if (pendingCameraImageUri != null) {
                            results = new Uri[] { pendingCameraImageUri };
                        }
                    }
                } catch (Exception ignored) {}

                pendingFileCallback.onReceiveValue(results);
                pendingFileCallback = null;
                pendingCameraImageUri = null;
            }
        );

        super.onCreate(savedInstanceState);

        NotificationHelper.ensureChannels(this);
        nativeBridge = new EstimatorAndroidBridge(this);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setAllowFileAccess(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);

            webView.addJavascriptInterface(nativeBridge, "EstimatorAndroid");
            webView.setWebChromeClient(new EstimatorWebChromeClient(this.bridge));
            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(
                    String url,
                    String userAgent,
                    String contentDisposition,
                    String mimeType,
                    long contentLength
                ) {
                    if (url == null) return;
                    if (url.startsWith("data:")) {
                        nativeBridge.saveBase64File(url, "Dokumen_Antrian_Estimator", mimeType);
                    } else if (url.startsWith("http")) {
                        nativeBridge.downloadUrl(url, "Dokumen_Antrian_Estimator");
                    }
                }
            });

            webView.postDelayed(() -> triggerAutoLiveUpdateCheck(), 1500);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().evaluateJavascript(
                        "(function(){ return (typeof window.__estimatorHandleAndroidBack === 'function') ? window.__estimatorHandleAndroidBack() : 'exit_prompt'; })()",
                        value -> {
                            if (value != null && value.contains("handled")) {
                                return;
                            }
                            long now = System.currentTimeMillis();
                            if (now - lastBackPressAt < 2000L) {
                                moveTaskToBack(true);
                            } else {
                                lastBackPressAt = now;
                                Toast.makeText(
                                    MainActivity.this,
                                    "Tekan kembali sekali lagi untuk keluar",
                                    Toast.LENGTH_SHORT
                                ).show();
                            }
                        }
                    );
                } else {
                    moveTaskToBack(true);
                }
            }
        });

        handleNotificationIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!hasCompletedInitialResume) {
            hasCompletedInitialResume = true;
            return;
        }
        triggerAutoLiveUpdateCheck();
    }

    public void triggerAutoLiveUpdateCheck() {
        long now = System.currentTimeMillis();
        if (now - lastLiveCheckAt < 30000L) {
            return;
        }
        lastLiveCheckAt = now;
        runLiveUpdateSync(false, false);
    }

    public void runLiveUpdateSync(boolean fromManual, boolean reloadOnOk) {
        new Thread(() -> {
            LiveHtmlUpdater.SyncResult res = LiveHtmlUpdater.checkAndSync(getApplicationContext());
            runOnUiThread(() -> {
                if (this.bridge == null || this.bridge.getWebView() == null) {
                    return;
                }
                WebView wv = this.bridge.getWebView();
                if (reloadOnOk) {
                    if (res.ok) {
                        wv.clearCache(false);
                        this.bridge.reload();
                    } else {
                        JSONObject payload = res.toJson();
                        try { payload.put("fromManualRefresh", fromManual); } catch (Exception ignored) {}
                        wv.evaluateJavascript(
                            "if (typeof window.__estimatorOnLiveRefreshStatus === 'function') { window.__estimatorOnLiveRefreshStatus("
                                + payload.toString() + "); }",
                            null
                        );
                    }
                    return;
                }

                if (res.ok && res.updated) {
                    wv.evaluateJavascript(
                        "if (typeof window.__estimatorOnLiveUpdateAvailable === 'function') { window.__estimatorOnLiveUpdateAvailable("
                            + res.toJson().toString() + "); }",
                        null
                    );
                } else if (fromManual) {
                    JSONObject payload = res.toJson();
                    try { payload.put("fromManualRefresh", true); } catch (Exception ignored) {}
                    wv.evaluateJavascript(
                        "if (typeof window.__estimatorOnLiveRefreshStatus === 'function') { window.__estimatorOnLiveRefreshStatus("
                            + payload.toString() + "); }",
                        null
                    );
                }
            });
        }).start();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null || this.bridge == null || this.bridge.getWebView() == null) return;
        String notifId = intent.getStringExtra("notif_id");
        if (notifId == null || notifId.isEmpty()) return;

        try {
            JSONObject payload = new JSONObject();
            payload.put("id", notifId);
            payload.put("eventType", intent.getStringExtra("notif_event_type"));
            payload.put("queueCode", intent.getStringExtra("notif_queue_code"));
            payload.put("title", intent.getStringExtra("notif_title"));
            payload.put("message", intent.getStringExtra("notif_message"));
            final String jsCall = "if (typeof window.__estimatorOnNativeNotifClick === 'function') { window.__estimatorOnNativeNotifClick("
                + payload.toString() + "); }";
            this.bridge.getWebView().postDelayed(() -> {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().evaluateJavascript(jsCall, null);
                }
            }, 450);
        } catch (Exception ignored) {}
    }

    private Uri createCameraTempUri() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        File image = File.createTempFile("IMG_" + timeStamp + "_", ".jpg", storageDir);
        return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", image);
    }

    private class EstimatorWebChromeClient extends BridgeWebChromeClient {

        public EstimatorWebChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean onShowFileChooser(
            WebView webView,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            if (pendingFileCallback != null) {
                pendingFileCallback.onReceiveValue(null);
            }
            pendingFileCallback = filePathCallback;
            pendingCameraImageUri = null;

            String[] acceptTypes = fileChooserParams != null ? fileChooserParams.getAcceptTypes() : new String[0];
            boolean captureEnabled = fileChooserParams != null && fileChooserParams.isCaptureEnabled();
            boolean hasImage = false;
            boolean hasVideo = false;
            boolean hasOther = false;
            if (acceptTypes != null && acceptTypes.length > 0) {
                for (String rawT : acceptTypes) {
                    if (rawT == null) continue;
                    for (String part : rawT.split(",")) {
                        String t = part.trim().toLowerCase(Locale.US);
                        if (t.isEmpty()) continue;
                        if (t.startsWith("image/") || ".jpg".equals(t) || ".jpeg".equals(t) || ".png".equals(t)) {
                            hasImage = true;
                        } else if (t.startsWith("video/") || ".mp4".equals(t) || ".webm".equals(t) || ".mov".equals(t)) {
                            hasVideo = true;
                        } else {
                            hasOther = true;
                        }
                    }
                }
            } else {
                hasOther = true;
            }

            if (captureEnabled && hasVideo && !hasImage && !hasOther) {
                try {
                    Intent vidIntent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
                    vidIntent.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 45);
                    if (vidIntent.resolveActivity(getPackageManager()) != null) {
                        customFilePickerLauncher.launch(vidIntent);
                        return true;
                    }
                } catch (Exception ignored) {}
            }

            if (captureEnabled && hasImage && !hasVideo && !hasOther) {
                try {
                    Intent camIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    if (camIntent.resolveActivity(getPackageManager()) != null) {
                        pendingCameraImageUri = createCameraTempUri();
                        camIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraImageUri);
                        camIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        customFilePickerLauncher.launch(camIntent);
                        return true;
                    }
                } catch (Exception ignored) {}
            }

            Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
            contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
            if (!hasOther && hasImage && !hasVideo) {
                contentIntent.setType("image/*");
            } else if (!hasOther && hasVideo && !hasImage) {
                contentIntent.setType("video/*");
            } else if (!hasOther && hasImage && hasVideo) {
                contentIntent.setType("*/*");
                contentIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*" });
            } else {
                contentIntent.setType("*/*");
            }
            if (fileChooserParams != null && fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }

            List<Intent> extraIntents = new ArrayList<>();
            if (hasImage || hasOther) {
                try {
                    Intent camIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    if (camIntent.resolveActivity(getPackageManager()) != null) {
                        pendingCameraImageUri = createCameraTempUri();
                        camIntent.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraImageUri);
                        camIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        extraIntents.add(camIntent);
                    }
                } catch (Exception ignored) {}
            }
            if (hasVideo) {
                try {
                    Intent vidIntent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
                    vidIntent.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 45);
                    if (vidIntent.resolveActivity(getPackageManager()) != null) {
                        extraIntents.add(vidIntent);
                    }
                } catch (Exception ignored) {}
            }

            Intent chooser = Intent.createChooser(contentIntent, hasVideo ? "Pilih / Rekam Foto & Video" : "Pilih Berkas / Foto Proyek");
            if (!extraIntents.isEmpty()) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Intent[0]));
            }

            try {
                customFilePickerLauncher.launch(chooser);
            } catch (ActivityNotFoundException e) {
                pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = null;
                Toast.makeText(MainActivity.this, "Tidak ada pemilih file ditemukan.", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            WebView tempWebView = new WebView(view.getContext());
            tempWebView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    if (request != null && request.getUrl() != null) {
                        nativeBridge.openExternal(request.getUrl().toString());
                    }
                    try { tempWebView.destroy(); } catch (Exception ignored) {}
                    return true;
                }
            });
            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(tempWebView);
            resultMsg.sendToTarget();
            return true;
        }
    }
}
