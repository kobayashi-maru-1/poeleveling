// Prevent a console window from appearing on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod store;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // Register the opener plugin so the renderer can open external URLs
        .plugin(tauri_plugin_opener::init())
        // Register all IPC commands the renderer can call via invoke()
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::set_settings,
            commands::collapse_window,
            commands::expand_window,
            commands::close_window,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main")
                .expect("main window not found");

            // Restore saved window position and size.
            // windowBounds values are logical pixels (DPI-independent), matching Electron's units.
            let settings = store::load();
            let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                x: settings.window_bounds.x as f64,
                y: settings.window_bounds.y as f64,
            }));
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: settings.window_bounds.width as f64,
                height: settings.window_bounds.height as f64,
            }));

            // Keep the overlay above all other windows (equivalent to Electron's
            // setAlwaysOnTop(true, "screen-saver") -- works with PoE borderless windowed)
            let _ = window.set_always_on_top(true);

            Ok(())
        })
        .on_window_event(|window, event| {
            // Save window position and size when the user closes the window.
            // Divide physical pixels by scale factor to get logical pixels (Electron's unit).
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Ok(pos) = window.outer_position() {
                    if let Ok(size) = window.outer_size() {
                        let scale = window.scale_factor().unwrap_or(1.0);
                        let mut settings = store::load();
                        settings.window_bounds.x = (pos.x as f64 / scale) as i32;
                        settings.window_bounds.y = (pos.y as f64 / scale) as i32;
                        settings.window_bounds.width = (size.width as f64 / scale) as u32;
                        // Only save height if not in collapsed state (> 100 logical px)
                        if (size.height as f64 / scale) as u32 > 100 {
                            settings.window_bounds.height = (size.height as f64 / scale) as u32;
                        }
                        let _ = store::save(&settings);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
