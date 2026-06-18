import { Application, Assets, AnimatedSprite, Texture, Sprite } from "pixi.js";
import type { Spritesheet } from "pixi.js";
import type { PetState } from "../types";

const ATLAS_URL = "/pets/aqua.json";

/** Função pura: escolhe a animação a partir do modo. Testável sem PixiJS. */
export function pickAnimation(pet: PetState): "idle" | "sleep" {
  return pet.asleep ? "sleep" : "idle";
}

export type AnimName = "idle" | "sleep" | "eat";

/** Função pura: escolhe a animação considerando a transitória de comer. */
export function chooseAnimation(pet: PetState, eating: boolean): AnimName {
  return eating ? "eat" : pickAnimation(pet);
}

export class PetRenderer {
  private app: Application;
  private sprite?: AnimatedSprite;
  private current?: AnimName;
  private sheet?: Spritesheet;
  private lastPet?: PetState;
  private eating = false;

  constructor(app: Application) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      this.sheet = await Assets.load(ATLAS_URL);
      this.setAnimation("idle");
    } catch (err) {
      console.error("falha ao carregar sprite sheet, usando quadrado branco", err);
      const fallback = new Sprite(Texture.WHITE);
      fallback.width = 64;
      fallback.height = 64;
      this.app.stage.addChild(fallback);
    }
  }

  private setAnimation(name: AnimName) {
    if (!this.sheet || this.current === name) return;
    if (this.sprite) {
      this.app.stage.removeChild(this.sprite);
      this.sprite.destroy();
    }
    const sprite = new AnimatedSprite(this.sheet.animations[name]);
    sprite.animationSpeed = 0.1;
    sprite.anchor.set(0.5);
    sprite.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
    if (name === "eat") {
      sprite.loop = false;
      sprite.onComplete = () => {
        this.eating = false;
        if (this.lastPet) this.setAnimation(chooseAnimation(this.lastPet, false));
      };
    } else {
      sprite.loop = true;
    }
    sprite.play();
    this.app.stage.addChild(sprite);
    this.sprite = sprite;
    this.current = name;
  }

  /** Toca a animação de comer uma vez e reverte ao estado quando termina. */
  playEat() {
    if (!this.sheet) return;
    this.eating = true;
    if (this.current === "eat" && this.sprite) {
      this.sprite.gotoAndPlay(0); // já comendo: reinicia
      return;
    }
    this.setAnimation("eat");
  }

  /**
   * Atualiza a animação conforme o estado. Durante o comer, `setAnimation("eat")`
   * é no-op (guard `current === name`), então mudanças de estado no meio são
   * deliberadamente colapsadas: ao terminar, reverte para o último `lastPet` visto.
   */
  render(pet: PetState) {
    this.lastPet = pet;
    this.setAnimation(chooseAnimation(pet, this.eating));
  }
}
