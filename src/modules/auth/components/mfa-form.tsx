"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { verifyMfa } from "../actions";
import type { FormState } from "../schema";

export function MfaForm({
  factorId,
  next,
  submitLabel,
}: {
  factorId: string;
  next: string | null;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(verifyMfa, {});

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="factorId" value={factorId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <Label htmlFor="code">Código de 6 números</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="text-center font-mono text-2xl tracking-[0.4em]"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "mfa-error" : "mfa-help"}
        />
        <p id="mfa-help" className="text-sm text-ink-muted">
          Ábrelo en tu app autenticadora. Cambia cada 30 segundos.
        </p>
      </div>

      {state.error ? (
        <p id="mfa-error" role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Verificando…" : submitLabel}
      </Button>
    </form>
  );
}
