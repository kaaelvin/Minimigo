# MiniMigo — Fatia Vertical 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar o pipeline fim-a-fim do MiniMigo — janela Tauri transparente perto da taskbar, pet animado em PixiJS (sprite sheet placeholder), fome+energia que decaem via engine Rust, persistência SQLite e estado que sobrevive a fechar/reabrir (com decay offline limitado).

**Architecture:** Rust é a fonte da verdade (domain puro → simulation → persistence → services com comandos Tauri → shell nativo). A UI (React + Zustand + PixiJS) só renderiza o estado que recebe via comandos/eventos Tauri; nunca calcula decay.

**Tech Stack:** Tauri 2.11, Rust (stable MSVC), `rusqlite`, React + Vite + TypeScript, PixiJS 8, Zustand 5, Vitest 4, Playwright.

---

## Notas de ambiente (Windows / PowerShell)

- Plataforma: Windows 10, shell PowerShell. Use `;` para encadear, não `&&`.
- Rust **não** está instalado — Task 0 resolve isso.
- Gerenciador de pacotes JS: **pnpm** (já disponível, v10).
- Comandos `cargo test` rodam dentro de `src-tauri/`.

## Estrutura de arquivos

```
src-tauri/
├─ Cargo.toml
├─ tauri.conf.json                janela transparente/borderless/always-on-top
├─ build.rs
└─ src/
   ├─ main.rs                      entrypoint, registra plugins/comandos/estado
   ├─ domain/mod.rs                Pet, Attributes, apply_decay (puro)
   ├─ simulation/mod.rs            tick, apply_offline, MAX_OFFLINE_MINUTES
   ├─ persistence/mod.rs           SQLite: init_db, load_snapshot, save_snapshot
   ├─ services/mod.rs              AppState, load_or_create_pet, comandos Tauri
   └─ shell/mod.rs                 posicionamento da janela perto da taskbar

src/
├─ main.tsx                        bootstrap React
├─ App.tsx                         monta canvas + assina pet-updated
├─ state/petStore.ts               Zustand store espelhando o pet
├─ pixi/PetRenderer.ts             carrega sprite sheet, escolhe animação
└─ types.ts                        tipos compartilhados (PetState)

src/state/petStore.test.ts         Vitest
src/pixi/PetRenderer.test.ts       Vitest
e2e/app.spec.ts                    Playwright (leve)
public/pet-placeholder.json        atlas do sprite sheet (placeholder)
public/pet-placeholder.png         sprite sheet (placeholder)
```

---

## Task 0: Pré-requisitos e scaffold

**Files:**
- Create: estrutura completa do projeto (via scaffold)
- Create: `.gitignore` (já existe; conferir entradas de Rust/Node)

- [ ] **Step 1: Instalar Rust via rustup (não-interativo)**

Run (PowerShell):
```powershell
Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile $env:TEMP\rustup-init.exe
& $env:TEMP\rustup-init.exe -y --default-toolchain stable --profile default
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
```
Expected: termina com "Rust is installed now".

- [ ] **Step 2: Verificar toolchain**

Run: `& "$env:USERPROFILE\.cargo\bin\cargo.exe" --version; & "$env:USERPROFILE\.cargo\bin\rustc.exe" --version`
Expected: imprime versões de cargo e rustc (stable). Se `link.exe` faltar ao buildar mais tarde, instalar "Visual Studio Build Tools" com workload "Desktop development with C++".

- [ ] **Step 3: Scaffold do app Tauri 2 + React/TS/Vite**

Run:
```powershell
pnpm create tauri-app@latest . --template react-ts --manager pnpm --yes
```
Se o diretório não estiver vazio, gerar em subpasta temporária e mover o conteúdo para a raiz, preservando `Minimigo SDD.md`, `docs/` e `.git/`.
Expected: cria `src/`, `src-tauri/`, `package.json`, `tauri.conf.json`.

- [ ] **Step 4: Instalar dependências JS**

Run:
```powershell
pnpm add pixi.js@^8 zustand@^5
pnpm add -D vitest@^4 @playwright/test jsdom
pnpm install
```
Expected: instala sem erros; `pnpm` registra as deps em `package.json`.

- [ ] **Step 5: Adicionar dependência SQLite no Rust**

Em `src-tauri/Cargo.toml`, dentro de `[dependencies]`, adicionar:
```toml
rusqlite = { version = "0.32", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```
(`bundled` compila o SQLite junto — não exige DLL externa no Windows.)

- [ ] **Step 6: Build inicial de validação**

Run: `pnpm tauri build --debug` (ou `pnpm tauri dev` e fechar a janela)
Expected: compila e abre a janela padrão do template. Confirma que o toolchain Rust + WebView2 funcionam.

- [ ] **Step 7: Configurar Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```
Adicionar script em `package.json`: `"test": "vitest run"`.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Tauri 2 + React/TS + deps (pixi, zustand, rusqlite)"
```

---

## Task 1: Domain — Pet, Attributes e decay puro

**Files:**
- Create: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/main.rs` (declarar `mod domain;`)

- [ ] **Step 1: Escrever o teste que falha**

Create `src-tauri/src/domain/mod.rs`:
```rust
use serde::{Deserialize, Serialize};

/// hunger: 0.0 = saciado, 100.0 = faminto.
/// energy: 0.0 = exausto, 100.0 = descansado.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Attributes {
    pub hunger: f64,
    pub energy: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pet {
    pub name: String,
    pub attributes: Attributes,
}

pub const HUNGER_RATE_PER_MIN: f64 = 0.5;
pub const ENERGY_RATE_PER_MIN: f64 = 0.3;

impl Attributes {
    pub fn apply_decay(&mut self, _elapsed_minutes: f64) {
        // implementação no próximo passo
    }
}

impl Pet {
    pub fn new(name: impl Into<String>) -> Self {
        Pet {
            name: name.into(),
            attributes: Attributes { hunger: 0.0, energy: 100.0 },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decay_increases_hunger_and_decreases_energy() {
        let mut a = Attributes { hunger: 10.0, energy: 90.0 };
        a.apply_decay(10.0); // 10 minutos
        assert_eq!(a.hunger, 15.0);  // 10 + 0.5*10
        assert_eq!(a.energy, 87.0);  // 90 - 0.3*10
    }

    #[test]
    fn decay_clamps_within_bounds() {
        let mut a = Attributes { hunger: 99.0, energy: 1.0 };
        a.apply_decay(1000.0);
        assert_eq!(a.hunger, 100.0);
        assert_eq!(a.energy, 0.0);
    }
}
```

- [ ] **Step 2: Declarar o módulo e rodar o teste (deve falhar)**

Em `src-tauri/src/main.rs`, adicionar no topo: `mod domain;`
Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::`
Expected: FAIL — `decay_increases_hunger_and_decreases_energy` falha (hunger continua 10.0).

- [ ] **Step 3: Implementar o decay**

Substituir o corpo de `apply_decay`:
```rust
    pub fn apply_decay(&mut self, elapsed_minutes: f64) {
        self.hunger = (self.hunger + HUNGER_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
        self.energy = (self.energy - ENERGY_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
    }
```

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/domain/mod.rs src-tauri/src/main.rs
git commit -m "feat(domain): Pet, Attributes e decay puro com clamp"
```

---

## Task 2: Simulation — tick online e offline com teto

**Files:**
- Create: `src-tauri/src/simulation/mod.rs`
- Modify: `src-tauri/src/main.rs` (`mod simulation;`)

- [ ] **Step 1: Escrever o teste que falha**

Create `src-tauri/src/simulation/mod.rs`:
```rust
use crate::domain::Pet;

/// Teto de punição offline: no máximo 8h de decay são aplicadas de uma vez.
pub const MAX_OFFLINE_MINUTES: f64 = 8.0 * 60.0;

pub fn tick(pet: &mut Pet, elapsed_minutes: f64) {
    let _ = (pet, elapsed_minutes); // implementação no próximo passo
}

pub fn apply_offline(pet: &mut Pet, elapsed_minutes: f64) {
    let _ = (pet, elapsed_minutes); // implementação no próximo passo
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Attributes, Pet};

    fn pet_at(hunger: f64, energy: f64) -> Pet {
        Pet { name: "Migo".into(), attributes: Attributes { hunger, energy } }
    }

    #[test]
    fn tick_applies_full_elapsed() {
        let mut p = pet_at(0.0, 100.0);
        tick(&mut p, 20.0);
        assert_eq!(p.attributes.hunger, 10.0); // 0.5*20
        assert_eq!(p.attributes.energy, 94.0); // 100 - 0.3*20
    }

    #[test]
    fn offline_is_capped_at_max() {
        let mut p = pet_at(0.0, 100.0);
        apply_offline(&mut p, 100_000.0); // muito tempo
        // limitado a 480 min: hunger = 0.5*480 = 240 -> clamp 100
        assert_eq!(p.attributes.hunger, 100.0);
        // energy = 100 - 0.3*480 = -44 -> clamp 0
        assert_eq!(p.attributes.energy, 0.0);
    }

    #[test]
    fn offline_below_cap_is_exact() {
        let mut p = pet_at(0.0, 100.0);
        apply_offline(&mut p, 60.0); // 1h, abaixo do teto
        assert_eq!(p.attributes.hunger, 30.0); // 0.5*60
        assert_eq!(p.attributes.energy, 82.0); // 100 - 0.3*60
    }
}
```

- [ ] **Step 2: Declarar o módulo e rodar (deve falhar)**

Em `main.rs`: `mod simulation;`
Run: `cargo test --manifest-path src-tauri/Cargo.toml simulation::`
Expected: FAIL — `tick_applies_full_elapsed` falha (hunger continua 0.0).

- [ ] **Step 3: Implementar tick e apply_offline**

```rust
pub fn tick(pet: &mut Pet, elapsed_minutes: f64) {
    pet.attributes.apply_decay(elapsed_minutes);
}

pub fn apply_offline(pet: &mut Pet, elapsed_minutes: f64) {
    let capped = elapsed_minutes.min(MAX_OFFLINE_MINUTES);
    pet.attributes.apply_decay(capped);
}
```

- [ ] **Step 4: Rodar (devem passar)**

Run: `cargo test --manifest-path src-tauri/Cargo.toml simulation::`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/simulation/mod.rs src-tauri/src/main.rs
git commit -m "feat(simulation): tick online e apply_offline com teto de 8h"
```

---

## Task 3: Persistence — SQLite round-trip

**Files:**
- Create: `src-tauri/src/persistence/mod.rs`
- Modify: `src-tauri/src/main.rs` (`mod persistence;`)

- [ ] **Step 1: Escrever o teste que falha**

Create `src-tauri/src/persistence/mod.rs`:
```rust
use crate::domain::Pet;
use rusqlite::Connection;

/// Snapshot persistido: o pet (JSON) + o timestamp Unix (segundos) do último save.
pub struct Snapshot {
    pub pet: Pet,
    pub last_seen_unix: i64,
}

pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    let _ = conn; // implementação no próximo passo
    Ok(())
}

pub fn save_snapshot(conn: &Connection, snap: &Snapshot) -> rusqlite::Result<()> {
    let _ = (conn, snap);
    Ok(())
}

pub fn load_snapshot(conn: &Connection) -> rusqlite::Result<Option<Snapshot>> {
    let _ = conn;
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Attributes, Pet};
    use rusqlite::Connection;

    #[test]
    fn save_then_load_round_trip() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let pet = Pet { name: "Migo".into(), attributes: Attributes { hunger: 42.0, energy: 7.0 } };
        let snap = Snapshot { pet: pet.clone(), last_seen_unix: 1_700_000_000 };
        save_snapshot(&conn, &snap).unwrap();

        let loaded = load_snapshot(&conn).unwrap().expect("snapshot deve existir");
        assert_eq!(loaded.pet, pet);
        assert_eq!(loaded.last_seen_unix, 1_700_000_000);
    }

    #[test]
    fn load_returns_none_when_empty() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        assert!(load_snapshot(&conn).unwrap().is_none());
    }
}
```

- [ ] **Step 2: Declarar o módulo e rodar (deve falhar)**

Em `main.rs`: `mod persistence;`
Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::`
Expected: FAIL — `save_then_load_round_trip` falha (load retorna None).

- [ ] **Step 3: Implementar init/save/load**

```rust
pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pet_snapshot (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            pet_json TEXT NOT NULL,
            last_seen_unix INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

pub fn save_snapshot(conn: &Connection, snap: &Snapshot) -> rusqlite::Result<()> {
    let pet_json = serde_json::to_string(&snap.pet)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO pet_snapshot (id, pet_json, last_seen_unix) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET pet_json = ?1, last_seen_unix = ?2",
        rusqlite::params![pet_json, snap.last_seen_unix],
    )?;
    Ok(())
}

pub fn load_snapshot(conn: &Connection) -> rusqlite::Result<Option<Snapshot>> {
    let mut stmt = conn.prepare("SELECT pet_json, last_seen_unix FROM pet_snapshot WHERE id = 1")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let pet_json: String = row.get(0)?;
        let last_seen_unix: i64 = row.get(1)?;
        let pet: Pet = serde_json::from_str(&pet_json)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e)))?;
        Ok(Some(Snapshot { pet, last_seen_unix }))
    } else {
        Ok(None)
    }
}
```

- [ ] **Step 4: Rodar (devem passar)**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/persistence/mod.rs src-tauri/src/main.rs
git commit -m "feat(persistence): SQLite snapshot upsert + round-trip"
```

---

## Task 4: Services — load_or_create, comandos Tauri e tick loop

**Files:**
- Create: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/main.rs` (`mod services;`, registro de estado/comandos)

- [ ] **Step 1: Escrever o teste que falha (lógica de boot pura)**

Create `src-tauri/src/services/mod.rs`:
```rust
use crate::domain::Pet;
use crate::persistence::{self, Snapshot};
use crate::simulation;
use rusqlite::Connection;
use std::sync::Mutex;

/// Estado compartilhado gerenciado pelo Tauri.
pub struct AppState {
    pub conn: Mutex<Connection>,
    pub pet: Mutex<Pet>,
}

/// Carrega o pet do banco aplicando decay offline; cria um novo se não houver snapshot
/// ou se o snapshot estiver corrompido. `now_unix` é injetado para testabilidade.
pub fn load_or_create_pet(conn: &Connection, now_unix: i64) -> Pet {
    match persistence::load_snapshot(conn) {
        Ok(Some(snap)) => {
            let mut pet = snap.pet;
            let elapsed_min = ((now_unix - snap.last_seen_unix).max(0) as f64) / 60.0;
            simulation::apply_offline(&mut pet, elapsed_min);
            pet
        }
        _ => Pet::new("Migo"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Attributes, Pet};
    use crate::persistence::{init_db, save_snapshot, Snapshot};
    use rusqlite::Connection;

    #[test]
    fn creates_new_pet_when_db_empty() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let pet = load_or_create_pet(&conn, 1_700_000_000);
        assert_eq!(pet.name, "Migo");
        assert_eq!(pet.attributes.energy, 100.0);
    }

    #[test]
    fn applies_offline_decay_on_load() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let pet = Pet { name: "Migo".into(), attributes: Attributes { hunger: 0.0, energy: 100.0 } };
        save_snapshot(&conn, &Snapshot { pet, last_seen_unix: 1_700_000_000 }).unwrap();

        // 60 minutos depois
        let loaded = load_or_create_pet(&conn, 1_700_000_000 + 3600);
        assert_eq!(loaded.attributes.hunger, 30.0); // 0.5*60
        assert_eq!(loaded.attributes.energy, 82.0); // 100 - 0.3*60
    }
}
```

- [ ] **Step 2: Declarar o módulo e rodar (deve passar — lógica já implementada)**

Em `main.rs`: `mod services;`
Run: `cargo test --manifest-path src-tauri/Cargo.toml services::`
Expected: PASS (2 testes). (Aqui a lógica pura já está completa; os comandos Tauri vêm a seguir e são validados manualmente/E2E.)

- [ ] **Step 3: Adicionar comandos Tauri e helper de tempo**

Acrescentar em `services/mod.rs`:
```rust
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_unix() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

#[derive(Serialize, Clone)]
pub struct PetState {
    pub name: String,
    pub hunger: f64,
    pub energy: f64,
}

impl From<&Pet> for PetState {
    fn from(p: &Pet) -> Self {
        PetState { name: p.name.clone(), hunger: p.attributes.hunger, energy: p.attributes.energy }
    }
}

#[tauri::command]
pub fn get_pet_state(state: tauri::State<AppState>) -> PetState {
    let pet = state.pet.lock().unwrap();
    PetState::from(&*pet)
}

/// Persiste o pet atual com o timestamp informado.
pub fn persist(state: &AppState, now: i64) {
    let pet = state.pet.lock().unwrap();
    let conn = state.conn.lock().unwrap();
    let _ = persistence::save_snapshot(&conn, &Snapshot { pet: pet.clone(), last_seen_unix: now });
}
```

- [ ] **Step 4: Conectar tudo no main.rs (setup, tick loop, persist no fechamento)**

Substituir o corpo de `main()` em `src-tauri/src/main.rs` por:
```rust
mod domain;
mod simulation;
mod persistence;
mod services;
mod shell;

use services::{AppState, get_pet_state, load_or_create_pet, now_unix, persist, PetState};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Banco em app_data_dir/minimigo.db
            let dir = app.path().app_data_dir().expect("app_data_dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("minimigo.db");
            let conn = rusqlite::Connection::open(&db_path)
                .or_else(|_| rusqlite::Connection::open_in_memory())
                .expect("abrir conexão SQLite");
            persistence::init_db(&conn).expect("init_db");

            let pet = load_or_create_pet(&conn, now_unix());
            app.manage(AppState { conn: Mutex::new(conn), pet: Mutex::new(pet) });

            shell::position_near_taskbar(app.get_webview_window("main").as_ref());

            // Tick loop: a cada 5s aplica decay e emite evento; persiste a cada ~30s.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_persist = now_unix();
                loop {
                    std::thread::sleep(Duration::from_secs(5));
                    let state = handle.state::<AppState>();
                    {
                        let mut pet = state.pet.lock().unwrap();
                        simulation::tick(&mut pet, 5.0 / 60.0); // 5s em minutos
                        let snapshot = PetState::from(&*pet);
                        let _ = handle.emit("pet-updated", snapshot);
                    }
                    let now = now_unix();
                    if now - last_persist >= 30 {
                        persist(&state, now);
                        last_persist = now;
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>();
                persist(&state, now_unix());
            }
        })
        .invoke_handler(tauri::generate_handler![get_pet_state])
        .run(tauri::generate_context!())
        .expect("erro ao rodar o app");
}
```

- [ ] **Step 5: Compilar**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: compila sem erros. (Se faltar a feature `Emitter`/`Manager`, confirmar Tauri 2 no `Cargo.toml`.)

- [ ] **Step 6: Commit**

```powershell
git add src-tauri/src/services/mod.rs src-tauri/src/main.rs
git commit -m "feat(services): AppState, comandos Tauri, tick loop e persistência no boot/close"
```

---

## Task 5: Shell — janela transparente perto da taskbar

**Files:**
- Create: `src-tauri/src/shell/mod.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Configurar a janela em tauri.conf.json**

No objeto da janela `main` dentro de `app.windows[0]` (ou `tauri.windows`), garantir:
```json
{
  "label": "main",
  "width": 220,
  "height": 220,
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "resizable": false,
  "shadow": false
}
```
E em `app.macOSPrivateApi` não aplicável; para Windows transparente já basta `transparent: true`. Garantir no CSS (`src/index.css` ou `App.css`): `html, body { background: transparent; margin: 0; overflow: hidden; }`.

- [ ] **Step 2: Implementar posicionamento perto da taskbar**

Create `src-tauri/src/shell/mod.rs`:
```rust
use tauri::WebviewWindow;

/// Posiciona a janela no canto inferior direito, logo acima da taskbar.
/// Em falha de leitura do monitor, não move (mantém a posição padrão).
pub fn position_near_taskbar(window: Option<&WebviewWindow>) {
    let Some(window) = window else { return };
    let Ok(Some(monitor)) = window.current_monitor() else { return };
    let screen = monitor.size();
    let scale = monitor.scale_factor();
    let win = window.outer_size().unwrap_or(tauri::PhysicalSize { width: 220, height: 220 });

    // margem ~48px (altura típica da taskbar) + folga
    let margin = (56.0 * scale) as u32;
    let x = screen.width.saturating_sub(win.width).saturating_sub((8.0 * scale) as u32);
    let y = screen.height.saturating_sub(win.height).saturating_sub(margin);

    let _ = window.set_position(tauri::PhysicalPosition { x: x as i32, y: y as i32 });
}
```

- [ ] **Step 3: Compilar e rodar**

Run: `pnpm tauri dev`
Expected: janela sem borda, fundo transparente, no canto inferior direito acima da taskbar, sem ícone na taskbar.

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/shell/mod.rs src-tauri/tauri.conf.json src/index.css
git commit -m "feat(shell): janela transparente, borderless, always-on-top perto da taskbar"
```

---

## Task 6: Frontend state — Zustand store

**Files:**
- Create: `src/types.ts`
- Create: `src/state/petStore.ts`
- Create: `src/state/petStore.test.ts`

- [ ] **Step 1: Definir tipo compartilhado**

Create `src/types.ts`:
```ts
export interface PetState {
  name: string;
  hunger: number; // 0 = saciado, 100 = faminto
  energy: number; // 0 = exausto, 100 = descansado
}
```

- [ ] **Step 2: Escrever o teste que falha**

Create `src/state/petStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { usePetStore } from "./petStore";

describe("petStore", () => {
  beforeEach(() => {
    usePetStore.setState({ pet: null });
  });

  it("começa sem pet", () => {
    expect(usePetStore.getState().pet).toBeNull();
  });

  it("setPet atualiza o estado", () => {
    usePetStore.getState().setPet({ name: "Migo", hunger: 30, energy: 82 });
    expect(usePetStore.getState().pet).toEqual({ name: "Migo", hunger: 30, energy: 82 });
  });
});
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `pnpm test src/state/petStore.test.ts`
Expected: FAIL — módulo `./petStore` não existe.

- [ ] **Step 4: Implementar o store**

Create `src/state/petStore.ts`:
```ts
import { create } from "zustand";
import type { PetState } from "../types";

interface PetStore {
  pet: PetState | null;
  setPet: (pet: PetState) => void;
}

export const usePetStore = create<PetStore>((set) => ({
  pet: null,
  setPet: (pet) => set({ pet }),
}));
```

- [ ] **Step 5: Rodar (devem passar)**

Run: `pnpm test src/state/petStore.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```powershell
git add src/types.ts src/state/petStore.ts src/state/petStore.test.ts
git commit -m "feat(state): Zustand petStore espelhando o estado do Rust"
```

---

## Task 7: PixiJS PetRenderer — sprite sheet e seleção de animação

**Files:**
- Create: `public/pet-placeholder.png`, `public/pet-placeholder.json` (atlas placeholder)
- Create: `src/pixi/PetRenderer.ts`
- Create: `src/pixi/PetRenderer.test.ts`

- [ ] **Step 1: Adicionar sprite sheet placeholder**

Baixar um sprite sheet livre simples (ex: do Kenney.nl, licença CC0) com 2 animações (`idle`, `sleep`) e exportar atlas no formato PixiJS:
```json
{
  "frames": {
    "idle_0": { "frame": { "x": 0, "y": 0, "w": 64, "h": 64 } },
    "idle_1": { "frame": { "x": 64, "y": 0, "w": 64, "h": 64 } },
    "sleep_0": { "frame": { "x": 0, "y": 64, "w": 64, "h": 64 } }
  },
  "meta": { "image": "pet-placeholder.png", "size": { "w": 128, "h": 128 }, "scale": "1" },
  "animations": { "idle": ["idle_0", "idle_1"], "sleep": ["sleep_0"] }
}
```
Se não houver arte à mão, gerar um PNG 128×128 com 3 quadrantes coloridos como placeholder programático e usar o atlas acima.

- [ ] **Step 2: Escrever o teste que falha (seleção de animação pura)**

Create `src/pixi/PetRenderer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickAnimation } from "./PetRenderer";

describe("pickAnimation", () => {
  it("dorme quando a energia está muito baixa", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 5 })).toBe("sleep");
  });

  it("fica idle quando descansado", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 80 })).toBe("idle");
  });
});
```

- [ ] **Step 3: Rodar o teste (deve falhar)**

Run: `pnpm test src/pixi/PetRenderer.test.ts`
Expected: FAIL — `pickAnimation` não existe.

- [ ] **Step 4: Implementar PetRenderer + pickAnimation**

Create `src/pixi/PetRenderer.ts`:
```ts
import { Application, Assets, AnimatedSprite, Texture, Sprite } from "pixi.js";
import type { PetState } from "../types";

export const SLEEP_ENERGY_THRESHOLD = 15;

/** Função pura: escolhe a animação a partir do estado. Testável sem PixiJS. */
export function pickAnimation(pet: PetState): "idle" | "sleep" {
  return pet.energy <= SLEEP_ENERGY_THRESHOLD ? "sleep" : "idle";
}

export class PetRenderer {
  private app: Application;
  private sprite?: AnimatedSprite;
  private current?: "idle" | "sleep";
  private sheet?: Awaited<ReturnType<typeof Assets.load>>;

  constructor(app: Application) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      this.sheet = await Assets.load("/pet-placeholder.json");
      this.setAnimation("idle");
    } catch (err) {
      console.error("falha ao carregar sprite sheet, usando placeholder", err);
      const fallback = new Sprite(Texture.WHITE);
      fallback.width = 64;
      fallback.height = 64;
      this.app.stage.addChild(fallback);
    }
  }

  private setAnimation(name: "idle" | "sleep") {
    if (!this.sheet || this.current === name) return;
    if (this.sprite) this.app.stage.removeChild(this.sprite);
    this.sprite = new AnimatedSprite(this.sheet.animations[name]);
    this.sprite.animationSpeed = 0.1;
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    this.sprite.play();
    this.app.stage.addChild(this.sprite);
    this.current = name;
  }

  /** Atualiza a animação conforme o estado do pet. */
  render(pet: PetState) {
    this.setAnimation(pickAnimation(pet));
  }
}
```

- [ ] **Step 5: Rodar (devem passar)**

Run: `pnpm test src/pixi/PetRenderer.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```powershell
git add public/pet-placeholder.json public/pet-placeholder.png src/pixi/PetRenderer.ts src/pixi/PetRenderer.test.ts
git commit -m "feat(pixi): PetRenderer com sprite sheet placeholder e pickAnimation"
```

---

## Task 8: App bootstrap — invoke + listen

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx` (se necessário)

- [ ] **Step 1: Implementar App.tsx**

Substituir `src/App.tsx` por:
```tsx
import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePetStore } from "./state/petStore";
import { PetRenderer } from "./pixi/PetRenderer";
import type { PetState } from "./types";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setPet = usePetStore((s) => s.setPet);
  const pet = usePetStore((s) => s.pet);

  useEffect(() => {
    let renderer: PetRenderer | undefined;
    let unlisten: (() => void) | undefined;
    const app = new Application();

    (async () => {
      await app.init({ width: 220, height: 220, backgroundAlpha: 0 });
      containerRef.current?.appendChild(app.canvas);
      renderer = new PetRenderer(app);
      await renderer.load();

      // estado inicial
      try {
        const initial = await invoke<PetState>("get_pet_state");
        setPet(initial);
      } catch (e) {
        console.error("falha no get_pet_state", e);
      }

      // updates do tick
      unlisten = await listen<PetState>("pet-updated", (e) => setPet(e.payload));
    })();

    return () => {
      unlisten?.();
      app.destroy(true);
    };
  }, [setPet]);

  useEffect(() => {
    if (pet) {
      // re-render do pet quando o estado muda
      // (o PetRenderer é re-acionado via ref dentro do efeito acima em apps maiores;
      //  aqui mantemos simples lendo do store)
    }
  }, [pet]);

  return <div ref={containerRef} />;
}
```

- [ ] **Step 2: Garantir que o store aciona o renderer**

Ajustar o efeito principal para guardar o renderer numa ref e chamar `renderer.render(pet)` ao receber updates. Versão final do efeito de listen:
```tsx
      unlisten = await listen<PetState>("pet-updated", (e) => {
        setPet(e.payload);
        renderer?.render(e.payload);
      });
```
E após `setPet(initial)`: `renderer?.render(initial);`

- [ ] **Step 3: Rodar o app**

Run: `pnpm tauri dev`
Expected: janela transparente mostra o pet animado (idle). Ao deixar rodando, fome sobe e energia cai (visível via console ou um overlay temporário de debug).

- [ ] **Step 4: (Opcional) overlay de debug temporário**

Adicionar texto pequeno mostrando `hunger/energy` para validar o decay a olho nu; remover antes de fechar a fatia. (Marcar como TODO removível no commit.)

- [ ] **Step 5: Commit**

```powershell
git add src/App.tsx
git commit -m "feat(app): bootstrap PixiJS, invoke get_pet_state e listen pet-updated"
```

---

## Task 9: E2E leve + verificação de aceite

**Files:**
- Create: `e2e/app.spec.ts`
- Modify: `package.json` (script e2e, se aplicável)

- [ ] **Step 1: Configurar Playwright**

Run: `pnpm exec playwright install chromium`
Create `playwright.config.ts` apontando para o dev server do Vite (`http://localhost:1420`, porta padrão do template Tauri). Nota: E2E completo do binário Tauri exige WebDriver (`tauri-driver`); nesta fatia validamos a camada web servida pelo Vite.

- [ ] **Step 2: Escrever o teste E2E leve**

Create `e2e/app.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("o app monta o canvas do pet", async ({ page }) => {
  await page.goto("http://localhost:1420");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
});
```
(No ambiente web puro, `invoke` falha silenciosamente — o teste valida apenas que o canvas/PixiJS monta. A validação do estado real é feita no `pnpm tauri dev`.)

- [ ] **Step 3: Rodar E2E**

Run (em dois terminais ou via `webServer` no config): `pnpm dev` e depois `pnpm exec playwright test`
Expected: PASS — canvas visível.

- [ ] **Step 4: Verificação manual dos critérios de aceite**

Run: `pnpm tauri dev` e confirmar:
- [ ] Janela transparente/sem borda perto da taskbar, sem ícone na taskbar.
- [ ] Pet aparece e anima (idle).
- [ ] Fome sobe e energia cai com o tempo.
- [ ] Fechar e reabrir preserva o estado; tempo fechado aplica decay offline (testar fechando ~2min e reabrindo, ou ajustando rates temporariamente para acelerar).

- [ ] **Step 5: Rodar toda a suíte**

Run: `cargo test --manifest-path src-tauri/Cargo.toml; pnpm test; pnpm exec playwright test`
Expected: todos os testes Rust + Vitest + Playwright passam.

- [ ] **Step 6: Commit**

```powershell
git add e2e/app.spec.ts playwright.config.ts package.json
git commit -m "test(e2e): canvas do pet monta + verificação de aceite da fatia 1"
```

---

## Critérios de conclusão da fatia

- App abre janela transparente/sem borda perto da taskbar.
- Pet animado (sprite sheet placeholder) com loop idle e troca para sleep em energia baixa.
- Fome e energia decaem com o tempo (tick de 5s).
- Estado persiste em SQLite e sobrevive a fechar/reabrir, com decay offline limitado a 8h.
- Testes de domain (decay/clamp), simulation (teto offline), persistence (round-trip) e
  services (boot/offline) passam; Vitest (store + pickAnimation) e Playwright (canvas) passam.
