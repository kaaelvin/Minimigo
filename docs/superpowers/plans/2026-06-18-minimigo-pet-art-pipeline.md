# Pipeline de Arte de Pet (primeiro pet: aqua) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o sprite placeholder pelo pet real `aqua`, com animações `idle`/`sleep`/`eat` geradas por um pipeline de assets reutilizável (script Node + jimp), e tocar a animação de comer ao alimentar.

**Architecture:** Um script de build (`scripts/build-pet-atlas.mjs`) fatia o sheet 4×8 da IA, faz auto-trim por alpha e recentraliza (centro horizontal + base) cada frame num atlas Pixi compacto em `public/pets/aqua.{png,json}`. O `PetRenderer` carrega esse atlas; `chooseAnimation(pet, eating)` decide a animação; `eat` é uma transitória play-once com trava de transição, disparada por um callback `onFeed` no `App`.

**Tech Stack:** Node ESM + jimp (asset build), PixiJS 8, React 19 + TS, Vitest. Rust intocado nesta fatia.

**Spec:** `docs/superpowers/specs/2026-06-18-minimigo-pet-art-pipeline-design.md`

**Convenção de commits:** pt-BR, conventional commits; toda mensagem termina com:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## Estrutura de arquivos

- `scripts/atlas-lib.mjs` — Criar: helpers puros (`cellRects`, `alphaBoundingBox`, `uniformCell`). Sem dependência de jimp.
- `scripts/atlas-lib.test.ts` — Criar: testes Vitest dos helpers puros.
- `scripts/build-pet-atlas.mjs` — Criar: script de build (jimp + helpers) com manifest inline.
- `vitest.config.ts` — Modificar: incluir `scripts/**` no `include`.
- `package.json` — Modificar: devDependency `jimp` + script `assets:pets`.
- `public/pets/aqua.png` + `public/pets/aqua.json` — Gerados (commitados).
- `src/assets/aqua/...png` — sheet bruto (commitar para reprodutibilidade).
- `src/pixi/atlas-output.test.ts` — Criar: valida o atlas gerado.
- `src/pixi/PetRenderer.ts` — Modificar: `chooseAnimation`, carregar atlas do aqua, `eat` transitória, `playEat`, trava.
- `src/pixi/PetRenderer.test.ts` — Modificar: testes de `chooseAnimation`.
- `src/components/CareBar.tsx` — Modificar: prop `onFeed` no botão alimentar.
- `src/App.tsx` — Modificar: `renderer` em `useRef`, `onFeed` (invoke + playEat) passado ao `CareBar`.

---

## Task 1: Helpers puros do atlas + escopo do Vitest

**Files:**
- Create: `scripts/atlas-lib.mjs`
- Create: `scripts/atlas-lib.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Incluir `scripts/**` no Vitest** — em `vitest.config.ts`, trocar a linha do `include`:

```ts
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.{test,spec}.{ts,tsx}"],
```

- [ ] **Step 2: Escrever os testes que falham** — criar `scripts/atlas-lib.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cellRects, alphaBoundingBox, uniformCell } from "./atlas-lib.mjs";

describe("cellRects", () => {
  it("cobre um grid divisível sem sobra nem buraco", () => {
    const rects = cellRects(8, 8, 4, 2);
    expect(rects).toHaveLength(8);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 2, h: 4 });
    expect(rects[3]).toEqual({ x: 6, y: 0, w: 2, h: 4 });
    expect(rects[4]).toEqual({ x: 0, y: 4, w: 2, h: 4 });
    // última célula encosta no canto
    expect(rects[7].x + rects[7].w).toBe(8);
    expect(rects[7].y + rects[7].h).toBe(8);
  });

  it("cobre um grid não-divisível sem buracos (larguras somam W)", () => {
    const rects = cellRects(10, 10, 4, 4);
    const row0 = rects.slice(0, 4);
    // sem gaps: cada célula começa onde a anterior termina
    for (let i = 1; i < 4; i++) {
      expect(row0[i].x).toBe(row0[i - 1].x + row0[i - 1].w);
    }
    expect(row0[3].x + row0[3].w).toBe(10);
  });
});

describe("alphaBoundingBox", () => {
  // sheet 4x4 RGBA: opaco em (1,1) e (2,2), resto transparente
  function sheet4x4() {
    const data = new Uint8Array(4 * 4 * 4); // tudo 0 (transparente)
    const setOpaque = (x: number, y: number) => {
      const i = (y * 4 + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    };
    setOpaque(1, 1);
    setOpaque(2, 2);
    return data;
  }

  it("acha a bbox dos pixels opacos dentro da célula", () => {
    const bbox = alphaBoundingBox(sheet4x4(), 4, { x: 0, y: 0, w: 4, h: 4 }, 8);
    expect(bbox).toEqual({ x: 1, y: 1, w: 2, h: 2 });
  });

  it("retorna null quando a célula é toda transparente", () => {
    const data = new Uint8Array(4 * 4 * 4);
    expect(alphaBoundingBox(data, 4, { x: 0, y: 0, w: 4, h: 4 }, 8)).toBeNull();
  });
});

describe("uniformCell", () => {
  it("usa maior largura/altura + margem dos dois lados", () => {
    const cell = uniformCell([{ x: 0, y: 0, w: 2, h: 3 }, { x: 0, y: 0, w: 5, h: 1 }], 4);
    expect(cell).toEqual({ w: 13, h: 11 }); // 5+2*4 , 3+2*4
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm test scripts/atlas-lib.test.ts`
Expected: FALHA (módulo `./atlas-lib.mjs` não existe).

- [ ] **Step 4: Implementar os helpers** — criar `scripts/atlas-lib.mjs`:

```js
// Helpers puros para o pipeline de atlas. Sem dependência de jimp (recebem
// buffers RGBA crus), para serem testáveis no Vitest.

/** Retângulos inteiros que cobrem um grid cols×rows sem sobra nem buraco. */
export function cellRects(width, height, cols, rows) {
  const xAt = (c) => Math.round((c * width) / cols);
  const yAt = (r) => Math.round((r * height) / rows);
  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = xAt(c);
      const y = yAt(r);
      rects.push({ x, y, w: xAt(c + 1) - x, h: yAt(r + 1) - y });
    }
  }
  return rects;
}

/**
 * Bounding box (em coordenadas absolutas do sheet) dos pixels com alpha > threshold
 * dentro de `cell`. `data` é RGBA (Uint8Array/Buffer) de largura `sheetWidth`.
 * Retorna null se a célula for totalmente transparente.
 */
export function alphaBoundingBox(data, sheetWidth, cell, threshold = 8) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = cell.y; y < cell.y + cell.h; y++) {
    for (let x = cell.x; x < cell.x + cell.w; x++) {
      const alpha = data[(y * sheetWidth + x) * 4 + 3];
      if (alpha > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Célula uniforme = maior largura/altura entre as bboxes + margem dos dois lados. */
export function uniformCell(bboxes, margin) {
  const maxW = Math.max(...bboxes.map((b) => b.w));
  const maxH = Math.max(...bboxes.map((b) => b.h));
  return { w: maxW + 2 * margin, h: maxH + 2 * margin };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm test scripts/atlas-lib.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 6: Commit**

```bash
git add scripts/atlas-lib.mjs scripts/atlas-lib.test.ts vitest.config.ts
git commit -m "feat(assets): helpers puros do pipeline de atlas + escopo Vitest

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Script de build do atlas + geração do aqua

**Files:**
- Create: `scripts/build-pet-atlas.mjs`
- Modify: `package.json`
- Create (gerados): `public/pets/aqua.png`, `public/pets/aqua.json`
- Add (bruto): `src/assets/aqua/ChatGPT Image 17 de jun. de 2026, 09_29_32 (1).png`

- [ ] **Step 1: Adicionar jimp e o script npm** — em `package.json`, adicionar em `devDependencies` (ordem alfabética, antes de `jsdom`):

```json
    "jimp": "^1.6.0",
```

e em `scripts` (após `"e2e": "playwright test"`):

```json
    "assets:pets": "node scripts/build-pet-atlas.mjs"
```

- [ ] **Step 2: Instalar a dependência**

Run: `pnpm install`
Expected: jimp instalado, sem erros.

- [ ] **Step 3: Criar o script de build** — criar `scripts/build-pet-atlas.mjs`:

```js
import { Jimp } from "jimp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cellRects, alphaBoundingBox, uniformCell } from "./atlas-lib.mjs";

const ROOT = process.cwd();
const MARGIN = 4;
const ALPHA_THRESHOLD = 8;

// pet -> sheet bruto, grid e quais linhas usar (0-indexado).
const MANIFEST = {
  aqua: {
    sheet: "src/assets/aqua/ChatGPT Image 17 de jun. de 2026, 09_29_32 (1).png",
    cols: 4,
    rows: 8,
    use: { idle: 0, sleep: 2, eat: 6 },
  },
};

async function buildPet(pet, cfg) {
  const img = await Jimp.read(join(ROOT, cfg.sheet));
  const { data, width, height } = img.bitmap;
  const rects = cellRects(width, height, cfg.cols, cfg.rows);

  const anims = Object.keys(cfg.use); // ["idle","sleep","eat"]
  // bbox de cada frame (linha do estado × colunas)
  const frameBoxes = []; // { anim, col, bbox }
  for (const anim of anims) {
    const row = cfg.use[anim];
    for (let col = 0; col < cfg.cols; col++) {
      const cell = rects[row * cfg.cols + col];
      const bbox = alphaBoundingBox(data, width, cell, ALPHA_THRESHOLD);
      if (!bbox) throw new Error(`frame vazio: ${pet} ${anim} col ${col}`);
      frameBoxes.push({ anim, col, bbox });
    }
  }

  const cell = uniformCell(frameBoxes.map((f) => f.bbox), MARGIN);
  const atlasW = cfg.cols * cell.w;
  const atlasH = anims.length * cell.h;
  const atlas = new Jimp({ width: atlasW, height: atlasH, color: 0x00000000 });

  const frames = {};
  const animations = {};
  for (const anim of anims) animations[anim] = [];

  frameBoxes.forEach(({ anim, col, bbox }) => {
    const animIndex = anims.indexOf(anim);
    const dx0 = col * cell.w;
    const dy0 = animIndex * cell.h;
    // centraliza na horizontal, alinha pela base (margem inferior = MARGIN)
    const offX = Math.round((cell.w - bbox.w) / 2);
    const offY = cell.h - MARGIN - bbox.h;
    for (let yy = 0; yy < bbox.h; yy++) {
      for (let xx = 0; xx < bbox.w; xx++) {
        const sIdx = ((bbox.y + yy) * width + (bbox.x + xx)) * 4;
        const dIdx = ((dy0 + offY + yy) * atlasW + (dx0 + offX + xx)) * 4;
        atlas.bitmap.data[dIdx] = data[sIdx];
        atlas.bitmap.data[dIdx + 1] = data[sIdx + 1];
        atlas.bitmap.data[dIdx + 2] = data[sIdx + 2];
        atlas.bitmap.data[dIdx + 3] = data[sIdx + 3];
      }
    }
    const name = `${pet}_${anim}_${col}`;
    frames[name] = { frame: { x: dx0, y: dy0, w: cell.w, h: cell.h } };
    animations[anim].push(name);
  });

  const outDir = join(ROOT, "public", "pets");
  mkdirSync(outDir, { recursive: true });
  await atlas.write(join(outDir, `${pet}.png`));
  const atlasJson = {
    frames,
    meta: { image: `${pet}.png`, size: { w: atlasW, h: atlasH }, scale: "1" },
    animations,
  };
  writeFileSync(join(outDir, `${pet}.json`), JSON.stringify(atlasJson, null, 2));
  console.log(`atlas gerado: public/pets/${pet}.{png,json} (célula ${cell.w}x${cell.h})`);
}

for (const [pet, cfg] of Object.entries(MANIFEST)) {
  await buildPet(pet, cfg);
}
```

- [ ] **Step 4: Garantir que o sheet bruto do aqua existe** (já está em `src/assets/aqua/`, não rastreado). Confirmar o caminho:

Run: `ls "src/assets/aqua/"`
Expected: lista o arquivo `ChatGPT Image 17 de jun. de 2026, 09_29_32 (1).png` (o sheet) — confirma que o `MANIFEST.aqua.sheet` bate. Se o nome divergir, corrigir o `sheet` no manifest para o nome exato.

- [ ] **Step 5: Rodar o build e gerar o atlas**

Run: `pnpm assets:pets`
Expected: imprime "atlas gerado: public/pets/aqua.{png,json}" sem erros; cria os dois arquivos.

- [ ] **Step 6: Inspeção visual rápida** (sanidade do recorte/recentralização)

Run: `ls public/pets/`
Expected: `aqua.png` e `aqua.json` existem. Abrir `public/pets/aqua.png` num visualizador e confirmar 3 linhas (idle/sleep/eat) × 4 colunas, personagens centralizados e base-alinhados. (Validação estrutural automatizada vem na Task 3.)

- [ ] **Step 7: Commit** (script, manifest embutido, sheet bruto e atlas gerado)

```bash
git add package.json pnpm-lock.yaml scripts/build-pet-atlas.mjs "src/assets/aqua/" public/pets/aqua.png public/pets/aqua.json
git commit -m "feat(assets): script de build de atlas + atlas do aqua gerado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Se o projeto não usar `pnpm-lock.yaml`, omitir esse arquivo do `git add`.)

---

## Task 3: Teste de validade do atlas gerado

**Files:**
- Create: `src/pixi/atlas-output.test.ts`

- [ ] **Step 1: Escrever o teste** — criar `src/pixi/atlas-output.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const atlas = JSON.parse(
  readFileSync(join(process.cwd(), "public/pets/aqua.json"), "utf-8"),
);

describe("atlas do aqua", () => {
  it("aponta para a imagem aqua.png", () => {
    expect(atlas.meta.image).toBe("aqua.png");
  });

  it("tem idle/sleep/eat com 4 frames cada", () => {
    for (const anim of ["idle", "sleep", "eat"]) {
      expect(atlas.animations[anim]).toHaveLength(4);
    }
  });

  it("todo frame citado nas animações existe em frames", () => {
    const all = Object.values(atlas.animations).flat() as string[];
    for (const name of all) {
      expect(atlas.frames[name]).toBeDefined();
      expect(atlas.frames[name].frame.w).toBeGreaterThan(0);
      expect(atlas.frames[name].frame.h).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver passar** (depende do atlas gerado na Task 2)

Run: `pnpm test src/pixi/atlas-output.test.ts`
Expected: PASS (3 testes). Se falhar com "arquivo não encontrado", rodar `pnpm assets:pets` antes.

- [ ] **Step 3: Commit**

```bash
git add src/pixi/atlas-output.test.ts
git commit -m "test(assets): valida estrutura do atlas gerado do aqua

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Helper `chooseAnimation`

**Files:**
- Modify: `src/pixi/PetRenderer.ts`
- Modify: `src/pixi/PetRenderer.test.ts`

- [ ] **Step 1: Escrever os testes que falham** — em `src/pixi/PetRenderer.test.ts`, trocar o import e adicionar um describe (manter os testes de `pickAnimation`):

Trocar a primeira linha de import por:

```ts
import { pickAnimation, chooseAnimation } from "./PetRenderer";
```

Adicionar ao fim do arquivo:

```ts
describe("chooseAnimation", () => {
  it("come quando eating=true, ignorando o modo", () => {
    expect(chooseAnimation({ name: "Migo", hunger: 20, energy: 80, asleep: true }, true)).toBe("eat");
  });

  it("usa o modo quando não está comendo: acordado -> idle", () => {
    expect(chooseAnimation({ name: "Migo", hunger: 20, energy: 80, asleep: false }, false)).toBe("idle");
  });

  it("usa o modo quando não está comendo: dormindo -> sleep", () => {
    expect(chooseAnimation({ name: "Migo", hunger: 20, energy: 80, asleep: true }, false)).toBe("sleep");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test src/pixi/PetRenderer.test.ts`
Expected: FALHA (`chooseAnimation` não exportado).

- [ ] **Step 3: Implementar o helper** — em `src/pixi/PetRenderer.ts`, adicionar o tipo e a função logo após `pickAnimation` (manter `pickAnimation` como está):

```ts
export type AnimName = "idle" | "sleep" | "eat";

/** Função pura: escolhe a animação considerando a transitória de comer. */
export function chooseAnimation(pet: PetState, eating: boolean): AnimName {
  return eating ? "eat" : pickAnimation(pet);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test src/pixi/PetRenderer.test.ts`
Expected: PASS (pickAnimation + chooseAnimation).

- [ ] **Step 5: Commit**

```bash
git add src/pixi/PetRenderer.ts src/pixi/PetRenderer.test.ts
git commit -m "feat(pixi): chooseAnimation considera a transitória de comer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `PetRenderer` carrega o aqua + animação de comer

**Files:**
- Modify: `src/pixi/PetRenderer.ts`

- [ ] **Step 1: Reescrever a classe `PetRenderer`** — substituir o `PetRenderer` inteiro (da declaração `export class PetRenderer {` até o `}` final) por esta versão. Manter `pickAnimation`, `AnimName` e `chooseAnimation` acima intactos, e adicionar a constante de URL logo abaixo dos imports:

Adicionar após os imports (topo do arquivo):

```ts
const ATLAS_URL = "/pets/aqua.json";
```

Substituir a classe por:

```ts
export class PetRenderer {
  private app: Application;
  private sprite?: AnimatedSprite;
  private current?: AnimName;
  private sheet?: Spritesheet;
  private lastPet?: PetState;
  private eating = false;

  constructor(app: Application) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      this.sheet = await Assets.load(ATLAS_URL);
      this.setAnimation("idle");
    } catch (err) {
      console.error("falha ao carregar sprite sheet, usando placeholder", err);
      const fallback = new Sprite(Texture.WHITE);
      fallback.width = 64;
      fallback.height = 64;
      this.app.stage.addChild(fallback);
    }
  }

  private setAnimation(name: AnimName) {
    if (!this.sheet || this.current === name) return;
    if (this.sprite) {
      this.app.stage.removeChild(this.sprite);
      this.sprite.destroy();
    }
    const sprite = new AnimatedSprite(this.sheet.animations[name]);
    sprite.animationSpeed = 0.1;
    sprite.anchor.set(0.5);
    sprite.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    if (name === "eat") {
      sprite.loop = false;
      sprite.onComplete = () => {
        this.eating = false;
        if (this.lastPet) this.setAnimation(chooseAnimation(this.lastPet, false));
      };
    } else {
      sprite.loop = true;
    }
    sprite.play();
    this.app.stage.addChild(sprite);
    this.sprite = sprite;
    this.current = name;
  }

  /** Toca a animação de comer uma vez e reverte ao estado quando termina. */
  playEat() {
    if (!this.sheet) return;
    this.eating = true;
    if (this.current === "eat" && this.sprite) {
      this.sprite.gotoAndPlay(0); // já comendo: reinicia
      return;
    }
    this.setAnimation("eat");
  }

  /** Atualiza a animação conforme o estado; trava durante o comer. */
  render(pet: PetState) {
    this.lastPet = pet;
    this.setAnimation(chooseAnimation(pet, this.eating));
  }
}
```

- [ ] **Step 2: Verificar que compila e os testes seguem verdes**

Run: `pnpm build`
Expected: tsc + vite build sem erros.

Run: `pnpm test`
Expected: PASS (helpers, atlas-output, pickAnimation/chooseAnimation, store).

- [ ] **Step 3: Commit**

```bash
git add src/pixi/PetRenderer.ts
git commit -m "feat(pixi): carrega atlas do aqua e toca comer ao alimentar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Disparo feed → eat (`App` + `CareBar`)

**Files:**
- Modify: `src/components/CareBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Dar ao `CareBar` a prop `onFeed`** — em `src/components/CareBar.tsx`, trocar a assinatura e o `onClick` do botão alimentar. A nova versão completa do arquivo:

```tsx
import { invoke } from "@tauri-apps/api/core";
import { usePetStore } from "../state/petStore";

// Espelha FEED_MIN_HUNGER do domínio Rust (src-tauri/src/domain/mod.rs).
export const FEED_MIN_HUNGER = 10;

/** Barra de ações sobre o pet. `visible` controla a aparição no hover. */
export function CareBar({ visible, onFeed }: { visible: boolean; onFeed: () => void }) {
  const pet = usePetStore((s) => s.pet);
  const feedDisabled = pet === null || pet.hunger < FEED_MIN_HUNGER;
  const asleep = pet?.asleep ?? false;

  return (
    <div className="care-bar" data-testid="care-bar" data-visible={visible}>
      <button
        type="button"
        data-testid="feed-btn"
        title="Alimentar"
        aria-label="Alimentar"
        disabled={feedDisabled}
        onClick={onFeed}
      >
        🍖
      </button>
      <button
        type="button"
        data-testid="sleep-btn"
        title={asleep ? "Acordar" : "Dormir"}
        aria-label={asleep ? "Acordar" : "Dormir"}
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

- [ ] **Step 2: Promover `renderer` a ref e passar `onFeed`** — em `src/App.tsx`:

(a) Manter o import do `invoke` (já existe). Dentro do componente, após `const [hovering, setHovering] = useState(false);`, adicionar a ref e o handler:

```tsx
  const rendererRef = useRef<PetRenderer | undefined>(undefined);

  const handleFeed = () => {
    void invoke("feed_pet");
    rendererRef.current?.playEat();
  };
```

(b) No corpo do effect, logo após `renderer = new PetRenderer(app);`, registrar a ref:

```tsx
      renderer = new PetRenderer(app);
      rendererRef.current = renderer;
```

(c) Dentro do `teardown`, limpar a ref para não chamar um renderer destruído. Trocar o corpo do `teardown` por:

```tsx
    const teardown = () => {
      unlisten?.();
      unlisten = undefined;
      rendererRef.current = undefined;
      if (initialized && !destroyed) {
        destroyed = true;
        app.destroy(true);
      }
    };
```

(d) Passar `onFeed` ao `CareBar` no JSX:

```tsx
      <CareBar visible={hovering} onFeed={handleFeed} />
```

- [ ] **Step 3: Verificar build e testes**

Run: `pnpm build`
Expected: tsc + vite build sem erros (a nova prop `onFeed` é obrigatória e o `App` a fornece).

Run: `pnpm test`
Expected: PASS.

Run: `pnpm e2e`
Expected: PASS (a barra aparece no hover; o teste não clica em alimentar).

- [ ] **Step 4: Commit**

```bash
git add src/components/CareBar.tsx src/App.tsx
git commit -m "feat(ui): alimentar dispara a animação de comer (onFeed no App)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verificação final + documentação

**Files:**
- Create: `docs/superpowers/ACCEPTANCE-slice-3.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Suíte completa**

Run: `pnpm test` e `pnpm e2e` e `cd src-tauri && cargo test --lib`
Expected: tudo verde (Vitest incluindo os novos testes; Playwright; Rust sem regressão).

- [ ] **Step 2: Criar o checklist de aceite** — criar `docs/superpowers/ACCEPTANCE-slice-3.md`:

```markdown
# Checklist de aceite manual — Arte de pet (aqua)

Exige a GUI real do Tauri (animação, hover). O E2E só cobre montagem do canvas.

## Pré-requisitos
- `cargo` no PATH; `pnpm install` feito.
- Atlas gerado: `pnpm assets:pets` (cria `public/pets/aqua.{png,json}`).

## Como rodar
```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
pnpm tauri dev
```

## Critérios
- [ ] O pet exibido é o **aqua** (azul), **animado** em idle (não um quadro estático).
- [ ] Ao clicar **dormir** (💤), o pet troca para a animação **sleep**; ao **acordar** (☀️), volta para idle.
- [ ] Ao clicar **alimentar** (🍖) com fome ≥ 10, toca a animação de **comer** uma vez e
      depois **reverte** ao estado atual (idle ou sleep), sem ser cortada por ticks.
- [ ] Sem regressão da Fatia 2: barra aparece no hover, alimentar desabilita ao saciar,
      modo persiste ao reabrir.

## Resultado
- [ ] Todos os critérios OK → fatia de arte (aqua) aceita.
```

- [ ] **Step 3: Atualizar o roadmap** — em `docs/ROADMAP.md`, na tabela do MVP, trocar a linha do entregável 2:

```
| 2 | Pet animado (8 animações) | 🟡 aqua real (idle/sleep/eat) via pipeline de atlas → demais pets/anims depois |
```

E na lista de fatias futuras, ajustar o item "Arte real" para reconhecer o pipeline:

```
7. **Arte real (demais pets + animações)** — pipeline de atlas pronto (`pnpm assets:pets`);
   falta gerar os outros 11 pets e mapear os estados restantes (triste/bravo/chorando/andando).
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/ACCEPTANCE-slice-3.md docs/ROADMAP.md
git commit -m "docs: aceite manual da arte do aqua + roadmap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificação final (resumo)

- [ ] `pnpm assets:pets` regenera `public/pets/aqua.{png,json}`.
- [ ] `pnpm test` verde (helpers + atlas-output + pickAnimation/chooseAnimation + store).
- [ ] `pnpm build` compila.
- [ ] `pnpm e2e` verde.
- [ ] `cargo test --lib` verde (sem regressão).
- [ ] Smoke manual (`ACCEPTANCE-slice-3.md`): aqua animado, sleep ao dormir, eat ao alimentar revertendo ao estado.
