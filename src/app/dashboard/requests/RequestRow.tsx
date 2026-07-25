"use client";

import { useActionState, useState } from "react";
import { Check, X, ExternalLink, ImageIcon } from "lucide-react";
import { reviewRequestAction, type ReviewState } from "./actions";

export interface RequestRowData {
  id: string;
  stage: "PENDING_MODERATOR" | "PENDING_RAHBARIYAT";
  cadNumber: string;
  regionName: string;
  requestedBy: string;
  moderatorName: string | null;
  toCategoryName: string;
  note: string | null;
  documentId: string | null;
  documentName: string | null;
  images: { id: string; fileName: string }[];
  createdAt: string;
  objectHref: string;
}

export function RequestRow({ req }: { req: RequestRowData }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewRequestAction, {});
  const [note, setNote] = useState("");

  const isModeratorStage = req.stage === "PENDING_MODERATOR";
  // Rad etish sababi majburiy — ijrochi nima uchun rad etilganini bilishi kerak.
  const canReject = note.trim().length > 0;

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3">
        <a href={req.objectHref} className="font-medium hover:underline" style={{ color: "var(--cobalt)" }}>
          {req.cadNumber}
        </a>
        <p className="text-xs text-muted-foreground">{req.regionName}</p>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            isModeratorStage ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800"
          }`}
        >
          {isModeratorStage ? "1 — Moderator" : "2 — Rahbariyat"}
        </span>
        {!isModeratorStage && req.moderatorName ? (
          <p className="mt-1 text-xs text-muted-foreground">Qabul qildi: {req.moderatorName}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium">{req.toCategoryName}</p>
        {req.note ? <p className="text-xs text-muted-foreground">{req.note}</p> : null}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {req.requestedBy}
        <br />
        <span className="text-xs">{req.createdAt}</span>
      </td>
      <td className="px-4 py-3">
        {req.documentId ? (
          <a
            href={`/api/documents/${req.documentId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm hover:underline"
            style={{ color: "var(--cobalt)" }}
          >
            {req.documentName ?? "Hujjat"} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          "—"
        )}
        {req.images.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {req.images.map((img, i) => (
              <a
                key={img.id}
                href={`/api/documents/${img.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: "var(--cobalt)" }}
              >
                <ImageIcon className="h-3 w-3" />
                Rasm {i + 1}
              </a>
            ))}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <form action={action} className="space-y-2">
          <input type="hidden" name="requestId" value={req.id} />
          <input type="hidden" name="stage" value={req.stage} />
          <input
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Izoh (rad etishda majburiy)"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              name="decision"
              value="approve"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {isModeratorStage ? "Qabul qilish" : "Tasdiqlash"}
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              disabled={pending || !canReject}
              title={canReject ? undefined : "Avval rad etish sababini yozing"}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Rad etish
            </button>
          </div>
          {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
          {state.ok ? <p className="text-xs text-emerald-700">{state.ok}</p> : null}
        </form>
      </td>
    </tr>
  );
}
