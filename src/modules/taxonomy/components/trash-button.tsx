"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { trashTaxonomyItem } from "../actions";
import type { ActionState } from "../schema";

/**
 * Two steps (docs/07: confirm before destructive actions). The item goes to
 * the trash, not away for good, so an inline confirmation is enough.
 */
export function TrashButton({
  table,
  id,
  name,
}: {
  table: "places" | "categories";
  id: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(trashTaxonomyItem, {});
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Enviar a la papelera: ${name}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" />
        Enviar a la papelera
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <span className="text-sm">¿Enviar «{name}» a la papelera?</span>
      <Button ref={confirmRef} type="submit" variant="destructive" size="sm" disabled={pending}>
        Sí, enviar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
      {state.error ? (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
