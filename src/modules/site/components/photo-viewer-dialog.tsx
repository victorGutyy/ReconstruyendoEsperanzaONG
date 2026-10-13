"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef } from "react";

import type { ViewerPhoto } from "./photo-viewer";

// The viewer itself (step 9.6): loaded only when someone opens a photo, so the
// dialog library is not part of every activity or album page (docs/07 §10).

export default function PhotoViewerDialog({
  photos,
  index,
  onIndex,
  onClose,
  focusOpener,
}: {
  photos: ViewerPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** Gives the focus back to the photo that opened the viewer. */
  focusOpener: () => void;
}) {
  const touchStart = useRef<number | null>(null);
  const count = photos.length;
  const go = (step: number) => onIndex((index + step + count) % count);
  const photo = photos[index]!;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/90" />
        <Dialog.Content
          aria-describedby={photo?.caption ? "viewer-caption" : undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusOpener();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") go(1);
            if (event.key === "ArrowLeft") go(-1);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = null;
            if (start === null || end === undefined || Math.abs(end - start) < 50) return;
            go(end < start ? 1 : -1);
          }}
          className="fixed inset-0 z-50 flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-paper outline-none"
        >
          {photo ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <Dialog.Title className="text-sm font-semibold" aria-live="polite">
                  Foto {index + 1} de {count}
                </Dialog.Title>
                <Dialog.Close className="flex size-11 cursor-pointer items-center justify-center rounded-md outline-none hover:bg-paper/10 focus-visible:ring-2 focus-visible:ring-paper">
                  <X aria-hidden="true" className="size-6" />
                  <span className="sr-only">Cerrar</span>
                </Dialog.Close>
              </div>

              <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={photo.src}
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="100vw"
                  width={photo.width}
                  height={photo.height}
                  alt={photo.alt}
                  className="max-h-full min-h-0 w-auto max-w-full object-contain"
                />
                {photo.caption ? (
                  <figcaption id="viewer-caption" className="max-w-2xl text-center text-sm">
                    {photo.caption}
                  </figcaption>
                ) : null}
              </figure>

              {count > 1 ? (
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-4 outline-none hover:bg-paper/10 focus-visible:ring-2 focus-visible:ring-paper"
                  >
                    <ChevronLeft aria-hidden="true" className="size-5" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-4 outline-none hover:bg-paper/10 focus-visible:ring-2 focus-visible:ring-paper"
                  >
                    Siguiente
                    <ChevronRight aria-hidden="true" className="size-5" />
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
