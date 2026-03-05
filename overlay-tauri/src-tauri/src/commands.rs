use crate::store;
use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::{command, AppHandle, Manager, WebviewWindow};

// ─── Route files ─────────────────────────────────────────────────────────────

/// Read all 10 act route files and return them as an array of strings.
/// Matches the "get-route-sources" IPC handler in the Electron main process.
#[command]
pub fn get_route_sources(app: AppHandle) -> Result<Vec<String>, String> {
    let routes_dir = get_data_dir(&app)?.join("routes");
    let mut sources = Vec::new();

    for act in 1..=10 {
        let path = routes_dir.join(format!("act-{}.txt", act));
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read act-{}.txt: {}", act, e))?;
        sources.push(content);
    }

    Ok(sources)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/// Return the current settings to the renderer.
#[command]
pub fn get_settings(app: AppHandle) -> store::Settings {
    store::load(&app)
}

/// Merge a partial settings object (only the keys the renderer sends) into
/// the saved settings, then persist to disk.
/// The renderer sends Partial<Settings>, so each field may or may not be present.
#[command]
pub fn set_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let mut current = store::load(&app);

    if let Some(v) = settings.get("opacity").and_then(Value::as_f64) {
        current.opacity = v;
    }
    if let Some(v) = settings.get("characterClass").and_then(Value::as_str) {
        current.character_class = v.to_string();
    }
    if let Some(v) = settings.get("bandit").and_then(Value::as_str) {
        current.bandit = v.to_string();
    }
    if let Some(v) = settings.get("leagueStart").and_then(Value::as_bool) {
        current.league_start = v;
    }
    if let Some(v) = settings.get("library").and_then(Value::as_bool) {
        current.library = v;
    }
    if let Some(v) = settings.get("pobCode").and_then(Value::as_str) {
        current.pob_code = v.to_string();
    }

    store::save(&app, &current)
}

// ─── Window management ────────────────────────────────────────────────────────

/// Collapse the overlay to show only the header bar (36 logical px tall).
/// Saves the current height first so expand_window can restore it.
#[command]
pub fn collapse_window(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let mut settings = store::load(&app);
    let physical = window.outer_size().map_err(|e| e.to_string())?;
    settings.window_height = physical.height;
    store::save(&app, &settings)?;

    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: physical.width as f64 / scale,
            height: 36.0,
        }))
        .map_err(|e| e.to_string())
}

/// Close the overlay window. Called from the renderer's close button.
/// Using a Rust command avoids the need for JS window-close capabilities.
#[command]
pub fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Restore the overlay to its previous full height (saved by collapse_window).
#[command]
pub fn expand_window(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let settings = store::load(&app);
    let current_size = window.outer_size().map_err(|e| e.to_string())?;

    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: current_size.width,
            height: settings.window_height,
        }))
        .map_err(|e| e.to_string())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Resolve the common/data directory that contains routes and JSON data.
/// - In dev builds: uses CARGO_MANIFEST_DIR (embedded at compile time) to find
///   the workspace root, then resolves common/data from there.
/// - In release builds: expects data to be bundled alongside the binary.
fn get_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let _ = app; // not needed in dev builds
        let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let workspace_root = manifest
            .parent() // overlay-tauri/
            .and_then(|p| p.parent()) // poeleveling-Github/
            .ok_or("Could not resolve workspace root from CARGO_MANIFEST_DIR")?;
        Ok(workspace_root.join("common").join("data"))
    }

    #[cfg(not(debug_assertions))]
    {
        // In production the route files are bundled as a resource named "common-data".
        // See tauri.conf.json bundle.resources for where they're copied from.
        app.path()
            .resource_dir()
            .map(|p: std::path::PathBuf| p.join("common-data"))
            .map_err(|e: tauri::Error| e.to_string())
    }
}
