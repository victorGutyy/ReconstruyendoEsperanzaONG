"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type PersonConsent, searchPersonConsents } from "../actions";

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Chooses the authorization of a person (step 7.6d): adults with a usable
 * authorization only. Shown to people who manage authorizations.
 */
export function ConsentPicker({
  selected,
  onSelect,
}: {
  selected: { id: string; subjectName: string } | null;
  onSelect: (consent: PersonConsent) => void;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PersonConsent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      setError(null);
      const result = await searchPersonConsents(query);
      if (!result.ok) return setError(result.error);
      setOptions(result.options);
    });

  return (
    <fieldset className="grid gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">Autorización de la persona</legend>
      {selected ? (
        <p className="text-sm">
          Vinculada: <span className="font-semibold">{selected.subjectName}</span>{" "}
          <Link
            href={`/admin/autorizaciones/${selected.id}`}
            className="font-medium text-green-700 underline"
          >
            Ver autorización
          </Link>
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Obligatoria. Solo aparecen autorizaciones vigentes de personas adultas.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor={inputId}>Buscar por nombre</Label>
          <Input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <Button type="button" variant="outline" disabled={pending} onClick={search}>
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </div>
      {options ? (
        options.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No hay autorizaciones vigentes con ese nombre. Regístrala primero en Autorizaciones.
          </p>
        ) : (
          <ul aria-label="Autorizaciones encontradas" className="grid gap-2">
            {options.map((option) => (
              <li
                key={option.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
              >
                <span className="text-sm">
                  <span className="font-medium">{option.subjectName}</span> · firmada el{" "}
                  {dateFormat.format(new Date(option.grantedOn))}
                </span>
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Elegir: ${option.subjectName}`}
                  disabled={option.id === selected?.id}
                  onClick={() => {
                    onSelect(option);
                    setOptions(null);
                  }}
                >
                  Elegir
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
