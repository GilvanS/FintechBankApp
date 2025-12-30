# Script PowerShell para Gerar APK do ZERO (Limpeza TOTAL)
# Execute: .\GERAR-APK-DO-ZERO.ps1
# Este script limpa TUDO e gera o APK como se fosse a primeira vez

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Gerando APK do ZERO (Limpeza TOTAL)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se esta no diretorio correto
if (-not (Test-Path "package.json")) {
    Write-Host "ERRO: Execute este script no diretorio MOBILE" -ForegroundColor Red
    exit 1
}

# Verificar versao ANTES de começar
Write-Host "Verificando versao atual..." -ForegroundColor Yellow
$appVersion = Get-Content "src\utils\AppVersion.ts" | Select-String "_version ="
$packageVersion = (Get-Content "package.json" | ConvertFrom-Json).version
$buildGradle = Get-Content "android\app\build.gradle" | Select-String "versionName"

Write-Host "   AppVersion.ts: $appVersion" -ForegroundColor Cyan
Write-Host "   package.json: $packageVersion" -ForegroundColor Cyan
Write-Host "   build.gradle: $buildGradle" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Limpeza TOTAL
Write-Host "Passo 1: Limpeza TOTAL (como primeira vez)..." -ForegroundColor Yellow
Write-Host ""

# Limpar dist
if (Test-Path "dist") {
    Write-Host "   [1.1] Removendo pasta dist..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host "   OK: Pasta dist removida" -ForegroundColor Green
}

# Limpar cache do Vite (mais genérico: .cache)
if (Test-Path "node_modules\.cache") {
    Write-Host "   [1.2] Removendo cache do Vite..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "   OK: Cache do Vite removido" -ForegroundColor Green
}

# Limpar Android COMPLETO
if (Test-Path "android") {
    Write-Host "   [1.3] Limpando Android completamente..." -ForegroundColor Yellow
    Set-Location "android"
    
    # Gradle clean
    if (Test-Path "gradlew.bat") {
        Write-Host "      Executando gradlew clean..." -ForegroundColor Yellow
        & .\gradlew.bat clean 2>&1 | Out-Null
    }
    
    # Remover pasta build do app
    if (Test-Path "app\build") {
        Write-Host "      Removendo app\build..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "app\build" -ErrorAction SilentlyContinue
        Write-Host "      OK: app\build removida" -ForegroundColor Green
    }
    
    # Remover pasta build do projeto
    if (Test-Path "build") {
        Write-Host "      Removendo build..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force "build" -ErrorAction SilentlyContinue
        Write-Host "      OK: build removida" -ForegroundColor Green
    }
    
    # Limpar cache do Gradle (importante para limpeza completa)
    if (Test-Path ".gradle") {
        Write-Host "      Removendo cache do Gradle..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force ".gradle" -ErrorAction SilentlyContinue
        Write-Host "      OK: Cache do Gradle removido" -ForegroundColor Green
    }
    
    Set-Location ".."
    Write-Host "   OK: Android limpo completamente" -ForegroundColor Green
}

# Limpar assets do Capacitor (forcar recriacao)
if (Test-Path "android\app\src\main\assets") {
    Write-Host "   [1.4] Removendo assets antigos do Capacitor..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "android\app\src\main\assets" -ErrorAction SilentlyContinue
    Write-Host "   OK: Assets antigos removidos" -ForegroundColor Green
}

Write-Host ""

# Passo 2: Verificar e instalar dependencias (se necessario)
Write-Host "Passo 2: Verificando dependencias..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   Instalando dependencias npm..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERRO: Falha ao instalar dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "   OK: Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "   OK: node_modules existe" -ForegroundColor Green
}
Write-Host ""

# Passo 3: Verificar versao novamente
Write-Host "Passo 3: Verificando versao antes de gerar APK..." -ForegroundColor Yellow
$appVersionFile = "src\utils\AppVersion.ts"
if (Test-Path $appVersionFile) {
    $appVersionContent = Get-Content $appVersionFile -Raw
    if ($appVersionContent -match '_version = "([^"]+)"') {
        $version = $matches[1]
        Write-Host "   Versao no AppVersion.ts: $version" -ForegroundColor Cyan
        Write-Host "   OK: Versao verificada" -ForegroundColor Green
    }
}
Write-Host ""

# Passo 4: Build do projeto web
Write-Host "Passo 4: Build do projeto web (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERRO: Erro no build do Vite" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "dist")) {
    Write-Host "   ERRO: Pasta dist nao foi criada" -ForegroundColor Red
    exit 1
}

Write-Host "   OK: Build do Vite concluido" -ForegroundColor Green
Write-Host ""

# Passo 5: Sincronizar com Android
Write-Host "Passo 5: Sincronizando com Android (Capacitor)..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERRO: Erro na sincronizacao do Capacitor" -ForegroundColor Red
    exit 1
}

# Verificar se os arquivos foram copiados
if (Test-Path "android\app\src\main\assets\public") {
    Write-Host "   OK: Arquivos sincronizados para Android" -ForegroundColor Green
} else {
    Write-Host "   AVISO: Pasta assets/public nao encontrada" -ForegroundColor Yellow
}
Write-Host ""

# Passo 6: Build do APK via Gradle
Write-Host "Passo 6: Gerando APK Debug via Gradle..." -ForegroundColor Yellow
Set-Location "android"

if (Test-Path "gradlew.bat") {
    Write-Host "   Executando gradlew assembleDebug..." -ForegroundColor Yellow
    & .\gradlew.bat assembleDebug --no-daemon
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK: APK gerado com sucesso!" -ForegroundColor Green
        
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            $apkSize = (Get-Item $apkPath).Length / 1MB
            $apkDate = (Get-Item $apkPath).LastWriteTime
            Write-Host "   APK: $apkPath" -ForegroundColor Cyan
            Write-Host "   Tamanho: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Cyan
            Write-Host "   Data: $apkDate" -ForegroundColor Cyan
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

# Passo 7: Instalar APK (opcional)
Write-Host ""
Write-Host "Passo 7: Instalando APK no dispositivo..." -ForegroundColor Yellow

$adbCheck = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCheck) {
    $devices = adb devices | Select-String "device$"
    if ($devices) {
        Write-Host "   Dispositivo detectado" -ForegroundColor Green
        
        Write-Host "   Desinstalando versao antiga..." -ForegroundColor Yellow
        adb uninstall com.fintechbank.app 2>&1 | Out-Null
        
        $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            Write-Host "   Instalando novo APK..." -ForegroundColor Yellow
            adb install -r $apkPath
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   OK: APK instalado com sucesso!" -ForegroundColor Green
            } else {
                Write-Host "   AVISO: Erro ao instalar APK" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   AVISO: Nenhum dispositivo conectado" -ForegroundColor Yellow
    }
} else {
    Write-Host "   AVISO: ADB nao encontrado" -ForegroundColor Yellow
}

# Resumo final
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Processo COMPLETO concluido!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "APK gerado em:" -ForegroundColor Yellow
Write-Host "   android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
Write-Host ""

Write-Host "Verificar versao no app:" -ForegroundColor Yellow
Write-Host "   Abra o app -> Perfil -> Informacoes do App" -ForegroundColor White
Write-Host ""

Write-Host "DICA: Se a versao ainda estiver antiga:" -ForegroundColor Yellow
Write-Host "   1. Verifique AppVersion.ts, package.json e build.gradle" -ForegroundColor White
Write-Host "   2. Desinstale o app: adb uninstall com.fintechbank.app" -ForegroundColor White
Write-Host "   3. Execute este script novamente" -ForegroundColor White
Write-Host ""
