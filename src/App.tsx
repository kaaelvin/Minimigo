import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePetStore } from "./state/petStore";
import { PetRenderer } from "./pixi/PetRenderer";
import type { PetState } from "./types";
import "./App.css";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setPet = usePetStore((s) => s.setPet);

  useEffect(() => {
    let renderer: PetRenderer | undefined;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    const app = new Application();

    (async () => {
      await app.init({ width: 220, height: 220, backgroundAlpha: 0 });
      if (disposed) {
        app.destroy(true);
        return;
      }
      containerRef.current?.appendChild(app.canvas);
      renderer = new PetRenderer(app);
      await renderer.load();

      // estado inicial vindo do Rust
      try {
        const initial = await invoke<PetState>("get_pet_state");
        setPet(initial);
        renderer.render(initial);
      } catch (e) {
        console.error("falha no get_pet_state", e);
      }

      // updates periódicos do tick loop do Rust
      const fn = await listen<PetState>("pet-updated", (e) => {
        setPet(e.payload);
        renderer?.render(e.payload);
      });
      // Se o componente desmontou enquanto o listen resolvia, desfaz já para não
      // vazar um listener órfão chamando um renderer destruído.
      if (disposed) {
        fn();
        return;
      }
      unlisten = fn;
    })();

    return () => {
      disposed = true;
      unlisten?.();
      app.destroy(true);
    };
  }, [setPet]);

  return <div ref={containerRef} />;
}
