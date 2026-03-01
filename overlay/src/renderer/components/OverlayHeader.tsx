import React from "react";
import { useAppState } from "../state";

export function OverlayHeader() {
  const { state, dispatch } = useAppState();
  const cur = state.flatSteps[state.currentIndex];
  const title = cur
    ? `${cur.sectionName}`
    : "PoE Leveling";

  return (
    <div className="header">
      <span className="header-title">⚔ {title}</span>

      {/* Gem toggle */}
      <button
        className={`header-btn${state.showGems ? " active" : ""}`}
        title="Toggle gem tracker"
        onClick={() => dispatch({ type: "TOGGLE_GEMS" })}
      >
        💎
      </button>

      {/* Settings toggle */}
      <button
        className={`header-btn${state.showSettings ? " active" : ""}`}
        title="Settings"
        onClick={() => dispatch({ type: "TOGGLE_SETTINGS" })}
      >
        ⚙
      </button>

      {/* Collapse / expand */}
      <button
        className="header-btn"
        title={state.collapsed ? "Expand" : "Collapse"}
        onClick={() => {
          if (state.collapsed) {
            dispatch({ type: "TOGGLE_COLLAPSE" });
            window.electronAPI.expandWindow();
          } else {
            dispatch({ type: "TOGGLE_COLLAPSE" });
            window.electronAPI.collapseWindow();
          }
        }}
      >
        {state.collapsed ? "▲" : "—"}
      </button>

      {/* Close */}
      <button
        className="header-btn close"
        title="Close"
        onClick={() => window.electronAPI.closeWindow()}
      >
        ✕
      </button>
    </div>
  );
}
