"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DraftRecovery,
  type OwnerOptions,
  OwnerSelect,
  useDraftAutosave,
} from "@/modules/content/client";

import { saveGallery } from "../actions";
import { GALLERIES_PATH, type GalleryValues } from "../schema";

/**
 * The gallery's title, description and owner (step 7.6c). Created on
 * "Guardar borrador"; after that every change is saved automatically.
 */
export function GalleryEditor({
  galleryId,
  initial,
  serverUpdatedAt,
  owners,
}: {
  galleryId?: string;
  initial: GalleryValues;
  serverUpdatedAt?: string;
  owners: OwnerOptions;
}) {
  const router = useRouter();
  const draft = useDraftAutosave<GalleryValues>({
    id: galleryId,
    storagePrefix: "galeria-borrador",
    initial,
    serverUpdatedAt,
    save: saveGallery,
  });
  const { values, change } = draft;

  const submit = async () => {
    const id = await draft.saveNow();
    if (!id) return;
    if (!galleryId) router.replace(`${GALLERIES_PATH}/${id}`);
    else router.refresh();
  };

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {draft.recovery ? (
        <DraftRecovery onUse={draft.applyRecovery} onDiscard={draft.discardRecovery} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="gallery-title">Título</Label>
        <Input
          id="gallery-title"
          value={values.title}
          onChange={(event) => change("title", event.target.value)}
          maxLength={160}
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gallery-description">Descripción (opcional)</Label>
        <textarea
          id="gallery-description"
          value={values.description}
          onChange={(event) => change("description", event.target.value)}
          maxLength={1000}
          className="min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gallery-owner">Pertenece a (opcional)</Label>
        <OwnerSelect
          id="gallery-owner"
          value={values.owner}
          onChange={(value) => change("owner", value)}
          owners={owners}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={draft.saving}>
          Guardar borrador
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
