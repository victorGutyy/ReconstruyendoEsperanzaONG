import { HandHeart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PublicActivityCard } from "@/modules/activities/components/public-activity-card";
import { listPublicActivities } from "@/modules/activities/public";
import { formatActivityDate, PUBLIC_ACTIVITIES_PATH } from "@/modules/activities/public-filters";
import { PublicPostCard } from "@/modules/posts/components/public-post-card";
import { listPublicPosts } from "@/modules/posts/public";
import { formatPostDate, PUBLIC_POSTS_PATH } from "@/modules/posts/public-filters";
import { PublicProjectCard } from "@/modules/projects/components/public-project-card";
import { listPublicProjects } from "@/modules/projects/public";
import { PUBLIC_PROJECTS_PATH } from "@/modules/projects/public-format";
import { getSiteSettings, isPending } from "@/modules/settings";
import { Photo, pickFeatured, without } from "@/modules/site";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    description: isPending(settings.seoDescription) ? undefined : settings.seoDescription,
    alternates: { canonical: "/" },
  };
}

const sectionTitle =
  "border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900";
const moreLink =
  "mt-4 inline-flex min-h-11 items-center font-medium text-green-700 underline underline-offset-4";

/** Editorial home page (step 8.5, docs/07 §6.1–6.2): each block only when it has content. */
export default async function Home() {
  const [settings, activities, posts, projectGroups] = await Promise.all([
    getSiteSettings(),
    listPublicActivities({ year: null, category: null, place: null, page: 1 }),
    listPublicPosts({ category: null, page: 1 }),
    listPublicProjects(),
  ]);

  const featured = pickFeatured(posts.posts, activities.past);
  const featuredId = featured?.item.id ?? null;
  const upcoming = activities.upcoming.slice(0, 3);
  const latest = without(activities.past, featured?.kind === "activity" ? featuredId : null, 3);
  const stories = without(posts.posts, featured?.kind === "post" ? featuredId : null, 2);
  const projects = (projectGroups.find((group) => group.stage === "active")?.projects ?? []).slice(
    0,
    2,
  );
  const tagline = isPending(settings.tagline) ? null : settings.tagline;
  const empty = !featured && upcoming.length === 0 && projects.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="sr-only">{settings.organizationName}</h1>

      {empty ? (
        <section className="py-8">
          {tagline ? <p className="text-xl text-ink-muted">{tagline}</p> : null}
          <p className="mt-4 text-ink-muted">
            Pronto publicaremos aquí las actividades, historias y proyectos de la organización.
          </p>
        </section>
      ) : null}

      {featured || upcoming.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {featured ? (
            <article aria-labelledby="featured-title" className="group relative">
              {featured.item.cover ? (
                <Photo
                  photo={featured.item.cover}
                  sizes="(min-width: 1024px) 48rem, 100vw"
                  priority
                  className="aspect-video rounded-sm"
                />
              ) : null}
              <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
                {featured.kind === "post" ? "Historia" : "Actividad"}
                {featured.item.category ? ` · ${featured.item.category}` : ""}
              </p>
              <h2
                id="featured-title"
                className="mt-1 font-serif text-3xl leading-tight font-semibold text-green-900 md:text-4xl"
              >
                <Link
                  href={
                    featured.kind === "post"
                      ? `${PUBLIC_POSTS_PATH}/${featured.item.slug}`
                      : `${PUBLIC_ACTIVITIES_PATH}/${featured.item.slug}`
                  }
                  className="outline-none group-hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {featured.item.title}
                </Link>
              </h2>
              <p className="mt-2 text-lg text-ink-muted">
                {featured.kind === "post" ? featured.item.excerpt : featured.item.summary}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {featured.kind === "post"
                  ? formatPostDate(featured.item.publishedAt)
                  : `${formatActivityDate(featured.item.startsAt, featured.item.endsAt)}${featured.item.place ? ` · ${featured.item.place}` : ""}`}
              </p>
            </article>
          ) : null}

          {upcoming.length > 0 ? (
            <section aria-labelledby="upcoming-title">
              <h2 id="upcoming-title" className={sectionTitle}>
                Próximas actividades
              </h2>
              <ul className="mt-2 divide-y">
                {upcoming.map((activity) => (
                  <li key={activity.id} className="py-3">
                    <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
                      <time dateTime={activity.startsAt}>
                        {formatActivityDate(activity.startsAt, null)}
                      </time>
                      {activity.place ? ` · ${activity.place}` : ""}
                    </p>
                    <Link
                      href={`${PUBLIC_ACTIVITIES_PATH}/${activity.slug}`}
                      className="inline-flex min-h-11 items-center font-serif text-lg font-semibold text-green-900 underline-offset-4 hover:underline"
                    >
                      {activity.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={PUBLIC_ACTIVITIES_PATH} className={moreLink}>
                Ver todas las actividades
              </Link>
            </section>
          ) : null}
        </div>
      ) : null}

      {latest.length > 0 ? (
        <section aria-labelledby="latest-title" className="mt-12">
          <h2 id="latest-title" className={sectionTitle}>
            Últimas actividades
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((activity) => (
              <li key={activity.id}>
                <PublicActivityCard activity={activity} />
              </li>
            ))}
          </ul>
          <Link href={PUBLIC_ACTIVITIES_PATH} className={moreLink}>
            Ver todas las actividades
          </Link>
        </section>
      ) : null}

      {stories.length > 0 || projects.length > 0 ? (
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          {stories.length > 0 ? (
            <section aria-labelledby="stories-title">
              <h2 id="stories-title" className={sectionTitle}>
                Historias
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {stories.map((post) => (
                  <li key={post.id}>
                    <PublicPostCard post={post} />
                  </li>
                ))}
              </ul>
              <Link href={PUBLIC_POSTS_PATH} className={moreLink}>
                Ver todas las historias
              </Link>
            </section>
          ) : null}
          {projects.length > 0 ? (
            <section aria-labelledby="projects-title">
              <h2 id="projects-title" className={sectionTitle}>
                Proyectos en curso
              </h2>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <PublicProjectCard project={project} />
                  </li>
                ))}
              </ul>
              <Link href={PUBLIC_PROJECTS_PATH} className={moreLink}>
                Ver todos los proyectos
              </Link>
            </section>
          ) : null}
        </div>
      ) : null}

      <section
        aria-labelledby="support-title"
        className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-sm border-y-[3px] border-double border-gold-500 bg-paper-2 px-5 py-6"
      >
        <div>
          <h2 id="support-title" className="font-serif text-2xl font-semibold text-green-900">
            ¿Quieres sumarte?
          </h2>
          <p className="text-ink-muted">Conoce las formas de apoyar a la organización.</p>
        </div>
        <Link
          href="/apoyanos"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-green-700 px-5 font-semibold text-paper outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <HandHeart aria-hidden="true" className="size-5" />
          Apóyanos
        </Link>
      </section>
    </div>
  );
}
