# MiniMigo Taskbar — Design: Fatia Vertical 1

**Data:** 2026-06-16
**Status:** Aprovado (design); aguardando revisão do spec
**Fonte:** `Minimigo SDD.md` (resumo executivo do SDD)

## Contexto

O MiniMigo Taskbar é um pet virtual de desktop estilo Tamagochi que vive próximo à
barra de tarefas do Windows. O MVP completo tem 10 entregáveis. Por ser grande demais
para um único plano executável, o projeto será construído em **fatias verticais**: cada
fatia entrega valor fim-a-fim e tem seu próprio ciclo spec → plano → implementação.

Este documento cobre **apenas a Fatia Vertical 1**.

## Decisões desta fatia

- **Abordagem:** fatia vertical (não scaffold-só, nem MVP inteiro de uma vez).
- **Arte do pet:** sprite sheet placeholder (genérico/temporário) para validar o
  pipeline de animação do PixiJS desde já. Será trocado por arte real depois.
- **Rust toolchain:** não instalado nesta máquina. O agente instala via `rustup`
  (stable, MSVC) como primeiro passo. WebView2 normalmente já presente no Windows 10;
  Visual Studio Build Tools (C++) pode ser necessário para linkar.
- **Não é git repo ainda:** inicializar git faz parte do scaffold.

## Objetivo da fatia

Provar o pipeline fim-a-fim:

1. Janela Tauri transparente, sem borda, always-on-top, posicionada perto da taskbar.
2. Pet animado (sprite sheet placeholder) renderizado em PixiJS, com loop idle.
3. Dois atributos — **fome** e **energia** — que decaem com o tempo.
4. Simulation engine em Rust (decay online + cálculo offline com teto de punição).
5. Persistência em SQLite; estado sobrevive a fechar/reabrir o app.

### Fora de escopo desta fatia (fatias futuras)

System tray, onboarding/escolha de pet, evolução (ovo→adulto), mood engine completo,
as 6 ações de cuidado, as 8 animações, tela de configurações, demais atributos
(felicidade, higiene, afeto, saúde).

## Arquitetura

Camadas do SDD, reduzidas ao necessário para a fatia.

```
Rust (src-tauri/)
├─ domain/         Pet, Attributes (fome, energia) — regras puras, sem I/O
├─ simulation/     tick(): decay por tempo decorrido; online + offline
├─ services/       orquestra: load → simulate(now) → save; expõe comandos Tauri
├─ persistence/    SQLite — load/save snapshot do pet + last_seen_ts
└─ shell/          janela transparente, sem borda, always-on-top, posição taskbar

Frontend (src/)
├─ pixi/           PetRenderer: carrega sprite sheet, loop idle, troca animação
├─ state/          Zustand: espelha estado vindo do Rust
└─ app/            bootstrap React, invoke() dos comandos, listen do tick
```

**Princípio:** a UI não calcula decay. O Rust é a fonte da verdade; a UI só renderiza
o estado recebido via comandos/eventos Tauri.

### Unidades e responsabilidades

- **domain** — define `Pet` e `Attributes`. Funções puras, testáveis isoladamente, sem
  dependência de tempo real ou I/O (recebe `elapsed` como parâmetro).
- **simulation** — aplica decay dado um intervalo decorrido. Mesma função para online
  (intervalos curtos) e offline (um intervalo grande, limitado pelo teto).
- **services** — orquestra load/simulate/save e registra os comandos Tauri.
- **persistence** — SQLite via `rusqlite` (ou `sqlx`); load/save de snapshot.
- **shell** — configuração da janela nativa (Tauri config + ajustes de posição).
- **pixi** — `PetRenderer` encapsula PixiJS; recebe estado, escolhe animação.
- **state** — store Zustand espelhando o estado do Rust.

## Fluxo de dados

**Boot:** `services::load_or_create_pet()` lê snapshot do SQLite (ou cria pet novo) →
calcula `elapsed = now - last_seen_ts` → `simulation::apply_offline(elapsed)` → salva →
devolve estado à UI via `get_pet_state` → Zustand atualiza → PixiJS renderiza.

**Em execução:** tick periódico no Rust (intervalo ~1–5s) aplica decay online; persiste
em intervalo maior (~30s) para não martelar o disco; emite evento `pet-updated` que a UI
escuta.

**Shutdown:** grava snapshot + `last_seen_ts = now`.

### Comandos / eventos Tauri (fatia 1)

- `get_pet_state` (comando) → snapshot atual do pet.
- `pet-updated` (evento) → emitido pelo Rust a cada tick com o estado novo.

## Simulação online vs offline

- **Decay** = taxa por minuto por atributo (fome sobe, energia cai). Uma única função
  pura serve online e offline.
- **Limite de punição:** offline aplica decay sobre `min(elapsed, MAX_OFFLINE)` (ex.:
  `MAX_OFFLINE = 8h`). O pet pode ficar com fome, mas **nunca morre** (decisão do SDD);
  os atributos têm pisos/tetos seguros.

## Tratamento de erros

- **DB ausente/corrompido:** loga e cria pet novo em vez de travar; faz backup do
  arquivo antigo antes de sobrescrever.
- **Comando Tauri falha:** UI mantém o último estado conhecido / estado "carregando" em
  vez de tela branca.
- **Sprite sheet não carrega:** PixiJS cai num placeholder (retângulo) e loga, sem
  quebrar a janela.

## Testes

- **Rust (unit):** decay determinístico (X minutos → Y de fome); teto offline; round-trip
  load/save no SQLite (arquivo temporário).
- **Frontend (Vitest):** store Zustand reflete o estado recebido; `PetRenderer` escolhe a
  animação correta para o estado.
- **E2E (Playwright), leve:** app abre, janela existe, pet aparece. E2E mais completo
  virá com a fatia de onboarding.

## Pré-requisitos / setup

1. Instalar Rust via `rustup` (stable, MSVC).
2. Verificar WebView2 (geralmente presente no Win10) e Build Tools C++ se o link falhar.
3. Inicializar repositório git.
4. Scaffold Tauri 2 + React + Vite + TypeScript; adicionar PixiJS, Zustand, SQLite,
   Vitest, Playwright.

## Critérios de aceite da fatia

- App abre uma janela transparente/sem borda perto da taskbar.
- Pet aparece e anima (loop idle) a partir do sprite sheet placeholder.
- Fome e energia decaem visivelmente ao longo do tempo (com tick).
- Fechar e reabrir o app preserva o estado; tempo fechado é aplicado como decay offline
  limitado pelo teto.
- Testes de decay, teto offline e round-trip de persistência passam.
