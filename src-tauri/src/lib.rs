mod domain;
mod persistence;
mod services;
mod simulation;

use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("app_data_dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("minimigo.db");
            // Tenta abrir e inicializar o banco em disco; se qualquer etapa falhar
            // (arquivo corrompido/bloqueado), cai para um banco em memória para que o
            // app ainda inicie (a sessão simplesmente não persiste).
            let open_disk = || -> rusqlite::Result<rusqlite::Connection> {
                let c = rusqlite::Connection::open(&db_path)?;
                persistence::init_db(&c)?;
                Ok(c)
            };
            let conn = open_disk().unwrap_or_else(|e| {
                eprintln!("falha ao abrir/inicializar {db_path:?} ({e}); usando banco em memória");
                let c = rusqlite::Connection::open_in_memory().expect("abrir SQLite em memória");
                persistence::init_db(&c).expect("init_db em memória");
                c
            });

            let pet = services::load_or_create_pet(&conn, services::now_unix());
            app.manage(services::AppState {
                conn: Mutex::new(conn),
                pet: Mutex::new(pet),
            });

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_persist = services::now_unix();
                loop {
                    std::thread::sleep(Duration::from_secs(5));
                    let state = handle.state::<services::AppState>();
                    {
                        let mut pet = state.pet.lock().unwrap();
                        simulation::tick(&mut pet, 5.0 / 60.0);
                        let snapshot = services::PetState::from(&*pet);
                        let _ = handle.emit("pet-updated", snapshot);
                    }
                    let now = services::now_unix();
                    if now - last_persist >= 30 {
                        services::persist(&state, now);
                        last_persist = now;
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<services::AppState>();
                services::persist(&state, services::now_unix());
            }
        })
        .invoke_handler(tauri::generate_handler![greet, services::get_pet_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
