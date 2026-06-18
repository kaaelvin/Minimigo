# MiniMigo — Design: Fatia Vertical 2 (Ações de Cuidado)

**Data:** 2026-06-16 (design concluído 2026-06-18)
**Status:** ✅ DESIGN CONCLUÍDO — pronto para `superpowers:writing-plans`
**Fonte:** `Minimigo SDD.md`, `docs/ROADMAP.md`
**Depende de:** Fatia 1 (concluída)

> Todas as seções aprovadas pelo usuário. Próximo passo: `superpowers:writing-plans`
> → `superpowers:subagent-driven-development`.

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
4. **Anti-spam de alimentar = saciedade impede feed** (sem estado de tempo/cooldown):
   só é possível alimentar se `hunger >= FEED_MIN_HUNGER`. A regra vive no domínio puro
   (testável) e a UI a espelha desabilitando o botão quando saciado.
5. **Comandos explícitos** (`feed_pet`, `toggle_sleep`), não um genérico `perform_action`.
6. **Comandos só emitem `pet-updated`** (não retornam `PetState`): caminho único de
   atualização — a UI sempre reconcilia pelo `listen`.
7. **Barra de hover = overlay React/DOM** por cima do canvas Pixi (mais simples que Pixi
   para botões). Ícones = emojis (🍖 alimentar, 💤 dormir / ☀️ acordar) enquanto a arte
   é placeholder.

## Seção 1 — Domínio e simulação ✅ APROVADA

Mudanças no Rust (mantendo o domain puro: recebe `elapsed` + modo, sem I/O/relógio):

- **Novo estado no `Pet`:** campo `mode: PetMode`, enum serializável `{ Awake, Asleep }`
  com `#[derive(Default)]` e `#[default]` em `Awake`. Persistido no snapshot (a fatia 1
  persiste `pet_json`, então o campo novo entra de graça via serde); o campo leva
  `#[serde(default)]` para que snapshots antigos sem ele desserializem como `Awake`.
- **Decay depende do modo** (função pura no `domain`):
  - **Acordado:** fome +0,5/min, energia −0,3/min (comportamento atual da Fatia 1).
  - **Dormindo:** energia **+1,0/min** (até 100), fome **+0,2/min** (mais devagar).
  - (Magnitudes são propostas iniciais — ajustar no plano/testes.)
- **Ações puras no `domain`:**
  - `feed(&mut self) -> bool` → se `hunger >= FEED_MIN_HUNGER` (ex.: 10), faz
    `hunger = (hunger - FEED_AMOUNT).clamp(0,100)` (ex.: `FEED_AMOUNT = 30`) e retorna
    `true`; senão é no-op e retorna `false`. Funciona em qualquer modo; não altera o modo.
  - `toggle_sleep(&mut self)` → alterna `awake`/`asleep`.
- **Simulação:** `tick` (online) e `apply_offline` aplicam o perfil de decay conforme o
  modo. Se o app fechar com o pet dormindo, a energia recupera offline também (ainda
  limitada pelo teto de 8h da Fatia 1).

**Princípio mantido:** Rust é a fonte da verdade; a UI só dispara ações e renderiza.

## Seção 2 — Comandos Tauri + fluxo ✅ APROVADA

**Comandos** (em `services/mod.rs`, registrados no `invoke_handler` do `lib.rs`):
- `feed_pet(app: AppHandle, state: State<AppState>)`
- `toggle_sleep(app: AppHandle, state: State<AppState>)`

Retorno `()` (ou `Result<(), String>` se quisermos propagar erro de persistência). **Não
retornam `PetState`** — a UI reage só pelo evento (caminho único de atualização).

**Fluxo de cada comando** (mesmo padrão para os dois):
1. `lock` no `pet`, aplica a ação no domínio (`feed()` / `toggle_sleep()`).
2. `persist` imediato (`now_unix`) — ação explícita do usuário sobrevive a crash/fechar.
3. `emit("pet-updated", PetState::from(&*pet))` — reusa o canal do tick loop, então toda
   a UI reconcilia pelo mesmo caminho.

**DTO:** `PetState` (Rust) e `src/types.ts` ganham `asleep: boolean` (derivado de `mode`).

**Concorrência:** comandos e o tick loop disputam o mesmo `Mutex<Pet>`; o `Mutex` já
serializa — sem corrida.

## Seção 3 — UI (barra no hover) + animações + testes ✅ APROVADA

**Barra no hover (overlay React/DOM sobre o canvas):**
- `App.tsx` renderiza um overlay DOM posicionado absoluto por cima do canvas Pixi (o
  canvas segue sendo a base; o container tem `position: relative`).
- Visibilidade por estado React `hovering`, alternado em `mouseenter`/`mouseleave` do
  container. Fora do hover a barra fica oculta para o pet aparecer limpo.
- **Botão Alimentar (🍖):** `invoke("feed_pet")`; `disabled` quando
  `pet.hunger < FEED_MIN_HUNGER` (espelha a regra do domínio).
- **Botão Dormir/Acordar (💤 / ☀️):** `invoke("toggle_sleep")`; rótulo/ícone alterna por
  `pet.asleep`.
- A barra lê `pet` do `usePetStore` (populado pelo `get_pet_state` inicial + `pet-updated`).

**Animação:**
- `pickAnimation(pet)` passa a decidir por `pet.asleep` (`asleep → "sleep"`, senão
  `"idle"`), substituindo o limiar de energia atual (`SLEEP_ENERGY_THRESHOLD` sai).
  `PetRenderer.render` segue igual.

**Testes:**
- **Rust:** `feed` reduz+clamp e respeita saciedade (no-op + `false` abaixo do limiar);
  `toggle_sleep` alterna; decay dormindo (energia sobe, fome sobe devagar); offline
  dormindo respeita o teto de 8h; round-trip de persistência inclui o modo; snapshot
  antigo sem o campo desserializa como `Awake`.
- **Vitest:** `pickAnimation` por modo; store reflete `asleep`.
- **Playwright (leve):** barra aparece no hover e tem os 2 botões.

## Critérios de aceite

- Passar o mouse no pet revela a barra; clicar em alimentar reduz a fome visivelmente e o
  botão desabilita quando saciado (`hunger < FEED_MIN_HUNGER`).
- Clicar em dormir põe o pet em sono (animação `sleep`), a energia sobe ao longo do
  tempo, e o botão vira "acordar"; clicar de novo acorda.
- O modo persiste ao fechar/reabrir; sono offline recupera energia (limitado a 8h).
- Suíte completa (Rust + Vitest + Playwright) verde.
