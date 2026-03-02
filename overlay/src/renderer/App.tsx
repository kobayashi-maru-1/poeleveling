import React from "react";
import { GemLinksPanel } from "./components/GemLinksPanel";
import { GemPanel } from "./components/GemPanel";
import { OverlayHeader } from "./components/OverlayHeader";
import { SettingsPanel } from "./components/SettingsPanel";
import { StepDisplay } from "./components/StepDisplay";
import { TreePanel } from "./components/TreePanel";
import { useAppState } from "./state";

export function App() {
  const { state } = useAppState();

  return (
    <div className={`overlay${state.collapsed ? " collapsed" : ""}`}>
      <OverlayHeader />

      {!state.collapsed && (
        state.loading ? (
          <div className="loading-msg">Loading route…</div>
        ) : (
          <>
            {/* Thin progress bar */}
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width:
                    state.flatSteps.length > 0
                      ? `${((state.currentIndex + 1) / state.flatSteps.length) * 100}%`
                      : "0%",
                }}
              />
            </div>

            {/* Main step display */}
            <StepDisplay />

            {/* Navigation */}
            <NavFooter />

            {/* Collapsible gem panel */}
            {state.showGems && <GemPanel />}

            {/* Collapsible gem links panel */}
            {state.showLinks && <GemLinksPanel />}

            {/* Collapsible passive tree panel */}
            {state.showTree && <TreePanel />}

            {/* Settings panel */}
            {state.showSettings && <SettingsPanel />}
          </>
        )
      )}
    </div>
  );
}

function NavFooter() {
  const { state, dispatch } = useAppState();
  const total = state.flatSteps.length;
  const cur = state.currentIndex;

  return (
    <div className="nav-footer">
      <button
        className="nav-btn"
        onClick={() => dispatch({ type: "RETREAT" })}
        disabled={cur === 0}
      >
        ◀ Back
      </button>
      <span className="step-counter">
        {cur + 1} / {total}
      </span>
      <button
        className="nav-btn"
        onClick={() => dispatch({ type: "ADVANCE" })}
        disabled={cur >= total - 1}
      >
        Next ▶
      </button>
    </div>
  );
}
