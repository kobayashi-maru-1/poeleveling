import React, { useState } from "react";
import { useAppState } from "../state";

type Filter = "all" | "quest" | "vendor" | "pending";

export function GemPanel() {
  const { state, dispatch } = useAppState();
  const [filter, setFilter] = useState<Filter>("pending");

  const { gems, collectedGems, pobGemIds, settings } = state;

  if (!settings.characterClass) {
    return (
      <div className="gem-panel">
        <div className="gem-panel-header">
          💎 Gems — set character class in settings
        </div>
      </div>
    );
  }

  // When a PoB import is active, restrict to gems in the build
  const baseGems = pobGemIds
    ? gems.filter((g) => pobGemIds.has(g.gemId))
    : gems;

  const visible = baseGems.filter((g) => {
    if (filter === "pending") return !collectedGems.has(g.gemId);
    if (filter === "quest") return g.rewardType === "quest";
    if (filter === "vendor") return g.rewardType === "vendor";
    return true;
  });

  return (
    <div className="gem-panel">
      <div
        className="gem-panel-header"
        onClick={() => dispatch({ type: "TOGGLE_GEMS" })}
      >
        <span>
          💎 Gems ({baseGems.filter((g) => !collectedGems.has(g.gemId)).length} pending
          {pobGemIds ? " · PoB" : ""})
        </span>
        <GemFilterTabs filter={filter} setFilter={setFilter} />
      </div>

      <div className="gem-list">
        {visible.length === 0 && (
          <div className="loading-msg" style={{ padding: "8px 10px", height: "auto" }}>
            {filter === "pending" ? "All gems collected!" : "None"}
          </div>
        )}
        {visible.map((gem) => {
          const collected = collectedGems.has(gem.gemId);
          return (
            <div
              key={`${gem.questId}:${gem.gemId}`}
              className={`gem-row${collected ? " collected" : ""}`}
              onClick={() => dispatch({ type: "TOGGLE_GEM", gemId: gem.gemId })}
              title={`${gem.questName} — Act ${gem.act}${gem.npc ? ` (${gem.npc})` : ""}`}
            >
              <div className="gem-checkbox">{collected ? "✓" : ""}</div>
              <div
                className="gem-dot"
                style={{ background: gem.colour }}
              />
              <span className="gem-name">{gem.gemName}</span>
              <span className="gem-meta">
                A{gem.act} · {gem.rewardType === "vendor" ? "buy" : "quest"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GemFilterTabs({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const tabs: Filter[] = ["pending", "quest", "vendor", "all"];
  return (
    <div
      style={{ display: "flex", gap: 4, marginLeft: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => setFilter(t)}
          style={{
            background: filter === t ? "rgba(200,150,30,0.3)" : "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 3,
            color: filter === t ? "#c89a20" : "#888",
            fontSize: 10,
            padding: "1px 5px",
            cursor: "pointer",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
