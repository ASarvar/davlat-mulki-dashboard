"use client";

import { useState } from "react";

type Mode = "single" | "multi" | "none";

/** Tanlash uchun tashkilot. `regionName` null bo'lsa — respublika darajasidagi. */
export interface SourceOption {
  id: string;
  /** Soha (guruh) nomi: "Ijara markazi", "Davlat aktivlari agentligi"... */
  name: string;
  /** To'liq rasmiy tashkilot nomi (bo'lmasa hudud nomi ko'rsatiladi). */
  orgName: string | null;
  regionName: string | null;
}

// Ro'yxatda ko'rinadigan nom: hududiy tashkilot uchun hudud yetarli va qisqa,
// respublika darajasidagilar aniq belgilanadi.
function optionLabel(s: SourceOption): string {
  return s.regionName ?? "Respublika";
}

function groupBySoha(sources: SourceOption[]): [string, SourceOption[]][] {
  const map = new Map<string, SourceOption[]>();
  for (const s of sources) {
    const arr = map.get(s.name) ?? [];
    arr.push(s);
    map.set(s.name, arr);
  }
  return [...map.entries()];
}

// Rolga qarab TASHKILOT tanlash:
//  - single (Ijrochi): aynan bitta tashkilot (select, majburiy)
//  - multi (Moderator): "hammasi" checkbox yoki bir nechta tashkilot
//  - none: hech narsa (admin/rahbariyat/kuzatuvchi — cheklovsiz)
export function SourcePicker({
  mode,
  sources,
  initialSourceId = null,
  initialAllSources = false,
  initialModeratorSourceIds = [],
}: {
  mode: Mode;
  sources: SourceOption[];
  initialSourceId?: string | null;
  initialAllSources?: boolean;
  initialModeratorSourceIds?: string[];
}) {
  const [all, setAll] = useState(initialAllSources);

  if (mode === "none") return null;

  const groups = groupBySoha(sources);

  if (mode === "single") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Tashkilot</label>
        <select
          name="sourceId"
          required
          defaultValue={initialSourceId ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Tanlang...</option>
          {groups.map(([soha, list]) => (
            <optgroup key={soha} label={soha}>
              {list.map((s) => (
                <option key={s.id} value={s.id}>
                  {optionLabel(s)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Ijrochi faqat shu tashkilotning obyektlarini ko&apos;radi.
        </p>
      </div>
    );
  }

  // multi (Moderator)
  return (
    <div className="md:col-span-2">
      <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="allSources"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
          className="h-4 w-4"
        />
        Barcha tashkilotlar
      </label>
      {!all ? (
        <div className="mt-2 space-y-3 rounded-md border border-slate-200 p-3">
          {groups.map(([soha, list]) => (
            <div key={soha}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{soha}</p>
              <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
                {list.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="moderatorSourceIds"
                      value={s.id}
                      defaultChecked={initialModeratorSourceIds.includes(s.id)}
                      className="h-4 w-4"
                    />
                    {optionLabel(s)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
