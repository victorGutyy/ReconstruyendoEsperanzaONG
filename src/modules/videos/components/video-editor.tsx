"use client";

import { ExternalLink } from "lucide-react";
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

import { saveVideo } from "../actions";
import { parseVideoUrl, PROVIDER_LABELS, watchUrl } from "../parse";
import { type VideoValues, VIDEOS_PATH } from "../schema";

/**
 * A video by its link (step 7.6c). The player is not loaded here (it would
 * set third-party cookies): the recognized video opens on its own site.
 */
export function VideoEditor({
  videoId,
  initial,
  serverUpdatedAt,
  owners,
}: {
  videoId?: string;
  initial: VideoValues;
  serverUpdatedAt?: string;
  owners: OwnerOptions;
}) {
  const router = useRouter();
  const draft = useDraftAutosave<VideoValues>({
    id: videoId,
    storagePrefix: "video-borrador",
    initial,
    serverUpdatedAt,
    save: saveVideo,
  });
  const { values, change } = draft;
  const recognized = values.url.trim() ? parseVideoUrl(values.url) : null;

  const submit = async () => {
    const id = await draft.saveNow();
    if (!id) return;
    if (!videoId) router.replace(`${VIDEOS_PATH}/${id}`);
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
        <Label htmlFor="video-url">Enlace del video</Label>
        <p id="video-url-help" className="text-sm text-ink-muted">
          De YouTube, Vimeo, Facebook o TikTok. Copia el enlace completo desde el navegador.
        </p>
        <Input
          id="video-url"
          type="url"
          inputMode="url"
          value={values.url}
          onChange={(event) => change("url", event.target.value)}
          maxLength={500}
          autoComplete="off"
          aria-describedby="video-url-help video-url-status"
          required
        />
        <div id="video-url-status" aria-live="polite">
          {recognized?.ok ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-green-700">
              <span>
                Video de {PROVIDER_LABELS[recognized.provider]} reconocido ({recognized.id}).
              </span>
              <a
                href={watchUrl(recognized.provider, recognized.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-medium underline"
              >
                Ver en {PROVIDER_LABELS[recognized.provider]}
                <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </p>
          ) : recognized ? (
            <p className="text-sm font-medium text-danger">{recognized.error}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-title">Título</Label>
        <Input
          id="video-title"
          value={values.title}
          onChange={(event) => change("title", event.target.value)}
          maxLength={160}
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-description">Descripción (opcional)</Label>
        <textarea
          id="video-description"
          value={values.description}
          onChange={(event) => change("description", event.target.value)}
          maxLength={1000}
          className="min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-owner">Pertenece a (opcional)</Label>
        <OwnerSelect
          id="video-owner"
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
