import React, { useEffect, useReducer } from "react";
import { ParseConfig, flattenRoute, getGemsForClass, parseRouteSources } from "./data";
import { parsePobCode } from "./pob";
import { AppContext, initialState, reducer } from "./state";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load settings and route on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const settings = await window.electronAPI.getSettings();
        if (cancelled) return;
        dispatch({ type: "SET_SETTINGS", settings });

        const sources = await window.electronAPI.getRouteSources();
        if (cancelled) return;

        const config: ParseConfig = {
          leagueStart: settings.leagueStart,
          library: settings.library,
          bandit: settings.bandit,
        };
        const sections = parseRouteSources(sources, config);
        const flatSteps = flattenRoute(sections);
        const gems = getGemsForClass(settings.characterClass);
        dispatch({ type: "SET_ROUTE", flatSteps, gems });

        // Restore PoB gem filter if a code was previously saved
        if (settings.pobCode) {
          const result = parsePobCode(settings.pobCode);
          if (!("error" in result)) {
            dispatch({ type: "SET_POB", pobGemIds: new Set(result.gemIds) });
          }
        }

        // Start log watcher if path is set
        if (settings.clientTxtPath) {
          window.electronAPI.startWatcher(settings.clientTxtPath);
        }
      } catch (err) {
        console.error("init failed:", err);
        if (!cancelled) dispatch({ type: "SET_LOADING", loading: false });
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Subscribe to zone-entered events from main process
  useEffect(() => {
    const unsub = window.electronAPI.onZoneEntered((zoneName) => {
      dispatch({ type: "ZONE_ENTERED", zoneName });
    });
    return unsub;
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
