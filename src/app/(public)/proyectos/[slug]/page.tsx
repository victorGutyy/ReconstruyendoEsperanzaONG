import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RichText } from "@/components/rich-text/rich-text";
import { absoluteUrl } from "@/lib/site/url";
import { PublicActivityCard } from "@/modules/activities/components/public-activity-card";
import { getPublicProject } from "@/modules/projects/public";
import {
  formatProjectDates,
  PUBLIC_PROJECTS_PATH,
  PUBLIC_STAGE_LABELS,
} from "@/modules/projects/public-format";
import { getSiteSettings, isPending } from "@/modules/settings";
import { Breadcrumbs, Photo, ShareButtons } from "@/modules/site";

// Built on the first visit and cached; publishing or retiring refreshes it
export const revalidate = 300;

/** None at build time (it has no database): each page is built when first visited. */
export async function generateStaticParams() {
  return [];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function load(slug: string) {
  return SLUG.test(slug) && slug.length <= 120 ? getPublicProject(slug) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/proyectos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await load(slug);
  if (!project) return { title: "Proyecto no encontrado" };

  const settings = await getSiteSettings();
  const fallback = isPending(settings.seoDescription) ? undefined : settings.seoDescription;
  const description = project.seoDescription ?? project.summary ?? fallback ?? undefined;
  const url = absoluteUrl(`${PUBLIC_PROJECTS_PATH}/${project.slug}`);
  const cover = project.cover;
  const ogWidth = cover ? Math.min(cover.width, 1920) : 0;

  return {
    title: project.seoTitle ?? project.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: project.title,
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

export default async function ProjectPage({ params }: PageProps<"/proyectos/[slug]">) {
  const { slug } = await params;
  const project = await load(slug);
  if (!project) notFound();

  const dates = formatProjectDates(project.startDate, project.endDate);
  const url = absoluteUrl(`${PUBLIC_PROJECTS_PATH}/${project.slug}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Inicio" },
          { href: PUBLIC_PROJECTS_PATH, label: "Proyectos" },
          { label: project.title },
        ]}
      />

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article>
          <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
            Proyecto · {PUBLIC_STAGE_LABELS[project.stage]}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold text-green-900 md:text-5xl">
            {project.title}
          </h1>
          {project.summary ? (
            <p className="mt-4 text-lg text-ink-muted">{project.summary}</p>
          ) : null}

          {project.cover ? (
            <figure className="mt-6">
              <Photo
                photo={project.cover}
                sizes="(min-width: 1024px) 48rem, 100vw"
                priority
                className="max-h-[36rem] rounded-sm"
              />
            </figure>
          ) : null}

          {project.objective ? (
            <section aria-labelledby="objective-title" className="mt-8">
              <h2
                id="objective-title"
                className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
              >
                Objetivo
              </h2>
              <p className="mt-4 whitespace-pre-line">{project.objective}</p>
            </section>
          ) : null}

          {project.body ? <RichText doc={project.body} className="mt-8" /> : null}
        </article>

        <aside className="grid content-start gap-6">
          <section aria-labelledby="facts-title" className="rounded-sm border bg-card p-4">
            <h2 id="facts-title" className="font-serif text-lg font-semibold text-green-900">
              Ficha
            </h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold">Estado</dt>
                <dd>{PUBLIC_STAGE_LABELS[project.stage]}</dd>
              </div>
              {dates ? (
                <div>
                  <dt className="font-semibold">Fechas</dt>
                  <dd>{dates}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold">Actividades</dt>
                <dd>{project.activities.length}</dd>
              </div>
            </dl>
          </section>
          <ShareButtons url={url} title={project.title} />
        </aside>
      </div>

      {project.activities.length > 0 ? (
        <section aria-labelledby="activities-title" className="mt-12">
          <h2
            id="activities-title"
            className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
          >
            Actividades del proyecto
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {project.activities.map((activity) => (
              <li key={activity.id}>
                <PublicActivityCard activity={activity} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
