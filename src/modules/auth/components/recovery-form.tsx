"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestPasswordReset } from "../actions";
import type { FormState } from "../schema";

export function RecoveryForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.notice) {
    return (
      <p id="recovery-notice" role="status" className="rounded-md bg-green-50 p-4 text-green-900">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Correo de tu cuenta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          defaultValue={state.email}
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "recovery-error" : undefined}
        />
      </div>

      {state.error ? (
        <p id="recovery-error" role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
