package com.websprodigital.antrianestimator;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

public class LiveHtmlUpdater {

    public static final String LIVE_HTML_PRIMARY_URL =
        "https://raw.githubusercontent.com/websprodigital/antrian-gambar-estimator/gh-pages/index.html";
    public static final String LIVE_HTML_FALLBACK_URL =
        "https://websprodigital.github.io/antrian-gambar-estimator/index.html";

    private static final String PREFS_NAME = "EstimatorLiveWebPrefs";
    private static final Object SYNC_LOCK = new Object();
    private static final Pattern VIEWPORT_PATTERN = Pattern.compile(
        "<meta\\s+name=[\"']viewport[\"']\\s+content=[\"']([^\"']*)[\"']\\s*/?>",
        Pattern.CASE_INSENSITIVE
    );

    public static class SyncResult {
        public boolean ok;
        public String status;
        public boolean updated;
        public String hash = "";
        public String updatedAt = "";
        public String sourceUrl = "";
        public String error = "";

        public JSONObject toJson() {
            JSONObject obj = new JSONObject();
            try {
                obj.put("ok", ok);
                obj.put("status", status != null ? status : "");
                obj.put("updated", updated);
                obj.put("hash", hash != null ? hash : "");
                obj.put("updatedAt", updatedAt != null ? updatedAt : "");
                obj.put("sourceUrl", sourceUrl != null ? sourceUrl : "");
                obj.put("error", error != null ? error : "");
            } catch (Exception ignored) {}
            return obj;
        }
    }

    public static File getLiveWebDir(Context context) {
        return new File(context.getFilesDir(), "live-web");
    }

    public static File getLiveIndexFile(Context context) {
        return new File(getLiveWebDir(context), "index.html");
    }

    public static void ensureLiveCacheMatchesBinary(Context context) {
        String bundledHash = getBundledIndexHash(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedBundledHash = prefs.getString("bundledHash", "");
        if (!bundledHash.isEmpty() && !savedBundledHash.isEmpty() && !bundledHash.equals(savedBundledHash)) {
            File liveFile = getLiveIndexFile(context);
            if (liveFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                liveFile.delete();
            }
            prefs.edit()
                .putString("bundledHash", bundledHash)
                .putString("liveHash", "")
                .putString("updatedAt", "")
                .apply();
        } else if (!bundledHash.isEmpty() && savedBundledHash.isEmpty()) {
            prefs.edit().putString("bundledHash", bundledHash).apply();
        }
    }

    public static SyncResult checkAndSync(Context context) {
        synchronized (SYNC_LOCK) {
            SyncResult res = new SyncResult();
            String[] urls = new String[] { LIVE_HTML_PRIMARY_URL, LIVE_HTML_FALLBACK_URL };
            String rawHtml = null;
            String usedUrl = "";
            String lastErr = "";

            for (String baseUrl : urls) {
                try {
                    String sep = baseUrl.contains("?") ? "&" : "?";
                    String fetchUrl = baseUrl + sep + "live_t=" + System.currentTimeMillis();
                    String candidate = downloadUtf8(fetchUrl);
                    if (isValidPortalHtml(candidate)) {
                        rawHtml = candidate;
                        usedUrl = baseUrl;
                        break;
                    } else {
                        lastErr = "HTML tidak valid atau belum lengkap";
                    }
                } catch (Exception e) {
                    lastErr = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                }
            }

            if (rawHtml == null) {
                res.ok = false;
                res.status = "offline";
                res.updated = false;
                res.error = lastErr.isEmpty() ? "Tidak dapat terhubung ke server" : lastErr;
                return res;
            }

            String transformed = transformLiveHtml(rawHtml);
            String nextHash = sha256(transformed);
            String activeHash = getCurrentActiveHash(context);

            if (!nextHash.isEmpty() && nextHash.equals(activeHash)) {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                res.ok = true;
                res.status = "up-to-date";
                res.updated = false;
                res.hash = nextHash;
                res.updatedAt = prefs.getString("updatedAt", "");
                res.sourceUrl = usedUrl;
                return res;
            }

            try {
                File dir = getLiveWebDir(context);
                if (!dir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();
                }
                File target = getLiveIndexFile(context);
                File tmp = new File(dir, "index.html.tmp");
                try (FileOutputStream fos = new FileOutputStream(tmp)) {
                    fos.write(transformed.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }
                if (target.exists() && !tmp.renameTo(target)) {
                    // Fallback overwrite if rename fails on device
                    try (FileOutputStream fos = new FileOutputStream(target)) {
                        fos.write(transformed.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }
                    //noinspection ResultOfMethodCallIgnored
                    tmp.delete();
                } else if (!target.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tmp.renameTo(target);
                }

                String nowIso = isoNow();
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                    .putString("bundledHash", getBundledIndexHash(context))
                    .putString("liveHash", nextHash)
                    .putString("updatedAt", nowIso)
                    .putString("sourceUrl", usedUrl)
                    .apply();

                res.ok = true;
                res.status = "updated";
                res.updated = true;
                res.hash = nextHash;
                res.updatedAt = nowIso;
                res.sourceUrl = usedUrl;
                return res;
            } catch (Exception e) {
                res.ok = false;
                res.status = "error";
                res.updated = false;
                res.error = e.getMessage() != null ? e.getMessage() : "Gagal menulis cache HTML";
                return res;
            }
        }
    }

    public static JSONObject getStatusJson(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        File liveFile = getLiveIndexFile(context);
        JSONObject obj = new JSONObject();
        try {
            obj.put("usingLiveCache", liveFile.exists() && liveFile.length() > 20000L);
            obj.put("activeHash", getCurrentActiveHash(context));
            obj.put("updatedAt", prefs.getString("updatedAt", ""));
            obj.put("sourceUrl", prefs.getString("sourceUrl", LIVE_HTML_PRIMARY_URL));
        } catch (Exception ignored) {}
        return obj;
    }

    private static String getCurrentActiveHash(Context context) {
        File liveFile = getLiveIndexFile(context);
        if (liveFile.exists() && liveFile.length() > 20000L) {
            try (FileInputStream fis = new FileInputStream(liveFile)) {
                return sha256Bytes(readAllBytes(fis));
            } catch (Exception ignored) {}
        }
        return getBundledIndexHash(context);
    }

    private static String getBundledIndexHash(Context context) {
        try (InputStream is = context.getAssets().open("public/index.html")) {
            return sha256Bytes(readAllBytes(is));
        } catch (Exception e) {
            return "";
        }
    }

    private static String downloadUtf8(String urlStr) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setUseCaches(false);
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(6500);
            conn.setReadTimeout(12000);
            conn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
            conn.setRequestProperty("Pragma", "no-cache");
            conn.setRequestProperty("User-Agent", "AntrianEstimatorAndroid/1.1");

            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new Exception("HTTP " + code);
            }
            try (InputStream is = conn.getInputStream()) {
                return new String(readAllBytes(is), StandardCharsets.UTF_8);
            }
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static byte[] readAllBytes(InputStream is) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = is.read(buf)) != -1) {
            bos.write(buf, 0, n);
        }
        return bos.toByteArray();
    }

    private static boolean isValidPortalHtml(String html) {
        if (html == null || html.length() < 20000) return false;
        String lower = html.toLowerCase(Locale.US);
        if (!lower.contains("<html") || !lower.contains("</body>") || !lower.contains("</html>")) {
            return false;
        }
        return html.contains("GOOGLE_SCRIPT_WEB_APP_URL") || html.contains("loginScreen");
    }

    private static String transformLiveHtml(String rawHtml) {
        String html = rawHtml;
        Matcher m = VIEWPORT_PATTERN.matcher(html);
        if (m.find()) {
            String content = m.group(1) != null ? m.group(1) : "";
            if (!content.contains("viewport-fit=cover")) {
                String replacement = "<meta name=\"viewport\" content=\"" + content + ", viewport-fit=cover\">";
                html = m.replaceFirst(Matcher.quoteReplacement(replacement));
            }
        }
        if (!html.contains("native-bridge.js")) {
            int closeIdx = html.toLowerCase(Locale.US).lastIndexOf("</body>");
            if (closeIdx != -1) {
                html = html.substring(0, closeIdx)
                    + "  <script src=\"native-bridge.js\"></script>\n"
                    + html.substring(closeIdx);
            }
        }
        return html;
    }

    private static String sha256(String text) {
        return sha256Bytes(text.getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256Bytes(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format(Locale.US, "%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String isoNow() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }
}
