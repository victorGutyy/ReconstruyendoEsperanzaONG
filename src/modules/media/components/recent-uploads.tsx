"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { discardUpload } from "../actions";
import type { RecentUpload } from "../queries";

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function DiscardButton({ mediaId }: { mediaId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => void discardUpload(mediaId))}
    >
      Quitar
    </Button>
  );
}

/** The person's latest photos; the full library (descriptions, people) is step 6.4. */
export function RecentUploads({ uploads }: { uploads: RecentUpload[] }) {
  if (uploads.length === 0) {
    return <p className="text-ink-muted">Todavía no has subido fotos.</p>;
  }

  return (
    <ul
      aria-label="Mis fotos recientes"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {uploads.map((upload) => (
        <li key={upload.id} className="overflow-hidden rounded-lg border bg-card">
          <div className="flex aspect-[4/3] items-center justify-center bg-paper-2">
            {upload.thumbnailUrl ? (
              // Short-lived signed URL from a private bucket: next/image cannot cache it
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={upload.thumbnailUrl}
                alt="Foto sin descripción todavía"
                width={upload.width ?? undefined}
                height={upload.height ?? undefined}
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <span className="px-2 text-center text-sm text-ink-muted">
                {upload.status === "failed" ? "No se pudo procesar" : "Sin terminar"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 p-2 text-xs text-ink-muted">
            <time dateTime={upload.createdAt}>{dateFormat.format(new Date(upload.createdAt))}</time>
            {upload.status === "ready" ? null : <DiscardButton mediaId={upload.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
