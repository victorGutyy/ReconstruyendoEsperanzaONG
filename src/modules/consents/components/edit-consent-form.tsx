"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { updateConsent } from "../actions";
import type { ConsentFormState } from "../schema";
import { ConsentFields, type ConsentFieldValues } from "./consent-fields";

export function EditConsentForm({ id, values }: { id: string; values: ConsentFieldValues }) {
  const [state, formAction, pending] = useActionState<ConsentFormState, FormData>(
    updateConsent,
    {},
  );

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      <input type="hidden" name="id" value={id} />
      <ConsentFields values={values} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Guardar cambios
        </Button>
        <div aria-live="polite">
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          {state.notice ? (
            <p role="status" className="text-sm font-medium text-green-700">
              {state.notice}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
