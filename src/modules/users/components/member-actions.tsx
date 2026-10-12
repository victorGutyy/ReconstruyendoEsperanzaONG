"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

import { changeUserRole, resetUserMfa, setUserActive } from "../actions";
import { type ActionState, ROLE_KEYS, ROLE_LABELS } from "../schema";

export function MemberActions({
  userId,
  fullName,
  roleKey,
  isActive,
}: {
  userId: string;
  fullName: string;
  roleKey: string | null;
  isActive: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(
    changeUserRole,
    {},
  );
  const [statusState, statusAction, statusPending] = useActionState<ActionState, FormData>(
    setUserActive,
    {},
  );
  const [mfaState, mfaAction, mfaPending] = useActionState<ActionState, FormData>(resetUserMfa, {});
  const [confirmingMfa, setConfirmingMfa] = useState(false);
  const message = roleState.error ?? statusState.error ?? mfaState.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <form action={roleAction} className="flex items-end gap-2">
          <input type="hidden" name="userId" value={userId} />
          <label className="sr-only" htmlFor={`role-${userId}`}>
            Rol de {fullName}
          </label>
          <NativeSelect
            id={`role-${userId}`}
            name="role"
            defaultValue={roleKey ?? ""}
            className="h-11 w-44"
          >
            {roleKey ? null : (
              <option value="" disabled>
                Sin rol
              </option>
            )}
            {ROLE_KEYS.map((key) => (
              <option key={key} value={key}>
                {ROLE_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={rolePending}>
            Cambiar rol
          </Button>
        </form>

        <form action={statusAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={isActive ? "false" : "true"} />
          <Button type="submit" variant={isActive ? "ghost" : "outline"} disabled={statusPending}>
            {isActive ? "Desactivar" : "Reactivar"}
          </Button>
        </form>
      </div>

      {/* Lost phone (step 9.5b): asks once before acting */}
      {confirmingMfa ? (
        <form
          action={(data) => {
            setConfirmingMfa(false);
            mfaAction(data);
          }}
          className="space-y-2 rounded-md border border-border p-3"
        >
          <input type="hidden" name="userId" value={userId} />
          <p className="text-sm">
            ¿Restablecer la verificación en dos pasos de {fullName}? Tendrá que configurar su app de
            nuevo al entrar. Si perdió el celular o se lo robaron, desactiva también la cuenta
            mientras tanto.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={mfaPending}>
              Sí, restablecer
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmingMfa(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmingMfa(true)}
          aria-label={`Restablecer verificación de ${fullName}`}
        >
          Restablecer verificación
        </Button>
      )}

      {mfaState.notice ? (
        <p role="status" className="text-sm font-medium text-green-700">
          {mfaState.notice}
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
