import type { SkillTree } from "../../../../common/data/tree";
import { buildTemplate, type ViewBox } from "./svg";

export type TreeEntry = [SkillTree.Data, SkillTree.NodeLookup, string, ViewBox];

// Tree JSON files are bundled by Vite (they are not committed to git, so
// they cannot be fetched from GitHub raw). Each version is lazy-loaded on
// first request and cached in-memory for the rest of the session.
const RAW_MODULES = import.meta.glob(
  "../../../../common/data/tree/*.json",
  { eager: false }
) as Record<string, () => Promise<{ default: SkillTree.Data }>>;

const _cache: Record<string, Promise<TreeEntry>> = {};

export function getTreeEntry(version: string): Promise<TreeEntry> {
  if (_cache[version]) return _cache[version];

  const load = RAW_MODULES[`../../../../common/data/tree/${version}.json`];
  if (!load) {
    return Promise.reject(
      new Error(`No tree data bundled for version ${version.replace("_", ".")}`)
    );
  }

  _cache[version] = load().then((mod) => {
    const tree = mod.default;
    const nodeLookup: SkillTree.NodeLookup = Object.assign(
      {},
      ...tree.graphs.map((g) => g.nodes)
    );
    const { svg, viewBox } = buildTemplate(tree, nodeLookup);
    return [tree, nodeLookup, svg, viewBox] as TreeEntry;
  });

  return _cache[version];
}
