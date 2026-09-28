"use client";

import { ArrowDown, ArrowUp, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MediaUploader, updateMediaDescription } from "@/modules/media/client";

import { attachPhoto, detachPhoto, movePhoto, setCover } from "../actions";

export type WizardPhoto = {
  mediaId: string;
  altText: string | null;
  thumbnailUrl: string | null;
  processing: boolean;
};

function PhotoRow({
  activityId,
  photo,
  index,
  total,
  isCover,
}: {
  activityId: string;
  photo: WizardPhoto;
  index: number;
  total: number;
  isCover: boolean;
}) {
  const router = useRouter();
  const [alt, setAlt] = useState(photo.altText ?? "");
  const [message, setMessage] = useState<{ error?: string; notice?: string }>({});
  const [pending, startTransition] = useTransition();
  const label = photo.altText || `Foto ${index + 1}`;
  const inputId = `photo-alt-${photo.mediaId}`;

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setMessage({ error: result.error });
      else router.refresh();
    });

  const saveAlt = () => {
    if (alt.trim() === (photo.altText ?? "")) return;
    startTransition(async () => {
      const result = await updateMediaDescription(photo.mediaId, alt);
      setMessage(result.ok ? { notice: "Descripción guardada." } : { error: result.error });
      if (result.ok) router.refresh();
    });
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
      </div>

      <div className="grid gap-2">
        <Label htmlFor={inputId}>Descripción de la foto {index + 1}</Label>
        <input
          id={inputId}
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          onBlur={saveAlt}
          maxLength={300}
          placeholder="Qué se ve en la foto (sin nombres de menores)"
          className="h-12 w-full rounded-md border-[1.5px] border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap gap-1">
          {isCover ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              aria-label={`Usar como portada: ${label}`}
              onClick={() => run(() => setCover(activityId, photo.mediaId))}
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
              aria-label={`Subir: ${label}`}
              onClick={() => run(() => movePhoto(activityId, photo.mediaId, "up"))}
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
              aria-label={`Bajar: ${label}`}
              onClick={() => run(() => movePhoto(activityId, photo.mediaId, "down"))}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label={`Quitar de la actividad: ${label}`}
            onClick={() => run(() => detachPhoto(activityId, photo.mediaId))}
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

/**
 * Step 2 · Fotos: upload from the phone (same pipeline as Medios: no EXIF or
 * GPS), describe each photo, choose the cover and the order.
 */
export function PhotosStep({
  activityId,
  photos,
  coverMediaId,
}: {
  activityId: string;
  photos: WizardPhoto[];
  coverMediaId: string | null;
}) {
  const router = useRouter();

  const onUploaded = async (mediaId: string) => {
    const result = await attachPhoto(activityId, mediaId);
    router.refresh();
    return result.ok ? null : result.error;
  };

  return (
    <div className="grid gap-6">
      <MediaUploader title="Tomar o elegir fotos" onUploaded={onUploaded} />

      <section aria-labelledby="activity-photos-title">
        <h2
          id="activity-photos-title"
          className="mb-3 font-serif text-xl font-semibold text-green-900"
        >
          Fotos de la actividad ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="rounded-lg border bg-card p-4 text-ink-muted">
            Todavía no hay fotos. Si no eliges portada, se usa la primera.
          </p>
        ) : (
          <ol aria-label="Fotos de la actividad" className="divide-y rounded-lg border bg-card">
            {photos.map((photo, index) => (
              <PhotoRow
                key={photo.mediaId}
                activityId={activityId}
                photo={photo}
                index={index}
                total={photos.length}
                isCover={photo.mediaId === coverMediaId}
              />
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/admin/actividades/${activityId}/editar?paso=1`}>Atrás</Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/actividades/${activityId}/editar?paso=3`}>Siguiente</Link>
        </Button>
      </div>
    </div>
  );
}
