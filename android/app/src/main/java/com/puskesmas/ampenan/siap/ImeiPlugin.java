package com.puskesmas.ampenan.siap;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.TelephonyManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

@CapacitorPlugin(
    name = "ImeiPlugin",
    permissions = {
        @Permission(
            alias = "imei",
            strings = { Manifest.permission.READ_PRECISE_PHONE_STATE }
        )
    }
)
public class ImeiPlugin extends Plugin {

    @PluginMethod
    public void getImeiInfo(PluginCall call) {
        // Cek apakah permission sudah granted
        if (getPermissionState("imei") == PermissionState.GRANTED) {
            // Permission sudah ada, langsung ambil IMEI
            returnImeiInfo(call);
        } else {
            // Permission belum ada, request ke user
            requestPermissionForAlias("imei", call, "imeiPermissionCallback");
        }
    }

    /**
     * Callback setelah user response permission request
     */
    @PermissionCallback
    private void imeiPermissionCallback(PluginCall call) {
        if (getPermissionState("imei") == PermissionState.GRANTED) {
            // User approved - ambil IMEI
            returnImeiInfo(call);
        } else {
            // User rejected - return dengan hasPermission = false
            JSObject result = new JSObject();
            result.put("imei", null);
            result.put("serial", null);
            result.put("model", Build.MODEL);
            result.put("hasPermission", false);
            result.put("permissionDenied", true);
            call.resolve(result);
        }
    }

    /**
     * Method untuk mengambil IMEI setelah permission confirmed
     */
    private void returnImeiInfo(PluginCall call) {
        JSObject result = new JSObject();

        try {
            Context context = getContext();
            TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);

            String imei = null;
            String serial = null;
            String model = Build.MODEL;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && tm != null) {
                imei = tm.getImei();
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    serial = Build.getSerial();
                } catch (SecurityException e) {
                    serial = null;
                }
            }

            result.put("imei", imei);
            result.put("serial", serial);
            result.put("model", model);
            result.put("hasPermission", true);
            result.put("permissionDenied", false);

            call.resolve(result);
        } catch (Exception e) {
            call.reject("ImeiPlugin error: " + e.getMessage());
        }
    }
}
