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
            commands::get_route_sources,
            commands::get_settings,
            commands::set_settings,
            commands::collapse_window,
            commands::expand_window,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main")
                .expect("main window not found");

            // Restore saved window position and size
            let settings = store::load(app.handle());
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: settings.window_x,
                y: settings.window_y,
            }));
            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: settings.window_width,
                height: settings.window_height,
            }));

            // Keep the overlay above all other windows (equivalent to Electron's
            // setAlwaysOnTop(true, "screen-saver") — works with PoE borderless windowed)
            let _ = window.set_always_on_top(true);

            Ok(())
        })
        .on_window_event(|window, event| {
            // Save window position and size when the user closes or moves the window
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Ok(pos) = window.outer_position() {
                    if let Ok(size) = window.outer_size() {
                        let mut settings = store::load(window.app_handle());
                        settings.window_x = pos.x;
                        settings.window_y = pos.y;
                        settings.window_width = size.width;
                        // Only save height if not in collapsed state (> 100px)
                        if size.height > 100 {
                            settings.window_height = size.height;
                        }
                        let _ = store::save(window.app_handle(), &settings);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
