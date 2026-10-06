"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { type ReactNode, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { purgeFromTrash, restoreFromTrash, type TrashResult } from "../actions";
import { PURGE_WORD, type TrashKind } from "../schema";

function ConfirmDialog({
  trigger,
  triggerVariant,
  label,
  title,
  explain,
  confirm,
  danger,
  children,
  ready = true,
  run,
}: {
  trigger: string;
  triggerVariant: "outline" | "destructive";
  /** Accessible name of the trigger: says which item it acts on. */
  label: string;
  title: string;
  explain: string;
  confirm: string;
  danger: boolean;
  children?: ReactNode;
  ready?: boolean;
  run: () => Promise<TrashResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const go = () =>
    startTransition(async () => {
      setError(null);
      const result = await run();
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
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
        <Button type="button" variant={triggerVariant} aria-label={label}>
          {trigger}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 grid gap-4 rounded-t-lg border-t bg-paper p-4 md:inset-x-auto md:top-1/2 md:left-1/2 md:w-[32rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg">
          <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-ink-muted">{explain}</Dialog.Description>
          {children}
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
            <Button
              type="button"
              variant={danger ? "destructive" : "default"}
              disabled={pending || !ready}
              onClick={go}
            >
              {confirm}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Restore or purge one item of the trash (the Administrator, step 7.7). */
export function TrashItemActions({
  kind,
  id,
  name,
  canPurge,
}: {
  kind: TrashKind;
  id: string;
  name: string;
  canPurge: boolean;
}) {
  const wordId = useId();
  const [word, setWord] = useState("");
  const photo = kind === "media";

  return (
    <span className="flex flex-wrap gap-2">
      <ConfirmDialog
        trigger="Restaurar"
        triggerVariant="outline"
        label={`Restaurar: ${name}`}
        title="Restaurar"
        explain={
          photo
            ? "La foto vuelve a la biblioteca."
            : "Vuelve al panel. Si estaba publicado o programado, vuelve como borrador para revisarlo antes de publicarlo otra vez."
        }
        confirm="Restaurar"
        danger={false}
        run={() => restoreFromTrash(kind, id)}
      />
      {canPurge ? (
        <ConfirmDialog
          trigger="Eliminar definitivamente"
          triggerVariant="destructive"
          label={`Eliminar definitivamente: ${name}`}
          title="Eliminar definitivamente"
          explain={
            photo
              ? "Se borran la foto y sus archivos. No se puede deshacer; el registro de auditoría lo conserva."
              : "Se borra con sus fotos vinculadas y etiquetas (las fotos siguen en la biblioteca). Lo que dependía de él queda desvinculado. No se puede deshacer; el registro de auditoría lo conserva."
          }
          confirm="Eliminar"
          danger
          ready={word.trim() === PURGE_WORD}
          run={() => purgeFromTrash(kind, id, word)}
        >
          <div className="space-y-2">
            <Label htmlFor={wordId}>Escribe {PURGE_WORD} para confirmar</Label>
            <Input
              id={wordId}
              value={word}
              onChange={(event) => setWord(event.target.value)}
              autoComplete="off"
            />
          </div>
        </ConfirmDialog>
      ) : null}
    </span>
  );
}
