"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { createPlace, updatePlace } from "../actions";
import type { Place } from "../queries";
import { type ActionState, PLACE_KIND_LABELS, PLACE_KINDS, type PlaceKind } from "../schema";
import { FormMessage } from "./form-message";
import { TrashButton } from "./trash-button";

function KindSelect({ id, defaultValue }: { id: string; defaultValue: PlaceKind }) {
  return (
    <NativeSelect id={id} name="kind" defaultValue={defaultValue} required>
      {PLACE_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {PLACE_KIND_LABELS[kind]}
        </option>
      ))}
    </NativeSelect>
  );
}

export function CreatePlaceForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createPlace, {});

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_12rem_auto]" noValidate>
      <div className="space-y-2">
        <Label htmlFor="place-name">Nombre del lugar</Label>
        <Input id="place-name" name="name" autoComplete="off" required maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="place-kind">Tipo</Label>
        <KindSelect id="place-kind" defaultValue="neighborhood" />
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full" disabled={pending}>
          Agregar lugar
        </Button>
      </div>
      <div className="sm:col-span-3">
        <FormMessage state={state} id="place-create" />
      </div>
    </form>
  );
}

export function PlaceItem({ place }: { place: Place }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updatePlace, {});
  const prefix = `place-${place.id}`;

  return (
    <li className="grid gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-semibold">{place.name}</span>
          <span className="text-ink-muted"> · {PLACE_KIND_LABELS[place.kind]}</span>
          {place.isActive ? null : (
            <span className="ml-2 text-sm font-semibold text-gold-700">Inactivo</span>
          )}
        </p>
        <TrashButton table="places" id={place.id} name={place.name} />
      </div>

      <details>
        <summary className="inline-flex min-h-6 cursor-pointer items-center text-sm font-medium text-green-700">
          Editar<span className="sr-only"> {place.name}</span>
        </summary>
        <form action={formAction} className="mt-3 grid gap-4 sm:grid-cols-[1fr_12rem]" noValidate>
          <input type="hidden" name="id" value={place.id} />
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-name`}>Nombre</Label>
            <Input
              id={`${prefix}-name`}
              name="name"
              defaultValue={place.name}
              autoComplete="off"
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-kind`}>Tipo</Label>
            <KindSelect id={`${prefix}-kind`} defaultValue={place.kind} />
          </div>
          <div className="flex items-center gap-2">
            <input
              id={`${prefix}-active`}
              name="active"
              type="checkbox"
              defaultChecked={place.isActive}
              className="size-5 accent-green-700"
            />
            <Label htmlFor={`${prefix}-active`}>Activo (se ofrece al crear contenido)</Label>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button type="submit" variant="outline" disabled={pending}>
              Guardar
            </Button>
          </div>
          <div className="sm:col-span-2">
            <FormMessage state={state} />
          </div>
        </form>
      </details>
    </li>
  );
}
