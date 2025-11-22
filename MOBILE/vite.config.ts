// Configuração Vite/Esbuild: adicionar target ES2020
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0', // Permite acesso via IP da rede
        proxy: {
          '/api': {
            target: 'http://192.168.0.105:3001', // IP fixo da rede WiFi
            changeOrigin: true
          }
        }
      },
      preview: {
        port: 3000,
        host: '0.0.0.0', // Permite acesso via IP da rede no preview também
        proxy: {
          '/api': {
            target: 'http://192.168.0.105:3001', // IP fixo da rede WiFi
            changeOrigin: true
          }
        }
      },
      plugins: [react()],
      esbuild: {
        target: 'es2020'
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'es2020'
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: 'tests/setup.ts'
      }
    };
});
