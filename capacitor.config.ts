import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puskesmas.ampenan.siap',
  appName: 'SIAP Puskesmas',
  webDir: 'dist',
  version: '1.6.1',
  versionCode: 13,
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
