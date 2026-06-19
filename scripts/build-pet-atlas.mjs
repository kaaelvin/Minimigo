import { Jimp } from "jimp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cellRects, alphaBoundingBox, uniformCell } from "./atlas-lib.mjs";

const ROOT = process.cwd(); // deve ser a raiz do projeto (garantido pelo script npm)
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

  const anims = Object.keys(cfg.use);
  const frameBoxes = [];
  for (const anim of anims) {
    const row = cfg.use[anim];
    if (row >= cfg.rows) throw new Error(`row ${row} fora do grid (${cfg.rows} linhas): ${pet}.${anim}`);
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
  console.log(`atlas gerado: public/pets/${pet}.{png,json} (celula ${cell.w}x${cell.h})`);
}

for (const [pet, cfg] of Object.entries(MANIFEST)) {
  await buildPet(pet, cfg);
}
