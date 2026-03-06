import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SkillTree } from "../../../../common/data/tree";
import type { UrlTreeDelta } from "../tree/delta";
import { buildUrlTreeDelta, calculateBounds } from "../tree/delta";
import { getTreeEntry, type TreeEntry } from "../tree/loader";
import { buildStyle } from "../tree/svg";
import { buildUrlTree, type UrlTree } from "../tree/url-tree";
import { useAppState } from "../state";

// Stable random ID for scoping the SVG style tag
const STYLE_ID = `tree-${Math.random().toString(36).slice(2, 8)}`;

interface RenderData {
  svg: string;
  style: string;
  skillTree: SkillTree.Data;
  nodeLookup: SkillTree.NodeLookup;
  masteries: UrlTreeDelta["masteries"];
  // Viewport initial focus in SVG-world coordinates (relative to SVG 0,0 origin)
  focus: { x: number; y: number; w: number; h: number };
}

// ─── Tooltip ────────────────────────────────────────────────────────────────────

interface TooltipData {
  nodeId: string;
  x: number;
  y: number;
}

function NodeTooltip({
  data,
  skillTree,
  nodeLookup,
  masteries,
}: {
  data: TooltipData;
  skillTree: SkillTree.Data;
  nodeLookup: SkillTree.NodeLookup;
  masteries: Record<string, string>;
}) {
  const node = nodeLookup[data.nodeId];
  if (!node) return null;

  const lines: string[] = [];
  if (node.stats) node.stats.forEach((s) => lines.push(...s.split("\n")));
  const effectId = masteries[data.nodeId];
  if (effectId) {
    const effect = skillTree.masteryEffects?.[effectId];
    if (effect?.stats) effect.stats.forEach((s) => lines.push(...s.split("\n")));
  }

  return (
    <div
      style={{
        position: "absolute",
        left: data.x + 12,
        top: data.y,
        background: "rgba(10,10,15,0.95)",
        border: "1px solid rgba(200,150,30,0.5)",
        borderRadius: 4,
        padding: "4px 8px",
        pointerEvents: "none",
        zIndex: 10,
        maxWidth: 220,
        fontSize: 11,
        lineHeight: 1.4,
        color: "#ddd",
      }}
    >
      {node.text && (
        <div style={{ fontWeight: 600, color: "#c8961e", marginBottom: 2 }}>
          {node.text}
        </div>
      )}
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// ─── Pan/zoom viewport ───────────────────────────────────────────────────────

interface ViewportProps {
  focus: RenderData["focus"];
  children: React.ReactNode;
}

function TreeViewport({ focus, children }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(0.02);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Fit the focus rect into the container on first render / when focus changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !focus || !isFinite(focus.x)) return;
    const rect = el.getBoundingClientRect();
    const scaleX = rect.width  / focus.w;
    const scaleY = rect.height / focus.h;
    const s = Math.min(scaleX, scaleY) * 0.85;
    const cx = rect.width  / 2;
    const cy = rect.height / 2;
    const fx = focus.x + focus.w / 2;
    const fy = focus.y + focus.h / 2;
    setScale(s);
    setTx(cx - fx * s);
    setTy(cy - fy * s);
  }, [focus]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setScale((s) => {
      const ns = Math.max(0.005, Math.min(1, s * factor));
      // Zoom toward cursor: keep world point under mouse fixed
      setTx((x) => mouseX - (mouseX - x) * (ns / s));
      setTy((y) => mouseY - (mouseY - y) * (ns / s));
      return ns;
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTx((x) => x + dx);
    setTy((y) => y + dy);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        cursor: dragging.current ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        style={{
          position: "absolute",
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main TreePanel ──────────────────────────────────────────────────────────

export function TreePanel() {
  const { state, dispatch } = useAppState();
  const { buildTrees, treeIndex } = state;

  const [renderData, setRenderData] = useState<RenderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);

  // Load tree data when index or buildTrees changes
  useEffect(() => {
    if (!buildTrees || buildTrees.length === 0) {
      setRenderData(null);
      return;
    }
    const curIndex = Math.min(treeIndex, buildTrees.length - 1);
    const currentBuildTree = buildTrees[curIndex];
    const version = currentBuildTree.version;

    setLoading(true);
    setError(null);

    const safeIndex = Math.min(treeIndex, buildTrees.length - 1);
    getTreeEntry(version)
      .then(([skillTree, nodeLookup, svg, viewBox]: TreeEntry) => {
        const currentUrlTree = buildUrlTree(currentBuildTree, skillTree, nodeLookup);

        let previousUrlTree: UrlTree.Data;
        if (safeIndex > 0) {
          try {
            previousUrlTree = buildUrlTree(buildTrees[safeIndex - 1], skillTree, nodeLookup);
          } catch {
            previousUrlTree = emptyTree(currentUrlTree);
          }
        } else {
          previousUrlTree = emptyTree(currentUrlTree);
        }

        const delta = buildUrlTreeDelta(currentUrlTree, previousUrlTree, skillTree);
        const bounds = calculateBounds(
          delta.nodesActive,
          delta.nodesAdded,
          delta.nodesRemoved,
          nodeLookup,
          viewBox
        );

        const style = buildStyle(STYLE_ID, delta, currentUrlTree.ascendancy?.id);

        // focus is in SVG element pixel space (0,0 = top-left of SVG element)
        // calculateBounds already returns x = minX - pad - viewBox.x, which is correct
        const focus = {
          x: bounds.x,
          y: bounds.y,
          w: bounds.width,
          h: bounds.height,
        };

        setRenderData({ svg, style, skillTree, nodeLookup, masteries: delta.masteries, focus });
      })
      .catch((e: unknown) => {
        setError(`Failed to load tree: ${e}`);
      })
      .finally(() => setLoading(false));
  }, [buildTrees, treeIndex]);

  // Attach hover listeners to SVG node circles after render
  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el || !renderData) return;

    const listeners: Array<[Element, string, EventListener]> = [];

    for (const nodeId of Object.keys(renderData.nodeLookup)) {
      const circle = el.querySelector(`#n${nodeId}`);
      if (!circle) continue;

      const enter: EventListener = (e) => {
        const pe = e as PointerEvent;
        setTooltip({ nodeId, x: pe.clientX, y: pe.clientY });
      };
      const move: EventListener = (e) => {
        const pe = e as PointerEvent;
        setTooltip((prev) => (prev ? { ...prev, x: pe.clientX, y: pe.clientY } : null));
      };
      const leave: EventListener = () => setTooltip(null);

      circle.addEventListener("pointerenter", enter);
      circle.addEventListener("pointermove", move);
      circle.addEventListener("pointerleave", leave);

      listeners.push([circle, "pointerenter", enter]);
      listeners.push([circle, "pointermove",  move]);
      listeners.push([circle, "pointerleave", leave]);
    }

    return () => {
      for (const [el, ev, fn] of listeners) el.removeEventListener(ev, fn);
    };
  }, [renderData]);

  const curIdx = buildTrees ? Math.min(treeIndex, buildTrees.length - 1) : 0;

  if (!buildTrees || buildTrees.length === 0) {
    return (
      <div className="tree-panel">
        <div className="tree-panel-header" onClick={() => dispatch({ type: "TOGGLE_TREE" })}>
          🕸 Passive Tree
        </div>
        <div style={{ padding: "10px", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
          Import a PoB code (Settings) to see your passive tree checkpoints.
        </div>
      </div>
    );
  }

  return (
    <div className="tree-panel">
      {/* Header */}
      <div className="tree-panel-header" onClick={() => dispatch({ type: "TOGGLE_TREE" })}>
        <span>
          🕸 {buildTrees[curIdx]?.name ?? "Passive Tree"}
          {buildTrees.length > 1 && (
            <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: 10 }}>
              ({curIdx + 1}/{buildTrees.length})
            </span>
          )}
        </span>
        {buildTrees.length > 1 && (
          <div
            style={{ display: "flex", gap: 4, marginLeft: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="tree-nav-btn"
              disabled={curIdx === 0}
              onClick={() => dispatch({ type: "SET_TREE_INDEX", index: curIdx - 1 })}
            >
              ◀
            </button>
            <button
              className="tree-nav-btn"
              disabled={curIdx >= buildTrees.length - 1}
              onClick={() => dispatch({ type: "SET_TREE_INDEX", index: curIdx + 1 })}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Viewport */}
      <div style={{ position: "relative", height: 350, display: "flex", flexDirection: "column" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 12, zIndex: 5 }}>
            Loading tree…
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#e05555", fontSize: 11, padding: 10, textAlign: "center", zIndex: 5 }}>
            {error}
          </div>
        )}
        {renderData && !loading && (
          <TreeViewport focus={renderData.focus}>
            <style dangerouslySetInnerHTML={{ __html: renderData.style }} />
            <div
              id={STYLE_ID}
              ref={svgWrapRef}
              dangerouslySetInnerHTML={{ __html: renderData.svg }}
            />
          </TreeViewport>
        )}
      </div>

      {/* Tooltip rendered at cursor position in viewport coords */}
      {tooltip && renderData && (
        <NodeTooltip
          data={tooltip}
          skillTree={renderData.skillTree}
          nodeLookup={renderData.nodeLookup}
          masteries={renderData.masteries}
        />
      )}
    </div>
  );
}

function emptyTree(ref: UrlTree.Data): UrlTree.Data {
  return { name: ref.name, version: ref.version, ascendancy: ref.ascendancy, nodes: [], masteries: {} };
}
