# Checklist de aceite manual — Fatia vertical 1 (MiniMigo)

Estes critérios exigem a GUI real do Tauri (janela, sprite, persistência em disco),
então não dá para cobri-los só com testes automatizados. O E2E do Playwright cobre
apenas que o `<canvas>` monta na camada web; o resto é validação manual abaixo.

## Pré-requisitos

- `cargo` precisa estar no PATH. No PowerShell:
  ```powershell
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  ```
- Dependências instaladas (`pnpm install`) e toolchain do Tauri 2 funcionando.

## Como rodar

```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
pnpm tauri dev
```

A primeira execução compila o backend Rust (pode demorar). Em seguida a janela do
pet deve aparecer.

## Critérios de aceite

### 1. Janela transparente/sem borda, ancorada no canto inferior direito

- [ ] A janela aparece **sem borda e com fundo transparente** (só o sprite é visível,
      sem moldura/título).
- [ ] Fica posicionada **perto do canto inferior direito**, junto à barra de tarefas.
- [ ] **Não há ícone na barra de tarefas** para a janela do pet (skip-taskbar).

### 2. Sprite do pet aparece e anima (idle)

- [ ] O sprite do pet é renderizado dentro da janela.
- [ ] Há uma animação de **idle** rodando (movimento sutil contínuo), não um quadro estático.

### 3. Decaimento ao longo do tempo (fome sobe, energia cai)

- O loop de tick roda no backend a cada **5 segundos**.
- As taxas são **lentas de propósito**:
  - fome: **+0,5 por minuto** (`HUNGER_RATE_PER_MIN`)
  - energia: **-0,3 por minuto** (`ENERGY_RATE_PER_MIN`)
- [ ] Deixando o app aberto por alguns minutos, a **fome aumenta** e a **energia diminui**
      (refletido no estado/representação do pet).

> Dica para ver mais rápido: como o decay real é lento, dá para **aumentar
> temporariamente as taxas** em `src-tauri/src/domain/mod.rs` (constantes
> `HUNGER_RATE_PER_MIN` e `ENERGY_RATE_PER_MIN`), rodar `pnpm tauri dev` de novo e
> observar a mudança em segundos. **Reverta os valores** depois do teste.

### 4. Persistência entre sessões + decay offline

- O estado é salvo em SQLite no `app_data_dir` do SO. No Windows tipicamente:
  `%APPDATA%\com.kaelvin.minimigo\minimigo.db`
  (o identifier do bundle é `com.kaelvin.minimigo`).
- [ ] Feche o app e **reabra** — o estado anterior (fome/energia) é **preservado**,
      não reinicia do zero.
- [ ] O tempo em que ficou fechado é aplicado como **decay offline ao recarregar**,
      **limitado a no máximo 8 horas** (`MAX_OFFLINE_MINUTES = 8h`). Ou seja, ficar
      fechado por dias não zera o pet de uma vez — o castigo é capado em 8h de decay.

> Para validar o teto offline sem esperar 8h: ajuste o relógio / ou edite o
> `last_seen` salvo no DB para uma data antiga e reabra; o decay aplicado deve
> corresponder a no máximo 8h de taxa, não ao período inteiro.

## Resultado

- [ ] Todos os 4 critérios acima OK → fatia 1 aceita.
