"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { describeIssues, LibraryPicker } from "@/modules/media/client";

import { setPostCover } from "../actions";
import type { CoverInfo } from "../queries";

/** The story's cover, chosen from the library (one photo). */
export function CoverField({ postId, cover }: { postId: string; cover: CoverInfo | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choose = async (mediaIds: string[]) => {
    const result = await setPostCover(postId, mediaIds[0] ?? null);
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  };

  const remove = () =>
    startTransition(async () => {
      setError(null);
      const result = await setPostCover(postId, null);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <section aria-labelledby="cover-title" className="grid gap-3">
      <h2 id="cover-title" className="font-serif text-xl font-semibold text-green-900">
        Portada
      </h2>
      {cover ? (
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-paper-2">
            {cover.thumbnailUrl ? (
              // Short-lived signed URL from a private bucket: next/image cannot cache it
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.thumbnailUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="p-2 text-xs text-ink-muted">Sin vista previa</span>
            )}
          </div>
          <div className="grid content-start gap-2">
            <p className="font-medium">{cover.altText || "Foto sin descripción"}</p>
            {cover.issues.length > 0 ? (
              <p className="text-sm text-gold-700">
                {describeIssues(cover.issues)
                  .map((issue) => issue.badge)
                  .join(" · ")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <LibraryPicker
                exclude={[cover.mediaId]}
                onPick={choose}
                single
                triggerLabel="Cambiar portada"
                confirmLabel="Usar como portada"
              />
              <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
                <X aria-hidden="true" />
                Quitar portada
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <LibraryPicker
            exclude={[]}
            onPick={choose}
            single
            triggerLabel="Elegir portada"
            confirmLabel="Usar como portada"
          />
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
