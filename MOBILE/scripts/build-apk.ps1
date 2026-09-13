# Script de build limpo e geracao de APK
param (
    [switch]$Release
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "1. Parando processos Java/Gradle ativos..." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Stop-Process -Name "java" -Force -ErrorAction SilentlyContinue

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "2. Limpando caches corrompidos do Gradle..." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
$gradleCachePath = "F:\GITHUB\FintechBankApp\gradle-home-clean\caches"
if (Test-Path $gradleCachePath) {
    Remove-Item -Recurse -Force $gradleCachePath -ErrorAction SilentlyContinue
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "3. Compilando Web assets (npm run build)..." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Set-Location "F:\GITHUB\FintechBankApp\MOBILE"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro na etapa de build Web!" -ForegroundColor Red
    exit 1
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "4. Sincronizando assets com Capacitor..." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro na sincronizacao do Capacitor!" -ForegroundColor Red
    exit 1
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "5. Executando Gradle clean e build APK..." -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Set-Location "F:\GITHUB\FintechBankApp\MOBILE\android"
.\gradlew clean

if ($Release) {
    Write-Host "Gerando APK Release..." -ForegroundColor Green
    .\gradlew assembleRelease
} else {
    Write-Host "Gerando APK Debug..." -ForegroundColor Green
    .\gradlew assembleDebug
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "APK Gerado com sucesso!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Cyan
} else {
    Write-Host "Falha na geracao do APK!" -ForegroundColor Red
    exit 1
}
