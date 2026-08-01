@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: ====================================================================
::  schtask_audit_all.bat
::  Executa a auditoria completa (run_audit_all.js) para Windows Task
::  Scheduler. O script run_audit_all.js já executa as 3 auditorias
::  internamente via child_process.spawn.
::
::  Uso:   schtask_audit_all.bat
:: ====================================================================

set API_DIR=F:\GITHUB\FintechBankApp\API
set LOG_DIR=%API_DIR%\scripts\logs

:: ─── Garantir diretório de log ───
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: ─── Timestamp via PowerShell (mais confiável que wmic, removido no Win 11 24H2) ───
for /f %%I in ('"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"') do set DT=%%I

set LOG_FILE=%LOG_DIR%\audit_all_%DT%.log
set CSV_FLAG=--csv

:: ─── Cabeçalho do log ───
echo ============================================================== > "%LOG_FILE%" 2>&1
echo   FintechBank — Auditoria Completa Semanal                    >> "%LOG_FILE%" 2>&1
echo   %DATE% %TIME%                                                >> "%LOG_FILE%" 2>&1
echo ============================================================== >> "%LOG_FILE%" 2>&1
echo. >> "%LOG_FILE%" 2>&1
echo [1/1] Executando run_audit_all.js (consistencia + double-counting >> "%LOG_FILE%" 2>&1
echo        + saldo negativo + relatorio HTML unificado)...          >> "%LOG_FILE%" 2>&1
echo. >> "%LOG_FILE%" 2>&1

cd /d "%API_DIR%"

:: ─── Única chamada — run_audit_all.js já executa as outras 2 internamente ───
"node" scripts/run_audit_all.js %CSV_FLAG% >> "%LOG_FILE%" 2>&1
set EXIT_CODE=%errorlevel%

:: ─── Rodapé do log ───
echo. >> "%LOG_FILE%" 2>&1
echo ============================================================== >> "%LOG_FILE%" 2>&1
echo   Auditoria Concluida                                         >> "%LOG_FILE%" 2>&1
echo   Exit code: %EXIT_CODE%                                       >> "%LOG_FILE%" 2>&1
echo   Fim: %DATE% %TIME%                                           >> "%LOG_FILE%" 2>&1
echo ============================================================== >> "%LOG_FILE%" 2>&1

:: ─── Exibir resultado no console (visível no Task Scheduler) ───
echo.
echo ==============================================================
echo   Auditoria Completa Semanal — Finalizada
echo   Exit code: %EXIT_CODE%
echo   Log: %LOG_FILE%
echo   Relatorio: %API_DIR%\scripts\audit_all_report_*.html
echo ==============================================================
echo.

exit /b %EXIT_CODE%
