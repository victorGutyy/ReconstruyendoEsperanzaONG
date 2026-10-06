"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RichTextDoc } from "@/lib/rich-text/schema";
import { DraftRecovery, useDraftAutosave } from "@/modules/content/client";

import { savePage } from "../actions";
import type { PageValues } from "../schema";

/**
 * One of the four fixed pages (step 7.6e). Saved automatically. Legal pages
 * carry a version: changing a published one needs a new version first.
 */
export function PageEditor({
  pageId,
  legal,
  published,
  initial,
  serverUpdatedAt,
}: {
  pageId: string;
  legal: boolean;
  published: boolean;
  initial: PageValues;
  serverUpdatedAt: string;
}) {
  const router = useRouter();
  const bodyLabelId = useId();
  const draft = useDraftAutosave<PageValues>({
    id: pageId,
    storagePrefix: "pagina-borrador",
    initial,
    serverUpdatedAt,
    save: savePage,
  });
  const { values, change } = draft;

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void draft.saveNow().then((id) => id && router.refresh());
      }}
    >
      {draft.recovery ? (
        <DraftRecovery onUse={draft.applyRecovery} onDiscard={draft.discardRecovery} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="page-title">Título</Label>
        <Input
          id="page-title"
          value={values.title}
          onChange={(event) => change("title", event.target.value)}
          maxLength={160}
          autoComplete="off"
          required
        />
      </div>

      {legal ? (
        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="page-version">Versión del documento</Label>
          <Input
            id="page-version"
            value={values.version}
            onChange={(event) => change("version", event.target.value)}
            maxLength={40}
            autoComplete="off"
            aria-describedby="page-version-help"
          />
          <p id="page-version-help" className="text-sm text-ink-muted">
            {published
              ? "Está publicada: para cambiar el texto, escribe primero una versión nueva (por ejemplo, 1.1)."
              : "Por ejemplo, 1.0. Cada versión publicada se guarda tal cual en el historial."}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <span id={bodyLabelId} className="text-sm font-medium">
          Texto
        </span>
        <RichTextEditor
          key={draft.editorKey}
          name="body"
          labelledBy={bodyLabelId}
          defaultValue={values.body as RichTextDoc | null}
          onChange={(doc) => change("body", doc)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={draft.saving}>
          Guardar
        </Button>
        <p aria-live="polite" className="text-sm text-ink-muted">
          {draft.saving ? "Guardando…" : draft.status}
        </p>
      </div>
      {draft.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {draft.error}
        </p>
      ) : null}
    </form>
  );
}
