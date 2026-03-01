import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI, Settings } from "../shared/types";

const api: ElectronAPI = {
  getRouteSources: () => ipcRenderer.invoke("get-route-sources"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setSettings: (s) => ipcRenderer.invoke("set-settings", s),
  openFilePicker: () => ipcRenderer.invoke("open-file-picker"),
  startWatcher: (p) => ipcRenderer.invoke("start-watcher", p),
  stopWatcher: () => ipcRenderer.invoke("stop-watcher"),
  onZoneEntered: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, zoneName: string) =>
      callback(zoneName);
    ipcRenderer.on("zone-entered", listener);
    return () => ipcRenderer.removeListener("zone-entered", listener);
  },
  collapseWindow: () => ipcRenderer.invoke("collapse-window"),
  expandWindow: () => ipcRenderer.invoke("expand-window"),
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type { Settings, ElectronAPI };
