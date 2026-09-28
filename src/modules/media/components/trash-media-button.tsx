"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { trashMedia } from "../actions";
import type { MediaFormState } from "../library";

/** Two steps; the photo goes to the trash with its files, it can be restored. */
export function TrashMediaButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<MediaFormState, FormData>(trashMedia, {});
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (state.notice) {
    return (
      <p role="status" className="text-sm font-medium text-green-700">
        {state.notice}
      </p>
    );
  }

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden="true" />
        Enviar a la papelera
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-sm">¿Enviar esta foto a la papelera?</span>
      <Button ref={confirmRef} type="submit" variant="destructive" disabled={pending}>
        Sí, enviar
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
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
