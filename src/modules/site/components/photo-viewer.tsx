"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { Photo, type PhotoData } from "./photo";

export type ViewerPhoto = PhotoData & { caption: string | null };

const PhotoViewerDialog = dynamic(() => import("./photo-viewer-dialog"), { ssr: false });
const loadViewer = () => void import("./photo-viewer-dialog");

/**
 * Photo grid that opens an accessible viewer (step 8.2, RF-A-06): arrow keys
 * or buttons, swipe on phones, "3 de 10", alt text and caption. Esc closes it
 * and the focus goes back to the photo that opened it. The viewer loads when
 * a photo is touched or reached with the keyboard (step 9.6).
 */
export function PhotoViewer({ photos, label }: { photos: ViewerPhoto[]; label: string }) {
  const [index, setIndex] = useState<number | null>(null);
  // The photo that opened the viewer gets the focus back when it closes
  const openers = useRef<(HTMLButtonElement | null)[]>([]);
  const openedFrom = useRef(0);
  const count = photos.length;

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
              onPointerDown={loadViewer}
              onFocus={loadViewer}
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

      {index !== null ? (
        <PhotoViewerDialog
          photos={photos}
          index={index}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
          focusOpener={() => openers.current[openedFrom.current]?.focus()}
        />
      ) : null}
    </>
  );
}
