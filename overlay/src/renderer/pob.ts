import pako from "pako";
import { Gems, VaalGemLookup, AwakenedGemLookup } from "./data";
import type { RouteData } from "../../../common/route-processing/types";

// PoB stores some gem IDs differently from the game data — remap them
const GEM_ID_REMAP: Record<string, string> = {
  "Metadata/Items/Gems/Smite": "Metadata/Items/Gems/SkillGemSmite",
  "Metadata/Items/Gems/ConsecratedPath":
    "Metadata/Items/Gems/SkillGemConsecratedPath",
  "Metadata/Items/Gems/VaalAncestralWarchief":
    "Metadata/Items/Gems/SkillGemVaalAncestralWarchief",
  "Metadata/Items/Gems/HeraldOfAgony":
    "Metadata/Items/Gems/SkillGemHeraldOfAgony",
  "Metadata/Items/Gems/HeraldOfPurity":
    "Metadata/Items/Gems/SkillGemHeraldOfPurity",
  "Metadata/Items/Gems/ScourgeArrow":
    "Metadata/Items/Gems/SkillGemScourgeArrow",
  "Metadata/Items/Gems/RainOfSpores": "Metadata/Items/Gems/SkillGemToxicRain",
  "Metadata/Items/Gems/SummonRelic": "Metadata/Items/Gems/SkillGemSummonRelic",
  "Metadata/Items/Gems/SkillGemNewPhaseRun":
    "Metadata/Items/Gems/SkillGemPhaseRun",
  "Metadata/Items/Gems/SkillGemNewArcticArmour":
    "Metadata/Items/Gems/SkillGemArcticArmour",
};

function normalizeGemId(gemId: string): string {
  gemId = GEM_ID_REMAP[gemId] ?? gemId;
  gemId = VaalGemLookup[gemId] ?? gemId;     // Vaal → normal
  gemId = AwakenedGemLookup[gemId] ?? gemId; // Awakened → normal
  return gemId;
}

function decodeBase64Url(value: string): Uint8Array {
  const unescaped = value.replace(/_/g, "/").replace(/-/g, "+");
  const binary = atob(unescaped);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const POB_COLOUR_REGEX = /\^(x[a-zA-Z0-9]{6}|[0-9])/g;
function cleanText(s: string) {
  return s.replace(POB_COLOUR_REGEX, "");
}

export interface GemLinkGroup {
  title: string;
  primaryGems: string[];  // active skill gem IDs
  supportGems: string[];  // support gem IDs
}

export interface GemLinkSet {
  title: string;          // SkillSet title (e.g. "Default", "League Start")
  groups: GemLinkGroup[]; // link groups within this loadout
}

export interface PobResult {
  characterClass: string;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  gemIds: string[];         // deduplicated, normalized gem IDs needed by the build
  gemNames: string[];       // display names parallel to gemIds (for UI)
  buildTrees: RouteData.BuildTree[];
  gemLinkSets: GemLinkSet[];
  error?: never;
}

export interface PobError {
  error: string;
}

export function parsePobCode(pobCode: string): PobResult | PobError {
  let doc: Document;
  try {
    const compressed = decodeBase64Url(pobCode.trim());
    const xml = new TextDecoder().decode(pako.inflate(compressed));
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return { error: "Invalid PoB code — could not decode or decompress." };
  }

  const buildEl = doc.getElementsByTagName("Build")[0];
  if (!buildEl) return { error: "No <Build> element found in PoB XML." };

  const characterClass =
    buildEl.getAttribute("className") ?? "";
  const rawBandit = buildEl.getAttribute("bandit") ?? "None";
  const bandit = (["None", "Oak", "Kraityn", "Alira"].includes(rawBandit)
    ? rawBandit
    : "None") as PobResult["bandit"];

  const gemIds: string[] = [];

  function processSkillContainer(container: Element): GemLinkGroup[] {
    const groups: GemLinkGroup[] = [];
    let recentEmptyLabel: string | undefined;
    const skills = Array.from(container.getElementsByTagName("Skill"));
    for (const skill of skills) {
      if (skill.getAttribute("enabled") === "false") continue;
      const label = skill.getAttribute("label") ?? undefined;
      const gems = Array.from(skill.getElementsByTagName("Gem"));
      if (gems.length === 0) { recentEmptyLabel = label; continue; }

      const primaryGems: string[] = [];
      const supportGems: string[] = [];

      for (const gem of gems) {
        const rawId = gem.getAttribute("gemId");
        if (!rawId) continue;
        const id = normalizeGemId(rawId);
        if (!Gems[id]) continue;
        if (!gemIds.includes(id)) gemIds.push(id);
        if (Gems[id].is_support) supportGems.push(id);
        else primaryGems.push(id);
      }

      if (primaryGems.length === 0 && supportGems.length === 0) continue;

      const title = cleanText(recentEmptyLabel || label || "");
      recentEmptyLabel = undefined;
      groups.push({
        title,
        primaryGems: primaryGems.length ? primaryGems : supportGems,
        supportGems: primaryGems.length ? supportGems : [],
      });
    }
    return groups;
  }

  const gemLinkSets: GemLinkSet[] = [];
  const skillSetElements = Array.from(doc.getElementsByTagName("SkillSet"));
  if (skillSetElements.length > 0) {
    for (const set of skillSetElements) {
      const title = cleanText(set.getAttribute("title") || "Default");
      const groups = processSkillContainer(set);
      if (groups.length > 0) gemLinkSets.push({ title, groups });
    }
  } else {
    const groups = processSkillContainer(doc.documentElement);
    if (groups.length > 0) gemLinkSets.push({ title: "Default", groups });
  }

  const gemNames = gemIds.map((id) => Gems[id]?.name ?? id);

  const buildTrees: RouteData.BuildTree[] = [];
  const specElements = Array.from(doc.getElementsByTagName("Spec"));
  for (const spec of specElements) {
    const url = spec.getElementsByTagName("URL")[0]?.textContent?.trim();
    const version = spec.getAttribute("treeVersion");
    if (url && version) {
      buildTrees.push({
        name: cleanText(spec.getAttribute("title") || "Default"),
        version,
        url,
      });
    }
  }

  return { characterClass, bandit, gemIds, gemNames, buildTrees, gemLinkSets };
}

