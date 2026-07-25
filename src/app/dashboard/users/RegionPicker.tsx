"use client";

import { useState } from "react";

type Mode = "single" | "multi" | "none";

// Rolga qarab hudud tanlash:
//  - single (Nazoratchi): bitta hudud (select, majburiy)
//  - multi (Moderator): "hammasi" checkbox yoki bir nechta hudud
//  - none: hech narsa
export function RegionPicker({
  mode,
  regions,
  initialRegionId = null,
  initialAllRegions = false,
  initialModeratorRegionIds = [],
}: {
  mode: Mode;
  regions: { id: string; name: string }[];
  initialRegionId?: string | null;
  initialAllRegions?: boolean;
  initialModeratorRegionIds?: string[];
}) {
  const [all, setAll] = useState(initialAllRegions);

  if (mode === "none") return null;

  if (mode === "single") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Hudud</label>
        <select
          name="regionId"
          required
          defaultValue={initialRegionId ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Tanlang...</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // multi (Moderator)
  return (
    <div className="md:col-span-2">
      <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="allRegions" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4" />
        Barcha hududlar
      </label>
      {!all ? (
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-slate-200 p-2 md:grid-cols-3">
          {regions.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                name="moderatorRegionIds"
                value={r.id}
                defaultChecked={initialModeratorRegionIds.includes(r.id)}
                className="h-4 w-4"
              />
              {r.name}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
