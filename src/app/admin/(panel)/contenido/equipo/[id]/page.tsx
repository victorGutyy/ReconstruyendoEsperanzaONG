import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { CONSENT_STATUS_LABELS, getPersonConsent } from "@/modules/consents";
import { getContentCover } from "@/modules/content";
import {
  ContentReview,
  CoverField,
  ReviewNote,
  statusLabel,
  StatusActions,
} from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TrashContentButton } from "@/modules/trash/client";
import { publishTeamMember, setTeamPhoto, submitTeamMember } from "@/modules/team/actions";
import { TeamEditor } from "@/modules/team/components/team-editor";
import { getTeamMember } from "@/modules/team/queries";
import { reviewTeamMember, TEAM_PATH } from "@/modules/team/schema";

export const metadata: Metadata = { title: "Editar perfil del equipo" };

export default async function EditTeamMemberPage({
  params,
}: PageProps<"/admin/contenido/equipo/[id]">) {
  const authorized = await authorizePage("consent.manage");
  if (!authorized || !hasPermission(authorized.profile, "content.read")) {
    return <NoPermission reason="El equipo lo gestiona quien maneja las autorizaciones." />;
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const member = await getTeamMember(id);
  if (!member) notFound();

  const { profile, user } = authorized;
  const canTrash = hasPermission(profile, "content.delete");
  const publisher = hasPermission(profile, "content.publish");
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !member.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        member.createdBy === user.id &&
        (member.status === "draft" || member.status === "review")));

  const [consent, cover] = await Promise.all([
    member.consentId ? getPersonConsent(member.consentId) : Promise.resolve(null),
    getContentCover(member.coverMediaId),
  ]);
  const consentState = !member.consentId
    ? "missing"
    : consent?.status === "active" && !consent.isMinor
      ? "usable"
      : "gone";
  const review = reviewTeamMember(
    { consent: consentState, coverIssues: cover?.issues ?? null },
    publisher,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={TEAM_PATH} className="font-medium text-green-700 underline">
        Volver al equipo
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Equipo · {statusLabel("team_member", member.status, member.publishedAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{member.fullName}</h1>
      <p className="mt-1 text-ink-muted">{member.roleTitle}</p>

      {(publisher || canTrash) && !member.inTrash ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {publisher ? (
            <StatusActions type="team_member" id={member.id} status={member.status} />
          ) : null}
          {canTrash ? (
            <TrashContentButton
              type="team_member"
              id={member.id}
              published={member.status === "published"}
            />
          ) : null}
        </div>
      ) : null}

      {member.reviewNote && member.status === "draft" ? (
        <ReviewNote note={member.reviewNote} />
      ) : null}

      {consentState === "gone" ? (
        <section
          aria-labelledby="consent-gone-title"
          className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
        >
          <h2 id="consent-gone-title" className="font-semibold text-green-900">
            Autorización{" "}
            {consent ? CONSENT_STATUS_LABELS[consent.status].toLowerCase() : "no disponible"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {member.status === "published"
              ? "El perfil ya no se muestra en el sitio ni su foto. Vuelve a verse cuando tenga una autorización vigente."
              : "No se puede publicar hasta que tenga una autorización vigente."}
          </p>
        </section>
      ) : null}

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {member.inTrash
            ? "Este perfil está en la papelera."
            : "No puedes editar este perfil: ya fue publicado o lo creó otra persona."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <TeamEditor
              memberId={member.id}
              serverUpdatedAt={member.updatedAt}
              initial={{
                fullName: member.fullName,
                roleTitle: member.roleTitle,
                bio: member.bio ?? "",
                consentId: member.consentId ?? "",
              }}
              initialConsent={consent ? { id: consent.id, subjectName: consent.subjectName } : null}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <CoverField contentId={member.id} cover={cover} setCover={setTeamPhoto} />
            <p className="mt-2 text-sm text-ink-muted">
              Opcional: su foto. Como toda foto con personas, necesita su autorización vinculada
              para publicarse.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="team_member"
              contentId={member.id}
              items={review.items}
              publisher={publisher}
              status={member.status}
              submit={submitTeamMember}
              publish={publishTeamMember}
            />
          </div>
        </div>
      )}
    </div>
  );
}
