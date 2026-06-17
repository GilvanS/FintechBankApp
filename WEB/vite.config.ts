import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    const isDemo = process.env.VITE_USE_MOCK_API === 'true';
    return {
      base: '/FintechBankApp/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
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
      resolve: {
        alias: [
          { find: '@', replacement: path.resolve(__dirname, '.') },
          ...(isDemo ? [{
            find: /.*\/services\/api$/,
            replacement: path.resolve(__dirname, 'services/mockApi.ts'),
          }] : []),
        ]
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
        include: ['tests/**/*.test.tsx'],
        exclude: [
            'node_modules', 
            'server',
            'tests/api.integration.test.ts'
        ]
      }
    };
});
