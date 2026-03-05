import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point @renderer/* at the shared Electron renderer source.
      // Any file edited there is automatically used by both apps.
      "@renderer": resolve(__dirname, "../overlay/src/renderer"),
      "@shared": resolve(__dirname, "../overlay/src/shared"),
      "@common": resolve(__dirname, "../common"),
    },
  },
  // Tauri expects the Vite dev server on port 1420
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    // Tauri uses Chromium 105+ on Windows 10/11
    target: "chrome105",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
