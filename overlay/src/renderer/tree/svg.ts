import type { SkillTree } from "../../../../common/data/tree";
import type { UrlTreeDelta } from "./delta";

const PADDING = 550;
const ASCENDANCY_BORDER_RADIUS = 650;
const ASCENDANCY_ASCENDANT_BORDER_RADIUS = 750;
const CONNECTION_STROKE_WIDTH = 20;
const CONNECTION_ACTIVE_STROKE_WIDTH = 35;

type ConstantsLookup = Partial<Record<SkillTree.Node["k"], { radius: number; cls?: string }>>;

const TREE_CONSTANTS: ConstantsLookup = {
  Mastery:          { radius: 50, cls: "mastery" },
  Keystone:         { radius: 75, cls: "keystone" },
  Notable:          { radius: 60, cls: "notable" },
  Jewel:            { radius: 60, cls: "notable" },
  Normal:           { radius: 40, cls: "normal" },
};

const ASCENDANCY_CONSTANTS: ConstantsLookup = {
  Ascendancy_Start: { radius: 30 },
  Notable:          { radius: 65, cls: "notable" },
  Normal:           { radius: 45, cls: "normal" },
  Jewel:            { radius: 65, cls: "notable" },
};

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function buildTemplate(
  tree: SkillTree.Data,
  nodeLookup: SkillTree.NodeLookup
): { svg: string; viewBox: ViewBox } {
  const viewBox: ViewBox = {
    x: tree.bounds.minX - PADDING,
    y: tree.bounds.minY - PADDING,
    w: tree.bounds.maxX - tree.bounds.minX + PADDING * 2,
    h: tree.bounds.maxY - tree.bounds.minY + PADDING * 2,
  };

  let svg = `<svg width="${viewBox.w}" height="${viewBox.h}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}" xmlns="http://www.w3.org/2000/svg">\n`;
  svg += buildSubTree(tree.graphs[tree.graphIndex], nodeLookup, TREE_CONSTANTS);

  for (const [, asc] of Object.entries(tree.ascendancies)) {
    const startNode = nodeLookup[asc.startNodeId];
    const r = asc.id === "Ascendant" ? ASCENDANCY_ASCENDANT_BORDER_RADIUS : ASCENDANCY_BORDER_RADIUS;
    svg += `<g class="ascendancy ${asc.id}">\n`;
    svg += `<circle cx="${startNode.x}" cy="${startNode.y}" r="${r}" class="border"/>\n`;
    svg += buildSubTree(tree.graphs[asc.graphIndex], nodeLookup, ASCENDANCY_CONSTANTS);
    svg += `</g>\n`;
  }

  svg += `</svg>\n`;
  return { svg, viewBox };
}

function buildSubTree(
  graph: SkillTree.Graph,
  nodeLookup: SkillTree.NodeLookup,
  lookup: ConstantsLookup
): string {
  let out = `<g class="connections">\n`;
  for (const conn of graph.connections) out += buildConnection(conn, nodeLookup);
  out += `</g>\n`;
  out += `<g class="nodes">\n`;
  for (const [id, node] of Object.entries(graph.nodes)) out += buildNode(id, node, lookup);
  out += `</g>\n`;
  return out;
}

function buildNode(id: string, node: SkillTree.Node, lookup: ConstantsLookup): string {
  const c = lookup[node.k];
  if (!c) return "";
  return `<circle cx="${node.x}" cy="${node.y}" id="n${id}" r="${c.radius}" class="${c.cls ?? ""}"></circle>\n`;
}

function buildConnection(conn: SkillTree.Connection, nodeLookup: SkillTree.NodeLookup): string {
  const id = `${conn.a}-${conn.b}`;
  const a = nodeLookup[conn.a];
  const b = nodeLookup[conn.b];
  if (!a || !b) return "";
  if (conn.s !== undefined) {
    const d = conn.s.w === "CW" ? 1 : 0;
    return `<path d="M ${a.x} ${a.y} A ${conn.s.r} ${conn.s.r} 0 0 ${d} ${b.x} ${b.y}" id="c${id}" />\n`;
  }
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" id="c${id}" />\n`;
}

/** Build the CSS style string for the tree SVG without Handlebars. */
export function buildStyle(
  styleId: string,
  delta: UrlTreeDelta,
  ascendancyId: string | undefined
): string {
  const sel = (ids: string[], prefix: string) =>
    ids.length ? `#${styleId} :is(${ids.map((id) => `#${prefix}${id}`).join(",")})` : null;

  const nodesActiveSel  = sel(delta.nodesActive,       "n");
  const nodesAddedSel   = sel(delta.nodesAdded,        "n");
  const nodesRemovedSel = sel(delta.nodesRemoved,      "n");
  const connActiveSel   = sel(delta.connectionsActive,  "c");
  const connAddedSel    = sel(delta.connectionsAdded,   "c");
  const connRemovedSel  = sel(delta.connectionsRemoved, "c");

  return `
#${styleId} { background: transparent; }
#${styleId} .nodes { fill: hsl(215,15%,50%); stroke: hsl(215,15%,50%); stroke-width: 0; }
#${styleId} .nodes .mastery { fill: transparent; stroke: transparent; }
#${styleId} .connections { fill: none; stroke: hsl(215,15%,40%); stroke-width: ${CONNECTION_STROKE_WIDTH}; }
#${styleId} .ascendancy { opacity: 0.4; }
${ascendancyId ? `#${styleId} .ascendancy.${ascendancyId} { opacity: unset; }` : ""}
#${styleId} .border { fill: none; stroke: hsl(215,15%,40%); stroke-width: ${CONNECTION_STROKE_WIDTH}; }
${nodesActiveSel  ? `${nodesActiveSel}  { fill: hsl(200,80%,50%); stroke: hsl(200,80%,50%); }` : ""}
${nodesAddedSel   ? `${nodesAddedSel}   { fill: hsl(120,90%,50%); stroke: hsl(120,90%,50%); }` : ""}
${nodesRemovedSel ? `${nodesRemovedSel} { fill: hsl(0,90%,50%);   stroke: hsl(0,90%,50%);   }` : ""}
${connActiveSel   ? `${connActiveSel}   { stroke: hsl(200,80%,40%); stroke-width: ${CONNECTION_ACTIVE_STROKE_WIDTH}; }` : ""}
${connAddedSel    ? `${connAddedSel}    { stroke: hsl(120,90%,40%); stroke-width: ${CONNECTION_ACTIVE_STROKE_WIDTH}; }` : ""}
${connRemovedSel  ? `${connRemovedSel}  { stroke: hsl(0,90%,40%);   stroke-width: ${CONNECTION_ACTIVE_STROKE_WIDTH}; }` : ""}
`;
}
