# Script PowerShell para Gerar APK Automaticamente
# Execute: .\GERAR-APK.ps1

param(
    [switch]$SkipClean = $false,
    [switch]$SkipAndroidStudio = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Gerando APK do FintechBankApp" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Verificar se está no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: Execute este script no diretório MOBILE" -ForegroundColor Red
    exit 1
}

# Passo 1: Limpar builds antigos
if (-not $SkipClean) {
    Write-Host "🧹 Passo 1: Limpando builds antigos..." -ForegroundColor Yellow
    
    # Limpar dist
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
        Write-Host "   ✅ Pasta dist removida" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  Pasta dist não existe" -ForegroundColor Cyan
    }
    
    # Limpar build do Android
    if (Test-Path "android") {
        Write-Host "   🧹 Limpando build do Android..." -ForegroundColor Yellow
        Set-Location "android"
        if (Test-Path "gradlew.bat") {
            & .\gradlew.bat clean 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Gradle clean executado" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Gradle clean teve avisos (continuando...)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ⚠️  gradlew.bat não encontrado" -ForegroundColor Yellow
        }
        Set-Location ".."
    }
} else {
    Write-Host "⏭️  Passo 1: Pulando limpeza (--SkipClean)" -ForegroundColor Cyan
}

# Passo 2: Instalar dependências (se necessário)
Write-Host "`n📦 Passo 2: Verificando dependências..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   📥 Instalando dependências npm..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Erro ao instalar dependências" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Dependências instaladas" -ForegroundColor Green
} else {
    Write-Host "   ✅ node_modules existe" -ForegroundColor Green
}

# Passo 3: Build do projeto web
Write-Host "`n🔨 Passo 3: Build do projeto web (Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Erro no build do Vite" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "dist")) {
    Write-Host "   ❌ Erro: Pasta dist não foi criada" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Build do Vite concluído" -ForegroundColor Green

# Passo 4: Sincronizar com Android
Write-Host "`n🔄 Passo 4: Sincronizando com Android (Capacitor)..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Erro na sincronização do Capacitor" -ForegroundColor Red
    exit 1
}

# Verificar se os arquivos foram copiados
if (-not (Test-Path "android\app\src\main\assets\public")) {
    Write-Host "   ⚠️  Aviso: Pasta assets/public não encontrada" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Arquivos sincronizados para Android" -ForegroundColor Green
}

# Passo 5: Abrir Android Studio
if (-not $SkipAndroidStudio) {
    Write-Host "`n📱 Passo 5: Abrindo Android Studio..." -ForegroundColor Yellow
    Write-Host "   ⚠️  Você precisará:" -ForegroundColor Yellow
    Write-Host "      1. Build → Clean Project" -ForegroundColor Cyan
    Write-Host "      2. Build → Rebuild Project" -ForegroundColor Cyan
    Write-Host "      3. Build → Build Bundle(s) / APK(s) → Build APK(s)" -ForegroundColor Cyan
    Write-Host "`n   🚀 Abrindo Android Studio..." -ForegroundColor Yellow
    
    npx cap open android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ⚠️  Erro ao abrir Android Studio (pode não estar instalado)" -ForegroundColor Yellow
        Write-Host "   ℹ️  Abra manualmente: npx cap open android" -ForegroundColor Cyan
    } else {
        Write-Host "   ✅ Android Studio aberto" -ForegroundColor Green
    }
} else {
    Write-Host "`n⏭️  Passo 5: Pulando abertura do Android Studio (--SkipAndroidStudio)" -ForegroundColor Cyan
}

# Resumo
Write-Host "`n✅ Processo concluído!" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Cyan

Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
Write-Host "   1. No Android Studio:" -ForegroundColor Cyan
Write-Host "      - Build → Clean Project" -ForegroundColor White
Write-Host "      - Build → Rebuild Project" -ForegroundColor White
Write-Host "      - Build → Build APK(s)" -ForegroundColor White
Write-Host "`n   2. Instalar APK:" -ForegroundColor Cyan
Write-Host "      adb uninstall com.fintechbank.app" -ForegroundColor White
Write-Host "      adb install android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White
Write-Host "`n   3. Verificar versão:" -ForegroundColor Cyan
Write-Host "      Abra o app → Perfil → Informações do App" -ForegroundColor White
Write-Host "      Deve mostrar: 4.0.1-20250127" -ForegroundColor White

Write-Host "`n📁 APK será gerado em:" -ForegroundColor Yellow
Write-Host "   android\app\build\outputs\apk\debug\app-debug.apk`n" -ForegroundColor Cyan

