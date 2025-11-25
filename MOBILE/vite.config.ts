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
            target: 'http://192.168.0.110:3001', // IP fixo da rede WiFi
            changeOrigin: true,
            secure: false,
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('Proxying:', req.method, req.url, '→', proxyReq.path);
              });
            },
          }
        }
      },
      preview: {
        port: 3002, // Porta diferente: WEB=3000, API=3001, MOBILE=3002
        host: '0.0.0.0', // Permite acesso via IP da rede no preview também
        cors: true, // Habilita CORS no preview
        proxy: {
          '/api': {
            target: 'http://192.168.0.105:3001', // IP fixo da rede WiFi - API na porta 3001
            changeOrigin: true,
            secure: false, // Para HTTP local
            ws: true, // Para WebSocket se necessário
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('Proxying request:', req.method, req.url, '→', proxyReq.path);
              });
            },
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
