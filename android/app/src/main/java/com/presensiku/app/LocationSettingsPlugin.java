package com.presensiku.app;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Membuka UI bawaan OS untuk mengaktifkan layanan lokasi (GPS).
 *
 * Dipakai sheet "Lokasi Belum Aktif" pada alur absensi ketika error
 * layanan lokasi terdeteksi (OS-PLUG-GLOC-0007/0009/0014/0016/0017):
 * pegawai diarahkan ke halaman pengaturan Lokasi sistem, mengaktifkan
 * layanan lokasi, lalu kembali ke aplikasi dan menekan "Coba Lagi".
 */
@CapacitorPlugin(name = "LocationSettings")
public class LocationSettingsPlugin extends Plugin {

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        // Utama: halaman Lokasi sistem (toggle Layanan Lokasi / GPS).
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception ignored) {
        }

        // Fallback: beberapa ROM membatasi intent lokasi langsung —
        // buka halaman pengaturan aplikasi sebagai jalan masuk alternatif.
        try {
            Intent fallback = new Intent(Settings.ACTION_APPLICATION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
            call.resolve();
        } catch (Exception e) {
            call.reject("Tidak dapat membuka pengaturan lokasi");
        }
    }
}
