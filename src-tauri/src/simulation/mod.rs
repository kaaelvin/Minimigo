use crate::domain::Pet;

/// Teto de punição offline: no máximo 8h de decay são aplicadas de uma vez.
pub const MAX_OFFLINE_MINUTES: f64 = 8.0 * 60.0;

pub fn tick(pet: &mut Pet, elapsed_minutes: f64) {
    pet.attributes.apply_decay(elapsed_minutes);
}

pub fn apply_offline(pet: &mut Pet, elapsed_minutes: f64) {
    let capped = elapsed_minutes.min(MAX_OFFLINE_MINUTES);
    pet.attributes.apply_decay(capped);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Attributes, Pet};

    fn pet_at(hunger: f64, energy: f64) -> Pet {
        Pet { name: "Migo".into(), attributes: Attributes { hunger, energy }, mode: crate::domain::PetMode::Awake }
    }

    #[test]
    fn tick_applies_full_elapsed() {
        let mut p = pet_at(0.0, 100.0);
        tick(&mut p, 20.0);
        assert_eq!(p.attributes.hunger, 10.0); // 0.5*20
        assert_eq!(p.attributes.energy, 94.0); // 100 - 0.3*20
    }

    #[test]
    fn offline_is_capped_at_max() {
        let mut p = pet_at(0.0, 100.0);
        apply_offline(&mut p, 100_000.0); // muito tempo
        // limitado a 480 min: hunger = 0.5*480 = 240 -> clamp 100
        assert_eq!(p.attributes.hunger, 100.0);
        // energy = 100 - 0.3*480 = -44 -> clamp 0
        assert_eq!(p.attributes.energy, 0.0);
    }

    #[test]
    fn offline_below_cap_is_exact() {
        let mut p = pet_at(0.0, 100.0);
        apply_offline(&mut p, 60.0); // 1h, abaixo do teto
        assert_eq!(p.attributes.hunger, 30.0); // 0.5*60
        assert_eq!(p.attributes.energy, 82.0); // 100 - 0.3*60
    }
}
