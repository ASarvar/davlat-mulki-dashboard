"use client";

import { useActionState, useState } from "react";
import { Save, Send } from "lucide-react";
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
  const [imageCount, setImageCount] = useState(0);

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
        <label className="mb-1 block text-sm font-medium text-slate-700">Rasmlar (ixtiyoriy)</label>
        <input
          type="file"
          name="images"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            const n = files?.length ?? 0;
            setImageCount(n);
            if (n > MAX_IMAGES) {
              setImageError(`Ko'pi bilan ${MAX_IMAGES} ta rasm tanlash mumkin`);
              return;
            }
            const tooBig = files && Array.from(files).some((f) => f.size > MAX_IMAGE_MB * 1024 * 1024);
            setImageError(tooBig ? `Har bir rasm ${MAX_IMAGE_MB}MB dan oshmasligi kerak` : null);
          }}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG yoki WEBP — ko&apos;pi bilan {MAX_IMAGES} ta, har biri {MAX_IMAGE_MB}MB gacha.
          {imageCount > 0 ? ` Tanlangan: ${imageCount} ta.` : ""}
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
