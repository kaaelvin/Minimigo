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

pub const HUNGER_RATE_PER_MIN: f64 = 0.5;
pub const ENERGY_RATE_PER_MIN: f64 = 0.3;

impl Attributes {
    pub fn apply_decay(&mut self, elapsed_minutes: f64) {
        self.hunger = (self.hunger + HUNGER_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
        self.energy = (self.energy - ENERGY_RATE_PER_MIN * elapsed_minutes).clamp(0.0, 100.0);
    }
}

impl Pet {
    pub fn new(name: impl Into<String>) -> Self {
        Pet {
            name: name.into(),
            attributes: Attributes { hunger: 0.0, energy: 100.0 },
            mode: PetMode::Awake,
        }
    }

    pub fn toggle_sleep(&mut self) {
        self.mode = match self.mode {
            PetMode::Awake => PetMode::Asleep,
            PetMode::Asleep => PetMode::Awake,
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decay_increases_hunger_and_decreases_energy() {
        let mut a = Attributes { hunger: 10.0, energy: 90.0 };
        a.apply_decay(10.0); // 10 minutos
        assert_eq!(a.hunger, 15.0);  // 10 + 0.5*10
        assert_eq!(a.energy, 87.0);  // 90 - 0.3*10
    }

    #[test]
    fn decay_clamps_within_bounds() {
        let mut a = Attributes { hunger: 99.0, energy: 1.0 };
        a.apply_decay(1000.0);
        assert_eq!(a.hunger, 100.0);
        assert_eq!(a.energy, 0.0);
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
}
