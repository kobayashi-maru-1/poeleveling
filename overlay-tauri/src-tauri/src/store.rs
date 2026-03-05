use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

// Settings that mirror the Electron version's electron-store fields.
// serde rename attributes match the camelCase keys the React frontend expects.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub opacity: f64,
    #[serde(rename = "characterClass")]
    pub character_class: String,
    pub bandit: String,
    #[serde(rename = "leagueStart")]
    pub league_start: bool,
    pub library: bool,
    #[serde(rename = "pobCode")]
    pub pob_code: String,
    // Saved window height so we can restore it after collapsing.
    // Not exposed to the renderer; used internally by Rust commands.
    #[serde(rename = "windowHeight", default = "default_window_height")]
    pub window_height: u32,
    // Saved window position
    #[serde(rename = "windowX", default)]
    pub window_x: i32,
    #[serde(rename = "windowY", default)]
    pub window_y: i32,
    #[serde(rename = "windowWidth", default = "default_window_width")]
    pub window_width: u32,
}

fn default_window_height() -> u32 { 600 }
fn default_window_width() -> u32 { 380 }

impl Default for Settings {
    fn default() -> Self {
        Settings {
            opacity: 0.92,
            character_class: String::new(),
            bandit: "None".to_string(),
            league_start: false,
            library: false,
            pob_code: String::new(),
            window_height: default_window_height(),
            window_x: 100,
            window_y: 100,
            window_width: default_window_width(),
        }
    }
}

/// Returns the path to the settings JSON file in the OS app-data folder.
/// On Windows this is: C:\Users\<user>\AppData\Roaming\com.poeleveling.overlay-tauri\settings.json
pub fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Could not resolve app data directory")
        .join("settings.json")
}

/// Load settings from disk, falling back to defaults if the file doesn't exist or is corrupt.
pub fn load(app: &tauri::AppHandle) -> Settings {
    let path = settings_path(app);
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(s) = serde_json::from_str::<Settings>(&data) {
            return s;
        }
    }
    Settings::default()
}

/// Persist settings to disk.
pub fn save(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app);
    // Ensure the directory exists before writing
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
