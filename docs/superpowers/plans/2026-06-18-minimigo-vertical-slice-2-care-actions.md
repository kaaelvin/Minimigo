# Fatia 2 — Ações de Cuidado: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o MiniMigo interativo — alimentar (instantâneo, com saciedade impedindo spam) e dormir (modo toggle que recupera energia) — via barra de botões no hover.

**Architecture:** Rust segue como fonte da verdade. O domínio puro ganha um `PetMode { Awake, Asleep }`, a ação `feed()` (gated por saciedade) e `toggle_sleep()`; o decay passa a depender do modo. Dois comandos Tauri (`feed_pet`, `toggle_sleep`) mutam o `Pet`, persistem e emitem `pet-updated` — a UI reconcilia só pelo evento. No front, uma barra DOM por cima do canvas Pixi aparece no hover; `pickAnimation` passa a decidir pela flag `asleep`.

**Tech Stack:** Tauri 2, Rust (MSVC), React 19 + Vite + TS, PixiJS 8, Zustand 5, rusqlite. Testes: cargo test, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-16-minimigo-vertical-slice-2-care-actions-design.md`

**Convenção de commits:** mensagens em pt-BR no estilo conventional commits; toda mensagem termina com o trailer:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## Estrutura de arquivos

**Rust (`src-tauri/src/`):**
- `domain/mod.rs` — Modificar: enum `PetMode`, campo `mode` no `Pet`, consts `FEED_AMOUNT`/`FEED_MIN_HUNGER` e rates do sono, métodos `feed`/`toggle_sleep`, decay movido para `Pet` (sensível ao modo).
- `simulation/mod.rs` — Modificar: `tick`/`apply_offline` chamam `pet.apply_decay`.
- `persistence/mod.rs` — Modificar: testes de round-trip do modo + snapshot legado.
- `services/mod.rs` — Modificar: `PetState` ganha `asleep`; comandos `feed_pet`/`toggle_sleep`.
- `lib.rs` — Modificar: registrar os dois comandos no `invoke_handler`.

**Front (`src/`):**
- `types.ts` — Modificar: `asleep: boolean` no `PetState`.
- `pixi/PetRenderer.ts` + `.test.ts` — Modificar: `pickAnimation` decide por `asleep`.
- `state/petStore.test.ts` — Modificar: objetos de teste incluem `asleep`.
- `components/CareBar.tsx` — Criar: barra com os dois botões.
- `App.tsx` — Modificar: wrapper relativo + hover + `<CareBar />`.
- `App.css` — Modificar: estilos da barra (oculta via `visibility`).
- `e2e/app.spec.ts` — Modificar: teste de hover revela a barra.

---

## Task 1: PetMode + estado de modo no Pet (domínio)

**Files:**
- Modify: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/simulation/mod.rs` (literal de teste)
- Modify: `src-tauri/src/services/mod.rs` (literal de teste)
- Modify: `src-tauri/src/persistence/mod.rs` (literal de teste)

- [ ] **Step 1: Escrever os testes que falham** — adicionar ao `mod tests` de `src-tauri/src/domain/mod.rs`:

```rust
    #[test]
    fn new_pet_starts_awake() {
        assert_eq!(Pet::new("Migo").mode, PetMode::Awake);
    }

    #[test]
    fn toggle_sleep_alternates() {
        let mut p = Pet::new("Migo");
        p.toggle_sleep();
        assert_eq!(p.mode, PetMode::Asleep);
        p.toggle_sleep();
        assert_eq!(p.mode, PetMode::Awake);
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri; cargo test --lib domain::tests::new_pet_starts_awake`
Expected: FALHA de compilação (`no field mode`, `no method toggle_sleep`, `PetMode` não existe).

- [ ] **Step 3: Implementar o enum, o campo e o método** — em `src-tauri/src/domain/mod.rs`, adicionar o enum logo após os `use`:

```rust
/// Modo do pet: acordado (decay normal) ou dormindo (recupera energia).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum PetMode {
    #[default]
    Awake,
    Asleep,
}
```

Adicionar o campo ao struct `Pet` (com `#[serde(default)]` para snapshots antigos):

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pet {
    pub name: String,
    pub attributes: Attributes,
    #[serde(default)]
    pub mode: PetMode,
}
```

Atualizar `Pet::new` e adicionar `toggle_sleep` no `impl Pet`:

```rust
impl Pet {
    pub fn new(name: impl Into<String>) -> Self {
        Pet {
            name: name.into(),
            attributes: Attributes { hunger: 0.0, energy: 100.0 },
            mode: PetMode::Awake,
        }
    }

    pub fn toggle_sleep(&mut self) {
        self.mode = match self.mode {
            PetMode::Awake => PetMode::Asleep,
            PetMode::Asleep => PetMode::Awake,
        };
    }
}
```

- [ ] **Step 4: Corrigir os literais de `Pet` nos outros testes** (o campo novo quebra a construção). Em `src-tauri/src/simulation/mod.rs`, no helper `pet_at`:

```rust
    fn pet_at(hunger: f64, energy: f64) -> Pet {
        Pet { name: "Migo".into(), attributes: Attributes { hunger, energy }, mode: crate::domain::PetMode::Awake }
    }
```

Em `src-tauri/src/services/mod.rs`, no teste `applies_offline_decay_on_load`:

```rust
        let pet = Pet {
            name: "Migo".into(),
            attributes: Attributes { hunger: 0.0, energy: 100.0 },
            mode: crate::domain::PetMode::Awake,
        };
```

Em `src-tauri/src/persistence/mod.rs`, no teste `save_then_load_round_trip`:

```rust
        let pet = Pet { name: "Migo".into(), attributes: Attributes { hunger: 42.0, energy: 7.0 }, mode: crate::domain::PetMode::Awake };
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd src-tauri; cargo test --lib`
Expected: PASSA (todos os testes existentes + os 2 novos).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain/mod.rs src-tauri/src/simulation/mod.rs src-tauri/src/services/mod.rs src-tauri/src/persistence/mod.rs
git commit -m "feat(domain): adiciona PetMode (awake/asleep) e toggle_sleep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Ação `feed` com saciedade (domínio)

**Files:**
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 1: Escrever os testes que falham** — adicionar ao `mod tests` de `src-tauri/src/domain/mod.rs`:

```rust
    #[test]
    fn feed_reduces_hunger_when_hungry() {
        let mut p = Pet::new("Migo");
        p.attributes.hunger = 50.0;
        assert!(p.feed());
        assert_eq!(p.attributes.hunger, 20.0); // 50 - 30
    }

    #[test]
    fn feed_clamps_at_zero() {
        let mut p = Pet::new("Migo");
        p.attributes.hunger = 20.0;
        assert!(p.feed());
        assert_eq!(p.attributes.hunger, 0.0); // 20 - 30 -> clamp 0
    }

    #[test]
    fn feed_noop_when_sated() {
        let mut p = Pet::new("Migo");
        p.attributes.hunger = 5.0; // < FEED_MIN_HUNGER
        assert!(!p.feed());
        assert_eq!(p.attributes.hunger, 5.0);
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri; cargo test --lib domain::tests::feed`
Expected: FALHA de compilação (`no method feed`).

- [ ] **Step 3: Implementar `feed` + consts** — em `src-tauri/src/domain/mod.rs`, adicionar as consts perto das rates existentes:

```rust
pub const FEED_AMOUNT: f64 = 30.0;
pub const FEED_MIN_HUNGER: f64 = 10.0;
```

E o método no `impl Pet`:

```rust
    /// Alimenta o pet se ele estiver com fome suficiente (saciedade impede spam).
    /// Retorna `true` se alimentou, `false` se estava saciado demais.
    pub fn feed(&mut self) -> bool {
        if self.attributes.hunger >= FEED_MIN_HUNGER {
            self.attributes.hunger = (self.attributes.hunger - FEED_AMOUNT).clamp(0.0, 100.0);
            true
        } else {
            false
        }
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri; cargo test --lib domain::tests::feed`
Expected: PASSA (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain/mod.rs
git commit -m "feat(domain): adiciona feed() com regra de saciedade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Decay sensível ao modo (domínio + simulação)

**Files:**
- Modify: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/simulation/mod.rs`

- [ ] **Step 1: Escrever os testes que falham** — substituir os testes `decay_increases_hunger_and_decreases_energy` e `decay_clamps_within_bounds` em `src-tauri/src/domain/mod.rs` por testes ao nível de `Pet`:

```rust
    #[test]
    fn awake_decay_matches_slice1() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 10.0, energy: 90.0 }, mode: PetMode::Awake };
        p.apply_decay(10.0);
        assert_eq!(p.attributes.hunger, 15.0); // 10 + 0.5*10
        assert_eq!(p.attributes.energy, 87.0); // 90 - 0.3*10
    }

    #[test]
    fn awake_decay_clamps() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 99.0, energy: 1.0 }, mode: PetMode::Awake };
        p.apply_decay(1000.0);
        assert_eq!(p.attributes.hunger, 100.0);
        assert_eq!(p.attributes.energy, 0.0);
    }

    #[test]
    fn asleep_recovers_energy_and_slows_hunger() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 10.0, energy: 50.0 }, mode: PetMode::Asleep };
        p.apply_decay(10.0);
        assert_eq!(p.attributes.energy, 60.0); // 50 + 1.0*10
        assert_eq!(p.attributes.hunger, 12.0); // 10 + 0.2*10
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri; cargo test --lib domain::tests`
Expected: FALHA de compilação (`Pet` não tem `apply_decay`).

- [ ] **Step 3: Mover o decay para `Pet` (sensível ao modo)** — em `src-tauri/src/domain/mod.rs`, adicionar as rates do sono perto das existentes:

```rust
pub const HUNGER_RATE_ASLEEP_PER_MIN: f64 = 0.2;
pub const ENERGY_RECOVER_ASLEEP_PER_MIN: f64 = 1.0;
```

Remover o método `Attributes::apply_decay` (o `impl Attributes { ... }` inteiro) e adicionar ao `impl Pet`:

```rust
    /// Aplica o decay conforme o modo. Acordado: fome sobe, energia cai.
    /// Dormindo: energia recupera, fome sobe devagar.
    pub fn apply_decay(&mut self, elapsed_minutes: f64) {
        let a = &mut self.attributes;
        match self.mode {
            PetMode::Awake => {
                a.hunger = (a.hunger + HUNGER_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
                a.energy = (a.energy - ENERGY_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
            }
            PetMode::Asleep => {
                a.hunger = (a.hunger + HUNGER_RATE_ASLEEP_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
                a.energy = (a.energy + ENERGY_RECOVER_ASLEEP_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
            }
        }
    }
```

- [ ] **Step 4: Atualizar a simulação para chamar `pet.apply_decay`** — em `src-tauri/src/simulation/mod.rs`, trocar as duas chamadas:

```rust
pub fn tick(pet: &mut Pet, elapsed_minutes: f64) {
    pet.apply_decay(elapsed_minutes);
}

pub fn apply_offline(pet: &mut Pet, elapsed_minutes: f64) {
    let capped = elapsed_minutes.min(MAX_OFFLINE_MINUTES);
    pet.apply_decay(capped);
}
```

- [ ] **Step 5: Adicionar teste de sono offline respeitando o teto** — em `src-tauri/src/simulation/mod.rs`, no `mod tests`:

```rust
    #[test]
    fn offline_asleep_recovers_energy_capped() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 0.0, energy: 0.0 }, mode: crate::domain::PetMode::Asleep };
        apply_offline(&mut p, 100_000.0); // muito tempo -> limitado a 480 min
        assert_eq!(p.attributes.energy, 100.0); // 0 + 1.0*480 = 480 -> clamp 100
        assert_eq!(p.attributes.hunger, 96.0);  // 0 + 0.2*480
    }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd src-tauri; cargo test --lib`
Expected: PASSA (todos, incluindo os novos de decay e offline-asleep).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/domain/mod.rs src-tauri/src/simulation/mod.rs
git commit -m "feat(domain): decay depende do modo (sono recupera energia)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Persistência do modo + compat com snapshot legado

**Files:**
- Modify: `src-tauri/src/persistence/mod.rs`

- [ ] **Step 1: Escrever os testes que falham** — adicionar ao `mod tests` de `src-tauri/src/persistence/mod.rs`:

```rust
    #[test]
    fn round_trip_preserves_mode() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let mut pet = Pet::new("Migo");
        pet.toggle_sleep(); // asleep
        save_snapshot(&conn, &Snapshot { pet, last_seen_unix: 1 }).unwrap();

        let loaded = load_snapshot(&conn).unwrap().expect("snapshot deve existir");
        assert_eq!(loaded.pet.mode, crate::domain::PetMode::Asleep);
    }

    #[test]
    fn legacy_snapshot_without_mode_defaults_awake() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        // JSON no formato da Fatia 1, sem o campo `mode`.
        let legacy = r#"{"name":"Migo","attributes":{"hunger":10.0,"energy":90.0}}"#;
        conn.execute(
            "INSERT INTO pet_snapshot (id, pet_json, last_seen_unix) VALUES (1, ?1, ?2)",
            rusqlite::params![legacy, 1_700_000_000_i64],
        )
        .unwrap();

        let loaded = load_snapshot(&conn).unwrap().expect("snapshot deve existir");
        assert_eq!(loaded.pet.mode, crate::domain::PetMode::Awake);
    }
```

- [ ] **Step 2: Rodar e ver passar** (a implementação já existe — `#[serde(default)]` da Task 1 cobre o legado; estes testes blindam o comportamento)

Run: `cd src-tauri; cargo test --lib persistence::tests`
Expected: PASSA (round-trip + legado + os 2 antigos).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/persistence/mod.rs
git commit -m "test(persistence): cobre modo no round-trip e snapshot legado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: DTO `asleep` + comandos Tauri

**Files:**
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Escrever o teste que falha** — adicionar ao `mod tests` de `src-tauri/src/services/mod.rs`:

```rust
    #[test]
    fn pet_state_reflects_asleep() {
        let mut p = Pet::new("Migo");
        assert!(!PetState::from(&p).asleep);
        p.toggle_sleep();
        assert!(PetState::from(&p).asleep);
    }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd src-tauri; cargo test --lib services::tests::pet_state_reflects_asleep`
Expected: FALHA de compilação (`PetState` não tem `asleep`).

- [ ] **Step 3: Adicionar `asleep` ao DTO** — em `src-tauri/src/services/mod.rs`, atualizar o struct e o `From`:

```rust
#[derive(Serialize, Clone)]
pub struct PetState {
    pub name: String,
    pub hunger: f64,
    pub energy: f64,
    pub asleep: bool,
}

impl From<&Pet> for PetState {
    fn from(p: &Pet) -> Self {
        PetState {
            name: p.name.clone(),
            hunger: p.attributes.hunger,
            energy: p.attributes.energy,
            asleep: p.mode == crate::domain::PetMode::Asleep,
        }
    }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd src-tauri; cargo test --lib services::tests::pet_state_reflects_asleep`
Expected: PASSA.

- [ ] **Step 5: Adicionar os comandos** — em `src-tauri/src/services/mod.rs`, adicionar `use tauri::Emitter;` no topo (junto dos outros `use`) e os comandos após `get_pet_state`:

```rust
#[tauri::command]
pub fn feed_pet(app: tauri::AppHandle, state: tauri::State<AppState>) {
    {
        let mut pet = state.pet.lock().unwrap();
        pet.feed();
    }
    persist(&state, now_unix());
    let snapshot = PetState::from(&*state.pet.lock().unwrap());
    let _ = app.emit("pet-updated", snapshot);
}

#[tauri::command]
pub fn toggle_sleep(app: tauri::AppHandle, state: tauri::State<AppState>) {
    {
        let mut pet = state.pet.lock().unwrap();
        pet.toggle_sleep();
    }
    persist(&state, now_unix());
    let snapshot = PetState::from(&*state.pet.lock().unwrap());
    let _ = app.emit("pet-updated", snapshot);
}
```

- [ ] **Step 6: Registrar no `invoke_handler`** — em `src-tauri/src/lib.rs`, trocar a linha do handler:

```rust
        .invoke_handler(tauri::generate_handler![
            services::get_pet_state,
            services::feed_pet,
            services::toggle_sleep
        ])
```

- [ ] **Step 7: Verificar build completo**

Run: `cd src-tauri; cargo test --lib; cargo build`
Expected: testes PASSAM e `cargo build` compila sem erro (valida assinaturas dos comandos e o `generate_handler`).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/services/mod.rs src-tauri/src/lib.rs
git commit -m "feat(services): comandos feed_pet/toggle_sleep + asleep no PetState

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `asleep` no tipo TS + ajuste do store

**Files:**
- Modify: `src/types.ts`
- Modify: `src/state/petStore.test.ts`

- [ ] **Step 1: Atualizar os testes do store** — em `src/state/petStore.test.ts`, incluir `asleep` nos objetos:

```ts
  it("setPet atualiza o estado", () => {
    usePetStore.getState().setPet({ name: "Migo", hunger: 30, energy: 82, asleep: false });
    expect(usePetStore.getState().pet).toEqual({ name: "Migo", hunger: 30, energy: 82, asleep: false });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/state/petStore.test.ts`
Expected: FALHA de type-check (objeto sem `asleep` não casa com `PetState`) — ou o teste roda mas o tipo está incompleto.

- [ ] **Step 3: Adicionar o campo ao tipo** — em `src/types.ts`:

```ts
export interface PetState {
  name: string;
  hunger: number; // 0 = saciado, 100 = faminto
  energy: number; // 0 = exausto, 100 = descansado
  asleep: boolean; // true = dormindo (modo de sono)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/state/petStore.test.ts`
Expected: PASSA.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/state/petStore.test.ts
git commit -m "feat(types): adiciona asleep ao PetState (TS)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `pickAnimation` decide pelo modo

**Files:**
- Modify: `src/pixi/PetRenderer.ts`
- Modify: `src/pixi/PetRenderer.test.ts`

- [ ] **Step 1: Reescrever os testes** — substituir o conteúdo de `src/pixi/PetRenderer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickAnimation } from "./PetRenderer";

describe("pickAnimation", () => {
  it("dorme quando asleep, independente da energia", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 80, asleep: true })).toBe("sleep");
  });

  it("fica idle quando acordado, mesmo com energia baixa", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 5, asleep: false })).toBe("idle");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/pixi/PetRenderer.test.ts`
Expected: FALHA (animação ainda decidida por energia; o caso `asleep:false, energy:5` retorna `"sleep"`).

- [ ] **Step 3: Atualizar `pickAnimation`** — em `src/pixi/PetRenderer.ts`, remover a const `SLEEP_ENERGY_THRESHOLD` e trocar a função:

```ts
/** Função pura: escolhe a animação a partir do modo. Testável sem PixiJS. */
export function pickAnimation(pet: PetState): "idle" | "sleep" {
  return pet.asleep ? "sleep" : "idle";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/pixi/PetRenderer.test.ts`
Expected: PASSA (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/pixi/PetRenderer.ts src/pixi/PetRenderer.test.ts
git commit -m "feat(pixi): pickAnimation decide pelo modo asleep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Componente `CareBar`

**Files:**
- Create: `src/components/CareBar.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Criar o componente** — `src/components/CareBar.tsx`:

```tsx
import { invoke } from "@tauri-apps/api/core";
import { usePetStore } from "../state/petStore";

// Espelha FEED_MIN_HUNGER do domínio Rust (src-tauri/src/domain/mod.rs).
export const FEED_MIN_HUNGER = 10;

/** Barra de ações sobre o pet. `visible` controla a aparição no hover. */
export function CareBar({ visible }: { visible: boolean }) {
  const pet = usePetStore((s) => s.pet);
  const feedDisabled = pet !== null && pet.hunger < FEED_MIN_HUNGER;
  const asleep = pet?.asleep ?? false;

  return (
    <div className="care-bar" data-testid="care-bar" data-visible={visible}>
      <button
        type="button"
        data-testid="feed-btn"
        title="Alimentar"
        disabled={feedDisabled}
        onClick={() => {
          void invoke("feed_pet");
        }}
      >
        🍖
      </button>
      <button
        type="button"
        data-testid="sleep-btn"
        title={asleep ? "Acordar" : "Dormir"}
        onClick={() => {
          void invoke("toggle_sleep");
        }}
      >
        {asleep ? "☀️" : "💤"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar os estilos** — anexar ao fim de `src/App.css` (oculta via `visibility` para o Playwright tratar como invisível; `opacity` só anima):

```css
.pet-root {
  position: relative;
  width: 220px;
  height: 220px;
}

.care-bar {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.care-bar[data-visible="true"] {
  visibility: visible;
  opacity: 1;
}

.care-bar button {
  font-size: 20px;
  line-height: 1;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.care-bar button:disabled {
  opacity: 0.4;
  cursor: default;
}
```

- [ ] **Step 3: Verificar que compila** (sem teste unitário — coberto pelo Playwright na Task 10)

Run: `pnpm build`
Expected: `tsc` + build sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/CareBar.tsx src/App.css
git commit -m "feat(ui): componente CareBar com botões alimentar/dormir

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Hover na `App` + montagem da barra

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Atualizar a `App`** — em `src/App.tsx`, importar `useState` e `CareBar`, e trocar o `return` por um wrapper com hover. Ajustar a primeira linha de import e o JSX:

Trocar a linha de import do React:

```tsx
import { useEffect, useRef, useState } from "react";
```

Adicionar o import do componente (junto dos outros imports):

```tsx
import { CareBar } from "./components/CareBar";
```

Dentro de `App`, adicionar o estado de hover logo após `const setPet = ...`:

```tsx
  const [hovering, setHovering] = useState(false);
```

Trocar o `return` final:

```tsx
  return (
    <div
      className="pet-root"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div ref={containerRef} />
      <CareBar visible={hovering} />
    </div>
  );
```

- [ ] **Step 2: Verificar que compila**

Run: `pnpm build`
Expected: `tsc` + build sem erros.

- [ ] **Step 3: Rodar a suíte Vitest completa**

Run: `pnpm test`
Expected: PASSA (store + pickAnimation).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): revela a CareBar no hover sobre o pet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: E2E — barra aparece no hover

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Adicionar o teste de hover** — anexar ao fim de `e2e/app.spec.ts`:

```ts
test("a barra de cuidado aparece no hover com os 2 botões", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });

  const bar = page.getByTestId("care-bar");
  await expect(bar).toBeHidden();

  await page.locator(".pet-root").hover();

  await expect(bar).toBeVisible();
  await expect(page.getByTestId("feed-btn")).toBeVisible();
  await expect(page.getByTestId("sleep-btn")).toBeVisible();
});
```

- [ ] **Step 2: Rodar o E2E**

Run: `pnpm e2e`
Expected: PASSA (o teste antigo do canvas + o novo de hover). Nota: roda no Vite dev sem backend Tauri, então `invoke` não responde — o teste só verifica presença/visibilidade, não o efeito do clique.

- [ ] **Step 3: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test(e2e): barra de cuidado aparece no hover

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificação final

- [ ] `cd src-tauri; cargo test --lib` — todos os testes Rust verdes.
- [ ] `cd src-tauri; cargo build` — compila (comandos + handler).
- [ ] `pnpm test` — Vitest verde.
- [ ] `pnpm e2e` — Playwright verde.
- [ ] **Smoke manual (`pnpm tauri dev`):** hover revela a barra; alimentar reduz a fome e o botão desabilita ao saciar (`hunger < 10`); dormir põe na animação `sleep`, energia sobe ao longo do tempo e o botão vira ☀️; fechar/reabrir mantém o modo.
- [ ] Atualizar `docs/ROADMAP.md` (Fatia 2 → ✅ CONCLUÍDA) e criar `docs/superpowers/ACCEPTANCE-slice-2.md` (espelhar o checklist da Fatia 1).
```