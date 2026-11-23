package com.websprodigital.antrianestimator;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class NotificationPollWorker extends Worker {

    public static final String PREFS_NAME = "estimator_native_prefs";

    public NotificationPollWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String apiUrl = prefs.getString("apiUrl", "").trim();
        if (apiUrl.isEmpty() || !apiUrl.startsWith("http")) {
            return Result.success();
        }

        long baselineMs = prefs.getLong("baselineMs", System.currentTimeMillis() - 1800000L);
        boolean soundMuted = prefs.getBoolean("soundMuted", false);

        Set<String> seenSet = new HashSet<>();
        List<String> seenOrdered = new ArrayList<>();
        try {
            String rawSeen = prefs.getString("seenIds", "[]");
            JSONArray arr = new JSONArray(rawSeen);
            for (int i = 0; i < arr.length(); i++) {
                String id = arr.optString(i, "");
                if (!id.isEmpty() && seenSet.add(id)) {
                    seenOrdered.add(id);
                }
            }
        } catch (Exception ignored) {}

        HttpURLConnection conn = null;
        try {
            String sep = apiUrl.contains("?") ? "&" : "?";
            URL url = new URL(apiUrl + sep + "action=get_notifications&t=" + System.currentTimeMillis());
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(12000);
            conn.setInstanceFollowRedirects(true);

            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                return Result.retry();
            }

            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            JSONObject json = new JSONObject(sb.toString());
            if (!"success".equalsIgnoreCase(json.optString("status"))) {
                return Result.success();
            }

            JSONArray notifs = json.optJSONArray("notifications");
            if (notifs == null || notifs.length() == 0) {
                return Result.success();
            }

            long maxCreatedMs = baselineMs;
            boolean updatedSeen = false;

            for (int i = 0; i < notifs.length(); i++) {
                JSONObject nt = notifs.optJSONObject(i);
                if (nt == null) continue;
                String nid = nt.optString("id", "").trim();
                if (nid.isEmpty() || seenSet.contains(nid)) continue;

                long createdAtMs = nt.optLong("createdAtMs", 0L);
                if (createdAtMs > maxCreatedMs) {
                    maxCreatedMs = createdAtMs;
                }
                if (createdAtMs < baselineMs) {
                    continue;
                }

                seenSet.add(nid);
                seenOrdered.add(nid);
                updatedSeen = true;

                String title = nt.optString("title", "Notifikasi Antrian Estimator");
                String message = nt.optString("message", "Ada pembaruan aktivitas proyek.");
                String eventType = nt.optString("eventType", "sales_form_new");
                String queueCode = nt.optString("queueCode", "");

                NotificationHelper.showNotification(ctx, nid, title, message, eventType, soundMuted, queueCode);
            }

            if (updatedSeen || maxCreatedMs > baselineMs) {
                int startIdx = Math.max(0, seenOrdered.size() - 300);
                JSONArray nextArr = new JSONArray();
                for (int i = startIdx; i < seenOrdered.size(); i++) {
                    nextArr.put(seenOrdered.get(i));
                }
                prefs.edit()
                    .putString("seenIds", nextArr.toString())
                    .putLong("baselineMs", maxCreatedMs)
                    .apply();
            }
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }

        return Result.success();
    }
}
