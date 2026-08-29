# FintechBankApp Desktop

App WinForms + CefSharp que embute o frontend WEB. O React compilado é copiado
para `wwwroot` e servido por um scheme handler próprio em `https://fintech.local/`;
chamadas a `/api` são reencaminhadas ao backend em `http://localhost:3001`.

## Como executar

```powershell
cd DESKTOP
.\run.ps1
```

**Use sempre o `run.ps1`, nunca o `.exe` direto.** O script compila, escolhe o
binário correto, recusa rodar quando há mais de uma saída e avisa se o binário
está mais velho que o código. Rodar o `.exe` na mão foi o que causou o incidente
descrito abaixo.

| Comando | Para quê |
|---|---|
| `.\run.ps1` | Compila e executa |
| `.\run.ps1 -SkipBuild` | Executa o que já está compilado |
| `.\run.ps1 -Check` | Só diagnostica: lista as saídas e o alvo, sem executar |

## Incidente: o app "crashava" e o problema era o executável

**Sintoma:** o app fechava sozinho na inicialização, sem mensagem. Aparentava
defeito de código ou incompatibilidade com a placa de vídeo.

**O que era de fato:** existiam **duas saídas de build** ao mesmo tempo —
`bin\Debug\net8.0-windows\win-x64` e `bin\Debug\net10.0-windows\win-x64` — cada
uma com uma versão diferente do Chromium (**133** e **151**). Ambas usavam o
**mesmo diretório de cache**. O perfil do Chromium muda de formato entre versões:
a build que abrisse por último reescrevia o cache no seu formato, e a outra
passava a morrer numa asserção interna ao ler aquele perfil.

Daí o efeito de "na minha máquina funciona": quem rodasse por último derrubava o
outro. Não havia nada errado com o hardware nem com a GPU.

**Por que as duas saídas existiam:** o projeto de testes estava em
`net10.0-windows` enquanto o app estava em `net8.0-windows`. Compilar a solução
gerava o executável nos dois alvos, cada um resolvendo um pacote CefSharp
diferente.

**Como confirmar um caso assim:** o Visualizador de Eventos do Windows registra o
módulo e a versão que falharam.

```powershell
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddMinutes(-10)} |
    Where-Object { $_.Message -match 'FintechBankApp' } |
    Select-Object -First 3 -ExpandProperty Message
```

Duas entradas apontando `libcef.dll` em versões distintas confirmam o
diagnóstico. Códigos vistos: `0x80000003` (asserção do Chromium) e `0xc0000005`
(violação de acesso).

## O que foi corrigido

| Correção | Onde | Efeito |
|---|---|---|
| Cache separado por versão do CEF | `Program.cs` | O caminho passou a incluir a versão (`CefCache\133.4.2`). Cada build usa o próprio perfil e nunca lê o de outra — inclusive em futuras atualizações do CefSharp |
| Alvo dos testes alinhado ao do app | `FintechBankApp.Desktop.Tests.csproj` | Elimina a origem das duas saídas: a solução produz um executável só |
| Popup deixou de derrubar o app | `Handlers/WinFormsLifeSpanHandler.cs` | `Control.FromHandle` sobre o handle do CEF não devolve um `Form`; o cast direto lançava `InvalidCastException` em qualquer `window.open`. Agora usa o próprio controle do navegador e agenda a janela na thread de interface |
| Inicialização e encerramento do CEF | `Program.cs`, `MainForm.cs` | Verifica o retorno de `Cef.Initialize`, chama `Cef.Shutdown()` ao sair e libera o navegador em `FormClosed` (não em `FormClosing`, quando o CEF ainda podia acioná-lo) |
| Guard de execução | `run.ps1` | Impede que o erro volte a acontecer na prática |

## Regras para não repetir

1. **Um alvo só.** App e testes no mesmo `TargetFramework`. Alvos diferentes
   geram binários paralelos com CEFs incompatíveis.
2. **Cache sempre por versão.** Nunca voltar a um `CachePath` fixo.
3. **Executar pelo `run.ps1`.** Ele é o guard; o `.exe` direto não tem nenhuma
   verificação.
4. **Ao trocar a versão do CefSharp**, apagar `bin` e `obj` antes de recompilar,
   para não deixar binários da versão anterior por perto.

## Diagnóstico com DevTools

O app abre a porta de depuração 9222 (`RemoteDebuggingPort` em `Program.cs`), o
que permite inspecionar a página, ler o console e executar JavaScript com o app
rodando:

```powershell
curl http://127.0.0.1:9222/json/list
```

É o caminho mais rápido para separar defeito do frontend de defeito do host.

## Limitação conhecida

A janela aberta por `window.open` (usada pelos botões Shop e Admin) surge e fecha
sem carregar o conteúdo. O app não cai mais — o cast que o derrubava foi
corrigido —, mas o popup ainda não exibe a página. Em aberto.
