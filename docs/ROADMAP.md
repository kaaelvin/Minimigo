# MiniMigo — Roadmap de Fatias Verticais

Documento estrutural que liga o `Minimigo SDD.md` (visão/MVP) à execução real.
O projeto é construído em **fatias verticais**: cada fatia entrega valor fim-a-fim e
tem seu próprio ciclo **spec → plano → implementação** (skills superpowers:
brainstorming → writing-plans → subagent-driven-development).

- **Specs:** `docs/superpowers/specs/`
- **Planos:** `docs/superpowers/plans/`
- **Aceite manual por fatia:** `docs/superpowers/ACCEPTANCE-slice-N.md`

## Convenções técnicas do projeto (válidas para todas as fatias)

- **Stack:** Tauri 2, Rust (stable, MSVC), React + Vite + TypeScript, PixiJS 8, SQLite
  (`rusqlite` bundled), Zustand 5. Testes: cargo test, Vitest, Playwright.
- **Crate root é `src-tauri/src/lib.rs`** (`pub fn run()`), NÃO `main.rs` — `main.rs` é
  só um wrapper que chama `minimigo_lib::run()`. Módulos (`mod domain;` etc.) e o
  `tauri::Builder` vivem em `lib.rs`.
- **Arquitetura em camadas (Rust é a fonte da verdade; a UI nunca calcula nada):**
  `domain/` (regras puras, recebe `elapsed` como parâmetro, sem I/O) → `simulation/`
  (tick online + offline com teto) → `persistence/` (snapshot SQLite, linha única id=1)
  → `services/` (AppState, comandos Tauri, loop de tick, persistência) → `shell/`
  (janela nativa). Frontend: `state/` (Zustand espelha o estado), `pixi/` (PetRenderer).
- **Contrato IPC:** Rust expõe comandos `#[tauri::command]` e emite eventos; o DTO
  `PetState` (Rust) espelha `src/types.ts` (TS). A UI faz `invoke`/`listen`.
- **Pré-requisitos de build:** Rust via rustup + Visual Studio Build Tools (workload
  "Desktop development with C++") para o linker MSVC. WebView2 já presente no Win10.
- **Persistência:** DB em `app_data_dir/minimigo.db` (`%APPDATA%\com.kaelvin.minimigo\`).
  Em falha de abrir/inicializar, cai para banco em memória (sessão não persiste).
- **Decisões do SDD que valem sempre:** o pet **nunca morre** (hiberna/fica triste, mas
  é recuperável); local-first, sem coleta invasiva; sem marketplace; não modifica a
  taskbar real do Windows; fofo e leve.
- **Repo:** git local em `C:\Games\MiniMigo`, remoto `origin` =
  `https://github.com/kaaelvin/Minimigo` (branch default `master`).

## Mapa MVP (SDD) → Fatias

Os 10 entregáveis do MVP (ver `Minimigo SDD.md`) distribuídos em fatias:

| # MVP | Entregável | Fatia |
|------|------------|-------|
| 1 | Janela transparente perto da taskbar | ✅ Fatia 1 |
| 6 | Simulação online/offline com teto de punição | ✅ Fatia 1 |
| 7 | Persistência SQLite | ✅ Fatia 1 |
| 4 | Atributos básicos | 🟡 Fatia 1 (fome, energia) → resto em fatia futura |
| 2 | Pet animado (8 animações) | 🟡 Fatia 1 (placeholder, 2 anims) → arte real depois |
| 5 | Ações (alimentar, brincar, limpar, carinho, dormir, medicar) | 🔵 Fatia 2 (alimentar, dormir) → resto depois |
| 3 | System tray + ações rápidas | ⬜ futura |
| 8 | Onboarding (nome/escolha do pet) | ⬜ futura |
| 9 | Configurações (escala, posição, FPS, modo discreto) | ⬜ futura |
| 10 | Evolução (ovo → bebê → jovem → adulto) | ⬜ futura |

Legenda: ✅ concluído · 🟡 parcial · 🔵 em design · ⬜ não iniciado

## Fatias

### Fatia 1 — Pipeline fim-a-fim ✅ CONCLUÍDA
- **Spec:** `docs/superpowers/specs/2026-06-16-minimigo-vertical-slice-1-design.md`
- **Plano:** `docs/superpowers/plans/2026-06-16-minimigo-vertical-slice-1.md`
- **Aceite:** `docs/superpowers/ACCEPTANCE-slice-1.md`
- **Entregue:** janela transparente/borderless/always-on-top perto da taskbar; pet
  animado (sprite sheet placeholder, idle/sleep); atributos fome+energia com decay;
  simulação online (tick 5s) + offline (teto 8h); persistência SQLite; comando
  `get_pet_state` + evento `pet-updated`. Testes: 9 Rust + 6 Vitest + 1 Playwright.

### Fatia 2 — Ações de cuidado 🔵 EM DESIGN (pausada)
- **Spec parcial:** `docs/superpowers/specs/2026-06-16-minimigo-vertical-slice-2-care-actions-design.md`
- **Objetivo:** tornar o app interativo — alimentar e dormir, fechando o loop central
  (pet sente fome/cansaço → usuário age).
- **Status:** brainstorming pausado após a Seção 1 (domínio/simulação) ser aprovada.
  Falta desenhar Seção 2 (comandos Tauri + fluxo) e Seção 3 (UI da barra no hover +
  animações + testes), revisar o spec e escrever o plano. Ver o spec parcial para
  decisões já tomadas e como retomar.

### Fatias futuras (ordem sugerida, a confirmar)
1. **System tray + ações rápidas** — lar natural para ações (alimentar, mostrar/esconder, sair).
2. **Mais atributos + mood engine** — felicidade, higiene, afeto, saúde + humor combinado.
3. **Demais ações** — brincar, limpar, carinho, medicar (dependem dos novos atributos).
4. **Onboarding** — primeira execução: nomear/escolher o pet.
5. **Evolução** — estágios ovo → bebê → jovem → adulto.
6. **Configurações** — escala, posição, FPS, modo discreto.
7. **Arte real** — substituir sprite sheet placeholder pelas 8 animações finais.
