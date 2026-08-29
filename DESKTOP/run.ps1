<#
    Executa o app desktop garantindo que seja o binário certo.

    Rodar o .exe direto de dentro de bin\ já custou horas: quando a solução
    produz mais de uma saída (alvos diferentes entre o app e os testes), cada
    pasta traz uma versão distinta do Chromium. Abrir a errada dá um crash sem
    mensagem, e o sintoma engana — parece defeito do app, é binário obsoleto.

    Este script resolve qual executável rodar, recusa continuar quando há
    ambiguidade e avisa quando o binário está mais velho que o código.

    Uso:
        .\run.ps1              # compila se preciso e executa
        .\run.ps1 -SkipBuild   # executa o que já está compilado
        .\run.ps1 -Check       # só diagnostica, não executa
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$projeto = Join-Path $raiz 'FintechBankApp.Desktop'
$binDir = Join-Path $projeto 'bin'

function Escrever($texto, $cor = 'Gray') { Write-Host $texto -ForegroundColor $cor }

# --- 1. Compilação -----------------------------------------------------------
if (-not $SkipBuild -and -not $Check) {
    $dotnet = @(
        "$env:ProgramFiles\dotnet\dotnet.exe",
        "${env:ProgramFiles(x86)}\dotnet\dotnet.exe",
        "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dotnet) { throw 'dotnet não encontrado. Instale o SDK do .NET.' }

    Escrever '==> Compilando...' 'Cyan'
    & $dotnet build (Join-Path $raiz 'FintechBankApp.Desktop.slnx') --nologo | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação.' }
}

if (-not (Test-Path $binDir)) { throw "Nada compilado em $binDir. Rode sem -SkipBuild." }

# --- 2. Localiza os executáveis ----------------------------------------------
$exes = @(Get-ChildItem -Path $binDir -Recurse -Filter 'FintechBankApp.Desktop.exe' -ErrorAction SilentlyContinue)
if ($exes.Count -eq 0) { throw "Nenhum executável encontrado em $binDir." }

# Cada saída carrega o próprio Chromium; versões diferentes na mesma máquina
# são exatamente o cenário que quebra.
$candidatos = $exes | ForEach-Object {
    $libcef = Join-Path $_.DirectoryName 'libcef.dll'
    [pscustomobject]@{
        Caminho   = $_.FullName
        Pasta     = $_.DirectoryName.Replace($binDir, 'bin')
        Compilado = $_.LastWriteTime
        Cef       = if (Test-Path $libcef) { (Get-Item $libcef).VersionInfo.FileVersion.Split('+')[0] } else { $null }
    }
}

# Sem libcef ao lado, o processo morre ao iniciar — não é candidato válido.
$validos = @($candidatos | Where-Object { $_.Cef })

Escrever "`n==> Executáveis encontrados: $($candidatos.Count)" 'Cyan'
foreach ($c in $candidatos) {
    $marca = if ($c.Cef) { "CEF $($c.Cef)" } else { 'SEM libcef (inválido)' }
    Escrever ("    {0,-42} {1,-16} {2}" -f $c.Pasta, $marca, $c.Compilado)
}

if ($validos.Count -eq 0) { throw 'Nenhum executável tem libcef.dll ao lado. Recompile.' }

# --- 3. Recusa ambiguidade ---------------------------------------------------
$versoes = @($validos | Select-Object -ExpandProperty Cef -Unique)
if ($versoes.Count -gt 1) {
    Escrever "`n!! Há saídas com versões diferentes do Chromium: $($versoes -join ', ')" 'Red'
    Escrever '   Elas disputam o mesmo perfil e derrubam uma à outra.' 'Red'
    Escrever '   Alinhe o TargetFramework entre o app e os testes, apague bin/obj e recompile.' 'Yellow'
    throw 'Ambiguidade de binário: recusando executar para não rodar o errado.'
}

$alvo = $validos | Sort-Object Compilado -Descending | Select-Object -First 1

# --- 4. Binário mais velho que o código? -------------------------------------
$fonteMaisNova = Get-ChildItem -Path $projeto -Recurse -Include '*.cs', '*.csproj' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(bin|obj)\\' } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($fonteMaisNova -and $fonteMaisNova.LastWriteTime -gt $alvo.Compilado) {
    Escrever "`n!! O código é mais recente que o binário." 'Yellow'
    Escrever "   $($fonteMaisNova.Name) alterado em $($fonteMaisNova.LastWriteTime)" 'Yellow'
    Escrever "   binário compilado em $($alvo.Compilado)" 'Yellow'
    Escrever '   Rode sem -SkipBuild para não testar código antigo.' 'Yellow'
}

Escrever "`n==> Alvo: $($alvo.Pasta)" 'Green'
Escrever "    CEF $($alvo.Cef) | compilado $($alvo.Compilado)"

if ($Check) { Escrever "`n(-Check: nada foi executado)" 'Gray'; return }

Start-Process -FilePath $alvo.Caminho -WorkingDirectory (Split-Path $alvo.Caminho)
Escrever '==> Aplicativo iniciado.' 'Green'
