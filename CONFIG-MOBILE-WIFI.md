# Configuração do Ambiente: API (Backend) e Mobile (Frontend) via Wi-Fi

Este documento descreve os passos para configurar o ambiente de desenvolvimento completo (backend e frontend) para que o aplicativo mobile se comunique com a API na sua rede local. O princípio é que a **API deve se adequar para servir o Mobile**, e não o contrário. Para isso, a API precisa estar acessível na rede, e o Mobile precisa saber onde encontrá-la.

## Passo 1: Configuração do Servidor (API)

Para que o aplicativo no seu celular (ou emulador) possa "enxergar" a API que está rodando no seu computador, a API não pode escutar apenas em `localhost`. Ela precisa escutar em todas as interfaces de rede.

- **Ação:** Inicie seu servidor de backend (API) para que ele aceite conexões de qualquer endereço da sua rede local, usando o IP `0.0.0.0`.
- **Arquivo Relevante:** O arquivo principal do seu servidor (ex: `API/index.cjs` ou similar).

**Exemplo (Node.js/Express):**

```javascript
// Antes (acessível apenas localmente)
app.listen(3001, 'localhost', () => {
  console.log('Server running on http://localhost:3001');
});

// Depois (acessível na sua rede Wi-Fi)
app.listen(3001, '0.0.0.0', () => {
  console.log('Server running on http://<seu-ip-aqui>:3001');
});
```

**Importante:**
- **Firewall:** Certifique-se de que o firewall do seu sistema operacional (Windows, macOS) não está bloqueando conexões de entrada na porta que sua API utiliza (ex: porta 3001).

## Passo 2: Configuração do Cliente (Mobile)

Agora que a API está visível na rede, o aplicativo mobile precisa saber o endereço para se conectar.

### 2.1. Encontrar o IP da sua Máquina

Você precisará do endereço de IP da sua máquina na rede Wi-Fi.

- **Windows:** Abra o `cmd` e digite `ipconfig`. Procure pelo "Endereço IPv4" no adaptador de rede Wi-Fi.
- **macOS/Linux:** Abra o terminal e digite `ifconfig` ou `ip addr`. Procure pelo endereço "inet" na sua interface de rede (`en0`, `wlan0`, etc.).

### 2.2. Alterar a URL da API no Mobile

- **Arquivo:** `MOBILE/src/services/api.ts`
- **Ação:** Altere a constante `API_BASE_URL` para o endereço de IP da sua máquina que você encontrou no passo anterior.

**Exemplo:**

Se o IP da sua máquina for `192.168.1.10` e o backend estiver na porta `3001`, a alteração será:

```typescript
// Antes
const API_BASE_URL = 'http://localhost:3001';

// Depois
const API_BASE_URL = 'http://192.168.1.10:3001';
```

### 2.3. Configurações da Plataforma Mobile

Para que o app possa se comunicar com um endereço IP na rede local, algumas permissões são necessárias.

#### Android

- **Arquivo:** `MOBILE/android/app/src/main/AndroidManifest.xml`
- **Ação:** Permita o tráfego de texto claro (necessário para endereços `http://`) adicionando `android:usesCleartextTraffic="true"` na tag `<application>`.

```xml
<application
    ...
    android:usesCleartextTraffic="true">
    ...
</application>
```

#### iOS

- **Arquivo:** `MOBILE/ios/App/App/Info.plist` (caso venha a ser desenvolvido)
- **Ação:** Adicione uma exceção para permitir cargas não seguras (`http`).

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

## Passo 3: Rebuild do Aplicativo

Após fazer as alterações no código do Mobile, é essencial recompilar o aplicativo.

- **Comandos:**
  ```bash
  npx cap sync
  npx cap open android
  # ou
  npx cap open ios
  ```

## Resumo

1.  **API:** Inicie o servidor escutando em `0.0.0.0` e verifique seu firewall.
2.  **Mobile:** Encontre o IP da sua máquina e configure-o em `MOBILE/src/services/api.ts`.
3.  **Mobile:** Adicione as permissões de rede no `AndroidManifest.xml` (Android) ou `Info.plist` (iOS).
4.  **Mobile:** Sincronize e recompile o projeto (`npx cap sync` e `npx cap open ...`).

Com esses passos, a API estará servindo adequadamente o aplicativo mobile no seu ambiente de desenvolvimento.
