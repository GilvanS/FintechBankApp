# 🚀 Como Usar os Scripts para Gerar APK

## 📋 Scripts Disponíveis

### 1. **GERAR-APK.ps1** - Script Básico

Faz tudo exceto gerar o APK no Android Studio (você precisa fazer manualmente).

**Uso:**
```powershell
cd MOBILE
.\GERAR-APK.ps1
```

**O que faz:**
- ✅ Limpa builds antigos
- ✅ Instala dependências (se necessário)
- ✅ Build do projeto web (Vite)
- ✅ Sincroniza com Android (Capacitor)
- ✅ Abre Android Studio
- ⏳ Você precisa gerar o APK manualmente no Android Studio

**Parâmetros opcionais:**
```powershell
# Pular limpeza
.\GERAR-APK.ps1 -SkipClean

# Não abrir Android Studio
.\GERAR-APK.ps1 -SkipAndroidStudio

# Ambos
.\GERAR-APK.ps1 -SkipClean -SkipAndroidStudio
```

### 2. **GERAR-APK-COMPLETO.ps1** - Script Completo ⭐ RECOMENDADO

Faz TUDO automaticamente, incluindo gerar o APK via Gradle.

**Uso:**
```powershell
cd MOBILE
.\GERAR-APK-COMPLETO.ps1
```

**O que faz:**
- ✅ Limpa builds antigos
- ✅ Build do projeto web (Vite)
- ✅ Sincroniza com Android (Capacitor)
- ✅ **Gera o APK via Gradle (automaticamente)**
- ✅ Instala no dispositivo (se conectado)

## 🎯 Qual Usar?

### Use **GERAR-APK-COMPLETO.ps1** se:
- ✅ Quer tudo automático
- ✅ Não quer abrir Android Studio
- ✅ Quer gerar APK via linha de comando

### Use **GERAR-APK.ps1** se:
- ✅ Prefere usar Android Studio
- ✅ Quer ver o processo de build no Android Studio
- ✅ Quer mais controle sobre o processo

## 📝 Exemplo de Uso Completo

### Opção 1: Script Completo (Recomendado)

```powershell
# Navegar para o diretório
cd F:\GITHUB\FintechBankApp\MOBILE

# Executar script completo
.\GERAR-APK-COMPLETO.ps1
```

**Resultado:**
- APK gerado automaticamente
- Instalado no dispositivo (se conectado)
- Pronto para usar!

### Opção 2: Script Básico + Android Studio

```powershell
# Navegar para o diretório
cd F:\GITHUB\FintechBankApp\MOBILE

# Executar script básico
.\GERAR-APK.ps1
```

**Depois, no Android Studio:**
1. Build → Clean Project
2. Build → Rebuild Project
3. Build → Build APK(s)

**Instalar:**
```powershell
adb uninstall com.fintechbank.app
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

## ⚠️ Solução de Problemas

### Erro: "Execute este script no diretório MOBILE"

**Solução:**
```powershell
cd F:\GITHUB\FintechBankApp\MOBILE
.\GERAR-APK-COMPLETO.ps1
```

### Erro: "gradlew.bat não encontrado"

**Solução:**
```powershell
# Verificar se está no diretório correto
cd MOBILE
ls android\gradlew.bat

# Se não existir, execute:
npx cap sync android
```

### Erro: "npm run build falhou"

**Solução:**
```powershell
# Limpar cache
npm cache clean --force

# Reinstalar dependências
Remove-Item -Recurse -Force node_modules
npm install

# Tentar novamente
npm run build
```

### APK não instalou automaticamente

**Solução:**
```powershell
# Verificar dispositivos
adb devices

# Instalar manualmente
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

## ✅ Verificação

Após gerar o APK:

1. **Verificar versão no app:**
   - Abra o app
   - Vá em **Perfil** → **Informações do App**
   - Deve mostrar: `4.0.1-20250127`

2. **Verificar APK:**
   ```powershell
   # Verificar se o APK existe
   Test-Path android\app\build\outputs\apk\debug\app-debug.apk
   
   # Ver tamanho do APK
   (Get-Item android\app\build\outputs\apk\debug\app-debug.apk).Length / 1MB
   ```

## 🎯 Resumo

| Script | Gera APK | Instala APK | Abre Android Studio |
|--------|----------|-------------|---------------------|
| `GERAR-APK.ps1` | ❌ Manual | ❌ Manual | ✅ Sim |
| `GERAR-APK-COMPLETO.ps1` | ✅ Automático | ✅ Automático | ❌ Não |

**Recomendação:** Use `GERAR-APK-COMPLETO.ps1` para máxima automação! 🚀

