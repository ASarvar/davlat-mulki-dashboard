"use client";

import { useActionState } from "react";
import { Check, X, ExternalLink } from "lucide-react";
import { reviewRequestAction, type ReviewState } from "./actions";

export interface RequestRowData {
  id: string;
  cadNumber: string;
  regionName: string;
  requestedBy: string;
  toCategoryName: string;
  note: string | null;
  documentId: string | null;
  documentName: string | null;
  createdAt: string;
  objectHref: string;
}

export function RequestRow({ req }: { req: RequestRowData }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewRequestAction, {});

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3">
        <a href={req.objectHref} className="font-medium hover:underline" style={{ color: "var(--cobalt)" }}>
          {req.cadNumber}
        </a>
        <p className="text-xs text-muted-foreground">{req.regionName}</p>
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
      </td>
      <td className="px-4 py-3">
        <form action={action} className="space-y-2">
          <input type="hidden" name="requestId" value={req.id} />
          <input name="note" placeholder="Izoh (ixtiyoriy)" className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" />
          <div className="flex gap-2">
            <button
              type="submit"
              name="decision"
              value="approve"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              Tasdiqlash
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              disabled={pending}
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
