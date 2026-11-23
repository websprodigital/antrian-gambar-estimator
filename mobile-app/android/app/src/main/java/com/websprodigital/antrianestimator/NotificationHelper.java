package com.websprodigital.antrianestimator;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class NotificationHelper {

    public static final String CHANNEL_ALERT_ID = "estimator_realtime_alerts_v1";
    public static final String CHANNEL_SILENT_ID = "estimator_realtime_silent_v1";
    public static final String CHANNEL_DOWNLOAD_ID = "estimator_downloads_v1";

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) {
            return;
        }

        if (nm.getNotificationChannel(CHANNEL_ALERT_ID) == null) {
            NotificationChannel alertChannel = new NotificationChannel(
                CHANNEL_ALERT_ID,
                "Notifikasi Proyek & Chat Real-Time",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Peringatan masuk saat ada antrian gambar, revisi desain, penawaran, atau chat proyek.");
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[] { 0, 250, 100, 250 });
            alertChannel.enableLights(true);
            alertChannel.setLightColor(0xFF20409A);
            Uri soundUri = Uri.parse(
                ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/raw/notif_sound"
            );
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            alertChannel.setSound(soundUri, audioAttrs);
            nm.createNotificationChannel(alertChannel);
        }

        if (nm.getNotificationChannel(CHANNEL_SILENT_ID) == null) {
            NotificationChannel silentChannel = new NotificationChannel(
                CHANNEL_SILENT_ID,
                "Notifikasi Proyek (Mode Senyap)",
                NotificationManager.IMPORTANCE_HIGH
            );
            silentChannel.setDescription("Notifikasi proyek tanpa suara saat mode senyap diaktifkan di aplikasi.");
            silentChannel.setSound(null, null);
            silentChannel.enableVibration(false);
            nm.createNotificationChannel(silentChannel);
        }

        if (nm.getNotificationChannel(CHANNEL_DOWNLOAD_ID) == null) {
            NotificationChannel dlChannel = new NotificationChannel(
                CHANNEL_DOWNLOAD_ID,
                "Unduhan Dokumen",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            dlChannel.setDescription("Status unduhan PDF, gambar, dan ekspor spreadsheet.");
            nm.createNotificationChannel(dlChannel);
        }
    }

    public static boolean hasNotificationPermission(Context context) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    public static void showNotification(
        Context context,
        String id,
        String title,
        String message,
        String eventType,
        boolean muted,
        String queueCode
    ) {
        ensureChannels(context);
        if (Build.VERSION.SDK_INT >= 33) {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        String channelId = muted ? CHANNEL_SILENT_ID : CHANNEL_ALERT_ID;
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notif_id", id != null ? id : "");
        intent.putExtra("notif_event_type", eventType != null ? eventType : "sales_form_new");
        intent.putExtra("notif_queue_code", queueCode != null ? queueCode : "");
        intent.putExtra("notif_title", title != null ? title : "");
        intent.putExtra("notif_message", message != null ? message : "");

        int notifIntId = (id != null && !id.isEmpty()) ? id.hashCode() : (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notifIntId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_estimator)
            .setLargeIcon(largeIcon)
            .setColor(0xFF20409A)
            .setContentTitle(title != null && !title.isEmpty() ? title : "Notifikasi Antrian Estimator")
            .setContentText(message != null && !message.isEmpty() ? message : "Ada pembaruan data baru.")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message != null ? message : ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        if (muted) {
            builder.setSilent(true);
        } else {
            Uri soundUri = Uri.parse(
                ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/raw/notif_sound"
            );
            builder.setSound(soundUri);
            builder.setVibrate(new long[] { 0, 250, 100, 250 });
        }

        try {
            NotificationManagerCompat.from(context).notify(notifIntId, builder.build());
        } catch (SecurityException ignored) {}
    }

    public static void showDownloadCompleteNotification(Context context, String fileName, Uri fileUri, String mimeType) {
        ensureChannels(context);
        if (Build.VERSION.SDK_INT >= 33) {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        Intent openIntent = new Intent(Intent.ACTION_VIEW);
        openIntent.setDataAndType(fileUri, mimeType != null && !mimeType.isEmpty() ? mimeType : "*/*");
        openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        int notifId = ("DL-" + fileName + System.currentTimeMillis()).hashCode();
        PendingIntent pi = PendingIntent.getActivity(
            context,
            notifId,
            Intent.createChooser(openIntent, "Buka " + fileName),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_DOWNLOAD_ID)
            .setSmallIcon(R.drawable.ic_stat_estimator)
            .setColor(0xFF10B981)
            .setContentTitle("Unduhan Selesai")
            .setContentText(fileName + " tersimpan di Downloads/AntrianEstimator")
            .setAutoCancel(true)
            .setContentIntent(pi);

        try {
            NotificationManagerCompat.from(context).notify(notifId, builder.build());
        } catch (Exception ignored) {}
    }
}
