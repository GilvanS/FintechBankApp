@echo off
title FintechBank — Teste de Auditoria de Consistencia
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ====================================================================
::  test_audit_consistency.bat
::  Inicia o servidor API, autentica como admin e testa
::  GET /admin/audit-consistency com JSON formatado.
::
::  Uso:   test_audit_consistency.bat [porta]
::  Ex:    test_audit_consistency.bat 3001
:: ====================================================================

set PORT=3001
if not "%1"=="" set PORT=%1

set API_BASE=http://localhost:%PORT%/api
set CPF_ADMIN=99999999999
set SENHA=admin999
set ROOT_DIR=F:\GITHUB\FintechBankApp\API

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   FintechBank — Teste de Auditoria de Consistencia         ║
echo ║   GET /admin/audit-consistency                             ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo [1/5] Parando servidores existentes na porta %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTEN"') do (
    if not "%%a"=="" (
        echo       Processo PID %%a encontrado. Encerrando...
        taskkill /F /PID %%a >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul
echo       OK — porta %PORT% liberada.
echo.

echo [2/5] Iniciando servidor API em segundo plano...
start "BillingValidation" cmd /c "cd /d %ROOT_DIR% && node index.cjs > server_log.txt 2>&1"
echo       Aguardando servidor iniciar...
timeout /t 5 /nobreak >nul

:: Verificar se o servidor subiu
set SERVER_UP=0
for /l %%i in (1,1,15) do (
    ping -n 1 -w 500 127.0.0.1 >nul
    curl -s --max-time 2 %API_BASE%/health >nul 2>&1
    if !errorlevel! equ 0 (
        set SERVER_UP=1
        goto :SERVER_OK
    )
    echo       Tentativa %%i/15 — aguardando...
)
:SERVER_OK

if !SERVER_UP! equ 0 (
    echo.
    echo   ❌ ERRO: Servidor nao respondeu apos 15 tentativas.
    echo      Veja o log em: %ROOT_DIR%\server_log.txt
    echo.
    pause
    exit /b 1
)

echo       ✅ Servidor online — %API_BASE%/health
echo.

echo [3/5] Autenticando como admin (%CPF_ADMIN%)...
for /f "delims=" %%t in ('curl -s --max-time 10 -X POST %API_BASE%/auth/login ^
    -H "Content-Type: application/json" ^
    -d "{\"cpf\":\"%CPF_ADMIN%\",\"password\":\"%SENHA%\"}"') do set LOGIN_RESP=%%t

:: Extrair token usando PowerShell
for /f "delims=" %%t in ('powershell -NoProfile -Command ^
    "$r = '%LOGIN_RESP%' | ConvertFrom-Json; Write-Host $r.token" 2^>nul') do set TOKEN=%%t

if "%TOKEN%"=="" (
    echo   ❌ ERRO: Falha na autenticacao.
    echo      Resposta: %LOGIN_RESP%
    goto :FIM
)
echo       ✅ Token obtido: %TOKEN:~0,20%...
echo.

echo [4/5] Executando GET /admin/audit-consistency...
echo.

set RESP_FILE=%TEMP%\audit_response.json

curl -s --max-time 30 -X GET "%API_BASE%/admin/audit-consistency" ^
    -H "Authorization: Bearer %TOKEN%" ^
    -H "Accept: application/json" > "%RESP_FILE%" 2>&1

if %errorlevel% neq 0 (
    echo   ❌ ERRO: Falha na requisicao.
    goto :FIM
)

echo [5/5] Resultado da Auditoria — JSON Formatado:
echo ================================================================

:: Formatar JSON com PowerShell
powershell -NoProfile -Command ^
    "$json = Get-Content '%RESP_FILE%' -Raw | ConvertFrom-Json; ^
     $summary = $json.summary; ^
     if ($json.success) { ^
         Write-Host ''; ^
         Write-Host ('  ✅ success: ' + $json.success) -ForegroundColor Green; ^
         Write-Host ''; ^
         Write-Host ('  📊 Usuarios escaneados:    ' + $summary.totalScanned) -ForegroundColor Cyan; ^
         Write-Host ('  ✅ Consistentes:            ' + $summary.usersConsistent) -ForegroundColor Green; ^
         $d = $summary.usersDesatualizados; ^
         if ($d -gt 0) { ^
             Write-Host ('  ⚠️  Desatualizados:          ' + $d) -ForegroundColor Red; ^
         } else { ^
             Write-Host ('  ✅ Desatualizados:          ' + $d) -ForegroundColor Green; ^
         } ^
         Write-Host ('  📄 Total de invoices:       ' + $summary.totalInvoices) -ForegroundColor Cyan; ^
         Write-Host ('  ✅ Invoices consistentes:    ' + $summary.invoicesConsistent) -ForegroundColor Green; ^
         Write-Host ('  ⚠️  Invoices desatualizadas: ' + $summary.invoicesDesatualizadas) -ForegroundColor Yellow; ^
         Write-Host ''; ^
         if ($json.details -and $json.details.Count -gt 0) { ^
             Write-Host ('  🔍 Detalhes das discrepancias (' + $json.details.Count + '):') -ForegroundColor Yellow; ^
             foreach ($d in $json.details) { ^
                 Write-Host ('    • CPF: ' + $d.cpf + ' | Status: ' + $d.status + ' | Diff (user): ' + $d.diffUser + ' | Diff (invoice): ' + $d.diffInvoice); ^
             } ^
         } else { ^
             Write-Host ('  ✅ Nenhuma discrepancia encontrada!') -ForegroundColor Green; ^
         } ^
         Write-Host ''; ^
         Write-Host ('  💡 ' + $json.tip) -ForegroundColor DarkYellow; ^
     } else { ^
         Write-Host ('  ❌ Erro: ' + $json.message) -ForegroundColor Red; ^
     }" 2>&1

if %errorlevel% neq 0 (
    echo.
    echo   ⚠️  Nao foi possivel formatar o JSON. Exibindo cru:
    echo.
    type "%RESP_FILE%"
)

echo.
echo ================================================================
echo   Log completo salvo em: %RESP_FILE%
echo.

:FIM
echo.
echo   🔹 Para testar novamente com um CPF especifico:
echo   curl "%API_BASE%/admin/audit-consistency?cpf=02816769844" -H "Authorization: Bearer %TOKEN%"
echo.
echo   🔹 Para atualizar a auditoria com --fix:
echo   node %ROOT_DIR%\scripts\audit_completo.js --fix --confirm
echo.
pause
