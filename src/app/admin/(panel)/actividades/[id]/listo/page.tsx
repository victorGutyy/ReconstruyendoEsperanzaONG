import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { authorizePage } from "@/lib/auth/guard";
import { getActivityForWizard } from "@/modules/activities/queries";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Actividad lista" };

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/** Final screen of the wizard (docs/07 §6.5): what happened and "Registrar otra actividad". */
export default async function ActivityDonePage({
  params,
}: PageProps<"/admin/actividades/[id]/listo">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const activity = await getActivityForWizard(id);
  if (!activity) notFound();

  // The real state, not the URL, decides the message
  const scheduled =
    activity.status === "published" &&
    activity.publishedAt !== null &&
    new Date(activity.publishedAt) > new Date();
  const message =
    activity.status === "review"
      ? { title: "¡Enviada a revisión!", text: "Un Editor la revisará y la publicará." }
      : scheduled
        ? {
            title: "¡Actividad programada!",
            text: `Se publicará el ${dateTimeFormat.format(new Date(activity.publishedAt!))} (hora de Colombia).`,
          }
        : activity.status === "published"
          ? { title: "¡Actividad publicada!", text: "Ya forma parte del sitio." }
          : { title: "Borrador guardado", text: "Puedes seguir editándola cuando quieras." };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <CircleCheck aria-hidden="true" className="mx-auto size-14 text-green-700" />
      <h1 className="mt-4 font-serif text-3xl font-semibold text-green-900">{message.title}</h1>
      <p className="mt-2 text-lg">{activity.title}</p>
      <p className="mt-2 text-ink-muted">{message.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/admin/actividades/nueva">Registrar otra actividad</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/actividades">Volver a actividades</Link>
        </Button>
      </div>
    </div>
  );
}
