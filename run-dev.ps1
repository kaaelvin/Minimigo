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
