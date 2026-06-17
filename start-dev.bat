@echo off
echo Iniciando API (Backend) e WEB (Frontend) em abas do Windows Terminal...

:: O comando 'wt' abre o Windows Terminal. 
:: A primeira aba abre na pasta API, e a diretiva '; new-tab' abre a segunda aba na pasta WEB.
wt -d "%~dp0API" cmd /k "title Fintech API && npm run dev" ; new-tab -d "%~dp0WEB" cmd /k "title Fintech WEB && npm run dev"
