export interface PetState {
  name: string;
  hunger: number; // 0 = saciado, 100 = faminto
  energy: number; // 0 = exausto, 100 = descansado
  asleep: boolean; // true = dormindo (modo de sono)
}
