import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.puskesmas.ampenan.siap',
  appName: 'SIAP Puskesmas',
  webDir: 'dist',
  version: '1.2.5',
  versionCode: 8,
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
      version: '1.2.5',
    },
  },
};

export default config;
