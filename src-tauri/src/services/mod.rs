use crate::domain::Pet;
use crate::persistence::{self, Snapshot};
use crate::simulation;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Estado compartilhado gerenciado pelo Tauri.
pub struct AppState {
    pub conn: Mutex<Connection>,
    pub pet: Mutex<Pet>,
}

/// Carrega o pet do banco aplicando decay offline; cria um novo se não houver snapshot
/// ou se o snapshot estiver corrompido. `now_unix` é injetado para testabilidade.
pub fn load_or_create_pet(conn: &Connection, now_unix: i64) -> Pet {
    match persistence::load_snapshot(conn) {
        Ok(Some(snap)) => {
            let mut pet = snap.pet;
            let elapsed_min = ((now_unix - snap.last_seen_unix).max(0) as f64) / 60.0;
            simulation::apply_offline(&mut pet, elapsed_min);
            pet
        }
        _ => Pet::new("Migo"),
    }
}

pub fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[derive(Serialize, Clone)]
pub struct PetState {
    pub name: String,
    pub hunger: f64,
    pub energy: f64,
}

impl From<&Pet> for PetState {
    fn from(p: &Pet) -> Self {
        PetState {
            name: p.name.clone(),
            hunger: p.attributes.hunger,
            energy: p.attributes.energy,
        }
    }
}

#[tauri::command]
pub fn get_pet_state(state: tauri::State<AppState>) -> PetState {
    let pet = state.pet.lock().unwrap();
    PetState::from(&*pet)
}

/// Persiste o pet atual com o timestamp informado.
pub fn persist(state: &AppState, now: i64) {
    let pet = state.pet.lock().unwrap();
    let conn = state.conn.lock().unwrap();
    if let Err(e) = persistence::save_snapshot(
        &conn,
        &Snapshot {
            pet: pet.clone(),
            last_seen_unix: now,
        },
    ) {
        eprintln!("falha ao persistir snapshot do pet: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Attributes, Pet};
    use crate::persistence::{init_db, save_snapshot, Snapshot};
    use rusqlite::Connection;

    #[test]
    fn creates_new_pet_when_db_empty() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let pet = load_or_create_pet(&conn, 1_700_000_000);
        assert_eq!(pet.name, "Migo");
        assert_eq!(pet.attributes.energy, 100.0);
    }

    #[test]
    fn applies_offline_decay_on_load() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        let pet = Pet {
            name: "Migo".into(),
            attributes: Attributes { hunger: 0.0, energy: 100.0 },
            mode: crate::domain::PetMode::Awake,
        };
        save_snapshot(&conn, &Snapshot { pet, last_seen_unix: 1_700_000_000 }).unwrap();

        let loaded = load_or_create_pet(&conn, 1_700_000_000 + 3600);
        assert_eq!(loaded.attributes.hunger, 30.0); // 0.5*60
        assert_eq!(loaded.attributes.energy, 82.0); // 100 - 0.3*60
    }
}
