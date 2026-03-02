import type { SkillTree } from "../../../../common/data/tree";
import { buildTemplate, type ViewBox } from "./svg";

export type TreeEntry = [SkillTree.Data, SkillTree.NodeLookup, string, ViewBox];

// Lazy-load each version's JSON only when first requested.
// The glob pattern uses a relative path from this file to common/data/tree/.
const RAW_MODULES = import.meta.glob(
  "../../../../common/data/tree/*.json",
  { eager: false }
) as Record<string, () => Promise<{ default: SkillTree.Data }>>;

// Build a lookup: version key (e.g. "3_27") → lazy Promise<TreeEntry>
export const TREE_DATA_LOOKUP: Record<string, Promise<TreeEntry>> = {};

for (const [path, load] of Object.entries(RAW_MODULES)) {
  const match = /([^/\\]+)\.json$/.exec(path);
  if (!match) continue;
  const version = match[1];

  TREE_DATA_LOOKUP[version] = load().then((mod) => {
    const tree = mod.default;
    const nodeLookup: SkillTree.NodeLookup = Object.assign(
      {},
      ...tree.graphs.map((g) => g.nodes)
    );
    const { svg, viewBox } = buildTemplate(tree, nodeLookup);
    return [tree, nodeLookup, svg, viewBox] as TreeEntry;
  });
}
