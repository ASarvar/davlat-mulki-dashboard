"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * API 2 xom javobini ko'rsatish + nusxalash. Client komponent faqat "Nusxalash"
 * tugmasi uchun — JSON'ning o'zi serverda render qilinadi.
 */
export function JsonView({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API HTTPS'siz muhitda ishlamasligi mumkin — jim o'tamiz,
      // foydalanuvchi matnni qo'lda belgilab nusxalay oladi.
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Nusxalandi" : "Nusxalash"}
      </button>
      <pre className="max-h-[70vh] overflow-auto rounded-xl bg-slate-900 p-4 pr-28 text-xs leading-relaxed text-slate-100">
        {json}
      </pre>
    </div>
  );
}
