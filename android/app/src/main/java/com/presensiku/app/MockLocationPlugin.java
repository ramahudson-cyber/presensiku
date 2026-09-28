package com.puskesmas.ampenan.siap;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * Deteksi mock/fake location untuk keperluan anti-fraud absensi.
 *
 * Tiga sumber deteksi:
 *  1. AppOpsManager op "android:mock_location" — aplikasi mana pun yang
 *     diizinkan memalsukan lokasi (Developer Options > Mock location app).
 *  2. Flag mock pada fix GPS terakhir yang masih segar (< 10 menit).
 *  3. Setting lama Settings.Secure.ALLOW_MOCK_LOCATION (Android < 6.0).
 */
@CapacitorPlugin(
    name = "MockLocationPlugin",
    permissions = {
        @Permission(
            alias = "mockLocation",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class MockLocationPlugin extends Plugin {

    private static final long MAX_FIX_AGE_MS = 10L * 60 * 1000;

    @PluginMethod
    public void detect(PluginCall call) {
        if (getPermissionState("mockLocation") == PermissionState.GRANTED) {
            runDetection(call);
        } else {
            requestPermissionForAlias("mockLocation", call, "mockPermissionCallback");
        }
    }

    @PermissionCallback
    private void mockPermissionCallback(PluginCall call) {
        // Deteksi AppOps tetap berjalan walau izin lokasi ditolak.
        runDetection(call);
    }

    @SuppressLint("InlinedApi")
    private void runDetection(PluginCall call) {
        Context ctx = getContext();
        boolean mockAppDetected = false;
        boolean lastFixMocked = false;
        boolean hasRecentFix = false;
        boolean legacyMockSetting = false;
        List<String> mockApps = new ArrayList<>();

        // 1) Aplikasi dengan izin mock location aktif.
        try {
            AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            PackageManager pm = ctx.getPackageManager();
            List<PackageInfo> installed = pm.getInstalledPackages(0);
            if (ops != null && installed != null) {
                for (PackageInfo pkg : installed) {
                    if (pkg.applicationInfo == null) continue;
                    int mode = checkMockOp(ops, pkg.applicationInfo.uid, pkg.packageName);
                    if (mode == AppOpsManager.MODE_ALLOWED) {
                        mockApps.add(pkg.packageName);
                        mockAppDetected = true;
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 2) Flag mock pada fix terakhir yang masih segar.
        try {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED) {
                LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    String[] providers = {
                        LocationManager.GPS_PROVIDER,
                        LocationManager.NETWORK_PROVIDER,
                        LocationManager.FUSED_PROVIDER,
                        LocationManager.PASSIVE_PROVIDER
                    };
                    long now = System.currentTimeMillis();
                    for (String provider : providers) {
                        try {
                            Location loc = lm.getLastKnownLocation(provider);
                            if (loc == null) continue;
                            if (now - loc.getTime() > MAX_FIX_AGE_MS) continue;
                            hasRecentFix = true;
                            if (isMock(loc)) {
                                lastFixMocked = true;
                                break;
                            }
                        } catch (SecurityException | IllegalArgumentException ignored) {
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 3) Setting mock location gaya lama.
        try {
            String allow = Settings.Secure.getString(
                ctx.getContentResolver(), Settings.Secure.ALLOW_MOCK_LOCATION);
            legacyMockSetting = "1".equals(allow);
        } catch (Exception ignored) {
        }

        JSArray appsArray = new JSArray();
        for (String app : mockApps) {
            appsArray.put(app);
        }

        JSObject result = new JSObject();
        result.put("mockAppDetected", mockAppDetected);
        result.put("mockApps", appsArray);
        result.put("lastFixMocked", lastFixMocked);
        result.put("hasRecentFix", hasRecentFix);
        result.put("legacyMockSetting", legacyMockSetting);
        result.put("isMock", mockAppDetected || lastFixMocked || legacyMockSetting);
        call.resolve(result);
    }

    private int checkMockOp(AppOpsManager ops, int uid, String packageName) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return ops.unsafeCheckOpNoThrow("android:mock_location", uid, packageName);
            }
            // Di bawah Android 10, versi int dari checkOpNoThrow adalah API @hide —
            // diakses lewat refleksi.
            int opCode = mockOpCodeLegacy();
            if (opCode < 0) return AppOpsManager.MODE_DEFAULT;
            Object mode = AppOpsManager.class
                .getMethod("checkOpNoThrow", int.class, int.class, String.class)
                .invoke(ops, opCode, uid, packageName);
            return (Integer) mode;
        } catch (Exception e) {
            return AppOpsManager.MODE_DEFAULT;
        }
    }

    /** AppOpsManager.OP_MOCK_LOCATION adalah konstanta @hide — diambil via refleksi. */
    private int mockOpCodeLegacy() {
        try {
            return AppOpsManager.class.getField("OP_MOCK_LOCATION").getInt(null);
        } catch (Exception e) {
            return -1;
        }
    }

    private boolean isMock(Location loc) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return loc.isMock();
        }
        @SuppressWarnings("deprecation")
        boolean mocked = loc.isFromMockProvider();
        return mocked;
    }
}
