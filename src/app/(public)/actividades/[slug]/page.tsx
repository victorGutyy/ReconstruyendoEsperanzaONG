import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/rich-text/rich-text";
import { absoluteUrl } from "@/lib/site/url";
import { PublicActivityCard } from "@/modules/activities/components/public-activity-card";
import { getPublicActivity, listRelatedActivities } from "@/modules/activities/public";
import {
  formatActivityDate,
  formatActivityTime,
  PUBLIC_ACTIVITIES_PATH,
  publicActivitiesHref,
} from "@/modules/activities/public-filters";
import { PUBLIC_PROJECTS_PATH } from "@/modules/projects/public-format";
import { getSiteSettings, isPending } from "@/modules/settings";
import { PublicVideoCard } from "@/modules/videos/components/public-video-card";
import { listPublicVideos } from "@/modules/videos/public";
import { Breadcrumbs, Photo, PhotoViewer, ShareButtons } from "@/modules/site";

// Built on the first visit and cached; publishing or retiring refreshes it
export const revalidate = 300;

/** None at build time (it has no database): each page is built when first visited. */
export async function generateStaticParams() {
  return [];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function load(slug: string) {
  return SLUG.test(slug) && slug.length <= 120 ? getPublicActivity(slug) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/actividades/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const activity = await load(slug);
  if (!activity) return { title: "Actividad no encontrada" };

  const settings = await getSiteSettings();
  const fallback = isPending(settings.seoDescription) ? undefined : settings.seoDescription;
  const description = activity.seoDescription ?? activity.summary ?? fallback ?? undefined;
  const url = absoluteUrl(`${PUBLIC_ACTIVITIES_PATH}/${activity.slug}`);

  return {
    title: activity.seoTitle ?? activity.title,
    description,
    alternates: { canonical: url },
    // What WhatsApp and the networks show when the link is shared (HU-02)
    openGraph: {
      type: "article",
      url,
      title: activity.title,
      description,
      siteName: settings.organizationName,
      locale: "es_CO",
      publishedTime: activity.publishedAt,
      images: activity.cover
        ? [
            {
              url: activity.cover.large,
              width: Math.min(activity.cover.width, 1920),
              height: Math.round(
                (Math.min(activity.cover.width, 1920) / activity.cover.width) *
                  activity.cover.height,
              ),
              alt: activity.cover.alt,
            },
          ]
        : undefined,
    },
    twitter: { card: activity.cover ? "summary_large_image" : "summary" },
  };
}

export default async function ActivityPage({ params }: PageProps<"/actividades/[slug]">) {
  const { slug } = await params;
  const activity = await load(slug);
  if (!activity) notFound();

  const [related, videos] = await Promise.all([
    listRelatedActivities(activity.id, activity.categoryId),
    listPublicVideos({ activityId: activity.id }),
  ]);
  const time = formatActivityTime(activity.startsAt);
  const url = absoluteUrl(`${PUBLIC_ACTIVITIES_PATH}/${activity.slug}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Inicio" },
          { href: PUBLIC_ACTIVITIES_PATH, label: "Actividades" },
          { label: activity.title },
        ]}
      />

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article>
          {activity.category ? (
            <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
              {activity.category}
            </p>
          ) : null}
          <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold text-green-900 md:text-5xl">
            {activity.title}
          </h1>
          {activity.summary ? (
            <p className="mt-4 text-lg text-ink-muted">{activity.summary}</p>
          ) : null}

          {activity.cover ? (
            <figure className="mt-6">
              <Photo
                photo={activity.cover}
                sizes="(min-width: 1024px) 48rem, 100vw"
                priority
                className="max-h-[36rem] rounded-sm"
              />
            </figure>
          ) : null}

          {activity.body ? <RichText doc={activity.body} className="mt-8" /> : null}

          {activity.results ? (
            <section aria-labelledby="results-title" className="mt-10">
              <h2
                id="results-title"
                className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
              >
                Resultados
              </h2>
              <p className="mt-1 text-sm text-ink-muted">Reportados por la organización.</p>
              <p className="mt-4 whitespace-pre-line">{activity.results}</p>
            </section>
          ) : null}

          {activity.photos.length > 0 ? (
            <section aria-labelledby="photos-title" className="mt-10">
              <h2
                id="photos-title"
                className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
              >
                Fotos
              </h2>
              <div className="mt-4">
                <PhotoViewer photos={activity.photos} label="Fotos de la actividad" />
              </div>
            </section>
          ) : null}

          {videos.length > 0 ? (
            <section aria-labelledby="videos-title" className="mt-10">
              <h2
                id="videos-title"
                className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
              >
                Videos
              </h2>
              <ul className="mt-4 grid gap-6 sm:grid-cols-2">
                {videos.map((video) => (
                  <li key={video.id}>
                    <PublicVideoCard video={video} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        <aside className="grid content-start gap-6">
          <section aria-labelledby="facts-title" className="rounded-sm border bg-card p-4">
            <h2 id="facts-title" className="font-serif text-lg font-semibold text-green-900">
              Ficha
            </h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold">Fecha</dt>
                <dd>
                  <time dateTime={activity.startsAt}>
                    {formatActivityDate(activity.startsAt, activity.endsAt)}
                  </time>
                  {time ? ` · ${time}` : ""}
                </dd>
              </div>
              {activity.place ? (
                <div>
                  <dt className="font-semibold">Lugar</dt>
                  <dd>{activity.place}</dd>
                </div>
              ) : null}
              {activity.category && activity.categorySlug ? (
                <div>
                  <dt className="font-semibold">Categoría</dt>
                  <dd>
                    <a
                      href={publicActivitiesHref(
                        { year: null, category: null, place: null, page: 1 },
                        { category: activity.categorySlug },
                      )}
                      className="inline-flex min-h-11 items-center underline underline-offset-4"
                    >
                      {activity.category}
                    </a>
                  </dd>
                </div>
              ) : null}
              {activity.project ? (
                <div>
                  <dt className="font-semibold">Proyecto</dt>
                  <dd>
                    <Link
                      href={`${PUBLIC_PROJECTS_PATH}/${activity.project.slug}`}
                      className="inline-flex min-h-11 items-center underline underline-offset-4"
                    >
                      {activity.project.title}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {activity.tags.length > 0 ? (
                <div>
                  <dt className="font-semibold">Etiquetas</dt>
                  <dd>{activity.tags.join(" · ")}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <ShareButtons url={url} title={activity.title} />

          {related.length > 0 ? (
            <section aria-labelledby="related-title">
              <h2 id="related-title" className="font-serif text-lg font-semibold text-green-900">
                Relacionadas
              </h2>
              <ul className="mt-3 grid gap-4">
                {related.map((item) => (
                  <li key={item.id}>
                    <PublicActivityCard activity={item} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
