import type { OverlayAPI } from "./index";

// Type declaration for the object the Electron preload script exposes on window.
declare global {
  interface Window {
    electronAPI: OverlayAPI;
  }
}

// The Electron preload sets window.electronAPI before any renderer JS runs,
// so it's safe to reference it here at module evaluation time.
export const electronAPI: OverlayAPI = {
  getSettings: () => window.electronAPI.getSettings(),
  setSettings: (s) => window.electronAPI.setSettings(s),
  collapseWindow: () => window.electronAPI.collapseWindow(),
  expandWindow: () => window.electronAPI.expandWindow(),
  minimizeWindow: () => window.electronAPI.minimizeWindow(),
  closeWindow: () => window.electronAPI.closeWindow(),
  openExternal: (url) => window.electronAPI.openExternal(url),
};
