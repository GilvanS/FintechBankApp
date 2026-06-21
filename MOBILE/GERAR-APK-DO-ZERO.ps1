# Script PowerShell para Gerar APK do ZERO (Limpeza TOTAL)
# Execute: .\GERAR-APK-DO-ZERO.ps1
# Este script limpa TUDO e gera o APK como se fosse a primeira vez

$ErrorActionPreference = "Stop"

# Isolar o diretorio GRADLE_USER_HOME do CLI para evitar conflitos de lock com a IDE (RedHat Java Language Server)
$env:GRADLE_USER_HOME = Join-Path (Get-Location) "android\.gradle_user_home"

# Forcar o uso do JDK 21 caso esteja instalado (evita erros de compilacao se a maquina tiver o Java 25 ativo)
$jdkPath = "C:\Program Files\Java\jdk-21"
if (Test-Path $jdkPath) {
    $env:JAVA_HOME = $jdkPath
    $env:PATH = "$jdkPath\bin;" + $env:PATH
    Write-Host "   OK: Forcando JAVA_HOME para JDK 21 ($jdkPath)" -ForegroundColor Green
}


# Alteração: 2026-06-19 - Adicionado autodetectacao de emulador ativo no ADB para usar o IP especial 10.0.2.2
$detectedIp = $null
$hasEmulator = $false
$adbCheck = Get-Command adb -ErrorAction SilentlyContinue

if ($adbCheck) {
    $devices = adb devices
    if ($devices -match "emulator-\d+") {
        $hasEmulator = $true
    }
}

if ($hasEmulator) {
    $detectedIp = "10.0.2.2"
    Write-Host "   Emulador detectado ativo via ADB. Usando IP especial do emulador: $detectedIp" -ForegroundColor Green
} else {
    try {
        # Tenta obter o IP associado a rota padrao (gateway de internet)
        $detectedIp = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Get-NetIPInterface | Get-NetIPAddress -AddressFamily IPv4 | Select-Object -First 1).IPAddress
    } catch {}
    
    if (-not $detectedIp) {
        # Fallback caso a rota padrao nao seja encontrada
        $detectedIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress
    }
}

if (-not $detectedIp) {
    Write-Host "ERRO: Nao foi possivel detectar o IP local ativo do computador." -ForegroundColor Red
    exit 1
}

Write-Host "IP local detectado automaticamente: $detectedIp" -ForegroundColor Green
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

# Atualizar apiConfig.ts
$apiConfigPath = "src\apiConfig.ts"
if (Test-Path $apiConfigPath) {
    $content = Get-Content $apiConfigPath -Raw -Encoding UTF8
    # Alteração: 2026-06-19 - Corrigido bug de expansao de variavel do PowerShell ($detectedIp:3001 interpretado como escopo) isolando a variavel com subexpressao
    $content = $content -replace "export const API_BASE_URL = 'http://[^']*';", "export const API_BASE_URL = 'http://$($detectedIp):3001';"
    Write-Utf8NoBom -Path $apiConfigPath -Value $content.TrimEnd()
    Write-Host "   OK: apiConfig.ts atualizado com IP $detectedIp" -ForegroundColor Green
} else {
    Write-Host "   AVISO: apiConfig.ts nao encontrado" -ForegroundColor Yellow
}

# Atualizar network_security_config.xml
$netSecurityPath = "android\app\src\main\res\xml\network_security_config.xml"
if (Test-Path $netSecurityPath) {
    $content = Get-Content $netSecurityPath -Raw -Encoding UTF8
    $domainTag = "<domain includeSubdomains=`"true`">$detectedIp</domain>"
    if ($content -notmatch [regex]::Escape($detectedIp)) {
        # Inserir tag de domínio logo antes de </domain-config>
        $replacement = "        $domainTag`r`n    </domain-config>"
        $content = $content -replace "\s*</domain-config>", $replacement
        Write-Utf8NoBom -Path $netSecurityPath -Value $content.TrimEnd()
        Write-Host "   OK: network_security_config.xml atualizado com IP $detectedIp" -ForegroundColor Green
    } else {
        Write-Host "   OK: IP $detectedIp ja esta configurado no network_security_config.xml" -ForegroundColor Green
    }
} else {
    Write-Host "   AVISO: network_security_config.xml nao encontrado" -ForegroundColor Yellow
}

# Atualizar AppVersion.ts
$appVersionPath = "src\utils\AppVersion.ts"
if (Test-Path $appVersionPath) {
    $content = Get-Content $appVersionPath -Raw -Encoding UTF8
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
    $content = Get-Content $buildGradlePath -Raw -Encoding UTF8
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
    $content = Get-Content $packagePath -Raw -Encoding UTF8
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
        Write-Host "      Parando daemons do Gradle ativos..." -ForegroundColor Yellow
        try {
            & .\gradlew.bat --stop 2>&1 | Out-Null
        } catch {}
        
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
    
    # Alteração: 2026-06-19 - Adicionado encerramento forcado de processos java/kotlin para liberar caches e validacao estrita da delecao do cache .gradle_user_home
    Write-Host "      Encerrando processos de background (java, kotlin) para liberar locks de arquivos..." -ForegroundColor Yellow
    Stop-Process -Name "java" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "kotlin-daemon" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Limpar cache do Gradle (importante para limpeza completa)
    if (Test-Path ".gradle") {
        Write-Host "      Removendo cache do Gradle..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force ".gradle" -ErrorAction SilentlyContinue
        if (Test-Path ".gradle") {
            Write-Host "      AVISO: Nao foi possivel remover a pasta .gradle completamente." -ForegroundColor Yellow
        } else {
            Write-Host "      OK: Cache do Gradle removido" -ForegroundColor Green
        }
    }
    if (Test-Path ".gradle_user_home") {
        Write-Host "      Removendo .gradle_user_home..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force ".gradle_user_home" -ErrorAction SilentlyContinue
        if (Test-Path ".gradle_user_home") {
            Write-Host "      AVISO: A pasta .gradle_user_home ainda esta presente. Tentando parar processos java/kotlin novamente..." -ForegroundColor Yellow
            Stop-Process -Name "java" -Force -ErrorAction SilentlyContinue
            Stop-Process -Name "kotlin-daemon" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            Remove-Item -Recurse -Force ".gradle_user_home" -ErrorAction SilentlyContinue
            if (Test-Path ".gradle_user_home") {
                Write-Host "      ERRO: Nao foi possivel deletar .gradle_user_home. Arquivos estao travados." -ForegroundColor Red
                Write-Host "      Feche seu editor de codigo (VS Code / Android Studio) para liberar os locks e execute novamente." -ForegroundColor Red
                Set-Location ".."
                exit 1
            }
        }
        Write-Host "      OK: .gradle_user_home removido" -ForegroundColor Green
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
    $appVersionContent = Get-Content $appVersionFile -Raw -Encoding UTF8
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
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
if (Test-Path "set-ip.js") {
    Write-Host "   Usando npm run build:mobile (set-ip.js encontrado)..." -ForegroundColor Cyan
    npm run build:mobile 2>&1
} else {
    npm run build 2>&1
}
$ErrorActionPreference = $oldPreference
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
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx cap sync android 2>&1
$ErrorActionPreference = $oldPreference
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
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & .\gradlew.bat assembleDebug --no-daemon 2>&1
    $ErrorActionPreference = $oldPreference
    
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
