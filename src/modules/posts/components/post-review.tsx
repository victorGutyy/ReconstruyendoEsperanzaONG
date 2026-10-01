"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContentStatus } from "@/modules/content/client";

import { publishPost, submitPost } from "../actions";
import type { CheckItem } from "../schema";

const LEVELS = {
  ok: { icon: CircleCheck, className: "text-green-700", label: "Listo" },
  warn: { icon: CircleAlert, className: "text-gold-700", label: "Aviso" },
  error: { icon: CircleX, className: "text-danger", label: "Falta" },
} as const;

const OUTCOMES = {
  review: "Enviada a revisión. Un Editor la revisará.",
  published: "Publicada.",
  scheduled: "Programada: se publicará en la fecha elegida.",
} as const;

/**
 * Revisar y publicar (same rules as the activity wizard). Buttons are never
 * disabled: pressing one while something is missing explains what to fix.
 */
export function PostReview({
  postId,
  items,
  publisher,
  status,
}: {
  postId: string;
  items: CheckItem[];
  publisher: boolean;
  status: ContentStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, startTransition] = useTransition();
  const blocking = items.filter((item) => item.level === "error");

  const run = (action: () => ReturnType<typeof publishPost>) =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await action();
      if (!result.ok) return setError(result.error);
      setNotice(OUTCOMES[result.outcome]);
      router.refresh();
    });

  const guarded = (action: () => ReturnType<typeof publishPost>) => {
    if (blocking.length > 0) {
      setError(`Antes de seguir resuelve: ${blocking.map((item) => item.text).join(" ")}`);
      return;
    }
    run(action);
  };

  return (
    <section aria-labelledby="post-review-title" className="grid gap-4">
      <h2 id="post-review-title" className="font-serif text-xl font-semibold text-green-900">
        Revisar y publicar
      </h2>
      <ul aria-label="Revisión de la historia" className="grid gap-2">
        {items.map((item) => {
          const level = LEVELS[item.level];
          const Icon = level.icon;
          return (
            <li key={item.key} className="flex items-start gap-2 rounded-md border bg-card p-3">
              <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${level.className}`} />
              <span>
                <span className="sr-only">{level.label}: </span>
                {item.text}
              </span>
            </li>
          );
        })}
      </ul>

      {status === "published" || status === "archived" ? (
        <p className="rounded-lg border bg-card p-4">
          {status === "published"
            ? "Esta historia ya está publicada o programada."
            : "Esta historia está archivada."}
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-3">
            {publisher ? (
              <>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => guarded(() => publishPost(postId))}
                >
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
                onClick={() => guarded(() => submitPost(postId))}
              >
                Enviar a revisión
              </Button>
            )}
          </div>

          {publisher && scheduling ? (
            <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="post-publish-date">Publicar el (fecha)</Label>
                <Input
                  id="post-publish-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-publish-time">A las (hora de Colombia)</Label>
                <Input
                  id="post-publish-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => guarded(() => publishPost(postId, { date, time }))}
                >
                  Programar publicación
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div aria-live="polite">
        {notice ? <p className="font-medium text-green-700">{notice}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
