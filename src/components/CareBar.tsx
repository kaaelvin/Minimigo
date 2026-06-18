import { invoke } from "@tauri-apps/api/core";
import { usePetStore } from "../state/petStore";

// Espelha FEED_MIN_HUNGER do domínio Rust (src-tauri/src/domain/mod.rs).
export const FEED_MIN_HUNGER = 10;

/** Barra de ações sobre o pet. `visible` controla a aparição no hover. */
export function CareBar({ visible }: { visible: boolean }) {
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
        onClick={() => {
          void invoke("feed_pet");
        }}
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
