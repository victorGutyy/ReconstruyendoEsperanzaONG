"use client";

import { useId, useOptimistic, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { setActivityTag } from "../actions";
import type { Option } from "../queries";

/** With more tags than this, a search box narrows the list. */
const SEARCH_FROM = 12;

/**
 * Tags of the activity (step 1). Each change is saved at once; new tags are
 * created in Categorías y lugares, not here.
 */
export function TagsField({
  activityId,
  tags,
  selected,
}: {
  activityId: string;
  tags: Option[];
  selected: string[];
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useOptimistic(
    selected,
    (state: string[], change: { id: string; on: boolean }) =>
      change.on ? [...state, change.id] : state.filter((id) => id !== change.id),
  );
  const [, startTransition] = useTransition();

  const toggle = (id: string, on: boolean) =>
    startTransition(async () => {
      setCurrent({ id, on });
      setError(null);
      const result = await setActivityTag(activityId, id, on);
      if (!result.ok) setError(result.error);
    });

  const text = query.trim().toLocaleLowerCase("es");
  const shown = text ? tags.filter((tag) => tag.name.toLocaleLowerCase("es").includes(text)) : tags;

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">Etiquetas (opcional)</legend>
      {tags.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Todavía no hay etiquetas. Quien administra Categorías y lugares puede crearlas.
        </p>
      ) : (
        <>
          {tags.length > SEARCH_FROM ? (
            <div className="space-y-2">
              <Label htmlFor={searchId}>Buscar etiqueta</Label>
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
          <ul className="flex flex-wrap gap-2">
            {shown.map((tag) => {
              const checked = current.includes(tag.id);
              return (
                <li key={tag.id}>
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 has-[:checked]:border-green-700 has-[:checked]:bg-green-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggle(tag.id, event.target.checked)}
                      className="size-5 accent-green-700"
                    />
                    {tag.name}
                  </label>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 ? (
            <p className="text-sm text-ink-muted">Ninguna etiqueta coincide.</p>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
