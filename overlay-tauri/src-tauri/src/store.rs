use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

// Settings that mirror the Electron version's electron-store schema exactly,
// so both apps read/write the same file: %APPDATA%poelevelingconfig.json.
// serde rename attributes match the camelCase keys the React frontend expects.

/// Window position and size -- stored as a nested object to match Electron's schema.
/// Not exposed to the renderer; used internally by Rust commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn default_window_bounds() -> WindowBounds {
    WindowBounds { x: 100, y: 100, width: 380, height: 600 }
}

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
    #[serde(rename = "windowBounds", default = "default_window_bounds")]
    pub window_bounds: WindowBounds,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            opacity: 0.92,
            character_class: String::new(),
            bandit: "None".to_string(),
            league_start: false,
            library: false,
            pob_code: String::new(),
            window_bounds: default_window_bounds(),
        }
    }
}

/// Returns the shared settings path: %APPDATA%poelevelingconfig.json
/// This is the same location Electron uses (electron-store + app.setName("poeleveling")),
/// so both apps share a single settings file.
pub fn settings_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").expect("APPDATA env var not set");
    PathBuf::from(appdata).join("poeleveling").join("config.json")
}

/// Load settings from disk, falling back to defaults if the file doesn't exist or is corrupt.
pub fn load() -> Settings {
    let path = settings_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(s) = serde_json::from_str::<Settings>(&data) {
            return s;
        }
    }
    Settings::default()
}

/// Persist settings to disk.
pub fn save(settings: &Settings) -> Result<(), String> {
    let path = settings_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
