use crate::domain::Pet;
use rusqlite::Connection;

/// Snapshot persistido: o pet (JSON) + o timestamp Unix (segundos) do último save.
pub struct Snapshot {
    pub pet: Pet,
    pub last_seen_unix: i64,
}

pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pet_snapshot (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            pet_json TEXT NOT NULL,
            last_seen_unix INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

pub fn save_snapshot(conn: &Connection, snap: &Snapshot) -> rusqlite::Result<()> {
    let pet_json = serde_json::to_string(&snap.pet)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO pet_snapshot (id, pet_json, last_seen_unix) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET pet_json = ?1, last_seen_unix = ?2",
        rusqlite::params![pet_json, snap.last_seen_unix],
    )?;
    Ok(())
}

pub fn load_snapshot(conn: &Connection) -> rusqlite::Result<Option<Snapshot>> {
    let mut stmt = conn.prepare("SELECT pet_json, last_seen_unix FROM pet_snapshot WHERE id = 1")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let pet_json: String = row.get(0)?;
        let last_seen_unix: i64 = row.get(1)?;
        let pet: Pet = serde_json::from_str(&pet_json)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e)))?;
        Ok(Some(Snapshot { pet, last_seen_unix }))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Attributes, Pet};
    use rusqlite::Connection;

    #[test]
    fn save_then_load_round_trip() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let pet = Pet { name: "Migo".into(), attributes: Attributes { hunger: 42.0, energy: 7.0 } };
        let snap = Snapshot { pet: pet.clone(), last_seen_unix: 1_700_000_000 };
        save_snapshot(&conn, &snap).unwrap();

        let loaded = load_snapshot(&conn).unwrap().expect("snapshot deve existir");
        assert_eq!(loaded.pet, pet);
        assert_eq!(loaded.last_seen_unix, 1_700_000_000);
    }

    #[test]
    fn load_returns_none_when_empty() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        assert!(load_snapshot(&conn).unwrap().is_none());
    }
}
