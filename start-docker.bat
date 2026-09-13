@echo off
REM Wrapper fino: toda a logica correta (mata Desktop, liga docker-ce no WSL,
REM espera dockerd responder, sobe Postgres+Redis) mora em scripts\start-docker.ps1.
REM Nao duplica a logica aqui pra nao reintroduzir a race condition do service start.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-docker.ps1" %*
pause
