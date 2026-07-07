import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puskesmas.ampenan.siap',
  appName: 'SIAP Puskesmas',
  webDir: 'dist',
  version: '1.6.7',
  versionCode: 19,
  plugins: {
    Geolocation: {
      permissions: {
        android: {
          requestWhenInUse: true,
          requestAlways: false,
        },
      },
    },
    CapacitorUpdater: {
      autoUpdate: false,
      allowModifyUrl: true,
      version: '1.6.0',
    },
  },
};

export default config;
