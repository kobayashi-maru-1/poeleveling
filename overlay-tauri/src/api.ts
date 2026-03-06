import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { OverlayAPI } from "@renderer/api/index";
import type { Settings } from "@shared/types";

// Tauri implementation of OverlayAPI.
// Each method maps to either a Rust command (via invoke) or a Tauri JS API.
export const tauriAPI: OverlayAPI = {
  // Returns persisted settings (stored in the OS app-data folder).
  getSettings: () => invoke<Settings>("get_settings"),

  // Sends a partial settings update to be merged and saved by Rust.
  setSettings: (settings) => invoke("set_settings", { settings }),

  // Resizes the window down to just the header bar.
  collapseWindow: () => invoke("collapse_window"),

  // Restores the window to its previous full height.
  expandWindow: () => invoke("expand_window"),

  // Minimizes the window to the taskbar.
  minimizeWindow: () => { getCurrentWindow().minimize().catch(console.error); },

  // Closes the application via a Rust command (avoids JS window-close permission).
  closeWindow: () => { invoke("close_window").catch(console.error); },

  // Opens a URL in the system default browser via the opener plugin.
  openExternal: (url) => openUrl(url),
};
