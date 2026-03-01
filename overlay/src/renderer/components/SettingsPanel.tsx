import React, { useState } from "react";
import { Characters } from "../data";
import { parsePobCode } from "../pob";
import { reloadRoute, useAppState } from "../state";
import type { Settings } from "../../shared/types";

export function SettingsPanel() {
  const { state, dispatch } = useAppState();
  const [local, setLocal] = useState<Settings>({ ...state.settings });
  const [pobError, setPobError] = useState("");
  const [pobInfo, setPobInfo] = useState(
    state.pobGemIds ? `${state.pobGemIds.size} gems loaded from PoB` : ""
  );

  const characterNames = Object.keys(Characters).sort();

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    if (key === "pobCode") {
      setPobError("");
      setPobInfo("");
    }
  }

  function importPob() {
    const code = local.pobCode.trim();
    if (!code) {
      dispatch({ type: "SET_POB", pobGemIds: null });
      setPobError("");
      setPobInfo("PoB filter cleared");
      return;
    }

    const result = parsePobCode(code);
    if ("error" in result) {
      setPobError(result.error);
      setPobInfo("");
      return;
    }

    // Auto-fill class and bandit from PoB data
    const newLocal = {
      ...local,
      characterClass: result.characterClass || local.characterClass,
      bandit: result.bandit,
    };
    setLocal(newLocal);

    dispatch({ type: "SET_POB", pobGemIds: new Set(result.gemIds) });
    setPobError("");
    setPobInfo(
      `✓ ${result.gemIds.length} gems from PoB` +
        (result.characterClass ? ` · ${result.characterClass}` : "")
    );
  }

  async function applySettings() {
    await window.electronAPI.setSettings(local);
    dispatch({ type: "SET_SETTINGS", settings: local });

    // Restart watcher with new path if changed
    if (local.clientTxtPath !== state.settings.clientTxtPath) {
      await window.electronAPI.stopWatcher();
      if (local.clientTxtPath) {
        await window.electronAPI.startWatcher(local.clientTxtPath);
      }
    }

    // Reload route if build config changed
    const needsReload =
      local.leagueStart !== state.settings.leagueStart ||
      local.library !== state.settings.library ||
      local.bandit !== state.settings.bandit ||
      local.characterClass !== state.settings.characterClass;

    if (needsReload) {
      await reloadRoute(dispatch, local);
    }

    dispatch({ type: "TOGGLE_SETTINGS" });
  }

  async function pickFile() {
    const path = await window.electronAPI.openFilePicker();
    if (path) update("clientTxtPath", path);
  }

  return (
    <div className="settings-panel">
      {/* ── Path of Building ── */}
      <div className="settings-row">
        <label className="settings-label">
          Path of Building code
          {pobInfo && (
            <span style={{ color: "#7cbf7c", marginLeft: 6, fontWeight: 400 }}>
              {pobInfo}
            </span>
          )}
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <textarea
            className="settings-input"
            rows={2}
            value={local.pobCode}
            onChange={(e) => update("pobCode", e.target.value)}
            placeholder="Paste your PoB export code here…"
            style={{ flex: 1, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 10 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button className="settings-btn" onClick={importPob}>
              Import
            </button>
            {(state.pobGemIds !== null || local.pobCode !== "") && (
              <button
                className="settings-btn settings-reset-btn"
                onClick={() => {
                  update("pobCode", "");
                  dispatch({ type: "SET_POB", pobGemIds: null });
                  setPobInfo("");
                  setPobError("");
                  window.electronAPI.setSettings({ ...local, pobCode: "" });
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {pobError && (
          <span style={{ fontSize: 11, color: "#e05555" }}>{pobError}</span>
        )}
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
          In PoB: Import/Export Build → Export → copy the code
        </span>
      </div>

      {/* ── client.txt path ── */}
      <div className="settings-row">
        <label className="settings-label">Client.txt path</label>
        <div className="settings-file-row">
          <input
            className="settings-input"
            value={local.clientTxtPath}
            onChange={(e) => update("clientTxtPath", e.target.value)}
            placeholder="C:\...\logs\Client.txt"
          />
          <button className="settings-btn" onClick={pickFile}>
            Browse
          </button>
        </div>
      </div>

      {/* ── Character class ── */}
      <div className="settings-row">
        <label className="settings-label">Character class</label>
        <select
          className="settings-input"
          value={local.characterClass}
          onChange={(e) => update("characterClass", e.target.value)}
        >
          <option value="">— Select class —</option>
          {characterNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Bandit ── */}
      <div className="settings-row">
        <label className="settings-label">Bandit quest</label>
        <select
          className="settings-input"
          value={local.bandit}
          onChange={(e) =>
            update("bandit", e.target.value as Settings["bandit"])
          }
        >
          <option value="None">Kill all (recommended)</option>
          <option value="Oak">Help Oak</option>
          <option value="Kraityn">Help Kraityn</option>
          <option value="Alira">Help Alira</option>
        </select>
      </div>

      {/* ── Checkboxes ── */}
      <div className="settings-row-inline">
        <input
          type="checkbox"
          id="leagueStart"
          className="settings-checkbox"
          checked={local.leagueStart}
          onChange={(e) => update("leagueStart", e.target.checked)}
        />
        <label className="settings-label" htmlFor="leagueStart">
          League start route
        </label>
      </div>

      <div className="settings-row-inline">
        <input
          type="checkbox"
          id="library"
          className="settings-checkbox"
          checked={local.library}
          onChange={(e) => update("library", e.target.checked)}
        />
        <label className="settings-label" htmlFor="library">
          Library route
        </label>
      </div>

      {/* ── Opacity ── */}
      <div className="settings-row">
        <label className="settings-label">
          Opacity: {Math.round(local.opacity * 100)}%
        </label>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={local.opacity}
          onChange={(e) => update("opacity", parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>

      {/* ── Apply ── */}
      <button
        className="settings-btn settings-apply-btn"
        onClick={applySettings}
        style={{ width: "100%", padding: "6px" }}
      >
        Apply Settings
      </button>

      {/* ── Reset progress ── */}
      <button
        className="settings-btn settings-reset-btn"
        onClick={() => dispatch({ type: "RESET_PROGRESS" })}
        style={{ width: "100%", padding: "5px", marginTop: 6 }}
      >
        ↺ Reset Progress
      </button>
    </div>
  );
}
