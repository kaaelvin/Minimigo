import { create } from "zustand";
import type { PetState } from "../types";

interface PetStore {
  pet: PetState | null;
  setPet: (pet: PetState) => void;
}

export const usePetStore = create<PetStore>((set) => ({
  pet: null,
  setPet: (pet) => set({ pet }),
}));
