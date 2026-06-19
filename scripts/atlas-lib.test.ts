import { describe, it, expect } from "vitest";
import { cellRects, alphaBoundingBox, uniformCell } from "./atlas-lib.mjs";

describe("cellRects", () => {
  it("cobre um grid divisível sem sobra nem buraco", () => {
    const rects = cellRects(8, 8, 4, 2);
    expect(rects).toHaveLength(8);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 2, h: 4 });
    expect(rects[3]).toEqual({ x: 6, y: 0, w: 2, h: 4 });
    expect(rects[4]).toEqual({ x: 0, y: 4, w: 2, h: 4 });
    expect(rects[7].x + rects[7].w).toBe(8);
    expect(rects[7].y + rects[7].h).toBe(8);
  });

  it("cobre um grid não-divisível sem buracos (larguras somam W)", () => {
    const rects = cellRects(10, 10, 4, 4);
    const row0 = rects.slice(0, 4);
    for (let i = 1; i < 4; i++) {
      expect(row0[i].x).toBe(row0[i - 1].x + row0[i - 1].w);
    }
    expect(row0[3].x + row0[3].w).toBe(10);
  });

  it("cobre colunas não-divisíveis sem buracos (alturas somam H)", () => {
    const rects = cellRects(10, 10, 4, 4);
    const col0 = rects.filter((_, i) => i % 4 === 0); // primeira célula de cada linha
    for (let i = 1; i < 4; i++) {
      expect(col0[i].y).toBe(col0[i - 1].y + col0[i - 1].h);
    }
    expect(col0[3].y + col0[3].h).toBe(10);
  });
});

describe("alphaBoundingBox", () => {
  function sheet4x4() {
    const data = new Uint8Array(4 * 4 * 4);
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
    expect(cell).toEqual({ w: 13, h: 11 });
  });
});
