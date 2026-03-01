import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import Store from "electron-store";
import * as fs from "fs";
import * as path from "path";
import { LogWatcher } from "./log-watcher";

// Must be set before app is ready so userData resolves to %APPDATA%\poeleveling
app.setName("poeleveling");

// Persistent settings store
const store = new Store<Settings>({
  defaults: {
    clientTxtPath: "",
    opacity: 0.92,
    characterClass: "",
    bandit: "None",
    leagueStart: false,
    library: false,
    pobCode: "",
    windowBounds: { x: 50, y: 50, width: 360, height: 480 },
  },
});

interface Settings {
  clientTxtPath: string;
  opacity: number;
  characterClass: string;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  leagueStart: boolean;
  library: boolean;
  pobCode: string;
  windowBounds: { x: number; y: number; width: number; height: number };
}

const HEADER_HEIGHT = 34; // px — collapsed window shows only the title bar

let mainWindow: BrowserWindow | null = null;
let logWatcher: LogWatcher | null = null;
let expandedHeight: number | null = null; // saved before collapsing

// Resolve path to common/data directory (dev vs packaged)
function getCommonDataPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "common-data");
  }
  // In dev: __dirname is overlay/out/main/, go up 3 levels to monorepo root
  return path.join(__dirname, "../../../common/data");
}

function createWindow(): void {
  const bounds = store.get("windowBounds");

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    minWidth: 280,
    minHeight: 200,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Highest z-order: stays above fullscreen apps in borderless windowed mode
  mainWindow.setAlwaysOnTop(true, "screen-saver");

  // Load the renderer
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Save window position/size on close (skip if collapsed)
  mainWindow.on("close", () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    const [width, height] = mainWindow.getSize();
    if (height > HEADER_HEIGHT + 20) {
      store.set("windowBounds", { x, y, width, height });
    } else {
      // Collapsed — save position but keep the last expanded height
      const bounds = store.get("windowBounds");
      store.set("windowBounds", { ...bounds, x, y });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle("get-route-sources", () => {
  const routesDir = path.join(getCommonDataPath(), "routes");
  const actFiles = [
    "act-1.txt",
    "act-2.txt",
    "act-3.txt",
    "act-4.txt",
    "act-5.txt",
    "act-6.txt",
    "act-7.txt",
    "act-8.txt",
    "act-9.txt",
    "act-10.txt",
  ];

  return actFiles.map((filename) => {
    const filePath = path.join(routesDir, filename);
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      console.error(`Failed to read route file: ${filePath}`);
      return "";
    }
  });
});

ipcMain.handle("get-settings", () => {
  return {
    clientTxtPath: store.get("clientTxtPath"),
    opacity: store.get("opacity"),
    characterClass: store.get("characterClass"),
    bandit: store.get("bandit"),
    leagueStart: store.get("leagueStart"),
    library: store.get("library"),
    pobCode: store.get("pobCode"),
  };
});

ipcMain.handle("set-settings", (_event, settings: Partial<Settings>) => {
  for (const [key, value] of Object.entries(settings)) {
    store.set(key as keyof Settings, value as never);
  }
  // Update window opacity
  if (settings.opacity !== undefined && mainWindow) {
    mainWindow.setOpacity(settings.opacity);
  }
});

ipcMain.handle("open-file-picker", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select PoE Client.txt",
    filters: [{ name: "Text Files", extensions: ["txt"] }],
    properties: ["openFile"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("start-watcher", (_event, clientTxtPath: string) => {
  if (logWatcher) {
    logWatcher.stop();
  }
  logWatcher = new LogWatcher(clientTxtPath, (zoneName) => {
    mainWindow?.webContents.send("zone-entered", zoneName);
  });
  logWatcher.start();
});

ipcMain.handle("stop-watcher", () => {
  logWatcher?.stop();
  logWatcher = null;
});

ipcMain.handle("collapse-window", () => {
  if (!mainWindow) return;
  const [width, height] = mainWindow.getSize();
  expandedHeight = height;
  mainWindow.setMinimumSize(280, HEADER_HEIGHT);
  mainWindow.setSize(width, HEADER_HEIGHT, false);
});

ipcMain.handle("expand-window", () => {
  if (!mainWindow) return;
  const [width] = mainWindow.getSize();
  const restoreHeight = expandedHeight ?? store.get("windowBounds").height;
  mainWindow.setMinimumSize(280, 200);
  mainWindow.setSize(width, restoreHeight, false);
  expandedHeight = null;
});

ipcMain.on("minimize-window", () => mainWindow?.minimize());
ipcMain.on("close-window", () => mainWindow?.close());

ipcMain.handle("open-external", (_event, url: string) => {
  shell.openExternal(url);
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  // Auto-start log watcher if path is saved
  const savedPath = store.get("clientTxtPath");
  if (savedPath && fs.existsSync(savedPath)) {
    logWatcher = new LogWatcher(savedPath, (zoneName) => {
      mainWindow?.webContents.send("zone-entered", zoneName);
    });
    logWatcher.start();
  }
});

app.on("window-all-closed", () => {
  logWatcher?.stop();
  app.quit();
});
