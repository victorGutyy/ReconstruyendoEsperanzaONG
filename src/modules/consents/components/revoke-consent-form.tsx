"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { revokeConsent } from "../actions";
import type { ConsentFormState } from "../schema";

/** Revocation is final (RB-005): it asks for a note and a confirmation. */
export function RevokeConsentForm({ id, photoCount }: { id: string; photoCount: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ConsentFormState, FormData>(
    revokeConsent,
    {},
  );

  if (!open) {
    return (
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Revocar autorización
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-danger/40 bg-card p-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm">
        La revocación <strong>no se puede deshacer</strong>. Si la persona vuelve a autorizar, se
        registra una autorización nueva.
        {photoCount > 0
          ? ` ${photoCount === 1 ? "La foto vinculada dejará" : `Las ${photoCount} fotos vinculadas dejarán`} de poder publicarse.`
          : ""}
      </p>
      <div className="space-y-2">
        <Label htmlFor="revoke-note">Motivo (quién lo pidió y cuándo)</Label>
        <textarea
          id="revoke-note"
          name="note"
          required
          maxLength={500}
          className="min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          Sí, revocar
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
