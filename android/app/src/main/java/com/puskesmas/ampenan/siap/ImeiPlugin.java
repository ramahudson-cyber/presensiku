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
        JSObject result = new JSObject();

        try {
            Context context = getContext();
            TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);

            String imei = null;
            String serial = null;
            String model = Build.MODEL;

            boolean hasPermission = ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_PRECISE_PHONE_STATE
            ) == PackageManager.PERMISSION_GRANTED;

            if (hasPermission && tm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    imei = tm.getImei();
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        serial = Build.getSerial();
                    } catch (SecurityException e) {
                        serial = null;
                    }
                }
            }

            result.put("imei", imei);
            result.put("serial", serial);
            result.put("model", model);
            result.put("hasPermission", hasPermission);

            call.resolve(result);
        } catch (Exception e) {
            call.reject("ImeiPlugin error: " + e.getMessage());
        }
    }
}
