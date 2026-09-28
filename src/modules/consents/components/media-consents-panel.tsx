"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type ConsentOption, linkConsent, searchConsentsToLink, unlinkConsent } from "../actions";
import type { LinkedConsent } from "../queries";
import { SIGNER_LABELS, STATUS_LABELS } from "../schema";

/**
 * "Autorizaciones de esta foto", for consent.manage only (docs/07 ConsentPicker).
 * Linking is checked again by RLS; the reminder asks to cover every person.
 */
export function MediaConsentsPanel({
  mediaId,
  linked,
}: {
  mediaId: string;
  linked: LinkedConsent[];
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ConsentOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await searchConsentsToLink(mediaId, query);
      if (result.ok) setOptions(result.options);
      else setError(result.error);
    });
  };

  const link = (consentId: string) =>
    startTransition(async () => {
      const result = await linkConsent(mediaId, consentId);
      if (!result.ok) return setError(result.error);
      setOptions((current) => current?.filter((option) => option.id !== consentId) ?? null);
    });

  const unlink = (linkId: string) =>
    startTransition(async () => {
      const result = await unlinkConsent(linkId);
      if (!result.ok) setError(result.error);
    });

  return (
    <section
      aria-labelledby="photo-consents-title"
      className="grid gap-4 rounded-lg border bg-card p-4"
    >
      <h2 id="photo-consents-title" className="font-serif text-lg font-semibold text-green-900">
        Autorizaciones de esta foto
      </h2>
      <p className="rounded-md bg-paper-2 p-3 text-sm">
        Verifica que <strong>todas</strong> las personas reconocibles de la foto estén cubiertas por
        una autorización vigente. El sistema solo comprueba que haya al menos una.
      </p>

      {linked.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay autorizaciones vinculadas.</p>
      ) : (
        <ul aria-label="Autorizaciones vinculadas" className="divide-y rounded-md border">
          {linked.map((consent) => (
            <li
              key={consent.linkId}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <div className="text-sm">
                <Link
                  href={`/admin/autorizaciones/${consent.consentId}`}
                  className="font-semibold text-green-900 underline-offset-4 hover:underline"
                >
                  {consent.subjectName}
                </Link>
                <span className="block text-ink-muted">
                  {consent.isMinor ? "Menor · " : ""}
                  {SIGNER_LABELS[consent.signerType]} ·{" "}
                  <span className={consent.status === "active" ? "text-green-700" : "text-danger"}>
                    {STATUS_LABELS[consent.status]}
                  </span>
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                aria-label={`Desvincular: ${consent.subjectName}`}
                onClick={() => unlink(consent.linkId)}
              >
                Desvincular
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={search} className="grid gap-2" role="search" aria-label="Buscar autorización">
        <Label htmlFor="consent-link-search">Vincular una autorización</Label>
        <div className="flex gap-2">
          <Input
            id="consent-link-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre de la persona"
            autoComplete="off"
            maxLength={80}
          />
          <Button type="submit" variant="outline" disabled={pending}>
            Buscar
          </Button>
        </div>
      </form>

      {options ? (
        options.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No hay autorizaciones vigentes con ese nombre.{" "}
            <Link
              href="/admin/autorizaciones/nueva"
              className="font-medium text-green-700 underline"
            >
              Registrar una
            </Link>
          </p>
        ) : (
          <ul aria-label="Autorizaciones encontradas" className="divide-y rounded-md border">
            {options.map((option) => (
              <li key={option.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="text-sm">
                  <span className="font-semibold">{option.subjectName}</span>
                  <span className="block text-ink-muted">
                    {option.isMinor ? "Menor · " : ""}
                    {SIGNER_LABELS[option.signerType]} · firmada el {option.grantedOn}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  aria-label={`Vincular: ${option.subjectName}`}
                  onClick={() => link(option.id)}
                >
                  Vincular
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
    </section>
  );
}
