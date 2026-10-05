import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { ContentTabs, statusLabel } from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TeamOrderButtons } from "@/modules/team/components/team-order-buttons";
import { listTeam } from "@/modules/team/queries";
import { TEAM_PATH } from "@/modules/team/schema";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  // Personal data: authorization managers only (decision 7.6d)
  const authorized = await authorizePage("consent.manage");
  if (!authorized || !hasPermission(authorized.profile, "content.read")) {
    return <NoPermission reason="El equipo lo gestiona quien maneja las autorizaciones." />;
  }

  const team = await listTeam();
  const canCreate = hasPermission(authorized.profile, "content.create");
  const canOrder = hasPermission(authorized.profile, "content.update_any");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Equipo</h1>
        {canCreate ? (
          <Button asChild>
            <Link href={`${TEAM_PATH}/nueva`}>
              <Plus aria-hidden="true" />
              Agregar persona
            </Link>
          </Button>
        ) : null}
      </div>
      <ContentTabs current="team_member" canManageConsents />

      <section aria-labelledby="team-title" className="mt-8">
        <h2 id="team-title" className="mb-1 font-serif text-xl font-semibold text-green-900">
          En el orden del sitio ({team.length})
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Solo se muestran en el sitio los perfiles publicados con su autorización vigente.
        </p>
        {team.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            Todavía no hay personas en el equipo.
          </p>
        ) : (
          <ol aria-label="Equipo" className="divide-y rounded-lg border bg-card">
            {team.map((member, index) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link
                    href={`${TEAM_PATH}/${member.id}`}
                    className="font-semibold text-green-900 underline-offset-4 hover:underline"
                  >
                    {member.fullName}
                  </Link>
                  <p className="text-sm text-ink-muted">{member.roleTitle}</p>
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {member.consentGone && member.status === "published" ? (
                    <span className="rounded-sm border border-danger/60 bg-card px-2 py-1 text-xs font-semibold text-danger">
                      Autorización revocada o vencida
                    </span>
                  ) : null}
                  <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold">
                    {statusLabel("team_member", member.status, member.publishedAt)}
                  </span>
                  {canOrder ? (
                    <TeamOrderButtons
                      memberId={member.id}
                      name={member.fullName}
                      first={index === 0}
                      last={index === team.length - 1}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
