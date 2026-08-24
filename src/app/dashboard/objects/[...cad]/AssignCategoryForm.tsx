"use client";

import { useActionState, useRef, useState } from "react";
import { Save, Send, Plus, X, ImagePlus } from "lucide-react";
import { ASSIGNABLE_CATEGORIES } from "@/lib/categories";
import { assignCategoryAction, type AssignState } from "../actions";

// Server bilan bir xil chegaralar (documents.ts → MAX_IMAGE_ATTACHMENTS/MAX_IMAGE_UPLOAD_BYTES).
// Client komponent bo'lgani uchun server modulidan import qilinmaydi — qiymatlar shu yerda takrorlanadi.
const MAX_IMAGES = 4;
const MAX_IMAGE_MB = 5;

// isRequest=true — Hudud ijrochisi: so'rov yuboradi (Moderator → Rahbariyat tasdiqlaydi).
export function AssignCategoryForm({ cadNumber, isRequest }: { cadNumber: string; isRequest: boolean }) {
  const [state, formAction, pending] = useActionState<AssignState, FormData>(assignCategoryAction, {});
  const [imageError, setImageError] = useState<string | null>(null);

  // ── Rasm slotlari ──
  // ⚠️ Bitta `multiple` input o'rniga HAR BIR rasm uchun ALOHIDA input: foydalanuvchi
  // rasmlarni birin-ketin qo'shadi ("+" tugmasi bilan), oldingilarini yo'qotmasdan
  // (talab, 2026-08-25). Bu `multiple` bilan ishlamasdi — ikkinchi marta tanlash
  // birinchi tanlovni butunlay almashtirib yuborardi.
  //
  // Bir nechta input BIR XIL `name="images"` bilan yuboriladi va server tomonda
  // `formData.getAll("images")` ularning hammasini oladi — qo'shimcha mantiq shart emas.
  const nextId = useRef(1);
  const [slots, setSlots] = useState<number[]>([0]);
  const [picked, setPicked] = useState<Record<number, { name: string; tooBig: boolean }>>({});

  const filledCount = Object.keys(picked).length;
  // "+" faqat hamma mavjud slot to'ldirilgan va chegaraga yetmagan bo'lsa chiqadi.
  const canAdd = slots.length < MAX_IMAGES && filledCount === slots.length;

  function refreshError(next: Record<number, { name: string; tooBig: boolean }>) {
    const big = Object.values(next).some((p) => p.tooBig);
    setImageError(big ? `Har bir rasm ${MAX_IMAGE_MB}MB dan oshmasligi kerak` : null);
  }

  function onPick(id: number, file: File | undefined) {
    setPicked((prev) => {
      const next = { ...prev };
      if (!file) delete next[id];
      else next[id] = { name: file.name, tooBig: file.size > MAX_IMAGE_MB * 1024 * 1024 };
      refreshError(next);
      return next;
    });
  }

  function removeSlot(id: number) {
    setSlots((prev) => (prev.length === 1 ? prev : prev.filter((s) => s !== id)));
    setPicked((prev) => {
      const next = { ...prev };
      delete next[id];
      refreshError(next);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="cadNumber" value={cadNumber} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Kategoriya</label>
        <select name="categoryCode" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Tanlang...</option>
          {ASSIGNABLE_CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.nameUz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Izoh (ixtiyoriy)</label>
        <textarea name="note" rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Asoslovchi hujjat (PDF)</label>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">PDF majburiy. Maks: 15MB.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Rasmlar (ixtiyoriy)
          <span className="ml-1 font-normal text-muted-foreground">
            {filledCount}/{MAX_IMAGES}
          </span>
        </label>

        <div className="space-y-2">
          {slots.map((id, i) => (
            <div key={id} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
              <input
                type="file"
                name="images"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPick(id, e.target.files?.[0])}
                className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm ${
                  picked[id]?.tooBig ? "file:bg-red-100 file:text-red-700" : "file:bg-slate-100"
                }`}
              />
              {slots.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeSlot(id)}
                  title="Bu rasmni olib tashlash"
                  className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {canAdd ? (
          <button
            type="button"
            onClick={() => {
              const id = nextId.current++;
              setSlots((prev) => [...prev, id]);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-cobalt hover:text-cobalt"
          >
            <Plus className="h-3.5 w-3.5" />
            Yana rasm qo&apos;shish
          </button>
        ) : null}

        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5 shrink-0" />
          JPG, PNG yoki WEBP — ko&apos;pi bilan {MAX_IMAGES} ta, har biri {MAX_IMAGE_MB}MB gacha.
        </p>
        {imageError ? <p className="mt-1 text-xs text-red-700">{imageError}</p> : null}
      </div>

      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {isRequest ? "So'rov yuborildi ✓ (Moderator ko'rib chiqishini kuting)" : "Biriktirildi ✓"}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !!imageError}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--navy)" }}
      >
        {isRequest ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {pending ? "Yuborilmoqda..." : isRequest ? "So'rov yuborish" : "Biriktirish"}
      </button>
    </form>
  );
}
