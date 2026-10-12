"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { markMessageRead, setMessageStatus, trashMessage } from "../actions";
import { MESSAGE_ACTIONS, type MessageStatus, MESSAGES_PATH } from "../schema";

/** Opening a new message marks it as read, once. */
export function MarkAsRead({ id, status }: { id: string; status: MessageStatus }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (status !== "new" || done.current) return;
    done.current = true;
    void markMessageRead(id).then((result) => result.ok && router.refresh());
  }, [id, status, router]);
  return null;
}

/** Handle, archive, reopen or send a message to the trash (messages.manage). */
export function MessageActions({ id, status }: { id: string; status: MessageStatus }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    then?: () => void,
  ) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) return setError(result.error);
      if (then) then();
      else router.refresh();
    });

  return (
    <section aria-label="Acciones del mensaje" className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        {MESSAGE_ACTIONS[status].map((action) => (
          <Button
            key={action.to}
            type="button"
            variant={action.to === "handled" ? "default" : "outline"}
            disabled={pending}
            onClick={() => run(() => setMessageStatus(id, action.to))}
          >
            {action.label}
          </Button>
        ))}

        <Dialog.Root open={confirming} onOpenChange={setConfirming}>
          <Dialog.Trigger asChild>
            <Button type="button" variant="outline" disabled={pending}>
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
                El mensaje sale de la bandeja. Solo el Administrador puede restaurarlo o eliminarlo
                definitivamente.
              </Dialog.Description>
              <div className="flex flex-wrap justify-end gap-3">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => trashMessage(id),
                      () => router.push(MESSAGES_PATH),
                    )
                  }
                >
                  Sí, enviar a la papelera
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
