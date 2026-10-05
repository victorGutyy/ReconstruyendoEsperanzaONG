import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TeamEditor } from "@/modules/team/components/team-editor";
import { TEAM_PATH } from "@/modules/team/schema";

export const metadata: Metadata = { title: "Agregar persona al equipo" };

export default async function NewTeamMemberPage() {
  const authorized = await authorizePage("consent.manage");
  if (!authorized || !hasPermission(authorized.profile, "content.create")) {
    return <NoPermission reason="El equipo lo gestiona quien maneja las autorizaciones." />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={TEAM_PATH} className="font-medium text-green-700 underline">
        Volver al equipo
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Equipo</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Agregar persona</h1>
      <p className="mt-2 text-ink-muted">
        Guarda el borrador para elegir su foto. Para publicarlo hace falta su autorización.
      </p>
      <div className="mt-6 rounded-lg border bg-card p-5">
        <TeamEditor
          initial={{ fullName: "", roleTitle: "", bio: "", consentId: "" }}
          initialConsent={null}
        />
      </div>
    </div>
  );
}
