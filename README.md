# 🏦 FintechBankApp

![Tela de Login](assets/login-screen.png)

> **FintechBankApp** é uma aplicação bancária moderna e completa, desenvolvida como projeto didático para treinamento de desenvolvimento Web, APIs e **testes automatizados**.

---

## 🛠️ Ferramenta Principal

Para configurar, executar e gerenciar todos os módulos do projeto (**API, WEB e Mobile**) de forma simplificada, utilize o **AG-Kit**:

```bash
npx @vudovn/ag-kit init
```

---

## 📋 Sobre o Projeto

FintechBankApp é um projeto didático desenvolvido para treinamento de desenvolvimento Web e APIs com foco em boas práticas aplicáveis ao ecossistema Java + frameworks (conceitos, padrões e arquitetura). A implementação de referência desta branch usa Node.js (Express) no backend e Vite + React + TypeScript no frontend para acelerar a prática e a validação dos fluxos.

### Objetivos

- Exercitar princípios SOLID, Clean Code e testes automatizados
- Simular rotinas bancárias (faturas, cartão de crédito, PIX, extrato)
- Praticar integrações com diferentes bancos de dados e ambientes
- Fornecer uma base completa para implementação de testes E2E

---

## 🚀 Principais Módulos

- **`API/`**: Backend Express, documentação Swagger, scripts de migração/seed e testes automatizados completos
- **`WEB/`**: Frontend React + Vite com páginas e componentes de fluxo bancário e testes com Vitest
- **`MOBILE/`**: Aplicação React Native completa para testes mobile
- **`docker-compose.yml`**: Infraestrutura de Postgres via Docker

---

## ⚙️ Pré-requisitos

- Node.js (>= 18)
- Docker Desktop (para a opção Postgres)
- Android SDK (para build mobile)
- Git

---

## 🔧 Configuração Rápida

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd FintechBankApp
```

### 2. Instale Dependências

**Backend:**
```bash
cd API
npm install
```

**Frontend:**
```bash
cd WEB
npm install
```

**Mobile:**
```bash
cd MOBILE
npm install
```

### 3. Configure Variáveis de Ambiente

Copie `API/.env.example` para `API/.env` e ajuste conforme necessário:

```env
PORT=3001
JWT_SECRET=seu-secret-key-aqui
DB_PROVIDER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=pwd123
DB_NAME=fintech
DB_SCHEMA=fintech
```

### 4. Configure Banco de Dados

Execute o script de setup do banco:

```powershell
cd API
.\RECRIAR-BANCO.ps1
```

---

## 🏃 Como Executar

### Backend (API)

```bash
cd API
npm run dev
```

A API estará disponível em `http://localhost:3001`

### Frontend (WEB)

```bash
cd WEB
npm run dev
```

A interface web abrirá em `http://localhost:5173`

### Documentação Swagger

Acesse: `http://localhost:3001/api-docs`

---

## 📱 Gerar APK do Aplicativo Mobile

### Script Automatizado (Recomendado)

O projeto possui um script único que faz todo o processo automaticamente:

```powershell
cd MOBILE
.\GERAR-APK-DO-ZERO.ps1
```

### O que o Script Faz

1. ✅ Verifica versão (antes e durante o processo)
2. ✅ Limpeza completa (dist, cache, build, .gradle)
3. ✅ Verifica dependências (instala se necessário)
4. ✅ Build do projeto web (Vite)
5. ✅ Sincroniza com Android (Capacitor)
6. ✅ Gera o APK via Gradle
7. ✅ Instala no dispositivo (se conectado)

### Localização do APK

Após executar o script, o APK estará em:

```
MOBILE\android\app\build\outputs\apk\debug\app-debug.apk
```

### Verificar Versão

Após instalar o APK:
1. Abra o app
2. Vá em **Perfil** → **Informações do App**
3. Deve mostrar a versão atual (ex: `4.0.2-20250127`)

### Requisitos para Gerar APK

- ✅ Node.js instalado
- ✅ Android SDK instalado
- ✅ **Java JDK 21** instalado e configurado em `JAVA_HOME`
- ✅ Dispositivo Android conectado (opcional, para instalação automática)

> **⚠️ IMPORTANTE — Versão do Java**
>
> Use obrigatoriamente o **JDK 21 (LTS)**. O Gradle 8.9 **não suporta Java 25**.
>
> Se você tiver o JDK 25 instalado na máquina, o build vai falhar com:
> ```
> BUG! Unsupported class file major version 69
> ```
> Isso acontece porque o plugin `firebase-appdistribution-gradle:5.0.0` foi compilado com Java 25, e o JVM 21 não consegue carregar esse bytecode.
>
> **Solução aplicada:** O plugin Firebase App Distribution está comentado nos arquivos `android/build.gradle` e `android/app/build.gradle`. Esse plugin serve apenas para distribuição via Firebase CI/CD e **não afeta** nenhuma funcionalidade do app.
>
> Para reativar (só se for fazer distribuição via Firebase):
> ```groovy
> // android/build.gradle — descomentar:
> classpath 'com.google.firebase:firebase-appdistribution-gradle:5.0.0'
>
> // android/app/build.gradle — descomentar:
> apply plugin: 'com.google.firebase.appdistribution'
> ```
> Ao reativar, use **Java 25** como `JAVA_HOME`.

### Processo Manual (Alternativo)

Se preferir fazer manualmente:

```bash
cd MOBILE

# 1. Limpar
npm run clean
cd android && ./gradlew clean && cd ..

# 2. Build web
npm run build

# 3. Sincronizar
npx cap sync android

# 4. Gerar APK
cd android
./gradlew assembleDebug
cd ..

# 5. APK gerado em:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🧪 Testes

### Testes de API (Newman)

```bash
cd API
npm run test:newman
```

### Testes de Frontend (Vitest)

```bash
cd WEB
npm run test
```

### Testes de Backend (Jest)

```bash
cd API
npm run test
```

---

## 🔄 Motor de Assinaturas, Recorrências & Política de Retentativas

O projeto conta com um **Motor de Recorrência (`recurringEngine.js`)** dedicado no backend, integrado a um agendador diário (**Cron**) e a endpoints administrativos no painel de controle (POS Sandbox).

### 📐 Regras de Negócio Implementadas

1. **Diferenciação do Consumo de Limite (Crédito vs. Assinatura):**
   - **Assinaturas (`SUBSCRIPTION`):** Comprometem **apenas o valor da parcela/mensalidade do ciclo vigente** no limite disponível do cartão, sem travar o limite total do contrato.
   - **Parcelamento Tradicional (`CREDIT`):** Compromete o **valor total com juros** no limite do cartão logo no 1º mês.
2. **Débito Automático em Conta Corrente (`ACCOUNT_DEBIT`):**
   - Suporte a cobranças diretas do saldo em conta corrente (`balance`). Entra em status `PENDING` e transita para `PAID` ou `PAST_DUE` conforme o saldo disponível.
3. **Política de Retentativas (Retry Policy):**
   - **Falha no Pagamento:** Em caso de recusa no cartão ou saldo insuficiente em conta, o status altera para `PAST_DUE` (Em Atraso - Tentativa 1 de 3).
   - **Ciclo de Re-cobrança:** O motor efetua até **3 tentativas diárias**.
   - **Suspensão:** Ao exaurir as 3 tentativas, o status altera para `SUSPENDED` e bloqueia renovações.
4. **Sincronia Bidirecional (Admin <-> App):**
   - Assinaturas simuladas pelo Admin no POS ou criadas na tela Home do App persistem no PostgreSQL (`fintech.recurring_bills`) e refletem em tempo real no app e nos modais financeiros.

---

## 🗺️ Roadmap & Foco do Projeto (Homologação & Treinamento QA)

Este projeto é focado em **Ambiente de Homologação (Sandbox / PV - Ponto de Venda)** para **simulação de compras, assinaturas, testes automatizados e treinamento de regras de negócio**:

- [x] **Motor de Recorrência & Retentativas (`recurringEngine.js`):** Simulação de ciclos de cobrança diários e política de 3 retentativas.
- [x] **Simulador POS / PV (Admin):** Processamento manual de compras a Crédito, Débito e Assinaturas via maquina de cartão fictícia.
- [x] **Diferenciação Estrita de Limite:** Validação de limite comprometido em parcelamento vs. ciclo mensal de assinatura.
- [x] **Sincronia em Tempo Real:** Comunicação bidirecional entre o Painel Admin (PV) e o App/Web (Home & Modais).
- [x] **Suíte de Testes Automatizados:** Bateria de testes de API e integração cobrindo aprovação, falta de saldo/limite e retentativas.

---

## 👥 Usuários Padrão para Testes

### Admin
- **CPF**: `99999999999`
- **Senha**: `admin999`
- **Email**: `admin@fintechbank.com`

### Usuários de Teste
- **CPF**: `11111111111`, `22222222222`, `77777777777`, `88888888888`
- **Senha padrão**: `admin999`

### PIN Padrão
- **PIN**: `9898` (para todas as operações sensíveis)

---

## 📚 Documentação Completa

Para documentação detalhada, consulte:

- **`SKILL.md`**: Regras de negócio do sistema de faturas (versão compacta para agentes de IA)
- **`docs/REGRAS-NEGOCIO-FATURA.md`**: Documento completo de regras de negócio (fatura e pagamento)
- **`DOCUMENTACAO-COMPLETA.md`**: Documentação consolidada completa do projeto
- **API**: `API/README-backend.md`
- **WEB**: `WEB/README.md`
- **MOBILE**: `MOBILE/README.md`

### 📊 Cobertura de Cross-References

| Documento | Seções com cross-reference | Validação |
|:----------|:--------------------------:|:---------:|
| `SKILL.md` | 16/17 (94%) | ✅ `npm run validate:rules` |
| `docs/REGRAS-NEGOCIO-FATURA.md` | 9/9 âncoras OK | ✅ `node scripts/validate_anchors.js` |

### 🏷️ Badge Dinâmico de Cobertura

**Shields.io (quando API estiver pública):**

```
https://img.shields.io/endpoint?url=https://SEU-DOMINIO/api/admin/badge/rules-coverage
```

**SVG local (gerado com `cd API && npm run badge:svg`):**

![Regras](rules-coverage.svg)

**Comandos:**

| Comando | Descrição |
|:--------|:----------|
| `cd API && npm run badge:svg` | Gera `rules-coverage.svg` na raiz |
| `cd API && npm run badge:json` | Exibe JSON com as estatísticas |
| `curl http://localhost:3001/api/admin/badge/rules-coverage` | JSON endpoint para shields.io |

---

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, JWT, bcrypt, Swagger
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Mobile**: React Native, Capacitor
- **Banco de Dados**: PostgreSQL, SQLite, Databricks
- **Testes**: Jest, Vitest, Newman, Supertest

---

## 📝 Comandos Úteis

```bash
# Iniciar containers Docker
docker-compose up -d

# Parar containers
docker-compose down

# Recriar banco de dados
cd API
.\RECRIAR-BANCO.ps1

# Gerar APK
cd MOBILE
.\GERAR-APK-DO-ZERO.ps1
```

---

**Desenvolvido com ❤️ para a comunidade de QA e Desenvolvimento**
