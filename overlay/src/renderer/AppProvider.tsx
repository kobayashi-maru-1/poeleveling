import React, { useEffect, useReducer } from "react";
import { ParseConfig, flattenRoute, getGemsForClass, parseRouteSources } from "./data";
import { parsePobCode } from "./pob";
import { AppContext, initialState, reducer } from "./state";
import { useAPI } from "./api/index";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const api = useAPI();

  // Load settings and route on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const settings = await api.getSettings();
        if (cancelled) return;
        dispatch({ type: "SET_SETTINGS", settings });

        const sources = await api.getRouteSources();
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
