# Script PowerShell COMPLETO para Gerar APK Debug
# Execute: .\GERAR-APK-COMPLETO.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Gerando APK COMPLETO do FintechBankApp" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se esta no diretorio correto
if (-not (Test-Path "package.json")) {
    Write-Host "ERRO: Execute este script no diretorio MOBILE" -ForegroundColor Red
    exit 1
}

# Passo 1: Limpar builds antigos
Write-Host "Passo 1: Limpando builds antigos..." -ForegroundColor Yellow

if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host "   OK: Pasta dist removida" -ForegroundColor Green
}

if (Test-Path "android") {
    Set-Location "android"
    if (Test-Path "gradlew.bat") {
        Write-Host "   Executando gradlew clean..." -ForegroundColor Yellow
        & .\gradlew.bat clean 2>&1 | Out-Null
        Write-Host "   OK: Gradle clean executado" -ForegroundColor Green
    }
    Set-Location ".."
}

# Passo 2: Build do projeto web
Write-Host ""
Write-Host "Passo 2: Build do projeto web (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERRO: Erro no build do Vite" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Build do Vite concluido" -ForegroundColor Green

# Passo 3: Sincronizar com Android
Write-Host ""
Write-Host "Passo 3: Sincronizando com Android (Capacitor)..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERRO: Erro na sincronizacao do Capacitor" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Capacitor sincronizado" -ForegroundColor Green

# Passo 4: Build do APK via Gradle
Write-Host ""
Write-Host "Passo 4: Gerando APK Debug via Gradle..." -ForegroundColor Yellow
Set-Location "android"

if (Test-Path "gradlew.bat") {
    Write-Host "   Executando gradlew assembleDebug..." -ForegroundColor Yellow
    & .\gradlew.bat assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: APK gerado com sucesso!" -ForegroundColor Green
        
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            $apkSize = (Get-Item $apkPath).Length / 1MB
            Write-Host "   APK: $apkPath ($([math]::Round($apkSize, 2)) MB)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ERRO: Erro ao gerar APK" -ForegroundColor Red
        Set-Location ".."
        exit 1
    }
} else {
    Write-Host "   ERRO: gradlew.bat nao encontrado" -ForegroundColor Red
    Set-Location ".."
    exit 1
}

Set-Location ".."

# Passo 5: Instalar APK (opcional)
Write-Host ""
Write-Host "Passo 5: Instalando APK no dispositivo..." -ForegroundColor Yellow

# Verificar se adb esta disponivel
$adbCheck = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCheck) {
    # Verificar se ha dispositivo conectado
    $devices = adb devices | Select-String "device$"
    if ($devices) {
        Write-Host "   Dispositivo detectado" -ForegroundColor Green
        
        # Desinstalar versao antiga
        Write-Host "   Desinstalando versao antiga..." -ForegroundColor Yellow
        adb uninstall com.fintechbank.app 2>&1 | Out-Null
        
        # Instalar novo APK
        $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            Write-Host "   Instalando novo APK..." -ForegroundColor Yellow
            adb install -r $apkPath
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   OK: APK instalado com sucesso!" -ForegroundColor Green
            } else {
                Write-Host "   AVISO: Erro ao instalar APK (pode ser necessario instalar manualmente)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ERRO: APK nao encontrado em $apkPath" -ForegroundColor Red
        }
    } else {
        Write-Host "   AVISO: Nenhum dispositivo conectado" -ForegroundColor Yellow
        Write-Host "   Conecte um dispositivo ou emulador e execute:" -ForegroundColor Cyan
        Write-Host "      adb install android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
    }
} else {
    Write-Host "   AVISO: ADB nao encontrado no PATH" -ForegroundColor Yellow
    Write-Host "   Instale manualmente o APK ou configure o ADB" -ForegroundColor Cyan
}

# Resumo final
Write-Host ""
Write-Host "Processo COMPLETO concluido!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

Write-Host "APK gerado em:" -ForegroundColor Yellow
Write-Host "   android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
Write-Host ""

Write-Host "Verificar versao:" -ForegroundColor Yellow
Write-Host "   Abra o app -> Perfil -> Informacoes do App" -ForegroundColor White
Write-Host "   Deve mostrar: 4.0.1-20250127" -ForegroundColor White
Write-Host ""
