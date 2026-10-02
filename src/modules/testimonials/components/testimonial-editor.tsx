"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentPicker } from "@/modules/consents/client";
import {
  DraftRecovery,
  type OwnerOptions,
  OwnerSelect,
  useDraftAutosave,
} from "@/modules/content/client";

import { saveTestimonial } from "../actions";
import { type TestimonialValues, TESTIMONIALS_PATH } from "../schema";

/**
 * A testimonial (step 7.6d): what the person said, how their name shows and
 * the authorization behind it. Created on "Guardar borrador" (the
 * authorization is required from the start); then saved automatically.
 */
export function TestimonialEditor({
  testimonialId,
  initial,
  initialConsent,
  serverUpdatedAt,
  owners,
}: {
  testimonialId?: string;
  initial: TestimonialValues;
  initialConsent: { id: string; subjectName: string } | null;
  serverUpdatedAt?: string;
  owners: OwnerOptions;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);
  const draft = useDraftAutosave<TestimonialValues>({
    id: testimonialId,
    storagePrefix: "testimonio-borrador",
    initial,
    serverUpdatedAt,
    save: saveTestimonial,
  });
  const { values, change } = draft;

  const submit = async () => {
    const id = await draft.saveNow();
    if (!id) return;
    if (!testimonialId) router.replace(`${TESTIMONIALS_PATH}/${id}`);
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

      <ConsentPicker
        selected={consent}
        onSelect={(chosen) => {
          setConsent({ id: chosen.id, subjectName: chosen.subjectName });
          change("consentId", chosen.id);
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="testimonial-quote">Testimonio</Label>
        <p id="testimonial-quote-help" className="text-sm text-ink-muted">
          Sus palabras, tal como las autorizó. Máximo 600 caracteres.
        </p>
        <textarea
          id="testimonial-quote"
          value={values.quote}
          onChange={(event) => change("quote", event.target.value)}
          maxLength={600}
          aria-describedby="testimonial-quote-help"
          className="min-h-28 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="testimonial-name">Nombre que se muestra</Label>
          <Input
            id="testimonial-name"
            value={values.authorName}
            onChange={(event) => change("authorName", event.target.value)}
            maxLength={80}
            autoComplete="off"
            aria-describedby="testimonial-name-help"
          />
          <p id="testimonial-name-help" className="text-sm text-ink-muted">
            Puede ser solo el nombre o las iniciales, como lo autorizó la persona.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="testimonial-context">Contexto (opcional)</Label>
          <Input
            id="testimonial-context"
            value={values.authorContext}
            onChange={(event) => change("authorContext", event.target.value)}
            maxLength={160}
            autoComplete="off"
            placeholder="Por ejemplo: participante del taller de tejido"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="testimonial-owner">Pertenece a (opcional)</Label>
        <OwnerSelect
          id="testimonial-owner"
          value={values.owner}
          onChange={(value) => change("owner", value)}
          owners={owners}
        />
      </div>

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
