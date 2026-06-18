import { describe, it, expect } from "vitest";
import { pickAnimation } from "./PetRenderer";

describe("pickAnimation", () => {
  it("dorme quando asleep, independente da energia", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 80, asleep: true })).toBe("sleep");
  });

  it("fica idle quando acordado, mesmo com energia baixa", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 5, asleep: false })).toBe("idle");
  });

  it("dorme quando asleep com energia baixa (confirma que energia não interfere)", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 5, asleep: true })).toBe("sleep");
  });
});
