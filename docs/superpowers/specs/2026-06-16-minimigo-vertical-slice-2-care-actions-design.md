# MiniMigo — Design: Fatia Vertical 2 (Ações de Cuidado)

**Data:** 2026-06-16
**Status:** 🔵 EM DESIGN — PAUSADO (brainstorming interrompido após a Seção 1 aprovada)
**Fonte:** `Minimigo SDD.md`, `docs/ROADMAP.md`
**Depende de:** Fatia 1 (concluída)

> **Para retomar:** reentre na skill `superpowers:brainstorming`, releia este spec,
> e continue a partir da **Seção 2** (comandos Tauri + fluxo) e **Seção 3** (UI da
> barra no hover + animações + testes). Depois: spec self-review → revisão do usuário
> → `superpowers:writing-plans` → `superpowers:subagent-driven-development`.

## Objetivo da fatia

Tornar o MiniMigo **interativo**, fechando o loop central do Tamagotchi: o pet sente
fome e cansaço, e o usuário pode **agir** para cuidar dele. Escopo desta fatia: duas
ações, casadas com os dois atributos existentes (fome, energia):

- **Alimentar** → reduz a fome (instantâneo).
- **Dormir/Acordar** → alterna um **modo de sono** que recupera energia ao longo do tempo.

### Fora de escopo (fatias futuras)
Demais ações (brincar, limpar, carinho, medicar) e seus atributos (felicidade, higiene,
afeto, saúde); system tray; onboarding; evolução; configurações; arte final.

## Decisões já tomadas (confirmadas com o usuário)

1. **Próxima fatia = Ações de cuidado** (alimentar + dormir).
2. **Gatilho das ações = barra de botões no hover:** ao passar o mouse sobre o pet,
   aparece uma pequena barra com ícones (alimentar, dormir/acordar); clicar dispara a
   ação. Tudo dentro da janela 220×220 do pet. (Tray fica para fatia futura.)
3. **Dormir é um MODO (toggle), não efeito instantâneo:**
   - Alimentar é instantâneo (fome −X com clamp).
   - Dormir coloca o pet em estado de sono: energia recupera mais rápido ao longo do
     tempo; fome continua subindo, porém mais devagar. Permanece dormindo até o usuário
     acordar. Usa a animação `sleep` do placeholder.

## Seção 1 — Domínio e simulação ✅ APROVADA

Mudanças no Rust (mantendo o domain puro: recebe `elapsed` + modo, sem I/O/relógio):

- **Novo estado no `Pet`:** um modo `awake` | `asleep` (enum `PetMode` serializável, ou
  `asleep: bool`). Persistido no snapshot (a fatia 1 persiste `pet_json`, então o campo
  novo entra de graça via serde — atenção a snapshots antigos sem o campo: usar
  `#[serde(default)]` para desserializar como `awake`).
- **Decay depende do modo** (função pura no `domain`):
  - **Acordado:** fome +0,5/min, energia −0,3/min (comportamento atual da Fatia 1).
  - **Dormindo:** energia **+1,0/min** (até 100), fome **+0,2/min** (mais devagar).
  - (Magnitudes são propostas iniciais — ajustar no plano/testes.)
- **Ações puras no `domain`:**
  - `feed()` → `hunger = (hunger - FEED_AMOUNT).clamp(0,100)` (ex.: `FEED_AMOUNT = 30`).
    Funciona em qualquer modo; não altera o modo.
  - `toggle_sleep()` → alterna `awake`/`asleep`.
- **Simulação:** `tick` (online) e `apply_offline` aplicam o perfil de decay conforme o
  modo. Se o app fechar com o pet dormindo, a energia recupera offline também (ainda
  limitada pelo teto de 8h da Fatia 1).

**Princípio mantido:** Rust é a fonte da verdade; a UI só dispara ações e renderiza.

## Seção 2 — Comandos Tauri + fluxo ⬜ A DESENHAR

Esboço a validar ao retomar (não definitivo):
- Comandos: `feed_pet` e `toggle_sleep` (ou um genérico `perform_action(action)`),
  ambos em `services/mod.rs`, mutando o `Pet` sob o `Mutex`, persistindo e emitindo o
  estado atualizado (reusar/`emit("pet-updated", ...)`).
- `PetState` (DTO Rust + `src/types.ts`) ganha o modo (`asleep: boolean`) para a UI saber
  qual animação mostrar e rotular o botão dormir/acordar.
- Decidir: feeding tem cooldown? (Na Seção 1 ficou sem cooldown explícito; reavaliar —
  o clamp já limita, mas spam de clique zera fome instantâneo.)

## Seção 3 — UI (barra no hover) + animações + testes ⬜ A DESENHAR

Esboço a validar ao retomar:
- **Barra no hover:** overlay com 2 botões/ícones sobre o canvas do pet, visível só no
  `mouseenter` da janela. Botão dormir vira "acordar" quando `asleep`. Implementação:
  React (DOM por cima do canvas Pixi) ou dentro do Pixi — provavelmente DOM/React é mais
  simples para botões. Clicar → `invoke` do comando correspondente.
- **Animação:** `pickAnimation` passa a considerar o modo (`asleep` → `sleep`, senão
  `idle`), substituindo o gatilho atual por limiar de energia. Reconciliar com
  `PetRenderer`.
- **Testes:**
  - Rust: `feed` reduz e faz clamp; `toggle_sleep` alterna; decay no modo dormindo
    (energia sobe, fome sobe devagar); offline no modo dormindo respeita o teto;
    round-trip de persistência inclui o modo; desserialização de snapshot antigo
    (sem o campo) cai para `awake`.
  - Vitest: `pickAnimation` por modo; store reflete o modo.
  - Playwright (leve): barra aparece no hover e tem os botões.

## Critérios de aceite (rascunho)

- Passar o mouse no pet revela a barra; clicar em alimentar reduz a fome visivelmente.
- Clicar em dormir põe o pet em sono (animação `sleep`), a energia sobe ao longo do
  tempo, e o botão vira "acordar"; clicar de novo acorda.
- O modo persiste ao fechar/reabrir; sono offline recupera energia (limitado a 8h).
- Suíte completa (Rust + Vitest + Playwright) verde.
