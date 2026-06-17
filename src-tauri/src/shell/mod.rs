use tauri::WebviewWindow;

/// Posiciona a janela no canto inferior direito, logo acima da taskbar.
/// Em falha de leitura do monitor, não move (mantém a posição padrão).
pub fn position_near_taskbar(window: Option<&WebviewWindow>) {
    let Some(window) = window else { return };
    let Ok(Some(monitor)) = window.current_monitor() else { return };
    let screen = monitor.size();
    let scale = monitor.scale_factor();
    let win = window.outer_size().unwrap_or(tauri::PhysicalSize { width: 220, height: 220 });

    // margem ~48px (altura típica da taskbar) + folga
    let margin = (56.0 * scale) as u32;
    let x = screen.width.saturating_sub(win.width).saturating_sub((8.0 * scale) as u32);
    let y = screen.height.saturating_sub(win.height).saturating_sub(margin);

    let _ = window.set_position(tauri::PhysicalPosition { x: x as i32, y: y as i32 });
}
