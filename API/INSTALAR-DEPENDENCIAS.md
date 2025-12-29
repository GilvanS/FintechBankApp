# 📦 Instalar Dependências - Primeira Vez

## ❌ Erro

`Error: Cannot find module 'dotenv'`

Isso acontece porque as dependências do Node.js não foram instaladas ainda.

## ✅ Solução

Execute na pasta `API`:

```bash
cd API

# Instalar todas as dependências
npm install
```

---

## 🔍 O que o npm install faz?

O comando `npm install` lê o arquivo `package.json` e instala todas as dependências listadas nele na pasta `node_modules/`.

---

## ✅ Depois de Instalar

Depois que o `npm install` terminar, você pode executar:

```bash
npm run dev
```

---

## 📋 Comandos Úteis

```bash
# Instalar dependências
npm install

# OU se preferir usar npm ci (instalação limpa)
npm ci

# Verificar dependências instaladas
npm list

# Ver dependências desatualizadas
npm outdated
```

---

## 🎯 Resumo Rápido

```bash
cd API
npm install
npm run dev
```



