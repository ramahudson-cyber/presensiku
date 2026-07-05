-keep class com.getcapacitor.** { *; }
-keep class com.puskesmas.ampenan.siap.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**
-dontwarn com.google.**
-keep class com.google.android.gms.** { *; }
