"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import { Photo, type PhotoData } from "@/modules/site/client";

/**
 * A video on the public site (step 8.4): our own photo first, and the
 * provider's player only when the visitor asks for it. Until then nothing is
 * loaded from the provider (faster, and no third-party cookies). Facebook is
 * never embedded: it opens on Facebook.
 */
export function PublicVideoCard({
  video,
}: {
  video: {
    title: string;
    description: string | null;
    providerLabel: string;
    embed: string | null;
    watch: string;
    cover: PhotoData | null;
  };
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-sm border bg-card">
      <div className="relative aspect-video bg-ink">
        {playing && video.embed ? (
          <iframe
            src={`${video.embed}${video.embed.includes("?") ? "&" : "?"}autoplay=1`}
            title={`Video: ${video.title}`}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        ) : (
          <>
            {video.cover ? (
              <Photo
                photo={video.cover}
                sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                className="absolute inset-0 size-full"
              />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
              {video.embed ? (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label={`Reproducir: ${video.title}`}
                  className="inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-full bg-paper px-5 font-semibold text-green-900 shadow-lg outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  <Play aria-hidden="true" className="size-5 fill-current" />
                  Reproducir
                </button>
              ) : (
                <a
                  href={video.watch}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver en ${video.providerLabel}: ${video.title} (se abre en otra pestaña)`}
                  className="inline-flex min-h-14 items-center gap-2 rounded-full bg-paper px-5 font-semibold text-green-900 shadow-lg outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  <Play aria-hidden="true" className="size-5 fill-current" />
                  Ver en {video.providerLabel}
                </a>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-serif text-xl leading-snug font-semibold text-green-900">
          {video.title}
        </h3>
        {video.description ? <p className="text-ink-muted">{video.description}</p> : null}
        {video.embed ? (
          <p className="mt-auto pt-2 text-sm">
            <a
              href={video.watch}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-ink-muted underline underline-offset-4"
            >
              Ver en {video.providerLabel}
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}
