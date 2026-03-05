import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "@renderer/App";
import { AppProvider } from "@renderer/AppProvider";
import { APIProvider } from "@renderer/api/index";
import { tauriAPI } from "./api";
import "@renderer/overlay.css";

// Inject the Tauri API implementation so all shared renderer components
// can call useAPI() and get Tauri's invoke-based implementation.
const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <APIProvider api={tauriAPI}>
      <AppProvider>
        <App />
      </AppProvider>
    </APIProvider>
  </React.StrictMode>
);
