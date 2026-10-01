import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { getContentCover } from "@/modules/content";
import {
  ContentReview,
  CoverField,
  displayStatus,
  ReviewNote,
  STATUS_LABELS,
  statusLabel,
  StatusActions,
} from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { publishProject, setProjectCover, submitProject } from "@/modules/projects/actions";
import { ProjectEditor } from "@/modules/projects/components/project-editor";
import { getProject, listProjectActivities } from "@/modules/projects/queries";
import { PROJECTS_PATH, reviewProject, STAGE_LABELS } from "@/modules/projects/schema";

export const metadata: Metadata = { title: "Editar proyecto" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

export default async function EditProjectPage({
  params,
}: PageProps<"/admin/contenido/proyectos/[id]">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const { profile, user } = authorized;
  const publisher = hasPermission(profile, "content.publish");
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !project.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        project.createdBy === user.id &&
        (project.status === "draft" || project.status === "review")));

  const [cover, activities] = await Promise.all([
    getContentCover(project.coverMediaId),
    listProjectActivities(project.id),
  ]);
  const review = reviewProject(
    { summary: project.summary, coverIssues: cover?.issues ?? null },
    publisher,
  );
  const coverWithdrawn = project.status === "published" && (cover?.issues.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={PROJECTS_PATH} className="font-medium text-green-700 underline">
        Volver a proyectos
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Proyecto · {statusLabel("project", project.status, project.publishedAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{project.title}</h1>
      <p className="mt-1 text-ink-muted">{STAGE_LABELS[project.stage]}</p>

      {publisher && !project.inTrash ? (
        <div className="mt-6">
          <StatusActions type="project" id={project.id} status={project.status} />
        </div>
      ) : null}

      {project.reviewNote && project.status === "draft" ? (
        <ReviewNote note={project.reviewNote} />
      ) : null}

      {coverWithdrawn ? (
        <section
          aria-labelledby="withdrawn-title"
          className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
        >
          <h2 id="withdrawn-title" className="font-semibold text-green-900">
            Portada retirada del sitio
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            El proyecto sigue publicado sin portada. Vuelve sola al sitio cuando se resuelve lo que
            falta.
          </p>
          <Link
            href={`/admin/medios/${project.coverMediaId}`}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-green-700 underline"
          >
            Resolver la portada
          </Link>
        </section>
      ) : null}

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {project.inTrash
            ? "Este proyecto está en la papelera."
            : "No puedes editar este proyecto: ya fue publicado o lo creó otra persona. Un Editor o Administrador puede hacerlo."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <ProjectEditor
              projectId={project.id}
              serverUpdatedAt={project.updatedAt}
              initial={{
                title: project.title,
                summary: project.summary ?? "",
                objective: project.objective ?? "",
                stage: project.stage,
                startDate: project.startDate ?? "",
                endDate: project.endDate ?? "",
                body: project.body,
              }}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <CoverField contentId={project.id} cover={cover} setCover={setProjectCover} />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="project"
              contentId={project.id}
              items={review.items}
              publisher={publisher}
              status={project.status}
              submit={submitProject}
              publish={publishProject}
            />
          </div>
        </div>
      )}

      <section aria-labelledby="project-activities-title" className="mt-8">
        <h2
          id="project-activities-title"
          className="mb-4 font-serif text-xl font-semibold text-green-900"
        >
          Actividades de este proyecto ({activities.length})
        </h2>
        {activities.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            Todavía no hay actividades. Se asocian desde el paso 1 de cada actividad.
          </p>
        ) : (
          <ul
            aria-label="Actividades de este proyecto"
            className="divide-y rounded-lg border bg-card"
          >
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-wrap items-center justify-between gap-2 p-4"
              >
                <Link
                  href={`/admin/actividades/${activity.id}/editar`}
                  className="font-semibold text-green-900 underline-offset-4 hover:underline"
                >
                  {activity.title}
                </Link>
                <span className="text-sm text-ink-muted">
                  {dateFormat.format(new Date(activity.startsAt))} ·{" "}
                  {STATUS_LABELS[displayStatus(activity.status, activity.publishedAt)]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
