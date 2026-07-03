import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puskesmas.ampenan.siap',
  appName: 'SIAP Puskesmas',
  webDir: 'dist',
  version: '1.2.4',
  versionCode: 7,
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
