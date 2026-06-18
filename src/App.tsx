import { useCallback, useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { usePetStore } from "./state/petStore";
import { PetRenderer } from "./pixi/PetRenderer";
import { CareBar } from "./components/CareBar";
import type { PetState } from "./types";
import "./App.css";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setPet = usePetStore((s) => s.setPet);
  const [hovering, setHovering] = useState(false);

  const rendererRef = useRef<PetRenderer | undefined>(undefined);

  const handleFeed = useCallback(() => {
    void invoke("feed_pet");
    rendererRef.current?.playEat();
  }, []);

  useEffect(() => {
    let renderer: PetRenderer | undefined;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    // Só fica `true` depois que app.init() resolveu. Sem isso, o StrictMode do
    // React 19 (mount -> unmount -> remount) dispara o cleanup enquanto o init
    // ainda está em voo; chamar app.destroy() nesse instante explode dentro do
    // ResizePlugin do Pixi com "this._cancelResize is not a function" e derruba
    // o componente (o canvas nunca chega a ser montado).
    let initialized = false;
    // Pixi 8 não é idempotente: app.destroy() zera app.stage, e uma segunda chamada
    // estoura com "Cannot read properties of null". Como teardown() pode ser chamado
    // mais de uma vez (cleanup do React + caminho disposed da IIFE), guardamos aqui.
    let destroyed = false;
    const app = new Application();

    const teardown = () => {
      unlisten?.();
      unlisten = undefined;
      rendererRef.current = undefined;
      if (initialized && !destroyed) {
        destroyed = true;
        app.destroy(true);
      }
    };

    (async () => {
      await app.init({ width: 220, height: 220, backgroundAlpha: 0 });
      initialized = true;
      if (disposed) {
        teardown();
        return;
      }
      containerRef.current?.appendChild(app.canvas);
      renderer = new PetRenderer(app);
      rendererRef.current = renderer;
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
        teardown();
        return;
      }
      unlisten = fn;
    })();

    return () => {
      disposed = true;
      teardown();
    };
  }, [setPet]);

  return (
    <div
      className="pet-root"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div ref={containerRef} />
      <CareBar visible={hovering} onFeed={handleFeed} />
    </div>
  );
}
