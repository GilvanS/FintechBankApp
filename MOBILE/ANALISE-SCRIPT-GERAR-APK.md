# Análise do script GERAR-APK-DO-ZERO.ps1

## Resumo

O script está **correto** e bem estruturado. Foram feitos pequenos ajustes para torná-lo mais robusto e alinhado ao projeto.

---

## O que o script faz (passos)

| Passo | Ação | Status |
|-------|------|--------|
| 1 | Limpeza total (dist, cache Vite, Android build/.gradle, assets) | OK |
| 2 | Verifica dependências (npm install se não houver node_modules) | OK |
| 3 | Verifica versão (AppVersion.ts) | OK |
| 4 | Build web (Vite) | Ajustado |
| 5 | Sincroniza com Android (Capacitor) | OK |
| 6 | Gera APK debug (Gradle assembleDebug) | OK |
| 7 | Instala no dispositivo via ADB (se conectado) | Ajustado |

---

## Correções aplicadas

### 1. Build: `build` vs `build:mobile`
- **Antes:** Sempre `npm run build`.
- **Depois:** Se existir `set-ip.js`, usa `npm run build:mobile` (configura API para o dispositivo); senão usa `npm run build`.
- **Motivo:** Hoje não existe `set-ip.js` no MOBILE; quando for criado, o script passará a usar `build:mobile` automaticamente.

### 2. Verificação de assets após `cap sync`
- **Antes:** Só verificava `android\app\src\main\assets\public`.
- **Depois:** Se não existir `assets\public`, verifica `android\app\src\main\assets` (estrutura do Capacitor).
- **Motivo:** Compatível com diferentes versões/estruturas do Capacitor.

### 3. Detecção de dispositivo ADB
- **Antes:** `Select-String "device$"` (qualquer linha terminando em "device").
- **Depois:** `Select-String "\s+device\s*$"` (linha com status "device", evitando "offline").
- **Motivo:** Só instalar quando o dispositivo estiver realmente pronto, não "offline".

### 4. Mensagem sobre APK assinado
- **Adicionado:** Mensagem indicando que o APK é assinado e aviso se `app-debug.apk` não for encontrado (evita confusão com APK unsigned).
- **Motivo:** APK unsigned gera `INSTALL_PARSE_FAILED_NO_CERTIFICATES`; o script deixa claro que o esperado é o APK assinado.

---

## Pontos já corretos (sem alteração)

- Execução apenas no diretório MOBILE (checagem de `package.json`).
- Exibição de versão (AppVersion.ts, package.json, build.gradle).
- Limpeza de dist, cache, Android e assets antes do build.
- Uso de `gradlew.bat clean` e remoção de `app\build`, `build`, `.gradle`.
- `npm run build` (ou `build:mobile` quando houver `set-ip.js`).
- `npx cap sync android`.
- `gradlew.bat assembleDebug --no-daemon`.
- Caminho do APK: `android\app\build\outputs\apk\debug\app-debug.apk`.
- Passo 7: desinstala versão antiga e instala com `adb install -r`.
- Tratamento de erro com `$ErrorActionPreference = "Stop"` e `exit 1` em falhas críticas.

---

## Observações

1. **set-ip.js:** Não existe no repositório. O `package.json` tem `"build:mobile": "node set-ip.js && vite build"`. Enquanto `set-ip.js` não existir, o script usa `npm run build` (apenas `vite build`), o que está correto.

2. **AppVersion.ts:** Existe em `src\utils\AppVersion.ts`; o script referencia corretamente.

3. **APK assinado:** O `android/app/build.gradle` foi ajustado para não usar `signingConfig null` no debug, então o build gera `app-debug.apk` assinado (não `app-debug-unsigned.apk`). O script já espera `app-debug.apk`.

4. **Execução:** Rodar sempre a partir da pasta MOBILE:
   ```powershell
   cd F:\GITHUB\FintechBankApp\MOBILE
   .\GERAR-APK-DO-ZERO.ps1
   ```

---

## Conclusão

O script está correto e pronto para uso. As alterações feitas só tornam o fluxo mais seguro e claro (build mobile quando houver `set-ip.js`, verificação de assets, detecção de dispositivo e mensagem sobre APK assinado).
