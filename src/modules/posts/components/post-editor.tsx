"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { RichTextDoc } from "@/lib/rich-text/schema";
import { DraftRecovery, EmptyListNote, useDraftAutosave } from "@/modules/content/client";

import { savePost } from "../actions";
import type { Option } from "../queries";
import { POSTS_PATH, type PostValues } from "../schema";

/**
 * The story itself (step 7.6a). The draft is created on "Guardar borrador";
 * after that every change is saved automatically and a copy stays on the
 * phone in case the signal drops.
 */
export function PostEditor({
  postId,
  initial,
  serverUpdatedAt,
  categories,
  canManageTaxonomy,
}: {
  postId?: string;
  initial: PostValues;
  serverUpdatedAt?: string;
  categories: Option[];
  /** Editors and Administrators create categories; Authors do not. */
  canManageTaxonomy: boolean;
}) {
  const router = useRouter();
  const bodyLabelId = useId();
  const draft = useDraftAutosave<PostValues>({
    id: postId,
    storagePrefix: "historia-borrador",
    initial,
    serverUpdatedAt,
    save: savePost,
  });
  const { values, change } = draft;

  const submit = async () => {
    const id = await draft.saveNow();
    if (!id) return;
    if (!postId) router.replace(`${POSTS_PATH}/${id}`);
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
        <Label htmlFor="post-title">Título</Label>
        <Input
          id="post-title"
          value={values.title}
          onChange={(event) => change("title", event.target.value)}
          maxLength={160}
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-excerpt">Extracto</Label>
        <p id="post-excerpt-help" className="text-sm text-ink-muted">
          Una o dos frases: se ve en las tarjetas del sitio.
        </p>
        <textarea
          id="post-excerpt"
          value={values.excerpt}
          onChange={(event) => change("excerpt", event.target.value)}
          maxLength={300}
          aria-describedby="post-excerpt-help"
          className="min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-category">Categoría</Label>
          <NativeSelect
            id="post-category"
            value={values.categoryId}
            onChange={(event) => change("categoryId", event.target.value)}
            aria-describedby={categories.length === 0 ? "post-category-empty" : undefined}
          >
            <option value="">Elige una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
          {categories.length === 0 ? (
            <EmptyListNote
              id="post-category-empty"
              what="categorías de historias"
              canCreate={canManageTaxonomy}
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="post-byline">Firma (opcional)</Label>
          <Input
            id="post-byline"
            value={values.byline}
            onChange={(event) => change("byline", event.target.value)}
            maxLength={120}
            autoComplete="off"
            aria-describedby="post-byline-help"
          />
          <p id="post-byline-help" className="text-sm text-ink-muted">
            Cómo aparece en el sitio. Si la dejas vacía, no se muestra firma.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <span id={bodyLabelId} className="text-sm font-medium">
          Relato
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
