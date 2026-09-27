"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

import { changeUserRole, setUserActive } from "../actions";
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
  const message = roleState.error ?? statusState.error;

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

      {message ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
