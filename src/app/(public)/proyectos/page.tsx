import type { Metadata } from "next";

import { PublicProjectCard } from "@/modules/projects/components/public-project-card";
import { listPublicProjects } from "@/modules/projects/public";
import { PUBLIC_PROJECTS_PATH, PUBLIC_STAGE_GROUPS } from "@/modules/projects/public-format";
import { Breadcrumbs } from "@/modules/site";

// Few projects: one cached page, refreshed when one is published or retired
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Proyectos",
  description:
    "Los proyectos de la organización en Calarcá: en curso, en planeación y finalizados.",
  alternates: { canonical: PUBLIC_PROJECTS_PATH },
};

export default async function ProjectsPage() {
  const groups = await listPublicProjects();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Proyectos" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        Proyectos
      </h1>

      {groups.length === 0 ? (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          Pronto publicaremos los proyectos de la organización.
        </p>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.stage}
          aria-labelledby={`stage-${group.stage}`}
          className="mt-10 first-of-type:mt-8"
        >
          <h2
            id={`stage-${group.stage}`}
            className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
          >
            {PUBLIC_STAGE_GROUPS[group.stage]}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.projects.map((project) => (
              <li key={project.id}>
                <PublicProjectCard project={project} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
