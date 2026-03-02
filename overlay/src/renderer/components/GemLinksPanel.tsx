import React, { useState } from "react";
import { Gems, getGemSources } from "../data";
import type { GemLinkGroup } from "../pob";
import { useAppState } from "../state";

const ATTR_COLOR: Record<string, string> = {
  strength:     "#c05050",
  dexterity:    "#50b050",
  intelligence: "#5090d0",
};

function gemColor(id: string): string {
  const attr = Gems[id]?.primary_attribute ?? "";
  return ATTR_COLOR[attr] ?? "#aaa";
}

function gemName(id: string): string {
  return Gems[id]?.name ?? id;
}

interface TooltipState {
  gemId: string;
  x: number;
  y: number;
}

function GemTooltip({ gemId, x, y }: TooltipState) {
  const sources = getGemSources(gemId);
  if (sources.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y,
        background: "rgba(10,10,15,0.97)",
        border: "1px solid rgba(200,150,30,0.5)",
        borderRadius: 4,
        padding: "5px 8px",
        pointerEvents: "none",
        zIndex: 1000,
        maxWidth: 260,
        fontSize: 10,
        lineHeight: 1.6,
        color: "#ddd",
      }}
    >
      {sources.map((src, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: src.rewardType === "quest" ? "#c8961e" : "#7cbf7c" }}>
            {src.rewardType === "quest" ? "▶" : "$"}
          </span>
          {" "}
          {src.questName}
          {src.npc ? ` — ${src.npc}` : ""}
          {" — "}
          <span style={{ color: "var(--text-dim)" }}>Act {src.act}</span>
        </div>
      ))}
    </div>
  );
}

function LinkGroup({
  group,
  onGemHover,
  onGemLeave,
}: {
  group: GemLinkGroup;
  onGemHover: (gemId: string, e: React.MouseEvent) => void;
  onGemLeave: () => void;
}) {
  return (
    <div className="link-group">
      {group.title && (
        <div className="link-group-title">{group.title}</div>
      )}
      {group.primaryGems.map((id) => (
        <div
          key={id}
          className="link-gem primary-gem"
          onMouseEnter={(e) => onGemHover(id, e)}
          onMouseMove={(e) => onGemHover(id, e)}
          onMouseLeave={onGemLeave}
        >
          <span className="gem-dot" style={{ background: gemColor(id) }} />
          <span className="gem-name">{gemName(id)}</span>
        </div>
      ))}
      {group.supportGems.map((id) => (
        <div
          key={id}
          className="link-gem support-gem"
          onMouseEnter={(e) => onGemHover(id, e)}
          onMouseMove={(e) => onGemHover(id, e)}
          onMouseLeave={onGemLeave}
        >
          <span className="gem-dot" style={{ background: gemColor(id) }} />
          <span className="gem-name">{gemName(id)}</span>
        </div>
      ))}
    </div>
  );
}

export function GemLinksPanel() {
  const { state, dispatch } = useAppState();
  const { gemLinkSets, linksSetIndex } = state;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const curIdx = gemLinkSets ? Math.min(linksSetIndex, gemLinkSets.length - 1) : 0;
  const currentSet = gemLinkSets?.[curIdx];

  function handleGemHover(gemId: string, e: React.MouseEvent) {
    setTooltip({ gemId, x: e.clientX, y: e.clientY });
  }

  return (
    <div className="gem-panel">
      <div
        className="gem-panel-header"
        onClick={() => dispatch({ type: "TOGGLE_LINKS" })}
      >
        <span>
          🔗 {currentSet?.title ?? "Gem Links"}
          {gemLinkSets && gemLinkSets.length > 1 && (
            <span style={{ color: "var(--text-dim)", marginLeft: 6, fontSize: 10 }}>
              ({curIdx + 1}/{gemLinkSets.length})
            </span>
          )}
        </span>
        {gemLinkSets && gemLinkSets.length > 1 && (
          <div
            style={{ display: "flex", gap: 4, marginLeft: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="tree-nav-btn"
              disabled={curIdx === 0}
              onClick={() => dispatch({ type: "SET_LINKS_SET_INDEX", index: curIdx - 1 })}
            >
              ◀
            </button>
            <button
              className="tree-nav-btn"
              disabled={curIdx >= gemLinkSets.length - 1}
              onClick={() => dispatch({ type: "SET_LINKS_SET_INDEX", index: curIdx + 1 })}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {!currentSet || currentSet.groups.length === 0 ? (
        <div
          className="loading-msg"
          style={{ padding: "8px 10px", height: "auto", fontSize: 11 }}
        >
          {gemLinkSets ? "No link groups found in PoB." : "Import a PoB code to see gem links."}
        </div>
      ) : (
        <div className="gem-list" style={{ paddingBottom: 4 }}>
          {currentSet.groups.map((group, i) => (
            <LinkGroup
              key={i}
              group={group}
              onGemHover={handleGemHover}
              onGemLeave={() => setTooltip(null)}
            />
          ))}
        </div>
      )}

      {tooltip && <GemTooltip {...tooltip} />}
    </div>
  );
}
