import type { Metadata } from "next";

import { authorizePage } from "@/lib/auth/guard";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { InviteForm } from "@/modules/users/components/invite-form";
import { MemberActions } from "@/modules/users/components/member-actions";
import { listTeam } from "@/modules/users/queries";

export const metadata: Metadata = { title: "Usuarios" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Bogota",
});

export default async function UsersPage() {
  const authorized = await authorizePage("users.manage");

  if (!authorized) {
    return (
      <NoPermission reason="Solo las personas con rol de Administrador pueden gestionar el equipo." />
    );
  }

  const team = await listTeam();
  const me = authorized.user.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Usuarios</h1>
      <p className="mt-2 text-ink-muted">
        Las cuentas se crean solo por invitación. Cada persona crea su contraseña y registra su app
        autenticadora al aceptar.
      </p>

      <section aria-labelledby="invite-title" className="mt-8 rounded-lg border bg-card p-5">
        <h2 id="invite-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Invitar a una persona
        </h2>
        <InviteForm />
      </section>

      <section aria-labelledby="team-title" className="mt-10">
        <h2 id="team-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Equipo ({team.length})
        </h2>
        <ul className="divide-y rounded-lg border bg-card">
          {team.map((member) => (
            <li key={member.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-semibold">
                  {member.fullName}
                  {member.id === me ? (
                    <span className="ml-2 text-sm text-ink-muted">(tú)</span>
                  ) : null}
                </p>
                <p className="text-sm break-all text-ink-muted">{member.email}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                  <span>{member.roleName ?? "Sin rol"}</span>
                  <span
                    className={member.isActive ? "text-green-700" : "font-semibold text-danger"}
                  >
                    {member.isActive ? "Activa" : "Desactivada"}
                  </span>
                  <span className="text-ink-muted">
                    Desde {dateFormat.format(new Date(member.createdAt))}
                    {member.invitedBy ? ` · invitada por ${member.invitedBy}` : ""}
                  </span>
                </p>
              </div>
              {member.id === me ? (
                <p className="text-sm text-ink-muted">
                  Tu rol y tu estado los cambia otra persona administradora.
                </p>
              ) : (
                <MemberActions
                  userId={member.id}
                  fullName={member.fullName}
                  roleKey={member.roleKey}
                  isActive={member.isActive}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
