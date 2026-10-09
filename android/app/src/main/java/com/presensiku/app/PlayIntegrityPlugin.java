package com.presensiku.app;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;
import com.google.android.play.core.integrity.IntegrityTokenResponse;

import java.security.SecureRandom;

/**
 * Play Integrity: minta integrity token dari Google untuk dibuktikan
 * keasliannya di server (Edge Function verify-integrity).
 *
 * Token BUKAN divalidasi di perangkat — perangkat bisa saja dimodifikasi.
 * Perangkat hanya MEMINTA token; server yang memverifikasi ke Google.
 * Nonce dikirim & dikembalikan agar server bisa mencocokkan token ini
 * dengan permintaan absensi tertentu (anti-replay).
 *
 * Plugin ini opsional: bila Play Integrity tidak tersedia di perangkat
 * (mis. tanpa Google Play Services), resolve { available:false } dan client
 * tetap bisa absen — server yang memutuskan lewat setting
 * attendance_require_integrity.
 */
@CapacitorPlugin(name = "PlayIntegrityPlugin")
public class PlayIntegrityPlugin extends Plugin {

    @PluginMethod
    public void requestToken(PluginCall call) {
        try {
            String nonce = call.getString("nonce");
            if (nonce == null || nonce.isEmpty()) {
                nonce = generateNonce();
            }

            IntegrityManager manager = IntegrityManagerFactory.create(getContext());
            IntegrityTokenRequest request = IntegrityTokenRequest.builder()
                    .setNonce(nonce)
                    .build();

            final String finalNonce = nonce;
            manager.requestIntegrityToken(request)
                    .addOnSuccessListener((IntegrityTokenResponse response) -> {
                        JSObject ret = new JSObject();
                        ret.put("available", true);
                        ret.put("token", response.token());
                        ret.put("nonce", finalNonce);
                        call.resolve(ret);
                    })
                    .addOnFailureListener((Exception e) -> {
                        // Gagal minta token (mis. perangkat tanpa Play Services).
                        JSObject ret = new JSObject();
                        ret.put("available", false);
                        ret.put("nonce", finalNonce);
                        ret.put("error", e.getMessage() == null ? "unknown" : e.getMessage());
                        call.resolve(ret);
                    });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("available", false);
            ret.put("error", e.getMessage() == null ? "unknown" : e.getMessage());
            call.resolve(ret);
        }
    }

    private String generateNonce() {
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.NO_WRAP | Base64.URL_SAFE | Base64.NO_PADDING);
    }
}
