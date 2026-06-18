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
