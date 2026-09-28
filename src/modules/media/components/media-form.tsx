"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateMedia } from "../actions";
import { type MediaFormState, PEOPLE_LABELS, PEOPLE_OPTIONS, type PeopleInPhoto } from "../library";

const textareaClass =
  "min-h-24 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function MediaForm({
  id,
  altText,
  caption,
  credit,
  people,
}: {
  id: string;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  people: PeopleInPhoto | null;
}) {
  const [state, formAction, pending] = useActionState<MediaFormState, FormData>(updateMedia, {});

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="id" value={id} />

      <div className="space-y-2">
        <Label htmlFor="media-alt">Descripción (obligatoria para publicar)</Label>
        <p id="media-alt-help" className="text-sm text-ink-muted">
          Cuenta qué se ve, para quien no puede ver la foto. Por ejemplo: «Mujeres sembrando árboles
          en la vereda». No escribas nombres de menores.
        </p>
        <textarea
          id="media-alt"
          name="altText"
          defaultValue={altText ?? ""}
          maxLength={300}
          aria-describedby="media-alt-help"
          className={textareaClass}
        />
      </div>

      <fieldset className="space-y-2" aria-describedby="media-people-help">
        <legend className="text-sm font-medium">¿Aparecen personas reconocibles?</legend>
        <p id="media-people-help" className="text-sm text-ink-muted">
          Si aparecen, la foto solo se publica con su autorización firmada; si hay menores, firmada
          por su representante legal.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {PEOPLE_OPTIONS.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="people"
                value={option}
                defaultChecked={people === option}
                className="size-5 accent-green-700"
              />
              {PEOPLE_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="media-caption">Pie de foto (opcional)</Label>
        <textarea
          id="media-caption"
          name="caption"
          defaultValue={caption ?? ""}
          maxLength={500}
          className={textareaClass}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="media-credit">Crédito (opcional)</Label>
        <Input
          id="media-credit"
          name="credit"
          defaultValue={credit ?? ""}
          maxLength={120}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <div aria-live="polite">
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          {state.notice ? (
            <p role="status" className="text-sm font-medium text-green-700">
              {state.notice}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
