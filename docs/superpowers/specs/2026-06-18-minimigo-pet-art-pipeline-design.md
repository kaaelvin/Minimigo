# MiniMigo — Design: Pipeline de Arte de Pet (primeiro pet real: aqua)

**Data:** 2026-06-18
**Status:** ✅ DESIGN CONCLUÍDO — pronto para `superpowers:writing-plans`
**Fonte:** `Minimigo SDD.md`, `docs/ROADMAP.md`
**Depende de:** Fatia 1 (pipeline) e Fatia 2 (ações de cuidado), ambas concluídas.

## Objetivo da fatia

Substituir o sprite sheet placeholder por **um pet real (`aqua`)** com animações geradas
a partir da arte criada pelo usuário, provando um **pipeline de assets** reutilizável para
os outros 11 pets depois. Anima `idle`, `sleep` e uma transitória de `eat` (comer)
disparada ao alimentar.

### Fora de escopo (fatias futuras)
- Os outros 11 pets (aqua2, pyro, pyro2, tera, tera2, Ventus, ventus2, Lucy, buu, dragun, gaspar).
- Seleção/troca de pet e onboarding.
- Os 5 estados restantes do sheet (triste, bravo, chorando, andando) e a arte "hero" (retrato).

## Contexto da arte (analisado)

- Cada pet em `src/assets/<pet>/` tem **2 PNGs 1254×1254**: um **sprite sheet** (grade
  **4 colunas × 8 linhas = 32 frames**, 8 estados × 4 quadros) e um **retrato hero** único.
- Estados por linha (0-indexado), confirmado em aqua/pyro: `0` idle, `1` triste, `2`
  dormindo, `3` feliz, `4` bravo, `5` chorando, `6` comendo, `7` andando.
- A grade 4×8 está **bem alinhada** (personagens ~centralizados nas células), com leve
  jitter de posição/tamanho por frame (típico de IA) — resolvido pelo trim+recentralização.
- Engine atual: `PetRenderer` (`src/pixi/PetRenderer.ts`) carrega `/pet-placeholder.json`
  (atlas Pixi) e usa `sheet.animations[nome]`; `pickAnimation(pet)` decide `idle`/`sleep`
  pelo modo (`pet.asleep`).

## Decisões já tomadas (confirmadas com o usuário)

1. **Escopo:** um pet real primeiro (`aqua`); seleção/onboarding fica para fatia futura.
2. **Animações desta fatia:** `idle` + `sleep` + `eat` (comer, transitória ao alimentar).
3. **Atlas pré-processado** (não retângulos sobre o sheet inteiro): script de build com
   auto-trim e recentralização → atlas compacto.
4. **Lib de imagem:** `jimp` (devDependency; JS puro, sem binário nativo).
5. **Saída em `public/pets/<pet>.{png,json}`** (servido pelo Vite como o placeholder hoje).
6. **Enquadramento:** trim por alpha, célula uniforme, conteúdo **centralizado na
   horizontal e alinhado pela base** (evita "pulo" vertical entre frames).
7. **Comer = play-once → reverte**, com trava de transição durante a animação.

## Seção 1 — Pipeline de assets (script de build)

- **Script único parametrizável:** `scripts/build-pet-atlas.mjs`, exposto como
  `pnpm assets:pets` (script `"assets:pets": "node scripts/build-pet-atlas.mjs"` no
  `package.json`).
- **Entrada:** lê o sheet bruto de `src/assets/<pet>/`. **Saída:** `public/pets/<pet>.png`
  + `public/pets/<pet>.json`.
- **Manifest** (mapa pet → config), no topo do script ou em `scripts/pet-atlas.manifest.json`.
  Nesta fatia só `aqua`:
  ```
  aqua → { sheet: "ChatGPT Image 17 de jun. de 2026, 09_29_32 (1).png",
           cols: 4, rows: 8, use: { idle: 0, sleep: 2, eat: 6 } }
  ```
  (linhas 0/2/6 = idle/dormindo/comendo, 4 frames cada → 12 frames).
- **Reprodutibilidade:** versionar script + manifest + **sheet bruto do aqua** + atlas
  gerado. Os outros 11 sheets brutos seguem não rastreados até suas fatias.

## Seção 2 — Fatiamento, trim/recentralização e formato do atlas

Por frame (12 no total):
1. **Recortar a célula** do grid com retângulos inteiros por índice
   (`x = round(col*W/cols)`, `w = round((col+1)*W/cols) - x`; idem vertical) — cobre o
   sheet sem sobra nem buraco.
2. **Auto-trim por alpha:** bounding box dos pixels com alpha > 0 (com um pequeno limiar,
   ex.: alpha > 8 para ignorar anti-aliasing fantasma), recortar nela.

Empacotamento e enquadramento:
- **Célula uniforme** = (maior largura de bbox, maior altura de bbox entre os 12) + margem
  (ex.: 4px de cada lado).
- Colar cada frame trimado na célula uniforme **centralizado na horizontal** e **alinhado
  pela base** (base do conteúdo no mesmo y, com a margem inferior).
- Empacotar os 12 numa grade fixa (4 col × 3 linhas) → `public/pets/aqua.png`.

Formato do atlas (spritesheet do Pixi), `public/pets/aqua.json`:
- `frames`: `aqua_idle_0..3`, `aqua_sleep_0..3`, `aqua_eat_0..3`, cada um com
  `frame {x,y,w,h}` (rect na atlas), `sourceSize` e `spriteSourceSize` (todos do tamanho
  da célula uniforme, já que recentralizamos no empacotamento).
- `animations`: `idle`, `sleep`, `eat` → listas dos 4 nomes na ordem.
- `meta`: `{ image: "aqua.png", size: {w,h}, scale: "1" }`.
- O `PetRenderer` consome `sheet.animations[nome]` — basta trocar a URL e ganhar `eat`.

Âncora: renderer mantém `anchor 0.5`; células uniformes + base-alinhadas mantêm o pet
estável e centralizado na janela 220×220 (escalado para caber).

## Seção 3 — Engine: carregar o atlas + animação transitória de comer

- **Trocar o atlas:** `PetRenderer.load()` carrega `/pets/aqua.json` (constante de caminho
  no topo do arquivo). `pickAnimation(pet)` inalterado. Fallback branco em falha mantido.
- **`eat` transitória (play-once → reverte):**
  - `PetRenderer.playEat()`: troca para a animação `eat` com `loop = false`; no
    `onComplete`, reverte para a animação dirigida pelo estado (`pickAnimation(lastPet)`).
  - `render(pet)` guarda `lastPet`. **Trava de transição:** enquanto `eat` toca, `render()`
    atualiza `lastPet` mas **não** troca a animação (um `pet-updated` no meio do comer não
    corta a animação). Ao completar, reverte para o estado atual.
  - Clicar alimentar de novo durante o `eat` reinicia o `eat`.
- **Helper puro de seleção:** `chooseAnimation(pet, eating)` → `"eat"` se `eating`, senão
  `pickAnimation(pet)`. Usado pela lógica do renderer e testável isoladamente.
- **Disparo (feed → eat):** `App` (dono do renderer) promove o `renderer` a `useRef` e
  passa um callback `onFeed` ao `CareBar`. O botão alimentar chama `onFeed`, que faz
  `invoke("feed_pet")` **e** `renderer.playEat()`. Como o botão só fica habilitado quando
  vai alimentar de fato (fome ≥ `FEED_MIN_HUNGER`, pet carregado), o `eat` só toca quando
  realmente come. `toggle_sleep` continua sendo invocado direto no `CareBar`.

## Seção 4 — Testes

- **Helpers puros do script (Vitest, ambiente Node):**
  - `cellRects(width, height, cols, rows)` → retângulos inteiros cobrindo tudo sem
    sobra/buraco (somatório das larguras de uma linha = width; idem alturas = height).
  - `alphaBoundingBox(data, w, h, threshold)` → bbox correta em imagem sintética pequena
    (ex.: 4×4 com bloco opaco central); caso totalmente transparente trata como vazio.
  - `uniformCell(bboxes, margin)` → maior largura/altura + margem.
- **Atlas gerado (Vitest):** ler `public/pets/aqua.json` e afirmar: `animations.idle`,
  `sleep`, `eat` existem com **4 frames cada**; todo frame citado existe em `frames`;
  `meta.image === "aqua.png"`.
- **Seleção de animação (Vitest):** `chooseAnimation(pet, eating)` nos 3 casos
  (eating→eat; awake→idle; asleep→sleep).
- **Playwright:** mantém o teste de canvas montando; sem novas asserções de pixel.
- **Smoke manual** (vai para `docs/superpowers/ACCEPTANCE-slice-3.md`): aqua aparece
  animado (idle); ao dormir, animação `sleep`; ao alimentar, toca `eat` e reverte ao estado.

## Critérios de aceite

- `pnpm assets:pets` gera `public/pets/aqua.{png,json}` a partir do sheet bruto.
- O app exibe o aqua **animado** em idle, troca para `sleep` ao dormir e volta ao acordar.
- Alimentar dispara a animação de **comer** uma vez e reverte ao estado (idle/sleep), sem
  ser cortada por ticks no meio.
- Suíte automatizada (helpers + validação do atlas + `chooseAnimation` + Vitest/Playwright
  existentes) verde.
- Sem regressão na Fatia 2 (barra no hover, alimentar/dormir, persistência).
