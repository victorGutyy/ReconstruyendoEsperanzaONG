"use client";

import { ArrowDown, ArrowUp, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { describeIssues, LibraryPicker } from "@/modules/media/client";

import {
  addGalleryPhotos,
  moveGalleryPhoto,
  removeGalleryPhoto,
  setGalleryCaption,
  setGalleryCover,
} from "../actions";
import type { GalleryPhoto } from "../queries";

type Result = { ok: true } | { ok: false; error: string };

function PhotoRow({
  galleryId,
  photo,
  index,
  total,
  isCover,
}: {
  galleryId: string;
  photo: GalleryPhoto;
  index: number;
  total: number;
  isCover: boolean;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [message, setMessage] = useState<{ error?: string; notice?: string }>({});
  const [pending, startTransition] = useTransition();
  const inputId = `gallery-caption-${photo.mediaId}`;

  const run = (action: () => Promise<Result>, notice?: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { notice } : { error: result.error });
      if (result.ok) router.refresh();
    });

  const saveCaption = () => {
    if (caption.trim() === (photo.caption ?? "")) return;
    run(() => setGalleryCaption(galleryId, photo.mediaId, caption), "Pie de foto guardado.");
  };

  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[8rem_1fr]">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-paper-2">
        {photo.thumbnailUrl ? (
          // Short-lived signed URL from a private bucket: next/image cannot cache it
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="p-2 text-center text-xs text-ink-muted">
            {photo.processing ? "Procesando…" : "Sin vista previa"}
          </span>
        )}
        {isCover ? (
          <span className="absolute top-1 left-1 rounded-sm bg-green-700 px-1.5 py-0.5 text-xs font-semibold text-paper">
            Portada
          </span>
        ) : null}
        {photo.isPublic ? (
          <span className="absolute right-1 bottom-1 rounded-sm bg-paper px-1.5 py-0.5 text-xs font-semibold text-green-900">
            En el sitio
          </span>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className="font-medium">{photo.label}</p>
        {photo.issues.length > 0 ? (
          <p className="text-sm text-gold-700">
            {describeIssues(photo.issues)
              .map((issue) => issue.badge)
              .join(" · ")}
          </p>
        ) : null}
        <Label htmlFor={inputId}>Pie de foto en esta galería (opcional)</Label>
        <input
          id={inputId}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={saveCaption}
          maxLength={300}
          className="h-12 w-full rounded-md border-[1.5px] border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap gap-1">
          {isCover ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              aria-label={`Usar como portada: ${photo.label}`}
              onClick={() => run(() => setGalleryCover(galleryId, photo.mediaId))}
            >
              <Star aria-hidden="true" />
              Portada
            </Button>
          )}
          {index > 0 ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              aria-label={`Subir: ${photo.label}`}
              onClick={() => run(() => moveGalleryPhoto(galleryId, photo.mediaId, "up"))}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
          ) : null}
          {index < total - 1 ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={pending}
              aria-label={`Bajar: ${photo.label}`}
              onClick={() => run(() => moveGalleryPhoto(galleryId, photo.mediaId, "down"))}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label={`Quitar de la galería: ${photo.label}`}
            onClick={() => run(() => removeGalleryPhoto(galleryId, photo.mediaId))}
          >
            <X aria-hidden="true" />
            Quitar
          </Button>
        </div>
        <div aria-live="polite">
          {message.error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {message.error}
            </p>
          ) : message.notice ? (
            <p className="text-sm text-green-700">{message.notice}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** The gallery's photos: picked from the library, in order, with captions. */
export function GalleryPhotos({
  galleryId,
  photos,
  coverMediaId,
}: {
  galleryId: string;
  photos: GalleryPhoto[];
  coverMediaId: string | null;
}) {
  const router = useRouter();

  const onPick = async (mediaIds: string[]) => {
    const result = await addGalleryPhotos(galleryId, mediaIds);
    router.refresh();
    return result.ok ? null : result.error;
  };

  return (
    <section aria-labelledby="gallery-photos-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gallery-photos-title" className="font-serif text-xl font-semibold text-green-900">
          Fotos de la galería ({photos.length})
        </h2>
        <LibraryPicker
          exclude={photos.map((photo) => photo.mediaId)}
          onPick={onPick}
          triggerLabel="Agregar fotos de la biblioteca"
          confirmLabel="Agregar a la galería"
        />
      </div>
      {photos.length === 0 ? (
        <p className="rounded-lg border bg-card p-4 text-ink-muted">
          Todavía no hay fotos. Súbelas en Medios y agrégalas desde la biblioteca.
        </p>
      ) : (
        <ol aria-label="Fotos de la galería" className="divide-y rounded-lg border bg-card">
          {photos.map((photo, index) => (
            <PhotoRow
              key={photo.mediaId}
              galleryId={galleryId}
              photo={photo}
              index={index}
              total={photos.length}
              isCover={photo.mediaId === coverMediaId}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
