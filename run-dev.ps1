#!/usr/bin/env pwsh
# Launcher de desenvolvimento do MiniMigo.
# Sobe o app Tauri em modo dev (janela do pet + hot reload do front).
# Uso (PowerShell, na raiz do projeto):  .\run-dev.ps1
#
# Cuida do gotcha comum no Windows: garante o cargo (Rust) no PATH desta sessão.
# NÃO regenera o atlas (public/pets/*.json já vem commitado); rode `pnpm assets:pets`
# manualmente quando mexer na arte dos pets.

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

# 0. Node >= 18 (o pnpm exige). Se estiver numa versão antiga (ex.: via nvm-windows),
#    avisa de forma clara em vez de estourar lá no pnpm.
$nodeVer = (& node --version) 2>$null
if ($nodeVer -match '^v(\d+)\.') {
  $nodeMajor = [int]$Matches[1]
  if ($nodeMajor -lt 18) {
    Write-Error "Node $nodeVer ativo; o pnpm exige >= 18. Rode 'nvm use 22.15.0' (ou outra >= 18) e tente de novo."
    exit 1
  }
} else {
  Write-Warning "Nao consegui detectar a versao do Node. Garanta Node >= 18 antes de continuar."
}

# 1. cargo (Rust) no PATH, se ainda não estiver.
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
  if (Test-Path $cargoBin) {
    $env:Path = "$cargoBin;$env:Path"
    Write-Host "cargo adicionado ao PATH: $cargoBin" -ForegroundColor DarkGray
  } else {
    Write-Warning "cargo nao encontrado e '$cargoBin' nao existe. Instale o Rust (rustup) se o build falhar."
  }
}

# 2. Dependencias do front, se ainda nao instaladas.
if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
  Write-Host "node_modules ausente - rodando pnpm install..." -ForegroundColor Yellow
  pnpm install
}

# 3. Sobe o app. A primeira compilacao do backend Rust pode demorar.
Write-Host "Iniciando MiniMigo (pnpm tauri dev). Feche a janela ou Ctrl+C para parar." -ForegroundColor Cyan
pnpm tauri dev
