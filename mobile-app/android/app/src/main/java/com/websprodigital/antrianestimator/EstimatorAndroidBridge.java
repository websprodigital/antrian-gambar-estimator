package com.websprodigital.antrianestimator;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.FileProvider;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class EstimatorAndroidBridge {

    private final Activity activity;

    public EstimatorAndroidBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean hasNotificationPermission() {
        return NotificationHelper.hasNotificationPermission(activity);
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !NotificationHelper.hasNotificationPermission(activity)) {
            activity.runOnUiThread(() -> ActivityCompat.requestPermissions(
                activity,
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                1001
            ));
        }
    }

    @JavascriptInterface
    public void showNotification(
        String id,
        String title,
        String message,
        String eventType,
        boolean muted,
        String queueCode
    ) {
        NotificationHelper.showNotification(activity, id, title, message, eventType, muted, queueCode);
    }

    @JavascriptInterface
    public void syncConfig(String jsonStr) {
        if (jsonStr == null || jsonStr.trim().isEmpty()) return;
        try {
            JSONObject obj = new JSONObject(jsonStr);
            String apiUrl = obj.optString("apiUrl", "").trim();
            long baselineMs = obj.optLong("baselineMs", System.currentTimeMillis() - 120000L);
            boolean soundMuted = obj.optBoolean("soundMuted", false);
            JSONArray seenIds = obj.optJSONArray("seenIds");

            SharedPreferences prefs = activity.getSharedPreferences(NotificationPollWorker.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("apiUrl", apiUrl);
            editor.putLong("baselineMs", baselineMs);
            editor.putBoolean("soundMuted", soundMuted);
            if (seenIds != null) {
                editor.putString("seenIds", seenIds.toString());
            }
            editor.apply();

            if (!apiUrl.isEmpty() && apiUrl.startsWith("http")) {
                Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();
                PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                    NotificationPollWorker.class,
                    15,
                    TimeUnit.MINUTES
                )
                    .setConstraints(constraints)
                    .build();
                WorkManager.getInstance(activity.getApplicationContext()).enqueueUniquePeriodicWork(
                    "estimator_bg_notif_poll",
                    ExistingPeriodicWorkPolicy.KEEP,
                    req
                );
            }
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void openExternal(String url) {
        if (url == null || url.trim().isEmpty()) return;
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url.trim()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception ex) {
                Toast.makeText(activity, "Tidak dapat membuka tautan eksternal.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public void downloadUrl(String url, String fileName) {
        if (url == null || url.trim().isEmpty()) return;
        String cleanUrl = url.trim();
        if (cleanUrl.contains("drive.google.com") || cleanUrl.contains("docs.google.com")) {
            openExternal(cleanUrl);
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(cleanUrl));
                String safeName = sanitizeFileName(fileName);
                req.setTitle(safeName);
                req.setDescription("Mengunduh dokumen Antrian Gambar Estimator...");
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "AntrianEstimator/" + safeName);
                DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(req);
                    Toast.makeText(activity, "Mengunduh " + safeName + "...", Toast.LENGTH_SHORT).show();
                } else {
                    openExternal(cleanUrl);
                }
            } catch (Exception e) {
                openExternal(cleanUrl);
            }
        });
    }

    @JavascriptInterface
    public void saveBase64File(String dataUrlOrBase64, String fileName, String fallbackMime) {
        if (dataUrlOrBase64 == null || dataUrlOrBase64.isEmpty()) return;
        new Thread(() -> {
            try {
                String mimeType = (fallbackMime != null && !fallbackMime.isEmpty()) ? fallbackMime : "application/octet-stream";
                String base64Part = dataUrlOrBase64;
                int commaIdx = dataUrlOrBase64.indexOf(',');
                if (dataUrlOrBase64.startsWith("data:") && commaIdx != -1) {
                    String header = dataUrlOrBase64.substring(5, commaIdx);
                    int semiIdx = header.indexOf(';');
                    if (semiIdx > 0) {
                        mimeType = header.substring(0, semiIdx);
                    }
                    base64Part = dataUrlOrBase64.substring(commaIdx + 1);
                }

                byte[] bytes = Base64.decode(base64Part, Base64.DEFAULT);
                String safeName = ensureExtension(sanitizeFileName(fileName), mimeType);
                Uri savedUri = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AntrianEstimator");
                    ContentResolver resolver = activity.getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = resolver.openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                            }
                        }
                        savedUri = uri;
                    }
                } else {
                    File dlDir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                        "AntrianEstimator"
                    );
                    if (!dlDir.exists()) {
                        dlDir.mkdirs();
                    }
                    File outFile = new File(dlDir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    savedUri = FileProvider.getUriForFile(
                        activity,
                        activity.getPackageName() + ".fileprovider",
                        outFile
                    );
                }

                final Uri notifyUri = savedUri;
                final String finalMime = mimeType;
                activity.runOnUiThread(() -> {
                    Toast.makeText(
                        activity,
                        "Tersimpan di Downloads/AntrianEstimator/" + safeName,
                        Toast.LENGTH_LONG
                    ).show();
                    if (notifyUri != null) {
                        NotificationHelper.showDownloadCompleteNotification(activity, safeName, notifyUri, finalMime);
                    }
                });
            } catch (Exception e) {
                activity.runOnUiThread(() ->
                    Toast.makeText(activity, "Gagal menyimpan file: " + e.getMessage(), Toast.LENGTH_LONG).show()
                );
            }
        }).start();
    }

    private String sanitizeFileName(String raw) {
        String cleaned = (raw == null || raw.trim().isEmpty()) ? "Dokumen_Estimator" : raw.trim();
        return cleaned.replaceAll("[<>:\"/\\\\|?*\\x00-\\x1f]", "_");
    }

    private String ensureExtension(String name, String mime) {
        if (name.contains(".") && !name.endsWith(".")) {
            return name;
        }
        String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
        if (ext == null || ext.isEmpty()) {
            if ("text/csv".equalsIgnoreCase(mime)) ext = "csv";
            else if ("application/pdf".equalsIgnoreCase(mime)) ext = "pdf";
            else if ("image/svg+xml".equalsIgnoreCase(mime)) ext = "svg";
        }
        return (ext != null && !ext.isEmpty()) ? (name + "." + ext) : name;
    }
}
