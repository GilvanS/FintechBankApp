# 🔧 Resolver Erro npm install - ERESOLVE

## ❌ Erro

```
npm error ERESOLVE unable to resolve dependency tree
Could not resolve dependency: peer newman@"4" from newman-reporter-html@1.0.5
```

## 🔍 Problema

O `newman-reporter-html@1.0.5` requer `newman@4`, mas o projeto usa `newman@6.x`, causando conflito.

## ✅ Solução 1: Usar --legacy-peer-deps (Recomendado)

O `newman-reporter-html@1.0.5` requer `newman@4`, mas o projeto usa `newman@6.x`. Como é apenas uma dependência de teste, podemos ignorar o conflito:

```bash
cd API
npm install --legacy-peer-deps
```

## ✅ Solução 2: Usar --legacy-peer-deps (Alternativa)

Se ainda der erro, use:

```bash
cd API
npm install --legacy-peer-deps
```

Isso ignora os peer dependencies conflitantes.

## ✅ Solução 3: Usar --force (Não Recomendado)

```bash
cd API
npm install --force
```

⚠️ Pode causar problemas de compatibilidade.

## 📋 Comandos Completos

```bash
cd API
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

OU se ainda der erro:

```bash
npm install --legacy-peer-deps
```

