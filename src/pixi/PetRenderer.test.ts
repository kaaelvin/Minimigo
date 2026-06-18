import { describe, it, expect } from "vitest";
import { pickAnimation, chooseAnimation } from "./PetRenderer";

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
