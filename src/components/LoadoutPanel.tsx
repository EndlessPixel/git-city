"use client";

import { useState, useCallback } from "react";
import { ZONE_ITEMS, ZONE_LABELS, ITEM_NAMES } from "@/lib/zones";

const ACCENT = "#c8e64a";
const SHADOW = "#5a7a00";

interface Loadout {
  crown: string | null;
  roof: string | null;
  aura: string | null;
}

interface Props {
  ownedItems: string[];
  initialLoadout: Loadout | null;
  onLoadoutChange?: (loadout: Loadout) => void;
}

export default function LoadoutPanel({ ownedItems, initialLoadout, onLoadoutChange }: Props) {
  const [loadout, setLoadout] = useState<Loadout>(
    initialLoadout ?? { crown: null, roof: null, aura: null }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const ownedSet = new Set(ownedItems);

  const handleChange = useCallback(
    (zone: keyof Loadout, value: string | null) => {
      const next = { ...loadout, [zone]: value };
      setLoadout(next);
      onLoadoutChange?.(next);
    },
    [loadout, onLoadoutChange]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/loadout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loadout),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [loadout]);

  return (
    <div className="border-[3px] border-border bg-bg-raised p-4 sm:p-6">
      <h3 className="mb-4 text-sm" style={{ color: ACCENT }}>
        Loadout
      </h3>
      <p className="mb-4 text-[10px] text-muted normal-case">
        Equip one item per zone. Only equipped items render on your building.
      </p>

      <div className="space-y-3">
        {(Object.entries(ZONE_ITEMS) as [string, string[]][]).map(
          ([zone, items]) => {
            const label = ZONE_LABELS[zone] ?? zone;
            const available = items.filter((id) => ownedSet.has(id));
            const current = loadout[zone as keyof Loadout];

            return (
              <div
                key={zone}
                className="flex items-center justify-between border-[2px] border-border bg-bg-card px-4 py-3"
              >
                <div>
                  <p className="text-xs text-cream">{label}</p>
                  <p className="text-[9px] text-dim normal-case">
                    {available.length} owned
                  </p>
                </div>
                <select
                  value={current ?? ""}
                  onChange={(e) =>
                    handleChange(
                      zone as keyof Loadout,
                      e.target.value || null
                    )
                  }
                  className="border-[2px] border-border bg-bg px-2 py-1 text-[10px] text-cream"
                >
                  <option value="">None</option>
                  {available.map((id) => (
                    <option key={id} value={id}>
                      {ITEM_NAMES[id] ?? id}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-press mt-4 w-full py-2 text-xs text-bg disabled:opacity-40"
        style={{
          backgroundColor: saved ? "#39d353" : ACCENT,
          boxShadow: `2px 2px 0 0 ${SHADOW}`,
        }}
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Loadout"}
      </button>
    </div>
  );
}
