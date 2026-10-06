"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { agree, CONTENT_TYPES, theType } from "@/modules/content/client";

import { trashContent } from "../actions";
import type { TrashableType } from "../schema";

/**
 * "Enviar a la papelera" for any content but the fixed pages (step 7.7).
 * Published content leaves the site at once; the Administrator can restore it.
 */
export function TrashContentButton({
  type,
  id,
  published,
}: {
  type: TrashableType;
  id: string;
  published: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const what = theType(type);
  const it = agree(type, "la", "lo");

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await trashContent(type, id);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.push(CONTENT_TYPES[type].listPath);
    });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline">
          <Trash2 aria-hidden="true" />
          Enviar a la papelera
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 grid gap-4 rounded-t-lg border-t bg-paper p-4 md:inset-x-auto md:top-1/2 md:left-1/2 md:w-[32rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg">
          <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
            Enviar a la papelera
          </Dialog.Title>
          <Dialog.Description className="text-ink-muted">
            {`${published ? `${what} saldrá del sitio en este momento. ` : ""}Solo el Administrador puede restaurar${it} o eliminar${it} definitivamente.`}
          </Dialog.Description>

          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
              Sí, enviar a la papelera
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
