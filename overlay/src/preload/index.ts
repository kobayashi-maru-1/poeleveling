import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI, Settings } from "../shared/types";

const api: ElectronAPI = {
  getRouteSources: () => ipcRenderer.invoke("get-route-sources"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setSettings: (s) => ipcRenderer.invoke("set-settings", s),
  collapseWindow: () => ipcRenderer.invoke("collapse-window"),
  expandWindow: () => ipcRenderer.invoke("expand-window"),
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type { Settings, ElectronAPI };
