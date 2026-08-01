# Run Doc — Fintech Bank App

## Architecture

This project has two servers:

| Server | Port | Directory | Command |
|--------|------|-----------|---------|
| API (Express) | 3001 | `API/` | `node index.cjs` |
| Frontend (Vite + React) | 3000 | `WEB/` | `npx vite --port 3000 --host` |

The Vite dev server proxies `/api` requests to `http://localhost:3001` (see `WEB/vite.config.ts`).

## How to Start

### 1. Start the API server

```bash
cd F:/GITHUB/FintechBankApp/API
node index.cjs
```

Wait for the message: `🎯 Servidor pronto para uso com Databricks!`

### 2. Start the Frontend dev server

```bash
cd F:/GITHUB/FintechBankApp/WEB
npx vite --port 3000 --host
```

### 3. Access the app

Open `http://localhost:3000/FintechBankApp/dashboard` in a browser.

## Login Credentials

| Role | CPF | Password |
|------|-----|----------|
| Admin | 99999999999 | admin999 |
| Massa (test) | 04617745777 | admin999 |

> **Note**: These passwords were reset with `reset_passwords.cjs`. All users now use `admin999`.

## Preview

When both servers are running, register the preview with:

```javascript
register_preview({ url: "http://localhost:3000/FintechBankApp/dashboard", pid: <vite-pid> })
```

## Troubleshooting

- **EADDRINUSE**: Kill existing node processes: `taskkill //F //IM node.exe`
- **Vite hangs on start**: Check `.freebuff/preview-thms0wmkwoq2vx.log` for errors
- **API not connecting**: Verify port 3001 is listening with `netstat -ano | findstr ":3001" | findstr "LISTENING"`
