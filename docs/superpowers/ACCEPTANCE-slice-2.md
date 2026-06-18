# Checklist de aceite manual — Fatia vertical 2 (Ações de cuidado)

Estes critérios exigem a GUI real do Tauri (janela, hover, persistência em disco e
decay ao longo do tempo), então não dá para cobri-los só com testes automatizados.
O E2E do Playwright cobre apenas que a barra de cuidado aparece no hover na camada web
(sem backend Tauri); o resto é validação manual abaixo.

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

### 1. Barra de cuidado aparece no hover

- [ ] Passar o mouse sobre a janela do pet **revela uma barra** com dois botões
      (🍖 alimentar e 💤/☀️ dormir/acordar) sobre o pet.
- [ ] Tirar o mouse da janela **esconde a barra** (o pet fica limpo, só o sprite).

### 2. Alimentar reduz a fome e respeita a saciedade

- Alimentar é instantâneo: `fome -= FEED_AMOUNT` (30) com clamp em 0.
- Regra de saciedade: só alimenta se `fome >= FEED_MIN_HUNGER` (10); o botão fica
  **desabilitado** quando o pet está saciado (e enquanto o estado ainda carrega).
- [ ] Com o pet com fome, clicar em 🍖 **reduz a fome visivelmente**.
- [ ] Quando a fome cai abaixo de 10, o botão 🍖 fica **desabilitado** (cinza/sem clique).

> Dica: a fome sobe devagar (+0,5/min acordado). Para ver a saciedade desabilitar o
> botão rápido, alimente algumas vezes seguidas até a fome chegar perto de 0.

### 3. Dormir é um modo (toggle) que recupera energia

- Dormir coloca o pet em **modo de sono** (animação `sleep`): energia recupera
  **+1,0/min** (até 100) e a fome sobe mais devagar (**+0,2/min**). Permanece dormindo
  até o usuário acordar.
- [ ] Clicar em 💤 põe o pet na **animação de dormir** e o botão vira **☀️ (acordar)**.
- [ ] Deixando o pet dormindo por alguns minutos, a **energia sobe** ao longo do tempo.
- [ ] Clicar em ☀️ **acorda** o pet (volta à animação idle e ao decay normal).

> Dica para ver mais rápido: as taxas de sono ficam em `src-tauri/src/domain/mod.rs`
> (`ENERGY_RECOVER_ASLEEP_PER_MIN`, `HUNGER_RATE_ASLEEP_PER_MIN`). Pode aumentá-las
> temporariamente, rodar `pnpm tauri dev` e observar em segundos. **Reverta** depois.

### 4. O modo persiste entre sessões + sono offline respeita o teto

- O modo (`awake`/`asleep`) é salvo junto do snapshot em SQLite
  (`%APPDATA%\com.kaelvin.minimigo\minimigo.db`). Snapshots antigos da Fatia 1 (sem o
  campo `mode`) carregam como `awake` (via `#[serde(default)]`).
- [ ] Com o pet **dormindo**, feche e **reabra** o app — ele continua **dormindo**.
- [ ] O tempo fechado dormindo aplica **recuperação de energia offline**, ainda
      **limitada a no máximo 8 horas** (`MAX_OFFLINE_MINUTES = 8h`).

> Para validar o teto offline sem esperar 8h: edite o `last_seen` salvo no DB para uma
> data antiga (com o pet dormindo) e reabra; a energia recuperada deve corresponder a
> no máximo 8h de taxa, não ao período inteiro.

## Resultado

- [ ] Todos os 4 critérios acima OK → fatia 2 aceita.
