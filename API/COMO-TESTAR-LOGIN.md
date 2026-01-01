# 🧪 Como Testar o Login

## Script de Teste

Execute no terminal dentro da pasta `API`:

```bash
node test-login-simples.js
```

## O que o script faz:

1. ✅ Conecta diretamente ao PostgreSQL
2. ✅ Busca o usuário `99999999999`
3. ✅ Mostra os dados do usuário encontrado
4. ✅ Testa se a senha `admin999` está correta

## Resultado Esperado

Se tudo estiver OK, você verá:
```
✅ Conectado!
✅ Query executada. Retornou 1 linha(s)
✅ TUDO OK! Usuário existe e senha está correta.
```

## Possíveis Problemas

### ❌ Usuário não encontrado
```
❌ USUÁRIO NÃO ENCONTRADO!
```
**Solução:** Verifique se o usuário existe no banco

### ❌ Senha incorreta
```
❌ Senha está incorreta no banco de dados.
```
**Solução:** A senha hash no banco não corresponde a `admin999`

### ❌ Erro de conexão
```
❌ ERRO: Connection refused
```
**Solução:** Verifique se o PostgreSQL está rodando e as credenciais no `.env`

## Após executar

Copie e cole aqui o resultado completo do script para eu analisar!

