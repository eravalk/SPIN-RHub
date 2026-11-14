package com.spinplayer.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/** Only start() enqueues network work; checking and restoring never download an APK. */
final class AppUpdateDownload {
    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("app-update", Context.MODE_PRIVATE);
    }
    private static DownloadManager manager(Context context) {
        return context.getSystemService(DownloadManager.class);
    }
    private static JSONObject saved(Context context) throws Exception {
        return new JSONObject(prefs(context).getString("release", "{}"));
    }
    private static File file(Context context, JSONObject release) throws Exception {
        String name = release.getString("name");
        if (!name.matches("SPIN-RHub-[0-9]+(\\.[0-9]+){0,3}\\.apk")) throw new IOException("Invalid filename");
        File directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) throw new IOException("Storage unavailable");
        return new File(directory, name);
    }
    static synchronized JSONObject start(Context context, JSONObject release) throws Exception {
        JSONObject current = state(context);
        if ("downloading".equals(current.optString("status")) || "ready".equals(current.optString("status"))) return current;
        if (!"available".equals(release.optString("status"))) throw new IOException("Release unavailable");
        String version = release.getString("version");
        String expected = "SPIN-RHub-" + version + ".apk";
        String url = release.getString("url");
        String base = "https://github.com/" + ReleaseUpdates.REPO + "/releases/download/";
        if (!url.equals(base + version + "/" + expected) && !url.equals(base + "v" + version + "/" + expected))
            throw new IOException("Invalid download URL");
        if (!expected.equals(release.getString("name"))) throw new IOException("Invalid filename");
        File target = file(context, release);
        long old = prefs(context).getLong("id", -1);
        if (old >= 0) manager(context).remove(old);
        if (target.exists() && !target.delete()) throw new IOException("Cannot replace update");
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                .setTitle("SPIN RHub " + version).setDescription("Обновление приложения")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true).setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, expected);
        long id = manager(context).enqueue(request);
        if (!prefs(context).edit().putLong("id", id).putString("release", release.toString())
                .remove("verified").remove("error").commit()) {
            manager(context).remove(id);
            throw new IOException("Cannot save update state");
        }
        return state(context);
    }
    static synchronized JSONObject state(Context context) throws Exception {
        long id = prefs(context).getLong("id", -1);
        if (id < 0) return new JSONObject().put("status", "idle");
        JSONObject release = saved(context);
        String version = release.optString("version");
        PackageInfo installed = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        if (!ReleaseUpdates.newer(version, installed.versionName)) {
            manager(context).remove(id);
            prefs(context).edit().clear().commit();
            return new JSONObject().put("status", "idle");
        }
        JSONObject result = new JSONObject().put("version", version);
        String error = prefs(context).getString("error", "");
        if (!error.isEmpty()) return result.put("status", "failed").put("message", error);
        try (Cursor cursor = manager(context).query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor == null || !cursor.moveToFirst()) return result.put("status", "failed").put("message", "Файл обновления удалён. Скачай его повторно.");
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_FAILED) return result.put("status", "failed").put("message", "Не удалось скачать обновление. Проверь сеть и свободное место.");
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                long bytes = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                return result.put("status", "downloading").put("bytes", bytes).put("size", release.optLong("size"))
                        .put("paused", status == DownloadManager.STATUS_PAUSED);
            }
        }
        try {
            File target = file(context, release);
            if (!target.isFile() || target.length() != release.getLong("size")) throw new IOException("Размер APK не совпадает. Скачай обновление повторно.");
            if (!prefs(context).getBoolean("verified", false)) {
                verify(context, release);
                prefs(context).edit().putBoolean("verified", true).commit();
            }
            return result.put("status", "ready");
        } catch (Exception errorCheck) {
            String message = "Файл обновления не прошёл проверку. Скачай его повторно.";
            prefs(context).edit().putString("error", message).commit();
            return result.put("status", "failed").put("message", message);
        }
    }
    private static Set<Signature> signers(PackageInfo info) throws IOException {
        if (info == null || info.signingInfo == null) throw new IOException("No APK signature");
        Set<Signature> result = new HashSet<>();
        for (Signature signature : info.signingInfo.getApkContentsSigners()) result.add(signature);
        if (result.isEmpty()) throw new IOException("No APK signature");
        return result;
    }
    private static void verify(Context context, JSONObject release) throws Exception {
        File target = file(context, release);
        if (!target.isFile() || target.length() != release.getLong("size")) throw new IOException("APK size mismatch");
        PackageManager pm = context.getPackageManager();
        PackageInfo installed = pm.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
        PackageInfo update = pm.getPackageArchiveInfo(target.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (update == null || !context.getPackageName().equals(update.packageName)
                || !release.getString("version").equals(update.versionName)
                || update.getLongVersionCode() <= installed.getLongVersionCode()
                || !signers(installed).equals(signers(update))) throw new IOException("APK identity mismatch");
        String digest = release.optString("digest", "");
        if (!digest.isEmpty()) {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            try (FileInputStream input = new FileInputStream(target)) {
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) != -1) sha.update(buffer, 0, count);
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : sha.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
            if (!digest.equalsIgnoreCase("sha256:" + hex)) throw new IOException("APK checksum mismatch");
        }
    }
    static synchronized Uri installUri(Context context) throws Exception {
        if (!"ready".equals(state(context).optString("status"))) throw new IOException("Update not ready");
        verify(context, saved(context));
        Uri uri = manager(context).getUriForDownloadedFile(prefs(context).getLong("id", -1));
        if (uri == null) throw new IOException("Missing APK URI");
        return uri;
    }
}
