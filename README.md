# MiniMigo

MiniMigo is a desktop Tamagotchi-style virtual pet that lives near the Windows
taskbar. This repository contains **Vertical Slice 1**: a transparent always-on
window rendering an animated pet whose needs are simulated and persisted across
sessions.

## Stack

- **Tauri 2** + **Rust** (native shell, window placement, simulation tick loop)
- **React** + **Vite** + **TypeScript** (UI)
- **PixiJS** (pet rendering)
- **SQLite** (persistence, via `rusqlite`)
- **Zustand** (front-end state)

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) toolchain
- Visual Studio Build Tools with the **MSVC** C++ workload (required to build the
  Tauri/Rust side on Windows)
- [pnpm](https://pnpm.io/)

## Running

```sh
pnpm install
pnpm tauri dev
```

## Tests

```sh
pnpm test                                        # unit tests (Vitest)
pnpm exec playwright test                        # end-to-end tests (Playwright)
cargo test --manifest-path src-tauri/Cargo.toml  # Rust tests
```

## Acceptance

Manual acceptance checklist for this slice lives at
[`docs/superpowers/ACCEPTANCE-slice-1.md`](docs/superpowers/ACCEPTANCE-slice-1.md).
