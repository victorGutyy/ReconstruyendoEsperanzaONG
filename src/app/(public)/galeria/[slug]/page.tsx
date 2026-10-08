import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { absoluteUrl } from "@/lib/site/url";
import { PUBLIC_ACTIVITIES_PATH } from "@/modules/activities/public-filters";
import { getPublicGallery, PUBLIC_GALLERIES_PATH } from "@/modules/galleries/public";
import { PUBLIC_PROJECTS_PATH } from "@/modules/projects/public-format";
import { getSiteSettings, isPending } from "@/modules/settings";
import { Breadcrumbs, PhotoViewer, ShareButtons } from "@/modules/site";

// Built on the first visit and cached; publishing or retiring refreshes it
export const revalidate = 300;

/** None at build time (it has no database): each page is built when first visited. */
export async function generateStaticParams() {
  return [];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function load(slug: string) {
  return SLUG.test(slug) && slug.length <= 120 ? getPublicGallery(slug) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/galeria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await load(slug);
  if (!gallery) return { title: "Álbum no encontrado" };

  const settings = await getSiteSettings();
  const fallback = isPending(settings.seoDescription) ? undefined : settings.seoDescription;
  const description = gallery.seoDescription ?? gallery.description ?? fallback ?? undefined;
  const url = absoluteUrl(`${PUBLIC_GALLERIES_PATH}/${gallery.slug}`);
  const cover = gallery.cover;
  const ogWidth = cover ? Math.min(cover.width, 1920) : 0;

  return {
    title: gallery.seoTitle ?? gallery.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: gallery.title,
      description,
      siteName: settings.organizationName,
      locale: "es_CO",
      images: cover
        ? [
            {
              url: cover.large,
              width: ogWidth,
              height: Math.round((ogWidth / cover.width) * cover.height),
              alt: cover.alt,
            },
          ]
        : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary" },
  };
}

export default async function GalleryPage({ params }: PageProps<"/galeria/[slug]">) {
  const { slug } = await params;
  const gallery = await load(slug);
  if (!gallery) notFound();

  const url = absoluteUrl(`${PUBLIC_GALLERIES_PATH}/${gallery.slug}`);
  const owner = gallery.owner;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Inicio" },
          { href: PUBLIC_GALLERIES_PATH, label: "Galería" },
          { label: gallery.title },
        ]}
      />

      <h1 className="mt-4 font-serif text-4xl leading-tight font-semibold text-green-900 md:text-5xl">
        {gallery.title}
      </h1>
      {owner ? (
        <p className="mt-2 text-ink-muted">
          {owner.kind === "activity" ? "De la actividad " : "Del proyecto "}
          <Link
            href={`${owner.kind === "activity" ? PUBLIC_ACTIVITIES_PATH : PUBLIC_PROJECTS_PATH}/${owner.slug}`}
            className="inline-flex min-h-11 items-center font-medium text-green-700 underline underline-offset-4"
          >
            {owner.title}
          </Link>
        </p>
      ) : null}
      {gallery.description ? (
        <p className="mt-4 max-w-3xl text-lg whitespace-pre-line text-ink-muted">
          {gallery.description}
        </p>
      ) : null}

      {gallery.photos.length > 0 ? (
        <div className="mt-8">
          <PhotoViewer photos={gallery.photos} label="Fotos del álbum" />
        </div>
      ) : (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          Este álbum no tiene fotos para mostrar por ahora.
        </p>
      )}

      <div className="mt-10 border-t pt-6">
        <ShareButtons url={url} title={gallery.title} />
      </div>
    </div>
  );
}
