import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./AppProvider";
import { APIProvider } from "./api/index";
import { electronAPI } from "./api/electron";
import "./overlay.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <APIProvider api={electronAPI}>
      <AppProvider>
        <App />
      </AppProvider>
    </APIProvider>
  </React.StrictMode>
);
