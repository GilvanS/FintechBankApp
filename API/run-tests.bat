@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo    NEWMAN TESTS - FintechBankApp
echo ========================================
echo.

REM Verificar se Newman está instalado
newman --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Newman nao esta instalado!
    echo    Instale com: npm install -g newman newman-reporter-html
    pause
    exit /b 1
)

echo ✅ Newman encontrado

REM Verificar se o servidor está rodando
echo 🔍 Verificando servidor...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Servidor nao esta rodando!
    echo    Inicie com: npm start
    echo.
    set /p choice="Deseja iniciar o servidor agora? (s/n): "
    if /i "!choice!"=="s" (
        echo 🚀 Iniciando servidor...
        start "FintechBankApp Server" cmd /k "npm start"
        echo ⏳ Aguardando servidor inicializar...
        timeout /t 10 /nobreak >nul
    ) else (
        pause
        exit /b 1
    )
)

echo ✅ Servidor esta rodando

echo.
echo 🧪 Executando testes Newman...
echo.

REM Gerar nome do relatório com timestamp
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "timestamp=%YYYY%%MM%%DD%-%HH%%Min%%Sec%"

set "reportHtml=newman-report-%timestamp%.html"
set "reportJson=newman-report-%timestamp%.json"

REM Executar Newman
newman run ../postman-collection.json ^
    --reporters cli,html,json ^
    --reporter-html-export "%reportHtml%" ^
    --reporter-json-export "%reportJson%" ^
    --timeout 30000 ^
    --delay-request 500 ^
    --insecure ^
    --color on

set "exitCode=%errorlevel%"

echo.
echo 📄 Relatorios gerados:
echo    📊 HTML: %reportHtml%
echo    📋 JSON: %reportJson%

if %exitCode% equ 0 (
    echo.
    echo 🎉 TODOS OS TESTES PASSARAM! 🎉
    echo ✅ APIs funcionando corretamente
    
    set /p openReport="Deseja abrir o relatorio HTML? (s/n): "
    if /i "!openReport!"=="s" (
        start "" "%reportHtml%"
    )
) else (
    echo.
    echo ⚠️  ALGUNS TESTES FALHARAM
    echo ❌ Verifique o relatorio para mais detalhes
    
    set /p openReport="Deseja abrir o relatorio HTML? (s/n): "
    if /i "!openReport!"=="s" (
        start "" "%reportHtml%"
    )
)

echo.
pause
exit /b %exitCode%