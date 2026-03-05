import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../state";
import { useAPI } from "../api/index";

export function OverlayHeader() {
  const { state, dispatch } = useAppState();
  const api = useAPI();
  const cur = state.flatSteps[state.currentIndex];
  const title = cur ? cur.sectionName : "PoE Leveling";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // First step index for each unique section
  const acts = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; firstIndex: number }[] = [];
    state.flatSteps.forEach((step, i) => {
      if (!seen.has(step.sectionName)) {
        seen.add(step.sectionName);
        result.push({ name: step.sectionName, firstIndex: i });
      }
    });
    return result;
  }, [state.flatSteps]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="header">
      {/* Title / act-jump dropdown */}
      <div className="act-dropdown-wrap" ref={wrapRef}>
        <button
          className="header-title"
          onClick={() => setOpen((o) => !o)}
          title="Jump to act"
        >
          ⚔ {title}
          {acts.length > 0 && <span className="act-chevron">{open ? "▴" : "▾"}</span>}
        </button>

        {open && (
          <div className="act-dropdown">
            {acts.map(({ name, firstIndex }) => (
              <button
                key={name}
                className={`act-dropdown-item${cur?.sectionName === name ? " active" : ""}`}
                onClick={() => {
                  dispatch({ type: "SET_INDEX", index: firstIndex });
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Draggable spacer fills the remaining header width */}
      <div style={{ flex: 1 }} />

      {/* Gem toggle */}
      <button
        className={`header-btn${state.showGems ? " active" : ""}`}
        title="Toggle gem tracker"
        onClick={() => dispatch({ type: "TOGGLE_GEMS" })}
      >
        💎
      </button>

      {/* Gem links toggle */}
      <button
        className={`header-btn${state.showLinks ? " active" : ""}`}
        title={state.gemLinkSets?.length ? "Toggle gem links" : "Import a PoB code to see gem links"}
        onClick={() => { if (state.gemLinkSets?.length) dispatch({ type: "TOGGLE_LINKS" }); }}
        style={{ opacity: state.gemLinkSets?.length ? undefined : 0.35 }}
      >
        🔗
      </button>

      {/* Passive tree toggle */}
      <button
        className={`header-btn${state.showTree ? " active" : ""}`}
        title={state.buildTrees?.length ? "Toggle passive tree" : "Import a PoB code to enable tree"}
        onClick={() => { if (state.buildTrees?.length) dispatch({ type: "TOGGLE_TREE" }); }}
        style={{ opacity: state.buildTrees?.length ? undefined : 0.35 }}
      >
        🕸
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
            api.expandWindow();
          } else {
            dispatch({ type: "TOGGLE_COLLAPSE" });
            api.collapseWindow();
          }
        }}
      >
        {state.collapsed ? "▲" : "—"}
      </button>

      {/* Close */}
      <button
        className="header-btn close"
        title="Close"
        onClick={() => api.closeWindow()}
      >
        ✕
      </button>
    </div>
  );
}
