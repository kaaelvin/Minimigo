import { describe, it, expect } from "vitest";
import { pickAnimation } from "./PetRenderer";

describe("pickAnimation", () => {
  it("dorme quando a energia está muito baixa", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 5 })).toBe("sleep");
  });

  it("fica idle quando descansado", () => {
    expect(pickAnimation({ name: "Migo", hunger: 20, energy: 80 })).toBe("idle");
  });
});
