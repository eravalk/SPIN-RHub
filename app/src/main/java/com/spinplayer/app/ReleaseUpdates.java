package com.spinplayer.app;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

final class ReleaseUpdates {
    static final String REPO = "eravalk/SPIN-RHub";
    static final String PAGE = "https://github.com/" + REPO + "/releases/latest";

    // Only old two-component releases use this translation. Four-component numbers are literal.
    static String canonicalInstalled(String installed) {
        switch (installed) {
            case "1.0": return "1.0.0.0";
            case "1.1": return "1.0.1.0";
            case "1.2": return "1.1.0.0";
            case "1.3": return "1.2.0.0";
            default: return installed;
        }
    }

    static boolean newer(String candidate, String installed) {
        String[] a = candidate.split("\\.");
        String[] b = installed.split("\\.");
        for (int i = 0; i < Math.max(a.length, b.length); i++) {
            BigInteger x = i < a.length ? new BigInteger(a[i]) : BigInteger.ZERO;
            BigInteger y = i < b.length ? new BigInteger(b[i]) : BigInteger.ZERO;
            int comparison = x.compareTo(y);
            if (comparison != 0) return comparison > 0;
        }
        return false;
    }

    static JSONObject check(String installed) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(
            "https://api.github.com/repos/" + REPO + "/releases/latest").openConnection();
        try {
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestProperty("User-Agent", "SPIN-RHub/" + installed);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            int status = c.getResponseCode();
            if (status == 404) return new JSONObject().put("status", "missing");
            if (status != 200) throw new IOException("HTTP " + status);
            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    c.getInputStream(), StandardCharsets.UTF_8))) {
                char[] chunk = new char[4096];
                int n;
                while ((n = reader.read(chunk)) != -1) {
                    if (body.length() + n > 1048576) throw new IOException("Release too large");
                    body.append(chunk, 0, n);
                }
            }
            return evaluate(new JSONObject(body.toString()), installed);
        } finally {
            c.disconnect();
        }
    }

    static JSONObject evaluate(JSONObject release, String installed) throws Exception {
        String tag = release.getString("tag_name");
        if (release.optBoolean("draft") || release.optBoolean("prerelease") ||
                !tag.matches("v?[0-9]+(\\.[0-9]+){3}")) {
            return new JSONObject().put("status", "missing");
        }
        String version = tag.replaceFirst("^v", "");
        if (!newer(version, canonicalInstalled(installed))) return new JSONObject().put("status", "current");
        String expected = "SPIN-RHub-" + version + ".apk";
        JSONArray assets = release.getJSONArray("assets");
        for (int i = 0; i < assets.length(); i++) {
            JSONObject file = assets.getJSONObject(i);
            if (expected.equals(file.optString("name")) && file.optLong("size") > 0 &&
                    "uploaded".equals(file.optString("state"))) {
                String url = file.optString("browser_download_url");
                String prefix = "https://github.com/" + REPO + "/releases/download/" + tag + "/";
                if (!url.equals(prefix + expected)) continue;
                String digest = file.optString("digest", "");
                if (!digest.isEmpty() && !digest.matches("sha256:[a-fA-F0-9]{64}")) continue;
                return new JSONObject().put("status", "available").put("version", version)
                        .put("url", url).put("name", expected).put("size", file.optLong("size"))
                        .put("digest", digest).put("notes", release.optString("body", ""));
            }
        }
        return new JSONObject().put("status", "missing");
    }
}
