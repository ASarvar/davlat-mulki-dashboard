"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import type { Region } from "@/lib/regions";

type Props = {
  regions: Region[];
  categories: Category[]; // faqat qo'lda kiritiladigan kategoriyalar
  regionId: string;
  categoryId: string;
  initialCount: number;
  initialFileName: string | null;
  initialFileUrl: string | null;
};

export default function EntryForm({
  regions,
  categories,
  regionId,
  categoryId,
  initialCount,
  initialFileName,
  initialFileUrl,
}: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  const activeCategory = categories.find((c) => c.id === categoryId);

  function goTo(nextRegion: string, nextCategory: string) {
    router.push(`/kiritish?region=${nextRegion}&category=${nextCategory}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("regionId", regionId);
      formData.set("categoryId", categoryId);
      formData.set("count", String(count));
      if (file) formData.set("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Noma'lum xatolik");
      }

      setMessage({ type: "success", text: "Ma'lumot muvaffaqiyatli saqlandi." });
      setFile(null);
      router.refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Saqlashda xatolik yuz berdi.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Hudud
          </label>
          <select
            value={regionId}
            onChange={(e) => goTo(e.target.value, categoryId)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-navy"
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Kategoriya (qo'lda kiritiladigan)
          </label>
          <select
            value={categoryId}
            onChange={(e) => goTo(regionId, e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-navy"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.order}. {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeCategory && (
        <p className="mb-5 rounded-lg bg-amber-light/50 px-3 py-2 text-xs text-amber">
          Bu yozuv faqat "{activeCategory.order}. {activeCategory.name}"
          kategoriyasiga tegishli bo'ladi. Biriktirilgan fayl boshqa
          kategoriyalarda ko'rinmaydi va ishlatilmaydi.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Obyektlar soni
          </label>
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm tabular-figures text-ink outline-none focus:border-navy"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Asos fayl (PDF, Word, Excel yoki rasm, 10&nbsp;MB gacha)
          </label>
          {initialFileName && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-ink">
              <span className="truncate">Joriy fayl: {initialFileName}</span>
              {initialFileUrl && (
                <a
                  href={initialFileUrl}
                  target="_blank"
                  className="ml-auto shrink-0 font-medium text-teal hover:underline"
                >
                  Ko'rish
                </a>
              )}
            </div>
          )}
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-dashed border-border bg-bg px-3 py-2 text-sm text-ink outline-none file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
          <p className="mt-1 text-xs text-muted">
            {initialFileName
              ? "Yangi fayl tanlasangiz, eskisi almashtiriladi."
              : "Fayl tanlamasangiz, faqat son saqlanadi."}
          </p>
        </div>

        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-teal" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-dark disabled:opacity-50"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </form>
    </div>
  );
}
