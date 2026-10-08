import Link from "next/link";

import { Photo } from "@/modules/site";

import { formatProjectDates, PUBLIC_PROJECTS_PATH, PUBLIC_STAGE_LABELS } from "../public-format";
import type { ProjectCard } from "../public";

/** A project in the public list: cover, stage, title, summary and dates. */
export function PublicProjectCard({ project }: { project: ProjectCard }) {
  const dates = formatProjectDates(project.startDate, project.endDate);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-sm border bg-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2">
      {project.cover ? (
        <Photo
          photo={project.cover}
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3]"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[4/3] bg-paper-2" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
          {PUBLIC_STAGE_LABELS[project.stage]}
        </p>
        <h3 className="font-serif text-xl leading-snug font-semibold text-green-900">
          {/* The whole card opens the project; the link is the title */}
          <Link
            href={`${PUBLIC_PROJECTS_PATH}/${project.slug}`}
            className="outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline"
          >
            {project.title}
          </Link>
        </h3>
        {project.summary ? <p className="text-ink-muted">{project.summary}</p> : null}
        {dates ? <p className="mt-auto pt-2 text-sm text-ink-muted">{dates}</p> : null}
      </div>
    </article>
  );
}
