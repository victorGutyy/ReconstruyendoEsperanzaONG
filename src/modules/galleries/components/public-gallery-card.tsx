import Link from "next/link";

import { Photo } from "@/modules/site";

import { type GalleryCard, PUBLIC_GALLERIES_PATH } from "../public";

const DAY = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/** An album in a public list: cover, title, how many photos and its date. */
export function PublicGalleryCard({ gallery }: { gallery: GalleryCard }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-sm border bg-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2">
      {gallery.cover ? (
        <Photo
          photo={gallery.cover}
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3]"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[4/3] bg-paper-2" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-serif text-xl leading-snug font-semibold text-green-900">
          {/* The whole card opens the album; the link is the title */}
          <Link
            href={`${PUBLIC_GALLERIES_PATH}/${gallery.slug}`}
            className="outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline"
          >
            {gallery.title}
          </Link>
        </h3>
        <p className="mt-auto pt-2 text-sm text-ink-muted">
          {gallery.photoCount === 1 ? "1 foto" : `${gallery.photoCount} fotos`} ·{" "}
          <time dateTime={gallery.publishedAt}>{DAY.format(new Date(gallery.publishedAt))}</time>
        </p>
      </div>
    </article>
  );
}
