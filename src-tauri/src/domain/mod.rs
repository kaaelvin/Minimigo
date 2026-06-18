use serde::{Deserialize, Serialize};

/// Modo do pet: acordado (decay normal) ou dormindo (recupera energia).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum PetMode {
    #[default]
    Awake,
    Asleep,
}

/// hunger: 0.0 = saciado, 100.0 = faminto.
/// energy: 0.0 = exausto, 100.0 = descansado.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Attributes {
    pub hunger: f64,
    pub energy: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pet {
    pub name: String,
    pub attributes: Attributes,
    #[serde(default)]
    pub mode: PetMode,
}

// Rates acordado (decay).
pub const HUNGER_RATE_PER_MIN: f64 = 0.5;
pub const ENERGY_RATE_PER_MIN: f64 = 0.3;
// Rates dormindo (energia recupera, fome desacelera).
pub const HUNGER_RATE_ASLEEP_PER_MIN: f64 = 0.2;
pub const ENERGY_RECOVER_ASLEEP_PER_MIN: f64 = 1.0;
pub const FEED_AMOUNT: f64 = 30.0;
pub const FEED_MIN_HUNGER: f64 = 10.0;

impl Pet {
    pub fn new(name: impl Into<String>) -> Self {
        Pet {
            name: name.into(),
            attributes: Attributes { hunger: 0.0, energy: 100.0 },
            mode: PetMode::Awake,
        }
    }

    /// Alterna o modo entre `Awake` e `Asleep`.
    pub fn toggle_sleep(&mut self) {
        self.mode = match self.mode {
            PetMode::Awake => PetMode::Asleep,
            PetMode::Asleep => PetMode::Awake,
        };
    }

    /// Aplica o decay conforme o modo. Acordado: fome sobe, energia cai.
    /// Dormindo: energia recupera, fome sobe devagar.
    pub fn apply_decay(&mut self, elapsed_minutes: f64) {
        let mode = self.mode;
        let a = &mut self.attributes;
        match mode {
            PetMode::Awake => {
                a.hunger = (a.hunger + HUNGER_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
                a.energy = (a.energy - ENERGY_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
            }
            PetMode::Asleep => {
                a.hunger = (a.hunger + HUNGER_RATE_ASLEEP_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
                a.energy = (a.energy + ENERGY_RECOVER_ASLEEP_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
            }
        }
    }

    /// Alimenta o pet se ele estiver com fome suficiente (saciedade impede spam).
    /// Retorna `true` se alimentou, `false` se estava saciado demais.
    pub fn feed(&mut self) -> bool {
        if self.attributes.hunger >= FEED_MIN_HUNGER {
            self.attributes.hunger = (self.attributes.hunger - FEED_AMOUNT).clamp(0.0, 100.0);
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn awake_decay_matches_slice1() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 10.0, energy: 90.0 }, mode: PetMode::Awake };
        p.apply_decay(10.0);
        assert_eq!(p.attributes.hunger, 15.0); // 10 + 0.5*10
        assert_eq!(p.attributes.energy, 87.0); // 90 - 0.3*10
    }

    #[test]
    fn awake_decay_clamps() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 99.0, energy: 1.0 }, mode: PetMode::Awake };
        p.apply_decay(1000.0);
        assert_eq!(p.attributes.hunger, 100.0);
        assert_eq!(p.attributes.energy, 0.0);
    }

    #[test]
    fn asleep_decay_clamps() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 99.0, energy: 99.0 }, mode: PetMode::Asleep };
        p.apply_decay(1000.0);
        assert_eq!(p.attributes.hunger, 100.0);
        assert_eq!(p.attributes.energy, 100.0);
    }

    #[test]
    fn asleep_recovers_energy_and_slows_hunger() {
        let mut p = Pet { name: "Migo".into(), attributes: Attributes { hunger: 10.0, energy: 50.0 }, mode: PetMode::Asleep };
        p.apply_decay(10.0);
        assert_eq!(p.attributes.energy, 60.0); // 50 + 1.0*10
        assert_eq!(p.attributes.hunger, 12.0); // 10 + 0.2*10
    }

    #[test]
    fn new_pet_starts_awake() {
        assert_eq!(Pet::new("Migo").mode, PetMode::Awake);
    }

    #[test]
    fn toggle_sleep_alternates() {
        let mut p = Pet::new("Migo");
        p.toggle_sleep();
        assert_eq!(p.mode, PetMode::Asleep);
        p.toggle_sleep();
        assert_eq!(p.mode, PetMode::Awake);
    }

    #[test]
    fn feed_reduces_hunger_when_hungry() {
        let mut p = Pet::new("Migo");
        p.attributes.hunger = 50.0;
        assert!(p.feed());
        assert_eq!(p.attributes.hunger, 20.0); // 50 - 30
    }

    #[test]
    fn feed_clamps_at_zero() {
        let mut p = Pet::new("Migo");
        p.attributes.hunger = 20.0;
        assert!(p.feed());
        assert_eq!(p.attributes.hunger, 0.0); // 20 - 30 -> clamp 0
    }

    #[test]
    fn feed_noop_when_sated() {
        let mut p = Pet::new("Migo");
        p.attributes.hunger = 5.0; // < FEED_MIN_HUNGER
        assert!(!p.feed());
        assert_eq!(p.attributes.hunger, 5.0);
    }
}
