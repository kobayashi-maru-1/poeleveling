import React, { createContext, useContext, useReducer } from "react";
import {
  FlatStep,
  GemEntry,
  ParseConfig,
  flattenRoute,
  getGemsForClass,
  parseRouteSources,
} from "./data";
import type { Settings } from "../shared/types";
import type { RouteData } from "../../../common/route-processing/types";
import type { GemLinkSet } from "./pob";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AppState {
  loading: boolean;
  settings: Settings;
  flatSteps: FlatStep[];
  currentIndex: number;
  gems: GemEntry[];
  collectedGems: Set<string>; // gemId keys collected
  /** Gem IDs extracted from PoB code — null means no PoB loaded (show all) */
  pobGemIds: Set<string> | null;
  /** Build trees extracted from PoB code — null means no PoB loaded */
  buildTrees: RouteData.BuildTree[] | null;
  /** Gem link sets (per SkillSet) extracted from PoB code — null means no PoB loaded */
  gemLinkSets: GemLinkSet[] | null;
  /** Currently viewed tree checkpoint index */
  treeIndex: number;
  /** Currently viewed SkillSet index in gem links panel */
  linksSetIndex: number;
  showSettings: boolean;
  showGems: boolean;
  showTree: boolean;
  showLinks: boolean;
  collapsed: boolean;
}

export type Action =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_SETTINGS"; settings: Settings }
  | { type: "SET_ROUTE"; flatSteps: FlatStep[]; gems: GemEntry[] }
  | { type: "SET_POB"; pobGemIds: Set<string> | null; buildTrees: RouteData.BuildTree[] | null; gemLinkSets: GemLinkSet[] | null }
  | { type: "TOGGLE_TREE" }
  | { type: "TOGGLE_LINKS" }
  | { type: "SET_INDEX"; index: number }
  | { type: "SET_TREE_INDEX"; index: number }
  | { type: "SET_LINKS_SET_INDEX"; index: number }
  | { type: "ADVANCE" }
  | { type: "RETREAT" }
  | { type: "TOGGLE_GEM"; gemId: string }
  | { type: "TOGGLE_SETTINGS" }
  | { type: "TOGGLE_GEMS" }
  | { type: "TOGGLE_COLLAPSE" }
  | { type: "RESET_PROGRESS" };

// ─── Reducer ───────────────────────────────────────────────────────────────────

const STORAGE_KEY_INDEX = "overlay:currentIndex";
const STORAGE_KEY_GEMS = "overlay:collectedGems";
const STORAGE_KEY_TREE_INDEX = "overlay:treeIndex";
const STORAGE_KEY_LINKS_SET_INDEX = "overlay:linksSetIndex";

function loadPersistedIndex(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY_INDEX) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function loadPersistedTreeIndex(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY_TREE_INDEX) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function loadPersistedLinksSetIndex(): number {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY_LINKS_SET_INDEX) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function loadPersistedGems(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEMS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export const initialState: AppState = {
  loading: true,
  settings: {
    opacity: 0.92,
    characterClass: "",
    bandit: "None",
    leagueStart: false,
    library: false,
    pobCode: "",
  },
  flatSteps: [],
  currentIndex: loadPersistedIndex(),
  gems: [],
  collectedGems: loadPersistedGems(),
  pobGemIds: null,
  buildTrees: null,
  gemLinkSets: null,
  treeIndex: loadPersistedTreeIndex(),
  linksSetIndex: loadPersistedLinksSetIndex(),
  showSettings: false,
  showGems: false,
  showTree: false,
  showLinks: false,
  collapsed: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "SET_SETTINGS":
      return { ...state, settings: action.settings };

    case "SET_ROUTE":
      return {
        ...state,
        flatSteps: action.flatSteps,
        gems: action.gems,
        loading: false,
      };

    case "SET_POB":
      localStorage.setItem(STORAGE_KEY_TREE_INDEX, "0");
      localStorage.setItem(STORAGE_KEY_LINKS_SET_INDEX, "0");
      return { ...state, pobGemIds: action.pobGemIds, buildTrees: action.buildTrees, gemLinkSets: action.gemLinkSets, treeIndex: 0, linksSetIndex: 0 };

    case "SET_TREE_INDEX": {
      const index = clamp(action.index, 0, (state.buildTrees?.length ?? 1) - 1);
      localStorage.setItem(STORAGE_KEY_TREE_INDEX, String(index));
      return { ...state, treeIndex: index };
    }

    case "SET_LINKS_SET_INDEX": {
      const index = clamp(action.index, 0, (state.gemLinkSets?.length ?? 1) - 1);
      localStorage.setItem(STORAGE_KEY_LINKS_SET_INDEX, String(index));
      return { ...state, linksSetIndex: index };
    }

    case "SET_INDEX": {
      const index = clamp(action.index, 0, state.flatSteps.length - 1);
      localStorage.setItem(STORAGE_KEY_INDEX, String(index));
      return { ...state, currentIndex: index };
    }

    case "ADVANCE": {
      const index = clamp(
        state.currentIndex + 1,
        0,
        state.flatSteps.length - 1
      );
      localStorage.setItem(STORAGE_KEY_INDEX, String(index));
      return { ...state, currentIndex: index };
    }

    case "RETREAT": {
      const index = clamp(
        state.currentIndex - 1,
        0,
        state.flatSteps.length - 1
      );
      localStorage.setItem(STORAGE_KEY_INDEX, String(index));
      return { ...state, currentIndex: index };
    }

    case "TOGGLE_GEM": {
      const next = new Set(state.collectedGems);
      if (next.has(action.gemId)) next.delete(action.gemId);
      else next.add(action.gemId);
      localStorage.setItem(STORAGE_KEY_GEMS, JSON.stringify([...next]));
      return { ...state, collectedGems: next };
    }

    case "TOGGLE_SETTINGS":
      return { ...state, showSettings: !state.showSettings };

    case "TOGGLE_GEMS":
      return { ...state, showGems: !state.showGems };

    case "TOGGLE_TREE":
      return { ...state, showTree: !state.showTree };

    case "TOGGLE_LINKS":
      return { ...state, showLinks: !state.showLinks };

    case "TOGGLE_COLLAPSE":
      return { ...state, collapsed: !state.collapsed };

    case "RESET_PROGRESS": {
      localStorage.setItem(STORAGE_KEY_INDEX, "0");
      localStorage.setItem(STORAGE_KEY_GEMS, "[]");
      return { ...state, currentIndex: 0, collectedGems: new Set() };
    }

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface ContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export const AppContext = createContext<ContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be inside AppProvider");
  return ctx;
}

// Helper: reload route when settings change
export async function reloadRoute(
  dispatch: React.Dispatch<Action>,
  settings: Settings
) {
  dispatch({ type: "SET_LOADING", loading: true });
  try {
    const sources = await window.electronAPI.getRouteSources();
    const config: ParseConfig = {
      leagueStart: settings.leagueStart,
      library: settings.library,
      bandit: settings.bandit,
    };
    const sections = parseRouteSources(sources, config);
    const flatSteps = flattenRoute(sections);
    const gems = getGemsForClass(settings.characterClass);
    dispatch({ type: "SET_ROUTE", flatSteps, gems });
  } catch (err) {
    console.error("reloadRoute failed:", err);
  } finally {
    dispatch({ type: "SET_LOADING", loading: false });
  }
}
