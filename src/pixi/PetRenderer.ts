import { Application, Assets, AnimatedSprite, Texture, Sprite } from "pixi.js";
import type { Spritesheet } from "pixi.js";
import type { PetState } from "../types";

/** Função pura: escolhe a animação a partir do modo. Testável sem PixiJS. */
export function pickAnimation(pet: PetState): "idle" | "sleep" {
  return pet.asleep ? "sleep" : "idle";
}

export class PetRenderer {
  private app: Application;
  private sprite?: AnimatedSprite;
  private current?: "idle" | "sleep";
  private sheet?: Spritesheet;

  constructor(app: Application) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      this.sheet = await Assets.load("/pet-placeholder.json");
      this.setAnimation("idle");
    } catch (err) {
      console.error("falha ao carregar sprite sheet, usando placeholder", err);
      const fallback = new Sprite(Texture.WHITE);
      fallback.width = 64;
      fallback.height = 64;
      this.app.stage.addChild(fallback);
    }
  }

  private setAnimation(name: "idle" | "sleep") {
    if (!this.sheet || this.current === name) return;
    if (this.sprite) {
      this.app.stage.removeChild(this.sprite);
      this.sprite.destroy();
    }
    this.sprite = new AnimatedSprite(this.sheet.animations[name]);
    this.sprite.animationSpeed = 0.1;
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    this.sprite.play();
    this.app.stage.addChild(this.sprite);
    this.current = name;
  }

  /** Atualiza a animação conforme o estado do pet. */
  render(pet: PetState) {
    this.setAnimation(pickAnimation(pet));
  }
}
