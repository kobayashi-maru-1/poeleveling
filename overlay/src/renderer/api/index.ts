import React, { createContext, useContext } from "react";
// Note: this file is .ts (not .tsx) so JSX is intentionally avoided.
import type { Settings } from "../../shared/types";

// Platform-agnostic API — implemented by both Electron and Tauri adapters.
// The renderer only calls this interface; it never imports Electron or Tauri directly.
export interface OverlayAPI {
  getRouteSources(): Promise<string[]>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Partial<Settings>): Promise<void>;
  collapseWindow(): Promise<void>;
  expandWindow(): Promise<void>;
  minimizeWindow(): void;
  closeWindow(): void;
  openExternal(url: string): Promise<void>;
}

const APIContext = createContext<OverlayAPI | null>(null);

export function APIProvider({
  api,
  children,
}: {
  api: OverlayAPI;
  children: React.ReactNode;
}) {
  return React.createElement(APIContext.Provider, { value: api }, children);
}

export function useAPI(): OverlayAPI {
  const api = useContext(APIContext);
  if (!api) throw new Error("useAPI must be used inside <APIProvider>");
  return api;
}
