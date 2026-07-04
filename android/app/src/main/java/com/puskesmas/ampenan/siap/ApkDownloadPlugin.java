package com.puskesmas.ampenan.siap;

import android.content.Intent;
import android.net.Uri;
import android.os.Environment;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkDownloadPlugin")
public class ApkDownloadPlugin extends Plugin {

    private volatile boolean cancelled = false;

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        String version = call.getString("version");

        if (url == null) {
            call.reject("URL required");
            return;
        }

        cancelled = false;

        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();

                int contentLength = conn.getContentLength();

                File downloadDir = new File(
                    getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                    "apk"
                );
                downloadDir.mkdirs();

                String fileName = "SIAP-Puskesmas-" + (version != null ? version : "latest") + ".apk";
                File apkFile = new File(downloadDir, fileName);
                if (apkFile.exists()) apkFile.delete();

                InputStream input = conn.getInputStream();
                FileOutputStream output = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalRead = 0;
                long lastNotify = 0;

                while ((bytesRead = input.read(buffer)) != -1) {
                    if (cancelled) {
                        input.close();
                        output.close();
                        apkFile.delete();
                        call.reject("Cancelled");
                        return;
                    }

                    output.write(buffer, 0, bytesRead);
                    totalRead += bytesRead;

                    long now = System.currentTimeMillis();
                    if (now - lastNotify > 200) {
                        lastNotify = now;
                        int percent = contentLength > 0
                            ? (int) (totalRead * 100 / contentLength)
                            : 0;
                        JSObject progress = new JSObject();
                        progress.put("percent", Math.min(percent, 99));
                        progress.put("bytesLoaded", totalRead);
                        progress.put("bytesTotal", contentLength);
                        notifyListeners("downloadProgress", progress);
                    }
                }

                output.flush();
                output.close();
                input.close();

                final long finalTotal = totalRead;
                final int finalContent = contentLength;
                notifyListeners("downloadProgress", new JSObject() {{
                    put("percent", 100);
                    put("bytesLoaded", finalTotal);
                    put("bytesTotal", finalContent);
                }});

                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
                );

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getContext().startActivity(installIntent);

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);

            } catch (Exception e) {
                JSObject error = new JSObject();
                error.put("success", false);
                error.put("error", e.getMessage());
                call.resolve(error);
            }
        }).start();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelled = true;
        call.resolve();
    }
}
