@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ====================================================================
::  schtask_audit_consistency.bat
::  Executa o auditor de consistência (run_audit_consistency_report.js)
::  para Windows Task Scheduler — DIÁRIO, logo após o motor.
::
::  O BillingValidateDaily (01:00) sincroniza users.days_overdue e
::  invoices.dias_atraso via runBillingValidation; esta tarefa (01:30)
::  confere TODAS as invoices fechadas não pagas contra a âncora e o
::  real-time, detectando qualquer drift reintroduzido pelo motor.
::  Exit codes: 0 = sem discrepâncias; 2 = discrepâncias encontradas
::  (via --fail-on-discrepancies, visível no histórico do Task Scheduler);
::  1 = erro de execução. O log fica em scripts/logs/audit_consistency_*.log
::  e o HTML/CSV em API/scripts/audit_report_*.html|csv para análise.
::
::  Uso:   schtask_audit_consistency.bat
:: ====================================================================

set API_DIR=F:\GITHUB\FintechBankApp\API
set LOG_DIR=%API_DIR%\scripts\logs

:: ─── Garantir diretório de log ───
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: ─── Timestamp via PowerShell (mais confiável que wmic, removido no Win 11 24H2) ───
for /f %%I in ('"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"') do set DT=%%I

set LOG_FILE=%LOG_DIR%\audit_consistency_%DT%.log

:: ─── Cabeçalho do log ───
echo ============================================================== > "%LOG_FILE%" 2>&1
echo   FintechBank — Auditoria de Consistência Diária               >> "%LOG_FILE%" 2>&1
echo   %DATE% %TIME%                                                >> "%LOG_FILE%" 2>&1
echo ============================================================== >> "%LOG_FILE%" 2>&1
echo. >> "%LOG_FILE%" 2>&1
echo [1/1] Executando run_audit_consistency_report.js (todas as invoices >> "%LOG_FILE%" 2>&1
echo        fechadas nao pagas + CSV)...                            >> "%LOG_FILE%" 2>&1
echo. >> "%LOG_FILE%" 2>&1

cd /d "%API_DIR%"

:: ─── Única chamada — auditor de consistência com CSV + exit 2 em drift ───
"node" scripts/run_audit_consistency_report.js --csv --fail-on-discrepancies >> "%LOG_FILE%" 2>&1
set EXIT_CODE=%errorlevel%

:: ─── Rodapé do log ───
echo. >> "%LOG_FILE%" 2>&1
echo ============================================================== >> "%LOG_FILE%" 2>&1
echo   Auditoria de Consistência Concluida                         >> "%LOG_FILE%" 2>&1
echo   Exit code: %EXIT_CODE%                                       >> "%LOG_FILE%" 2>&1
echo   Fim: %DATE% %TIME%                                           >> "%LOG_FILE%" 2>&1
echo ============================================================== >> "%LOG_FILE%" 2>&1

:: ─── Exibir resultado no console (visível no Task Scheduler) ───
echo.
echo ==============================================================
echo   Auditoria de Consistência Diária — Finalizada
echo   Exit code: %EXIT_CODE%
echo   Log: %LOG_FILE%
echo   Relatorio: %API_DIR%\scripts\audit_report_*.html
echo ==============================================================
echo.

exit /b %EXIT_CODE%
