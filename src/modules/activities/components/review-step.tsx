"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { publishActivity, submitForReview } from "../actions";
import type { CheckItem } from "../review";

const LEVELS = {
  ok: { icon: CircleCheck, className: "text-green-700", label: "Listo" },
  warn: { icon: CircleAlert, className: "text-gold-700", label: "Aviso" },
  error: { icon: CircleX, className: "text-danger", label: "Falta" },
} as const;

/**
 * Step 4 · Revisar y publicar (docs/07 §6.5). Buttons are never disabled:
 * pressing one while something is missing explains what to fix.
 */
export function ReviewStep({
  activityId,
  items,
  publisher,
  status,
}: {
  activityId: string;
  items: CheckItem[];
  publisher: boolean;
  status: "draft" | "review" | "published" | "archived";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, startTransition] = useTransition();
  const blocking = items.filter((item) => item.level === "error");

  const run = (action: () => ReturnType<typeof publishActivity>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) return setError(result.error);
      router.push(`/admin/actividades/${activityId}/listo?estado=${result.outcome}`);
    });

  const publish = (schedule?: { date: string; time: string }) => {
    if (blocking.length > 0) {
      setError(`Antes de publicar resuelve: ${blocking.map((item) => item.text).join(" ")}`);
      return;
    }
    run(() => publishActivity(activityId, schedule));
  };

  return (
    <div className="grid gap-6">
      <ul aria-label="Revisión de la actividad" className="grid gap-2">
        {items.map((item) => {
          const level = LEVELS[item.level];
          const Icon = level.icon;
          return (
            <li
              key={item.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3"
            >
              <span className="flex items-start gap-2">
                <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${level.className}`} />
                <span>
                  <span className="sr-only">{level.label}: </span>
                  {item.text}
                </span>
              </span>
              {item.level === "ok" ? null : (
                <Link
                  href={`/admin/actividades/${activityId}/editar?paso=${item.step}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-green-700 underline"
                >
                  Resolver
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {status === "published" || status === "archived" ? (
        <p role="status" className="rounded-lg border bg-card p-4">
          {status === "published"
            ? "Esta actividad ya está publicada o programada."
            : "Esta actividad está archivada."}
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/actividades">Guardar borrador</Link>
            </Button>
            {publisher ? (
              <>
                <Button type="button" disabled={pending} onClick={() => publish()}>
                  Publicar ahora
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setScheduling((open) => !open)}
                  aria-expanded={scheduling}
                >
                  Programar
                </Button>
              </>
            ) : status === "review" ? (
              <p className="self-center text-sm text-ink-muted">
                Ya está en revisión: un Editor la publicará.
              </p>
            ) : (
              <Button
                type="button"
                disabled={pending}
                onClick={() => run(() => submitForReview(activityId))}
              >
                Enviar a revisión
              </Button>
            )}
          </div>

          {publisher && scheduling ? (
            <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="publish-date">Publicar el (fecha)</Label>
                <Input
                  id="publish-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publish-time">A las (hora de Colombia)</Label>
                <Input
                  id="publish-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" disabled={pending} onClick={() => publish({ date, time })}>
                  Programar publicación
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
