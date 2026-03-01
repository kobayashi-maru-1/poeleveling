import pako from "pako";
import { Gems, VaalGemLookup, AwakenedGemLookup } from "./data";

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

export interface PobResult {
  characterClass: string;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  gemIds: string[];      // deduplicated, normalized gem IDs needed by the build
  gemNames: string[];    // display names parallel to gemIds (for UI)
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

  // Collect gem IDs from all enabled Skill elements
  const gemIds: string[] = [];
  const skillElements = Array.from(doc.getElementsByTagName("Skill"));

  for (const skill of skillElements) {
    if (skill.getAttribute("enabled") === "false") continue;
    for (const gem of Array.from(skill.getElementsByTagName("Gem"))) {
      const rawId = gem.getAttribute("gemId");
      if (!rawId) continue;
      const id = normalizeGemId(rawId);
      if (!gemIds.includes(id) && Gems[id]) {
        gemIds.push(id);
      }
    }
  }

  // Also check SkillSet elements (newer PoB format)
  const skillSetElements = Array.from(doc.getElementsByTagName("SkillSet"));
  if (skillSetElements.length > 0) {
    // Already covered by the Skill element scan above since SkillSet contains Skills
  }

  const gemNames = gemIds.map((id) => Gems[id]?.name ?? id);

  return { characterClass, bandit, gemIds, gemNames };
}
