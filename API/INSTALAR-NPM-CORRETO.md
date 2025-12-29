# ✅ Instalar Dependências - Solução Correta

## ❌ Erro

Conflito entre `newman@6.x` e `newman-reporter-html@1.0.5` (que requer newman@4).

## ✅ Solução: Usar --legacy-peer-deps

Execute:

```bash
cd API
npm install --legacy-peer-deps
```

Isso ignora o conflito de peer dependencies e instala tudo normalmente.

---

## 📋 Comandos Completos (Copiar e Colar)

```bash
cd API
rm -rf node_modules
rm -f package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

---

## ✅ Depois de Instalar

```bash
npm run dev
```

---

## 🔍 Por que --legacy-peer-deps?

O `newman-reporter-html` é apenas uma dependência de teste (para gerar relatórios HTML dos testes do Postman). O conflito não afeta o funcionamento da API, então é seguro ignorar.



