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

# Gerar versao automatica com data e hora atual (ex: 4.0.4-20250128-1430)
$baseVersion = "4.0.4"
$dateStr = Get-Date -Format "yyyyMMdd"
$timeStr = Get-Date -Format "HHmm"
$versionName = "$baseVersion-$dateStr-$timeStr"
$buildStr = "$dateStr-$timeStr"
# versionCode Android: inteiro 32-bit (max 2147483647). Formato: yyyyMMdd*100+HH para caber
$versionCode = [int](Get-Date -Format "yyyyMMdd") * 100 + [int](Get-Date -Format "HH")

Write-Host "Atualizando versao para data/hora da geracao..." -ForegroundColor Yellow
Write-Host "   Versao: $versionName" -ForegroundColor Cyan
Write-Host "   versionCode (Android): $versionCode" -ForegroundColor Cyan
Write-Host ""

# Escrever arquivo em UTF-8 SEM BOM (evita erro "Unexpected token ''" no Vite/JSON)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
function Write-Utf8NoBom { param($Path, $Value) [System.IO.File]::WriteAllText((Join-Path (Get-Location) $Path), $Value, $utf8NoBom) }

# Atualizar AppVersion.ts
$appVersionPath = "src\utils\AppVersion.ts"
if (Test-Path $appVersionPath) {
    $content = Get-Content $appVersionPath -Raw
    $content = $content -replace 'private static readonly _version = "[^"]*";', "private static readonly _version = `"$versionName`";"
    $content = $content -replace 'private static readonly _build = "[^"]*";', "private static readonly _build = `"$buildStr`";"
    Write-Utf8NoBom -Path $appVersionPath -Value $content.TrimEnd()
    Write-Host "   OK: AppVersion.ts atualizado (_version, _build)" -ForegroundColor Green
} else {
    Write-Host "   AVISO: AppVersion.ts nao encontrado" -ForegroundColor Yellow
}

# Atualizar android\app\build.gradle (versionCode e versionName)
$buildGradlePath = "android\app\build.gradle"
if (Test-Path $buildGradlePath) {
    $content = Get-Content $buildGradlePath -Raw
    $content = $content -replace 'versionCode \d+', "versionCode $versionCode"
    $content = $content -replace 'versionName "[^"]*"', "versionName `"$versionName`""
    Write-Utf8NoBom -Path $buildGradlePath -Value $content.TrimEnd()
    Write-Host "   OK: build.gradle atualizado (versionCode, versionName)" -ForegroundColor Green
} else {
    Write-Host "   AVISO: build.gradle nao encontrado" -ForegroundColor Yellow
}

# Atualizar package.json (version) - UTF-8 sem BOM para Vite/PostCSS nao falharem
$packagePath = "package.json"
if (Test-Path $packagePath) {
    $content = Get-Content $packagePath -Raw
    $content = $content -replace '("version"\s*:\s*)"[^"]*"', "`${1}`"$versionName`""
    Write-Utf8NoBom -Path $packagePath -Value $content.TrimEnd()
    Write-Host "   OK: package.json atualizado (version)" -ForegroundColor Green
} else {
    Write-Host "   AVISO: package.json nao encontrado" -ForegroundColor Yellow
}

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
    
    # Gradle clean (falha nao interrompe: pastas build serao removidas manualmente em seguida)
    if (Test-Path "gradlew.bat") {
        Write-Host "      Executando gradlew clean..." -ForegroundColor Yellow
        $gradleOut = $null
        try {
            $gradleOut = & .\gradlew.bat clean 2>&1
        } catch {
            Write-Host "      AVISO: gradlew clean gerou erro do PowerShell (continuando...)" -ForegroundColor Yellow
        }
        if ($LASTEXITCODE -ne 0 -and $gradleOut) {
            Write-Host "      Saida do Gradle (codigo $LASTEXITCODE):" -ForegroundColor Yellow
            $gradleOut | ForEach-Object { Write-Host "        $_" -ForegroundColor Gray }
        }
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
# Usar build:mobile se set-ip.js existir (configura API para dispositivo); senao build normal
if (Test-Path "set-ip.js") {
    Write-Host "   Usando npm run build:mobile (set-ip.js encontrado)..." -ForegroundColor Cyan
    npm run build:mobile
} else {
    npm run build
}
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

# Verificar se os arquivos foram copiados (Capacitor coloca webDir em assets/public)
if (Test-Path "android\app\src\main\assets\public") {
    Write-Host "   OK: Arquivos sincronizados para Android" -ForegroundColor Green
} elseif (Test-Path "android\app\src\main\assets") {
    Write-Host "   OK: Assets sincronizados (estrutura Capacitor)" -ForegroundColor Green
} else {
    Write-Host "   AVISO: Pasta assets nao encontrada apos sync" -ForegroundColor Yellow
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
        
        # APK assinado (debug) deve ser app-debug.apk; unsigned nao instala
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            $apkSize = (Get-Item $apkPath).Length / 1MB
            $apkDate = (Get-Item $apkPath).LastWriteTime
            Write-Host "   APK (assinado): $apkPath" -ForegroundColor Cyan
            Write-Host "   Tamanho: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Cyan
            Write-Host "   Data: $apkDate" -ForegroundColor Cyan
        } else {
            Write-Host "   AVISO: app-debug.apk nao encontrado (verifique build.gradle - APK deve ser assinado)" -ForegroundColor Yellow
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
    # So instalar se dispositivo estiver "device" (nao "offline")
    $devices = adb devices | Select-String "\s+device\s*$"
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
