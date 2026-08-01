@echo off
REM ============================================================
REM  FintechBankApp - Sobe API + WEB + MOBILE em 3 janelas
REM  Uso: clique duplo em start-all.bat ou `start-all.bat` no cmd
REM  Requisito: npm install ja rodou em API\, WEB\ e MOBILE\
REM ============================================================

setlocal
cd /d "%~dp0"

REM --- Pre-flight: node instalado? ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado no PATH. Instale em https://nodejs.org/
    pause
    exit /b 1
)

set API_PORT=3001
set WEB_PORT=3000
set MOBILE_PORT=3002

REM --- Libera portas se ja tiver algo preso ---
echo [1/3] Verificando portas %API_PORT%, %WEB_PORT%, %MOBILE_PORT%...
for %%P in (%API_PORT% %WEB_PORT% %MOBILE_PORT%) do (
    for /f "tokens=5" %%I in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%%P "') do (
        echo   Liberando porta %%P (PID %%I)...
        taskkill /PID %%I /F >nul 2>nul
    )
)

REM --- Sobe a API (porta 3001) ---
echo.
echo [2/3] Iniciando API em http://localhost:%API_PORT% ...
start "API" cmd /k "cd /d %~dp0API && npm run dev"

REM --- Sobe o WEB (porta 3000) ---
echo [3/3] Iniciando WEB em http://localhost:%WEB_PORT% ...
start "WEB" cmd /k "cd /d %~dp0WEB && npm run dev"

REM --- Sobe o MOBILE (porta 3002) ---
echo [BONUS] Iniciando MOBILE em http://localhost:%MOBILE_PORT% ...
start "MOBILE" cmd /k "cd /d %~dp0MOBILE && npm run dev:mobile"

echo.
echo ============================================================
echo  Tudo ligado. 3 janelas abertas.
echo   API    -> http://localhost:%API_PORT%
echo   WEB    -> http://localhost:%WEB_PORT%
echo   MOBILE -> http://localhost:%MOBILE_PORT%
echo  Feche cada janela para parar o servico correspondente.
echo ============================================================
echo.
pause
