"use client";

import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { changeActivityStatus, type StatusChange } from "../actions";

type Status = "draft" | "review" | "published" | "archived";

const CHANGES: Record<
  StatusChange,
  {
    button: string;
    title: string;
    explain: string;
    confirm: string;
    note: "required" | "optional" | null;
    danger: boolean;
  }
> = {
  returned: {
    button: "Devolver con nota",
    title: "Devolver a borrador",
    explain:
      "La actividad vuelve a borrador para que quien la escribió la corrija. Verá tu nota arriba del asistente.",
    confirm: "Devolver a borrador",
    note: "required",
    danger: false,
  },
  retired: {
    button: "Retirar para corregir",
    title: "Retirar para corregir",
    explain:
      "La actividad sale del sitio público y vuelve a borrador. Cuando esté corregida, se publica de nuevo con la misma dirección.",
    confirm: "Retirar del sitio",
    note: "optional",
    danger: true,
  },
  archived: {
    button: "Archivar",
    title: "Archivar la actividad",
    explain:
      "La actividad sale del sitio público pero se conserva en el panel. Se puede reabrir como borrador más adelante.",
    confirm: "Archivar",
    note: null,
    danger: true,
  },
  reopened: {
    button: "Reabrir como borrador",
    title: "Reabrir como borrador",
    explain: "La actividad vuelve a borrador para editarla y publicarla otra vez.",
    confirm: "Reabrir",
    note: null,
    danger: false,
  },
};

const AVAILABLE: Record<Status, StatusChange[]> = {
  draft: [],
  review: ["returned"],
  published: ["retired", "archived"],
  archived: ["reopened"],
};

function ChangeDialog({ activityId, change }: { activityId: string; change: StatusChange }) {
  const router = useRouter();
  const noteId = useId();
  const config = CHANGES[change];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await changeActivityStatus(activityId, change, note);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setNote("");
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
        <Button type="button" variant={config.danger ? "destructive" : "outline"}>
          {config.button}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 grid gap-4 rounded-t-lg border-t bg-paper p-4 md:inset-x-auto md:top-1/2 md:left-1/2 md:w-[32rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg">
          <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
            {config.title}
          </Dialog.Title>
          <Dialog.Description className="text-ink-muted">{config.explain}</Dialog.Description>

          {config.note ? (
            <div className="space-y-2">
              <Label htmlFor={noteId}>
                {config.note === "required" ? "Qué hay que corregir" : "Nota (opcional)"}
              </Label>
              <textarea
                id={noteId}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                required={config.note === "required"}
                className="min-h-28 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : null}

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
              variant={config.danger ? "destructive" : "default"}
              disabled={pending}
              onClick={confirm}
            >
              {config.confirm}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Editor actions on the state of an activity (step 7.4b, decision F7-D7). */
export function StatusActions({ activityId, status }: { activityId: string; status: Status }) {
  const changes = AVAILABLE[status];
  if (changes.length === 0) return null;
  return (
    <section aria-label="Acciones del editor" className="flex flex-wrap gap-3">
      {changes.map((change) => (
        <ChangeDialog key={change} activityId={activityId} change={change} />
      ))}
    </section>
  );
}
