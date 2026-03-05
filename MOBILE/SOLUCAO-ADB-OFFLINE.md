# 🔧 Solução para "adb.exe: device offline"

## ❌ Problema
```
adb.exe: device offline
emulator-5554   offline
```

## 🔍 Causas Comuns

1. **Emulador travado ou não inicializado completamente**
2. **Servidor ADB travado**
3. **Conexão USB/emulador instável**

## ✅ Soluções (Tente nesta ordem)

### Solução 1: Reiniciar Servidor ADB (Mais Comum)

```powershell
# Parar servidor ADB
adb kill-server

# Aguardar 2 segundos
Start-Sleep -Seconds 2

# Iniciar servidor ADB novamente
adb start-server

# Verificar dispositivos
adb devices
```

### Solução 2: Reiniciar Emulador

1. **Fechar o emulador completamente**
2. **Abrir Android Studio**
3. **Abrir AVD Manager** (Device Manager)
4. **Iniciar o emulador novamente**
5. **Aguardar até aparecer a tela inicial**
6. **Verificar conexão:**
   ```powershell
   adb devices
   ```

### Solução 3: Verificar se Emulador Está Rodando

```powershell
# Ver processos do emulador
Get-Process | Where-Object {$_.ProcessName -like "*emulator*"}

# Se não estiver rodando, iniciar via Android Studio ou linha de comando
```

### Solução 4: Instalar APK Diretamente no Emulador (Alternativa)

Se o ADB não funcionar, você pode:

1. **Arrastar e soltar o APK no emulador**
   - Abra o emulador
   - Arraste o arquivo `app-debug.apk` para dentro da tela do emulador
   - O Android instalará automaticamente

2. **Usar o File Manager do emulador**
   - Abra o emulador
   - Vá em Settings > Storage
   - Copie o APK para a pasta Downloads do emulador
   - Abra o arquivo e instale

### Solução 5: Usar Android Studio para Instalar

1. Abra Android Studio
2. Vá em **Tools > Device Manager**
3. Inicie o emulador
4. Vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. Após build, clique em **locate** no popup
6. Arraste o APK para o emulador ou use **Run > Run 'app'**

## 🚀 Script PowerShell Completo

Crie um arquivo `fix-adb.ps1`:

```powershell
Write-Host "🔄 Reiniciando servidor ADB..." -ForegroundColor Yellow

# Parar servidor
adb kill-server
Start-Sleep -Seconds 2

# Iniciar servidor
adb start-server
Start-Sleep -Seconds 2

# Verificar dispositivos
Write-Host "`n📱 Verificando dispositivos conectados..." -ForegroundColor Cyan
adb devices

# Se encontrar dispositivo online, tentar instalar
$devices = adb devices | Select-String -Pattern "device$"
if ($devices) {
    Write-Host "`n✅ Dispositivo encontrado! Tentando instalar APK..." -ForegroundColor Green
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        adb install -r $apkPath
    } else {
        Write-Host "❌ APK não encontrado em: $apkPath" -ForegroundColor Red
        Write-Host "Execute primeiro: npm run build:mobile && npx cap sync android && cd android && ./gradlew assembleDebug" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n⚠️ Nenhum dispositivo online encontrado." -ForegroundColor Red
    Write-Host "Certifique-se de que o emulador está rodando e completamente inicializado." -ForegroundColor Yellow
}
```

Execute:
```powershell
.\fix-adb.ps1
```

## 📋 Checklist de Verificação

- [ ] Emulador está rodando completamente (tela inicial visível)
- [ ] Servidor ADB foi reiniciado
- [ ] `adb devices` mostra dispositivo como "device" (não "offline")
- [ ] APK foi gerado corretamente
- [ ] Caminho do APK está correto

## 🎯 Próximos Passos

1. Execute a **Solução 1** primeiro (reiniciar ADB)
2. Se não funcionar, reinicie o emulador (**Solução 2**)
3. Como alternativa, use arrastar e soltar (**Solução 4**)
