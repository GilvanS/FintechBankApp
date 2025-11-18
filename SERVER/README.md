# Projeto SERVER

Este diretório contém o código do servidor backend da aplicação.

## Desenvolvimento Local e Testes com o App Mobile

Para que o aplicativo mobile (rodando em um celular Android físico) consiga se comunicar com este servidor rodando na sua máquina local, é essencial estabelecer uma ponte de rede usando o Android Debug Bridge (ADB).

### Problema Comum: Falha de Conexão

**Sintoma:** O aplicativo no celular não consegue fazer login ou acessar dados, mesmo com o servidor local em execução.

**Solução:** O túnel de rede do ADB, que conecta o celular ao PC, foi perdido. Você precisa recriá-lo.

Execute o seguinte comando no seu terminal sempre que a conexão falhar (por exemplo, após reconectar o cabo USB ou reiniciar um dos dispositivos):

```bash
adb reverse tcp:3001 tcp:3001
```

Para verificar se a conexão está ativa, use:

```bash
adb reverse --list
```
