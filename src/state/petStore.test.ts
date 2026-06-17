import { describe, it, expect, beforeEach } from "vitest";
import { usePetStore } from "./petStore";

describe("petStore", () => {
  beforeEach(() => {
    usePetStore.setState({ pet: null });
  });

  it("começa sem pet", () => {
    expect(usePetStore.getState().pet).toBeNull();
  });

  it("setPet atualiza o estado", () => {
    usePetStore.getState().setPet({ name: "Migo", hunger: 30, energy: 82 });
    expect(usePetStore.getState().pet).toEqual({ name: "Migo", hunger: 30, energy: 82 });
  });
});
