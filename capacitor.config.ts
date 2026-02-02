import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danielsihyun.drinkr.app',
  appName: 'drinkr',
  webDir: 'out',
  server: {
    url: 'https://drink-the-beer.vercel.app',
    cleartext: false
  }
};

export default config;