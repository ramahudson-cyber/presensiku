import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puskesmas.ampenan.siap',
  appName: 'SIAP Puskesmas',
  webDir: 'dist',
  version: '1.1.0',
  versionCode: 2,
  plugins: {
    Geolocation: {
      permissions: {
        android: {
          requestWhenInUse: true,
          requestAlways: false,
        },
      },
    },
  },
};

export default config;
