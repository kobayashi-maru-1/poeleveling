import React, { useEffect, useMemo, useRef } from "react";
import { GemEntry } from "../data";
import { useAppState } from "../state";

const CONTEXT_BEFORE = 3;
const CONTEXT_AFTER = 6;

export function StepDisplay() {
  const { state, dispatch } = useAppState();
  const { flatSteps, currentIndex, gems, collectedGems, pobGemIds } = state;
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentIndex]);

  // Build questId → GemEntry[] lookup from the class's gem list
  const gemsByQuestId = useMemo(() => {
    const map = new Map<string, GemEntry[]>();
    for (const g of gems) {
      // Apply PoB filter here so the map only contains relevant gems
      if (pobGemIds && !pobGemIds.has(g.gemId)) continue;
      const list = map.get(g.questId) ?? [];
      list.push(g);
      map.set(g.questId, list);
    }
    return map;
  }, [gems, pobGemIds]);

  if (flatSteps.length === 0) {
    return (
      <div className="steps-container">
        <div className="loading-msg">No route loaded</div>
      </div>
    );
  }

  const start = Math.max(0, currentIndex - CONTEXT_BEFORE);
  const end = Math.min(flatSteps.length - 1, currentIndex + CONTEXT_AFTER);

  const rows: React.ReactNode[] = [];
  let lastSection = "";

  for (let i = start; i <= end; i++) {
    const flat = flatSteps[i];
    const isCurrent = i === currentIndex;
    const isPast = i < currentIndex;
    const sectionName = flat.sectionName;

    if (sectionName !== lastSection) {
      rows.push(
        <div key={`sec-${i}`} className="section-label">
          {sectionName}
        </div>
      );
      lastSection = sectionName;
    }

    // Gem badges for quest hand-in steps
    const questGems = flat.step.questId
      ? (gemsByQuestId.get(flat.step.questId) ?? [])
      : [];

    rows.push(
      <div
        key={i}
        ref={isCurrent ? currentRef : undefined}
        className={`step-row ${isCurrent ? "current" : isPast ? "past" : "future"}`}
        onClick={() => dispatch({ type: "SET_INDEX", index: i })}
      >
        <div className="step-text">{flat.step.text}</div>
        {isCurrent && flat.step.subSteps.length > 0 && (
          <div className="step-substeps">
            {flat.step.subSteps.map((sub, si) => (
              <div key={si} className="sub-text">
                • {sub}
              </div>
            ))}
          </div>
        )}
        {questGems.length > 0 && (
          <div className="gem-badge-row">
            {questGems.map((gem) => {
              const collected = collectedGems.has(gem.gemId);
              return (
                <div
                  key={gem.gemId}
                  className={`gem-badge${collected ? " collected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "TOGGLE_GEM", gemId: gem.gemId });
                  }}
                  title={`${gem.rewardType === "vendor" ? "Buy from vendor" : "Quest reward"}${gem.npc ? ` (${gem.npc})` : ""}`}
                >
                  <span className="gem-badge-dot" style={{ background: gem.colour }} />
                  <span className="gem-badge-name">{gem.gemName}</span>
                  <span className="gem-badge-type">
                    {gem.rewardType === "vendor" ? "buy" : "quest"}
                  </span>
                  {collected && <span className="gem-badge-check">✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return <div className="steps-container">{rows}</div>;
}
