# 🔧 Troubleshooting npm install

## ❌ Erro no npm install

Se der erro, tente estas soluções:

## ✅ Soluções Comuns

### 1. Limpar Cache do npm

```bash
cd API
npm cache clean --force
npm install
```

### 2. Deletar node_modules e package-lock.json

```bash
cd API

# Windows (PowerShell)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Git Bash
rm -rf node_modules
rm -f package-lock.json

# Depois reinstalar
npm install
```

### 3. Usar npm ci (instalação limpa)

```bash
cd API
npm ci
```

### 4. Atualizar npm

```bash
npm install -g npm@latest
cd API
npm install
```

### 5. Verificar versão do Node.js

```bash
node --version
# Deve ser Node.js 16 ou superior

npm --version
```

---

## 🔍 Ver Log Completo do Erro

O npm cria um log de erro. Para ver o último erro:

```bash
# Ver o último log
cat C:\Users\11\AppData\Local\npm-cache\_logs\*.log | tail -50

# OU abrir o arquivo no notepad
notepad C:\Users\11\AppData\Local\npm-cache\_logs\2025-12-27T01_35_32_515Z-debug-0.log
```

---

## 📋 Comandos Sequenciais (Tentar em Ordem)

```bash
cd API

# 1. Limpar cache
npm cache clean --force

# 2. Remover node_modules e package-lock.json
rm -rf node_modules package-lock.json

# 3. Instalar novamente
npm install
```

---

## 🎯 Se Nada Funcionar

1. Verifique se você tem conexão com a internet
2. Verifique se há firewall bloqueando o npm
3. Tente usar uma versão diferente do Node.js
4. Verifique se há espaços ou caracteres especiais no caminho da pasta



