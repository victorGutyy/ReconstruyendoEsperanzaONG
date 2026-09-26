"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { inviteUser } from "../actions";
import { type ActionState, ROLE_KEYS, ROLE_LABELS } from "../schema";

export function InviteForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(inviteUser, {});

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2" noValidate>
      <div className="space-y-2">
        <Label htmlFor="invite-name">Nombre</Label>
        <Input id="invite-name" name="fullName" autoComplete="off" required maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Correo</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Rol</Label>
        <NativeSelect id="invite-role" name="role" defaultValue="author" required>
          {ROLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {ROLE_LABELS[key]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enviando…" : "Enviar invitación"}
        </Button>
      </div>

      <div className="md:col-span-2" aria-live="polite">
        {state.error ? (
          <p id="invite-error" role="alert" className="text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}
        {state.notice ? (
          <p id="invite-notice" role="status" className="text-sm font-medium text-green-700">
            {state.notice}
          </p>
        ) : null}
      </div>
    </form>
  );
}
