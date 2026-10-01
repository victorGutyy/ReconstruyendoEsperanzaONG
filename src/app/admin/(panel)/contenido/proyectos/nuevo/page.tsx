import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { ProjectEditor } from "@/modules/projects/components/project-editor";
import { PROJECTS_PATH } from "@/modules/projects/schema";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  const authorized = await authorizePage("content.create");
  if (!authorized) return <NoPermission reason="Tu rol no permite crear proyectos." />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={PROJECTS_PATH} className="font-medium text-green-700 underline">
        Volver a proyectos
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Proyectos
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Nuevo proyecto</h1>
      <p className="mt-2 text-ink-muted">
        Guarda el borrador para elegir la portada y enviarlo a revisión.
      </p>
      <div className="mt-6 rounded-lg border bg-card p-5">
        <ProjectEditor
          initial={{
            title: "",
            summary: "",
            objective: "",
            stage: "planned",
            startDate: "",
            endDate: "",
            body: null,
          }}
        />
      </div>
    </div>
  );
}
