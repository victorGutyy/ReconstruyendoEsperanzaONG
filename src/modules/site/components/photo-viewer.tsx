"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState } from "react";

import { Photo, type PhotoData } from "./photo";

export type ViewerPhoto = PhotoData & { caption: string | null };

/**
 * Photo grid that opens an accessible viewer (step 8.2, RF-A-06): arrow keys
 * or buttons, swipe on phones, "3 de 10", alt text and caption. Esc closes it
 * and the focus goes back to the photo that opened it.
 */
export function PhotoViewer({ photos, label }: { photos: ViewerPhoto[]; label: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);
  // The photo that opened the viewer gets the focus back when it closes
  const openers = useRef<(HTMLButtonElement | null)[]>([]);
  const openedFrom = useRef(0);
  const count = photos.length;

  const go = (step: number) =>
    setIndex((current) => (current === null ? null : (current + step + count) % count));
  const photo = index === null ? null : photos[index]!;

  return (
    <>
      <ul aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((item, position) => (
          <li key={item.src}>
            <button
              type="button"
              ref={(element) => {
                openers.current[position] = element;
              }}
              onClick={() => {
                openedFrom.current = position;
                setIndex(position);
              }}
              className="block w-full cursor-zoom-in overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="sr-only">
                Ver foto {position + 1} de {count}:{" "}
              </span>
              <Photo
                photo={item}
                sizes="(min-width: 1024px) 18rem, (min-width: 640px) 33vw, 50vw"
                className="aspect-[4/3] transition-transform duration-200 hover:scale-[1.02]"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog.Root open={photo !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/90" />
          <Dialog.Content
            aria-describedby={photo?.caption ? "viewer-caption" : undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              openers.current[openedFrom.current]?.focus();
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
                    Foto {index! + 1} de {count}
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
    </>
  );
}
