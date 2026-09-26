"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updatePassword } from "../actions";
import type { FormState } from "../schema";

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña nueva</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby={state.error ? "password-error" : "password-help"}
          aria-invalid={state.error ? true : undefined}
        />
        <p id="password-help" className="text-sm text-ink-muted">
          Al menos 12 caracteres. Una frase de varias palabras es fácil de recordar y difícil de
          adivinar.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Repite la contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "password-error" : undefined}
        />
      </div>

      {state.error ? (
        <p id="password-error" role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar y continuar"}
      </Button>
    </form>
  );
}
