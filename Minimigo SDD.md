# MiniMigo Taskbar — Resumo Executivo do SDD

O MiniMigo Taskbar é um jogo/companheiro virtual de desktop onde um pet vive próximo à barra de tarefas do Windows, acompanhando o usuário durante o dia. A proposta combina a presença discreta de um app de taskbar com mecânicas de Tamagochi, evolução inspirada em jogos de criaturas, gerenciamento leve e vínculo emocional.

A experiência central não é grind nem RPG idle, mas convivência. O pet sente fome, sono, alegria, tédio, sujeira, afeto e saúde. Ele reage ao tempo, às interações do usuário e, opcionalmente, à conclusão de pequenas tarefas. O jogador pode alimentar, brincar, limpar, fazer carinho, colocar para dormir, medicar e treinar o pet. Com o tempo, o estilo de cuidado influencia personalidade, humor e evolução.

A stack recomendada é:

* Tauri 2 para o app desktop.
* Rust para backend local, controle nativo e simulação.
* React + Vite + TypeScript para UI.
* PixiJS para renderização 2D do pet.
* SQLite para persistência local.
* Zustand para estado visual.
* Vitest, Playwright e testes Rust para qualidade.

A arquitetura deve ser modular:

* Domain Core: regras puras do pet.
* Simulation Engine: tick online/offline, decay e eventos.
* Application Services: ações de cuidado e orquestração.
* Persistence Adapter: SQLite e backups.
* Native Shell Adapter: janela transparente, tray, autostart e posição.
* Renderer/UI: PixiJS e React.

O MVP deve entregar:

1. App Windows com janela transparente, sem borda e posicionada próxima à taskbar.
2. Pet animado com pelo menos 8 animações.
3. System tray com ações rápidas.
4. Atributos básicos: fome, energia, felicidade, higiene, afeto e saúde.
5. Ações: alimentar, brincar, limpar, carinho, dormir e medicar.
6. Simulação online e offline com limite de punição.
7. Persistência local em SQLite.
8. Onboarding com escolha/nome do pet.
9. Configurações de escala, posição, FPS e modo discreto.
10. Evolução inicial com estágios: ovo, bebê, jovem e adulto.

Decisões importantes:

* O pet não deve morrer no MVP; ele pode hibernar ou ficar triste, mas sempre será recuperável.
* O app deve ser local-first e sem coleta invasiva.
* Não deve existir marketplace de itens vendáveis.
* O app não deve tentar modificar a taskbar real do Windows.
* O pet deve ser fofo, leve e não atrapalhar o uso normal do computador.
* O foco é companhia, cuidado e vínculo emocional.

Prompt master para uma IA/agente de desenvolvimento:

“Você é um agente sênior responsável por construir um app desktop chamado MiniMigo Taskbar, um pet virtual estilo Tamagochi que vive próximo à barra de tarefas do Windows. Use Tauri 2, Rust, React, Vite, TypeScript, PixiJS, SQLite e Zustand. Implemente o MVP com janela transparente, system tray, onboarding, persistência local, simulation engine, ações de cuidado, mood engine, animações e configurações básicas. Mantenha domínio separado da UI, escreva testes para decay, humor e ações, evite coleta de dados pessoais e mantenha baixo consumo de recursos.”

---

## Execução — Roadmap de Fatias

Este SDD descreve a visão e o MVP. A **execução** acontece em **fatias verticais**
(cada uma com ciclo spec → plano → implementação), rastreadas de forma estrutural em:

**→ [`docs/ROADMAP.md`](docs/ROADMAP.md)** — mapa MVP → fatias, status, convenções
técnicas do projeto e ponteiros para specs/planos/aceites.

Estado atual (resumo; ver o roadmap para detalhes):

- **Fatia 1 — Pipeline fim-a-fim:** ✅ concluída (janela transparente, pet animado
  placeholder, fome+energia com decay online/offline, persistência SQLite).
- **Fatia 2 — Ações de cuidado (alimentar + dormir):** 🔵 em design, pausada — ver
  `docs/superpowers/specs/2026-06-16-minimigo-vertical-slice-2-care-actions-design.md`.
