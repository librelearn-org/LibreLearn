import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.librelearn.app',
  appName: 'LibreLearn',
  webDir: 'build/client',
  server: {
    androidScheme: 'https',
    hostname: 'librelearn.nl',
    url: 'https://librelearn.nl',
    cleartext: true
  }
};

export default config;
