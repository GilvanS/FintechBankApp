import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
            changeOrigin: true,
            // Quando a API está fora do ar / derruba a conexão, o proxy respondia
            // 500 com corpo VAZIO em text/plain. O front faz response.json() nesse
            // corpo, quebra, e cai no fallback genérico "Request failed" — sem
            // status, sem causa, e (pior) sem o usuário saber se o pagamento foi
            // processado. Aqui devolvemos SEMPRE JSON, com a causa real.
            timeout: 30000,
            proxyTimeout: 30000,
            configure: (proxy) => {
              proxy.on('error', (err, _req, res) => {
                const payload = JSON.stringify({
                  success: false,
                  code: 'API_UNREACHABLE',
                  message: `Não foi possível falar com a API (${err.code || err.message}). A operação pode NÃO ter sido processada — confira antes de tentar de novo.`,
                });
                if (res && 'writeHead' in res && !res.headersSent) {
                  res.writeHead(502, { 'Content-Type': 'application/json' });
                }
                if (res && 'end' in res) res.end(payload);
              });
            },
          }
        }
      },
      plugins: [react(), tailwindcss()],
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
          { find: '@api', replacement: path.resolve(__dirname, '../API') },
          ...(isDemo ? [{
            find: /.*\/services\/api$/,
            replacement: path.resolve(__dirname, 'services/mockApi.ts'),
          }] : []),
        ]
      },
      test: {
        globals: true,
        environment: 'jsdom',
        pool: 'threads',
        server: {
          deps: {
            inline: ['@reduxjs/toolkit', 'recharts']
          }
        },
        setupFiles: './tests/setup.ts',
        include: ['tests/**/*.test.{ts,tsx}'],
        exclude: [
            'node_modules',
            'server',
            'tests/api.integration.test.ts'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['components/**/*.tsx', 'services/**/*.ts', 'context/**/*.tsx'],
            exclude: ['**/*.test.*', 'components/Icons.tsx'],
            thresholds: { statements: 5, branches: 4, functions: 4, lines: 5 },
        },
      }
    };
});
