import { fetchJsonFile } from "./remote-data";

// ─── Type aliases ─────────────────────────────────────────────────────────────

export interface Area {
  id: string;
  name: string;
  act: number;
  level: number;
  has_waypoint: boolean;
  is_town_area: boolean;
  connection_ids: string[];
  crafting_recipes: string[];
  map_name?: string;
}

export interface Gem {
  id: string;
  name: string;
  primary_attribute: "strength" | "dexterity" | "intelligence" | "none";
  required_level: number;
  is_support: boolean;
}

// Actual quests.json reward structure:
// quest/vendor are Records of gemId → { classes: string[], npc?: string }
interface GemClassEntry {
  classes: string[];
  npc?: string;
}

export interface RewardOffer {
  quest_npc?: string;
  quest?: Record<string, GemClassEntry>;
  vendor?: Record<string, GemClassEntry>;
}

export interface Quest {
  id: string;
  name: string;
  act: string; // "1", "2", … stored as string in JSON
  reward_offers: Record<string, RewardOffer>;
}

// characters.json: key = class name, value has only gem IDs
export interface Character {
  start_gem_id?: string;
  chest_gem_id?: string;
}

export type Areas = Record<string, Area>;
export type Gems = Record<string, Gem>;
export type Quests = Record<string, Quest>;
export type Characters = Record<string, Character>;
export type GemColours = Record<string, string>; // attribute → hex colour

// These are populated by loadData() before any route parsing occurs.
export let Areas: Areas = {} as Areas;
export let Gems: Gems = {} as Gems;
export let Quests: Quests = {} as Quests;
export let Characters: Characters = {} as Characters;
export let GemColours: GemColours = {} as GemColours;
// Gem ID variant lookups: Vaal/Awakened → normal gem ID
export let VaalGemLookup: Record<string, string> = {};
export let AwakenedGemLookup: Record<string, string> = {};

/** Fetch all JSON data files from GitHub and populate the module-level exports. */
export async function loadData(): Promise<void> {
  const [areas, gems, quests, characters, gemColours, vaalLookup, awakenedLookup] =
    await Promise.all([
      fetchJsonFile<Areas>("areas"),
      fetchJsonFile<Gems>("gems"),
      fetchJsonFile<Quests>("quests"),
      fetchJsonFile<Characters>("characters"),
      fetchJsonFile<GemColours>("gem-colours"),
      fetchJsonFile<Record<string, string>>("vaal-gem-lookup"),
      fetchJsonFile<Record<string, string>>("awakened-gem-lookup"),
    ]);
  Areas = areas;
  Gems = gems;
  Quests = quests;
  Characters = characters;
  GemColours = gemColours;
  VaalGemLookup = vaalLookup;
  AwakenedGemLookup = awakenedLookup;
  areaNameMap = buildAreaNameMap();
}

// ─── Route Parsing ────────────────────────────────────────────────────────────

export interface OverlayStep {
  text: string;
  enterAreaId?: string;
  enterAreaName?: string;
  subSteps: string[];
  /** Quest ID for steps that hand in a quest — used to look up gem rewards */
  questId?: string;
}

export interface OverlaySection {
  name: string;
  steps: OverlayStep[];
}

// Flat step for easy linear navigation
export interface FlatStep {
  sectionIndex: number;
  sectionName: string;
  stepIndex: number;
  step: OverlayStep;
}

// Direction arrows indexed 0–7 (N, NE, E, SE, S, SW, W, NW)
const DIR_ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

type FragmentResult = {
  text: string;
  enterAreaId?: string;
  enterAreaName?: string;
  questId?: string;
};

function renderFragment(type: string, parts: string[]): FragmentResult {
  switch (type) {
    case "enter": {
      const area = Areas[parts[1]];
      return {
        text: area?.name ?? parts[1],
        enterAreaId: parts[1],
        enterAreaName: area?.name ?? parts[1],
      };
    }
    case "area": {
      const area = Areas[parts[1]];
      return { text: area?.name ?? parts[1] };
    }
    case "kill":
      return { text: parts[1] ?? "" };
    case "arena":
      return { text: parts[1] ?? "" };
    case "waypoint":
      if (parts[1]) {
        const area = Areas[parts[1]];
        return { text: `Waypoint → ${area?.name ?? parts[1]}` };
      }
      return { text: "Waypoint" };
    case "waypoint_get":
      return { text: "Get Waypoint" };
    case "logout":
      return { text: "Logout" };
    case "portal":
      return { text: parts[1] === "set" ? "Set Portal" : "Use Portal" };
    case "quest": {
      const questId = parts[1];
      const quest = Quests[questId];
      return { text: quest?.name ?? questId, questId };
    }
    case "quest_text":
      return { text: parts[1] ?? "" };
    case "generic":
      return { text: parts[1] ?? "" };
    case "reward_quest":
      return { text: `Take: ${parts[1] ?? ""}` };
    case "reward_vendor":
      return {
        text: parts[2]
          ? `Buy: ${parts[1]} [${parts[2]}]`
          : `Buy: ${parts[1] ?? ""}`,
      };
    case "trial":
      return { text: "Trial of Ascendancy" };
    case "ascend":
      return { text: "Ascend" };
    case "crafting":
      return { text: "Crafting" };
    case "dir": {
      const idx = parseInt(parts[1] ?? "0") / 45;
      return { text: DIR_ARROWS[Math.floor(idx) % 8] ?? "?" };
    }
    case "copy":
      return { text: parts.slice(1).join("") };
    default:
      return { text: `{${parts.join("|")}}` };
  }
}

function parseLine(rawLine: string): OverlayStep | null {
  let line = rawLine;

  // Strip inline comments (#text at end) but preserve the comment text
  // to use if no other text is found from fragments
  let inlineComment = "";
  const commentMatch = line.match(/ #([^{]*)$/);
  if (commentMatch) {
    inlineComment = commentMatch[1].trim();
    line = line.slice(0, line.length - commentMatch[0].length);
  }

  // Replace {fragment|param...} with readable text
  let resultText = "";
  let enterAreaId: string | undefined;
  let enterAreaName: string | undefined;
  let questId: string | undefined;
  let lastIndex = 0;

  const fragmentRegex = /\{([^}]+)\}/g;
  let fragMatch: RegExpExecArray | null;

  while ((fragMatch = fragmentRegex.exec(line)) !== null) {
    // Append literal text before this fragment
    resultText += line.slice(lastIndex, fragMatch.index);
    lastIndex = fragMatch.index + fragMatch[0].length;

    const parts = fragMatch[1].split("|");
    const type = parts[0];
    const rendered = renderFragment(type, parts);
    resultText += rendered.text;
    if (rendered.enterAreaId) {
      enterAreaId = rendered.enterAreaId;
      enterAreaName = rendered.enterAreaName;
    }
    if (rendered.questId) {
      questId = rendered.questId;
    }
  }
  // Append any trailing literal text
  resultText += line.slice(lastIndex);
  resultText = resultText.trim();

  if (!resultText && inlineComment) resultText = inlineComment;
  if (!resultText) return null;

  return { text: resultText, enterAreaId, enterAreaName, subSteps: [], questId };
}

export interface ParseConfig {
  leagueStart: boolean;
  library: boolean;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
}

export function parseRouteSources(
  sources: string[],
  config: ParseConfig
): OverlaySection[] {
  const sections: OverlaySection[] = [];
  let currentSection: OverlaySection | null = null;

  // Build preprocessor definitions from config
  const defs = new Set<string>();
  if (config.leagueStart) defs.add("LEAGUE_START");
  if (config.library) defs.add("LIBRARY");
  switch (config.bandit) {
    case "None":
      defs.add("BANDIT_KILL");
      break;
    case "Oak":
      defs.add("BANDIT_OAK");
      break;
    case "Kraityn":
      defs.add("BANDIT_KRAITYN");
      break;
    case "Alira":
      defs.add("BANDIT_ALIRA");
      break;
  }

  for (const source of sources) {
    const lines = source.split(/\r?\n/);
    const conditionalStack: boolean[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trimStart();
      if (!line) continue;

      // #section directive
      const sectionMatch = /^#section +(.+)/.exec(line);
      if (sectionMatch) {
        currentSection = { name: sectionMatch[1].trim(), steps: [] };
        sections.push(currentSection);
        continue;
      }

      // Ensure a section exists
      if (!currentSection) {
        currentSection = { name: "Route", steps: [] };
        sections.push(currentSection);
      }

      // Conditionals
      if (/^#endif/.test(line)) {
        conditionalStack.pop();
        continue;
      }
      if (/^#ifdef +(.+)/.test(line)) {
        const m = /^#ifdef +(.+)/.exec(line)!;
        conditionalStack.push(defs.has(m[1].trim()));
        continue;
      }
      if (/^#ifndef +(.+)/.test(line)) {
        const m = /^#ifndef +(.+)/.exec(line)!;
        conditionalStack.push(!defs.has(m[1].trim()));
        continue;
      }

      // Skip if inside a false conditional
      const active =
        conditionalStack.length === 0 ||
        conditionalStack[conditionalStack.length - 1];
      if (!active) continue;

      // #sub — add to last step's subSteps
      if (/^#sub +/.test(line)) {
        const m = /^#sub +(.+)/.exec(line);
        if (m && currentSection.steps.length > 0) {
          const lastStep =
            currentSection.steps[currentSection.steps.length - 1];
          // Sub-step also contains fragments, render them
          const subStep = parseLine(m[1]);
          if (subStep) lastStep.subSteps.push(subStep.text);
        }
        continue;
      }

      // Regular step line
      const step = parseLine(line);
      if (step) currentSection.steps.push(step);
    }
  }

  return sections;
}

export function flattenRoute(sections: OverlaySection[]): FlatStep[] {
  const flat: FlatStep[] = [];
  sections.forEach((section, si) => {
    section.steps.forEach((step, stepI) => {
      flat.push({
        sectionIndex: si,
        sectionName: section.name,
        stepIndex: stepI,
        step,
      });
    });
  });
  return flat;
}

// ─── Gem Data ─────────────────────────────────────────────────────────────────

export interface GemEntry {
  gemId: string;
  gemName: string;
  attribute: Gem["primary_attribute"];
  colour: string;
  questId: string;
  questName: string;
  act: number;
  npc?: string;
  rewardType: "quest" | "vendor";
  cost?: string;
}

export function getGemsForClass(characterClass: string): GemEntry[] {
  if (!characterClass) return [];

  const gems: GemEntry[] = [];
  const seen = new Set<string>();

  for (const quest of Object.values(Quests)) {
    const act = parseInt(quest.act, 10);

    for (const offer of Object.values(quest.reward_offers)) {
      // Quest reward gems
      if (offer.quest) {
        for (const [gemId, entry] of Object.entries(offer.quest)) {
          if (!entry.classes.includes(characterClass)) continue;
          const key = `${quest.id}:${gemId}:quest`;
          if (seen.has(key)) continue;
          seen.add(key);
          const gem = Gems[gemId];
          if (!gem) continue;
          gems.push({
            gemId,
            gemName: gem.name,
            attribute: gem.primary_attribute,
            colour: GemColours[gem.primary_attribute] ?? "#aaaaaa",
            questId: quest.id,
            questName: quest.name,
            act,
            npc: offer.quest_npc,
            rewardType: "quest",
          });
        }
      }

      // Vendor reward gems
      if (offer.vendor) {
        for (const [gemId, entry] of Object.entries(offer.vendor)) {
          if (!entry.classes.includes(characterClass)) continue;
          const key = `${quest.id}:${gemId}:vendor`;
          if (seen.has(key)) continue;
          seen.add(key);
          const gem = Gems[gemId];
          if (!gem) continue;
          gems.push({
            gemId,
            gemName: gem.name,
            attribute: gem.primary_attribute,
            colour: GemColours[gem.primary_attribute] ?? "#aaaaaa",
            questId: quest.id,
            questName: quest.name,
            act,
            npc: entry.npc,
            rewardType: "vendor",
          });
        }
      }
    }
  }

  gems.sort((a, b) => a.act - b.act);
  return gems;
}

// ─── Gem acquisition sources ──────────────────────────────────────────────────

export interface GemSource {
  questName: string;
  act: number;
  npc: string | undefined;
  rewardType: "quest" | "vendor";
}

/** Returns all quests/vendor offers where gemId can be obtained (any class). */
export function getGemSources(gemId: string): GemSource[] {
  const sources: GemSource[] = [];
  const seen = new Set<string>();

  for (const quest of Object.values(Quests)) {
    const act = parseInt(quest.act, 10);
    for (const offer of Object.values(quest.reward_offers)) {
      if (offer.quest && gemId in offer.quest) {
        const key = `${quest.id}:quest`;
        if (!seen.has(key)) {
          seen.add(key);
          sources.push({ questName: quest.name, act, npc: offer.quest_npc, rewardType: "quest" });
        }
      }
      if (offer.vendor && gemId in offer.vendor) {
        const key = `${quest.id}:vendor`;
        if (!seen.has(key)) {
          seen.add(key);
          sources.push({ questName: quest.name, act, npc: offer.vendor[gemId].npc, rewardType: "vendor" });
        }
      }
    }
  }

  sources.sort((a, b) => a.act - b.act);
  return sources;
}

// Build a map from area name (as it appears in client.txt) → all matching area IDs
// Multiple areas can share the same display name (e.g. "The Sarn Encampment" in Act 3 and Act 8)
export function buildAreaNameMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  function add(name: string, id: string) {
    const key = name.toLowerCase();
    const existing = map.get(key);
    if (existing) existing.push(id);
    else map.set(key, [id]);
  }
  for (const area of Object.values(Areas)) {
    add(area.name, area.id);
    if (area.map_name && area.map_name !== area.name) add(area.map_name, area.id);
  }
  return map;
}

export let areaNameMap: Map<string, string[]> = new Map();
