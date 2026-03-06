import React, { useEffect, useReducer } from "react";
import { loadData, ParseConfig, flattenRoute, getGemsForClass, parseRouteSources } from "./data";
import { fetchRouteSources } from "./remote-data";
import { parsePobCode } from "./pob";
import { AppContext, initialState, reducer } from "./state";
import { useAPI } from "./api/index";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const api = useAPI();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Load persisted settings first and dispatch immediately.
        // This ensures settings (class, PoB code, etc.) are always visible
        // in the UI even if the subsequent GitHub data fetch is slow or fails.
        const settings = await api.getSettings();
        if (cancelled) return;
        dispatch({ type: "SET_SETTINGS", settings });

        // Fetch all game data and route files from GitHub in parallel.
        // NOTE: parsePobCode must run AFTER loadData() — it relies on Gems/VaalGemLookup/
        // AwakenedGemLookup which are populated by loadData(). Running it before yields
        // empty gemIds/gemLinkSets because every gem is skipped when Gems is {}.
        const [, sources] = await Promise.all([loadData(), fetchRouteSources()]);
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

        // Restore PoB state after game data is loaded so gem lookups work correctly.
        if (settings.pobCode) {
          const result = parsePobCode(settings.pobCode);
          if (!("error" in result)) {
            dispatch({ type: "SET_POB", pobGemIds: new Set(result.gemIds), buildTrees: result.buildTrees, gemLinkSets: result.gemLinkSets });
          }
        }
      } catch (err) {
        console.error("init failed:", err);
        if (!cancelled) dispatch({ type: "SET_LOADING", loading: false });
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
