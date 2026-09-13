@echo off
REM Wrapper fino: delega pro scripts\start-docker.ps1 -Stop (mesma logica
REM correta de parada, sem duplicar comandos WSL aqui).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-docker.ps1" -Stop
pause
