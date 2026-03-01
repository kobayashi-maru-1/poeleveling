import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./AppProvider";
import "./overlay.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
