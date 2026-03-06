import React, { useState } from "react";
import { Characters } from "../data";
import { parsePobCode } from "../pob";
import { reloadRoute, useAppState } from "../state";
import type { Settings } from "../../shared/types";
import { useAPI } from "../api/index";

export function SettingsPanel() {
  const { state, dispatch } = useAppState();
  const api = useAPI();
  const [local, setLocal] = useState<Settings>({ ...state.settings });
  const [pobError, setPobError] = useState("");
  const [pobInfo, setPobInfo] = useState(
    state.pobGemIds ? `${state.pobGemIds.size} gems loaded from PoB` : ""
  );

  const characterNames = Object.keys(Characters).sort();

  // Save a new settings object immediately, update local + global state,
  // and reload the route if any route-affecting field changed.
  async function saveSettings(next: Settings) {
    setLocal(next);
    await api.setSettings(next);
    dispatch({ type: "SET_SETTINGS", settings: next });

    const routeChanged =
      next.leagueStart !== state.settings.leagueStart ||
      next.library !== state.settings.library ||
      next.bandit !== state.settings.bandit ||
      next.characterClass !== state.settings.characterClass;

    if (routeChanged) {
      await reloadRoute(dispatch, next);
    }
  }

  async function importPob() {
    const code = local.pobCode.trim();
    if (!code) {
      dispatch({ type: "SET_POB", pobGemIds: null, buildTrees: null, gemLinkSets: null });
      await saveSettings({ ...local, pobCode: "" });
      setPobError("");
      setPobInfo("PoB filter cleared");
      return;
    }

    const result = parsePobCode(code);
    if ("error" in result) {
      setPobError(result.error ?? "");
      setPobInfo("");
      return;
    }

    await saveSettings({
      ...local,
      characterClass: result.characterClass || local.characterClass,
      bandit: result.bandit,
    });
    dispatch({ type: "SET_POB", pobGemIds: new Set(result.gemIds), buildTrees: result.buildTrees, gemLinkSets: result.gemLinkSets });
    setPobError("");
    setPobInfo(
      `✓ ${result.gemIds.length} gems` +
        (result.buildTrees.length ? ` · ${result.buildTrees.length} tree${result.buildTrees.length > 1 ? "s" : ""}` : "") +
        (result.characterClass ? ` · ${result.characterClass}` : "")
    );
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
            onChange={(e) => {
              setLocal((prev) => ({ ...prev, pobCode: e.target.value }));
              setPobError("");
              setPobInfo("");
            }}
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
                  dispatch({ type: "SET_POB", pobGemIds: null, buildTrees: null, gemLinkSets: null });
                  setPobInfo("");
                  setPobError("");
                  void saveSettings({ ...local, pobCode: "" });
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

      {/* ── Character class ── */}
      <div className="settings-row">
        <label className="settings-label">Character class</label>
        <select
          className="settings-input"
          value={local.characterClass}
          onChange={(e) => void saveSettings({ ...local, characterClass: e.target.value })}
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
          onChange={(e) => void saveSettings({ ...local, bandit: e.target.value as Settings["bandit"] })}
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
          onChange={(e) => void saveSettings({ ...local, leagueStart: e.target.checked })}
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
          onChange={(e) => void saveSettings({ ...local, library: e.target.checked })}
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
          onChange={(e) => void saveSettings({ ...local, opacity: parseFloat(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>

      {/* ── Reset progress ── */}
      <button
        className="settings-btn settings-reset-btn"
        onClick={() => dispatch({ type: "RESET_PROGRESS" })}
        style={{ width: "100%", padding: "5px" }}
      >
        ↺ Reset Progress
      </button>
    </div>
  );
}
