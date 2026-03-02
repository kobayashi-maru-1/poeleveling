import type { SkillTree } from "../../../../common/data/tree";
import type { RouteData } from "../../../../common/route-processing/types";

export namespace UrlTree {
  export interface Data {
    name: string;
    version: string;
    ascendancy?: SkillTree.Ascendancy;
    nodes: string[];
    masteries: Record<string, string>;
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const unescaped = value.replace(/_/g, "/").replace(/-/g, "+");
  // Extract just the path component from a full URL if present
  const path = /\/passive-skill-tree\/([^?#]+)/.exec(value)?.[1];
  const base64 = path
    ? path.replace(/_/g, "/").replace(/-/g, "+")
    : unescaped;
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function read_u16(buf: Uint8Array, offset: number) {
  return (buf[offset] << 8) | buf[offset + 1];
}

function read_u32(buf: Uint8Array, offset: number) {
  return (buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
}

function read_u16s(buf: Uint8Array, offset: number, length: number): number[] {
  if (buf.length < offset + length * 2) throw new Error("invalid u16 buffer");
  const result: number[] = [];
  for (let i = 0; i < length; i++) result.push(read_u16(buf, offset + i * 2));
  return result;
}

export function buildUrlTree(
  buildTree: RouteData.BuildTree,
  skillTree: SkillTree.Data,
  nodeLookup: SkillTree.NodeLookup
): UrlTree.Data {
  // Extract the base64 payload — it's the last path segment of the URL
  const data = /.*\/(.*?)$/.exec(buildTree.url)?.[1];
  if (!data) throw new Error(`invalid url ${buildTree.url}`);

  const buffer = decodeBase64Url(data);

  const version = read_u32(buffer, 0);
  const classId = buffer[4];
  const ascendancyId = buffer[5];

  if (version < 6) throw new Error("unsupported tree URL version");

  const nodesOffset  = 7;
  const nodesCount   = buffer[6];
  const clusterOffset = nodesOffset + nodesCount * 2 + 1;
  const clusterCount  = buffer[clusterOffset - 1];
  const masteryOffset = clusterOffset + clusterCount * 2 + 1;
  const masteryCount  = buffer[masteryOffset - 1] * 2;

  const nodes = read_u16s(buffer, nodesOffset, nodesCount)
    .map((x) => x.toString())
    .filter((x) => nodeLookup[x] !== undefined);

  const masteries: Record<string, string> = {};
  const masteryData = read_u16s(buffer, masteryOffset, masteryCount);
  for (let i = 0; i < masteryData.length; i += 2) {
    masteries[masteryData[i + 1].toString()] = masteryData[i].toString();
  }

  const ascendancy =
    ascendancyId > 0
      ? skillTree.ascendancies[
          skillTree.classes[classId]?.ascendancies[ascendancyId - 1]
        ]
      : undefined;

  return { name: buildTree.name, version: buildTree.version, ascendancy, nodes, masteries };
}
