// Shared types between preload and renderer — no Electron/Node imports here

export type Bandit = "None" | "Oak" | "Kraityn" | "Alira";

export interface Settings {
  opacity: number;
  characterClass: string;
  bandit: Bandit;
  leagueStart: boolean;
  library: boolean;
  pobCode: string; // Path of Building export code (persisted, decoded on load)
}

export interface ElectronAPI {
  getSettings(): Promise<Settings>;
  setSettings(settings: Partial<Settings>): Promise<void>;
  collapseWindow(): Promise<void>;
  expandWindow(): Promise<void>;
  minimizeWindow(): void;
  closeWindow(): void;
  openExternal(url: string): Promise<void>;
}
