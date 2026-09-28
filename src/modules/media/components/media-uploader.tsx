"use client";

import { ImagePlus, RotateCcw, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getPublicEnv } from "@/lib/env/public";

import { discardUpload, finishUpload, requestUpload } from "../actions";
import { preparePhoto, UnreadablePhotoError, uploadWithProgress } from "../prepare";

type ItemStatus = "waiting" | "preparing" | "uploading" | "processing" | "done" | "error";

type Item = {
  key: string;
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
  mediaId?: string;
};

/** Two uploads at a time: fast on 4G without saturating a weak connection. */
const CONCURRENCY = 2;

const STATUS_TEXT: Record<Exclude<ItemStatus, "error">, string> = {
  waiting: "En espera",
  preparing: "Preparando…",
  uploading: "Subiendo",
  processing: "Procesando (quitando la ubicación y los datos ocultos)…",
  done: "Lista",
};

const UNREADABLE =
  "Este navegador no pudo abrir la foto. Si es de iPhone (HEIC), envíala como JPEG o cambia en Ajustes › Cámara › Formatos a «Más compatible».";

export function MediaUploader() {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const running = useRef(0);
  const queue = useRef<Item[]>([]);

  const update = useCallback((key: string, patch: Partial<Item>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const uploadOne = useCallback(
    async (item: Item) => {
      update(item.key, { status: "preparing", progress: 0, error: undefined });
      try {
        const photo = await preparePhoto(item.file);

        const request = await requestUpload({ type: photo.type, size: photo.size });
        if (!request.ok) return update(item.key, { status: "error", error: request.error });
        update(item.key, { status: "uploading", mediaId: request.mediaId });

        try {
          await uploadWithProgress(
            request.signedUrl,
            photo,
            getPublicEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
            (progress) => update(item.key, { progress }),
          );
        } catch {
          return update(item.key, {
            status: "error",
            error: "Se cortó la conexión mientras subía. Vuelve a intentarlo.",
          });
        }

        update(item.key, { status: "processing", progress: 100 });
        const result = await finishUpload(request.mediaId);
        update(item.key, result.ok ? { status: "done" } : { status: "error", error: result.error });
      } catch (error) {
        update(item.key, {
          status: "error",
          error:
            error instanceof UnreadablePhotoError
              ? UNREADABLE
              : "Algo falló al subir la foto. Vuelve a intentarlo.",
        });
      }
    },
    [update],
  );

  // Starts queued uploads while fewer than CONCURRENCY are running; each one
  // that ends starts the next
  const enqueue = (newItems: Item[]) => {
    queue.current.push(...newItems);
    const pump = () => {
      while (running.current < CONCURRENCY && queue.current.length > 0) {
        const next = queue.current.shift()!;
        running.current += 1;
        void uploadOne(next).finally(() => {
          running.current -= 1;
          pump();
        });
      }
    };
    pump();
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added = [...files].map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: "waiting" as const,
      progress: 0,
    }));
    setItems((current) => [...added, ...current]);
    enqueue(added);
  };

  // A retry starts over; an unfinished photo row is sent to the trash first
  const retry = async (item: Item) => {
    if (item.mediaId) await discardUpload(item.mediaId);
    const fresh = { ...item, mediaId: undefined, status: "waiting" as const, progress: 0 };
    update(item.key, fresh);
    enqueue([fresh]);
  };

  const remove = async (item: Item) => {
    if (item.mediaId) await discardUpload(item.mediaId);
    setItems((current) => current.filter((other) => other.key !== item.key));
  };

  return (
    <div className="grid gap-4">
      <div>
        <label
          htmlFor={inputId}
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-green-700/40 bg-card p-6 text-center focus-within:ring-2 focus-within:ring-ring hover:border-green-700"
        >
          <ImagePlus aria-hidden="true" className="size-8 text-green-700" />
          <span className="font-semibold text-green-900">Elegir fotos</span>
          <span className="text-sm text-ink-muted">
            Desde la galería o la cámara. Se les quita la ubicación antes de guardarlas.
          </span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul aria-label="Fotos que estás subiendo" className="divide-y rounded-lg border bg-card">
          {items.map((item) => (
            <li key={item.key} className="grid gap-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{item.file.name}</span>
                <span
                  role={item.status === "error" ? "alert" : "status"}
                  className={
                    item.status === "error"
                      ? "text-sm font-medium text-danger"
                      : item.status === "done"
                        ? "text-sm font-medium text-green-700"
                        : "text-sm text-ink-muted"
                  }
                >
                  {item.status === "error"
                    ? item.error
                    : item.status === "uploading"
                      ? `${STATUS_TEXT.uploading} ${item.progress} %`
                      : STATUS_TEXT[item.status]}
                </span>
              </div>

              {item.status === "uploading" || item.status === "processing" ? (
                <progress
                  className="h-2 w-full accent-green-700"
                  max={100}
                  value={item.status === "processing" ? undefined : item.progress}
                  aria-label={`Progreso de ${item.file.name}`}
                />
              ) : null}

              {item.status === "error" ? (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => retry(item)}>
                    <RotateCcw aria-hidden="true" />
                    Reintentar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(item)}>
                    <X aria-hidden="true" />
                    Quitar
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
