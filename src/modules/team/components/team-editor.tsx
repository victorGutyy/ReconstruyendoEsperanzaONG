"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentPicker } from "@/modules/consents/client";
import { DraftRecovery, useDraftAutosave } from "@/modules/content/client";

import { saveTeamMember } from "../actions";
import { TEAM_PATH, type TeamValues } from "../schema";

/**
 * A team profile (step 7.6d). Created on "Guardar borrador"; then saved
 * automatically. The authorization can come later, but it is required to
 * publish.
 */
export function TeamEditor({
  memberId,
  initial,
  initialConsent,
  serverUpdatedAt,
}: {
  memberId?: string;
  initial: TeamValues;
  initialConsent: { id: string; subjectName: string } | null;
  serverUpdatedAt?: string;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);
  const draft = useDraftAutosave<TeamValues>({
    id: memberId,
    storagePrefix: "equipo-borrador",
    initial,
    serverUpdatedAt,
    save: saveTeamMember,
  });
  const { values, change } = draft;

  const submit = async () => {
    const id = await draft.saveNow();
    if (!id) return;
    if (!memberId) router.replace(`${TEAM_PATH}/${id}`);
    else router.refresh();
  };

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {draft.recovery ? (
        <DraftRecovery onUse={draft.applyRecovery} onDiscard={draft.discardRecovery} />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="team-name">Nombre</Label>
          <Input
            id="team-name"
            value={values.fullName}
            onChange={(event) => change("fullName", event.target.value)}
            maxLength={120}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="team-role">Cargo o rol</Label>
          <Input
            id="team-role"
            value={values.roleTitle}
            onChange={(event) => change("roleTitle", event.target.value)}
            maxLength={120}
            autoComplete="off"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-bio">Biografía corta (opcional)</Label>
        <textarea
          id="team-bio"
          value={values.bio}
          onChange={(event) => change("bio", event.target.value)}
          maxLength={600}
          className="min-h-24 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <ConsentPicker
        selected={consent}
        help="Necesaria para publicar el perfil. Solo aparecen autorizaciones vigentes de personas adultas."
        onSelect={(chosen) => {
          setConsent({ id: chosen.id, subjectName: chosen.subjectName });
          change("consentId", chosen.id);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={draft.saving}>
          Guardar borrador
        </Button>
        <p aria-live="polite" className="text-sm text-ink-muted">
          {draft.saving ? "Guardando…" : draft.status}
        </p>
      </div>
      {draft.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {draft.error}
        </p>
      ) : null}
    </form>
  );
}
