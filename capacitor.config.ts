import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fintechbank.app',
  appName: 'Fintech Bank',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e40af',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark'
    }
  }
};

export default config;