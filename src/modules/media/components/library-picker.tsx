"use client";

import { Images } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { browseLibrary } from "../actions";
import type { LibraryItem } from "../queries";

/**
 * "Elegir de la biblioteca": a sheet with the library, newest first, to pick
 * photos already uploaded. `exclude` hides the ones already in use there.
 * `onPick` returns an error message or null.
 */
export function LibraryPicker({
  exclude,
  onPick,
  confirmLabel = "Agregar",
}: {
  exclude: readonly string[];
  onPick: (mediaIds: string[]) => Promise<string | null>;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const load = (nextMine: boolean, nextPage: number) =>
    startLoading(async () => {
      setError(null);
      const result = await browseLibrary({ mine: nextMine, page: nextPage });
      if (!result.ok) return setError(result.error);
      setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
      setPage(nextPage);
      setPageCount(result.pageCount);
    });

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );

  const add = () =>
    startSaving(async () => {
      const message = await onPick(picked);
      if (message) return setError(message);
      setPicked([]);
      setOpen(false);
    });

  const visible = items.filter((item) => !exclude.includes(item.id) && item.status === "ready");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPicked([]);
          load(mine, 1);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline">
          <Images aria-hidden="true" />
          Elegir de la biblioteca
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-lg border-t bg-paper md:inset-x-auto md:top-1/2 md:left-1/2 md:w-[44rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
              Biblioteca de fotos
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm">
                Cerrar
              </Button>
            </Dialog.Close>
          </div>

          <div className="grid gap-4 overflow-y-auto p-4">
            <label className="flex min-h-11 items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={mine}
                onChange={(event) => {
                  setMine(event.target.checked);
                  load(event.target.checked, 1);
                }}
                className="size-5 accent-green-700"
              />
              Solo subidas por mí
            </label>

            {visible.length > 0 ? (
              <ul
                aria-label="Fotos de la biblioteca"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {visible.map((item) => {
                  const checked = picked.includes(item.id);
                  const name = item.altText || "Foto sin descripción";
                  return (
                    <li key={item.id}>
                      <label
                        className={cn(
                          "relative grid cursor-pointer gap-1 rounded-md border-2 p-1",
                          checked ? "border-green-700 bg-green-50" : "border-transparent",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(item.id)}
                          className="absolute top-2 left-2 size-6 accent-green-700"
                        />
                        <span className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm bg-paper-2">
                          {item.thumbnailUrl ? (
                            // Short-lived signed URL from a private bucket
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="line-clamp-2 text-sm">{name}</span>
                        {item.issues.length > 0 ? (
                          <span className="text-xs text-gold-700">Tiene pendientes</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : loading ? null : (
              <p className="rounded-lg border bg-card p-4 text-ink-muted">
                No hay más fotos para agregar.
              </p>
            )}

            {loading ? (
              <p role="status" className="text-ink-muted">
                Cargando fotos…
              </p>
            ) : page < pageCount ? (
              <Button type="button" variant="ghost" onClick={() => load(mine, page + 1)}>
                Cargar más fotos
              </Button>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t p-4">
            <span aria-live="polite" className="text-sm text-ink-muted">
              {picked.length === 1 ? "1 foto elegida" : `${picked.length} fotos elegidas`}
            </span>
            <Button type="button" disabled={picked.length === 0 || saving} onClick={add}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
