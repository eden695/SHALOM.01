import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shalom.app',
  appName: 'SHALOM',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
