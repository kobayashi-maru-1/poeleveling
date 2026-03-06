use crate::store;
use serde_json::Value;
use tauri::{command, AppHandle, WebviewWindow};

// --- Settings ----------------------------------------------------------------

/// Return the current settings to the renderer.
#[command]
pub fn get_settings(_app: AppHandle) -> store::Settings {
    store::load()
}

/// Merge a partial settings object (only the keys the renderer sends) into
/// the saved settings, then persist to disk.
/// The renderer sends Partial<Settings>, so each field may or may not be present.
#[command]
pub fn set_settings(_app: AppHandle, settings: Value) -> Result<(), String> {
    let mut current = store::load();

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

    store::save(&current)
}

// --- Window management -------------------------------------------------------

/// Collapse the overlay to show only the header bar (36 logical px tall).
/// Saves the current height first (in logical px) so expand_window can restore it.
#[command]
pub fn collapse_window(_app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let physical = window.outer_size().map_err(|e| e.to_string())?;

    // Save current height as logical pixels to match Electron's stored units
    let mut settings = store::load();
    settings.window_bounds.height = (physical.height as f64 / scale) as u32;
    store::save(&settings)?;

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: physical.width as f64 / scale,
            height: 36.0,
        }))
        .map_err(|e| e.to_string())
}

/// Close the overlay window. Called from the renderer's close button.
#[command]
pub fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Restore the overlay to its previous full height (saved by collapse_window).
#[command]
pub fn expand_window(_app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let settings = store::load();
    let physical_width = window.outer_size().map_err(|e| e.to_string())?.width;

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: physical_width as f64 / scale,
            // window_bounds.height is stored in logical px
            height: settings.window_bounds.height as f64,
        }))
        .map_err(|e| e.to_string())
}
