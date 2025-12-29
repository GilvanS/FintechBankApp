# 🔧 Resolver Erro bcrypt - node-gyp Build

## ❌ Erro

```
npm error gyp ERR! build error
MSBuild.exe failed with exit code: 1
```

O módulo `bcrypt` precisa compilar código nativo (C++), o que requer ferramentas de build do Visual Studio.

## ✅ Solução: Remover bcrypt e usar apenas bcryptjs

O projeto já tem `bcryptjs` instalado, que é uma versão JavaScript pura e **não precisa compilar**. Removemos o `bcrypt` do `package.json`.

## 🚀 Instalar Agora

```bash
cd API
rm -rf node_modules
rm -f package-lock.json
npm install --legacy-peer-deps
```

---

## 🔍 Verificar se o código usa bcrypt ou bcryptjs

Se o código estiver usando `require('bcrypt')`, precisamos mudar para `require('bcryptjs')`. Vou verificar e corrigir se necessário.

---

## ✅ Depois de Instalar

```bash
npm run dev
```



