# 🚀 Como Gerar APK do Zero

## ✅ Script Único: `GERAR-APK-DO-ZERO.ps1`

**ÚNICO SCRIPT NECESSÁRIO** - Todos os outros scripts foram removidos/consolidados.

Este é o **único script** que você precisa usar. Ele faz:
1. ✅ **Verifica versão** (antes e durante o processo)
2. ✅ **Clean completo** (limpa tudo: dist, cache, build, .gradle)
3. ✅ **Verifica dependências** (instala se necessário)
4. ✅ **Build do zero** (como primeira vez)
5. ✅ **Gera o APK**
6. ✅ **Instala no dispositivo** (se conectado)

## 📋 Como Usar

### 1. Abra o PowerShell

### 2. Navegue até a pasta MOBILE

```powershell
cd F:\GITHUB\FintechBankApp\MOBILE
```

### 3. Execute o script

```powershell
.\GERAR-APK-DO-ZERO.ps1
```

## 🔄 O que o Script Faz

### Passo Inicial: Verifica Versão
- ✅ Mostra versão do `AppVersion.ts`
- ✅ Mostra versão do `package.json`
- ✅ Mostra versão do `build.gradle`

### Passo 1: Limpeza TOTAL
- ✅ Remove pasta `dist`
- ✅ Remove cache do Vite (`node_modules/.cache`)
- ✅ Executa `gradlew clean`
- ✅ Remove `android/app/build`
- ✅ Remove `android/build`
- ✅ Remove cache do Gradle (`.gradle`)
- ✅ Remove assets antigos do Capacitor

### Passo 2: Verifica Dependências
- ✅ Verifica se `node_modules` existe
- ✅ Instala dependências se necessário

### Passo 3: Verifica Versão Novamente
- ✅ Confirma versão antes de gerar APK

### Passo 4: Build do Projeto Web
- ✅ Executa `npm run build` (Vite)
- ✅ Cria pasta `dist`

### Passo 5: Sincroniza com Android
- ✅ Executa `npx cap sync android`
- ✅ Copia arquivos para `android/app/src/main/assets`

### Passo 6: Gera APK
- ✅ Executa `gradlew assembleDebug`
- ✅ Gera APK em `android/app/build/outputs/apk/debug/app-debug.apk`
- ✅ Mostra tamanho e data do APK

### Passo 7: Instala APK (Opcional)
- ✅ Detecta dispositivo conectado
- ✅ Desinstala versão antiga
- ✅ Instala novo APK

## 📁 Localização do APK

Após executar o script, o APK estará em:

```
MOBILE\android\app\build\outputs\apk\debug\app-debug.apk
```

## ✅ Verificar Versão

Após instalar o APK:
1. Abra o app
2. Vá em **Perfil** → **Informações do App**
3. Deve mostrar: `4.0.2-20250127`

## ⚠️ Importante

- Execute o script **dentro da pasta MOBILE**
- Certifique-se de ter Node.js e Android SDK instalados
- Se houver erro, verifique as mensagens no console

## 🎯 Resumo

**Comando único:**
```powershell
cd MOBILE
.\GERAR-APK-DO-ZERO.ps1
```

**Pronto!** O script faz tudo automaticamente. 🚀

