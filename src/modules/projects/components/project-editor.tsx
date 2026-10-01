"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { RichTextDoc } from "@/lib/rich-text/schema";
import { DraftRecovery, useDraftAutosave } from "@/modules/content/client";

import { saveProject } from "../actions";
import {
  PROJECT_STAGES,
  PROJECTS_PATH,
  type ProjectStage,
  type ProjectValues,
  STAGE_LABELS,
} from "../schema";

const textareaClass =
  "w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The project itself (step 7.6b). The draft is created on "Guardar borrador";
 * after that every change is saved automatically, with a copy on the phone.
 */
export function ProjectEditor({
  projectId,
  initial,
  serverUpdatedAt,
}: {
  projectId?: string;
  initial: ProjectValues;
  serverUpdatedAt?: string;
}) {
  const router = useRouter();
  const bodyLabelId = useId();
  const draft = useDraftAutosave<ProjectValues>({
    id: projectId,
    storagePrefix: "proyecto-borrador",
    initial,
    serverUpdatedAt,
    save: saveProject,
  });
  const { values, change } = draft;

  const submit = async () => {
    const id = await draft.saveNow();
    if (!id) return;
    if (!projectId) router.replace(`${PROJECTS_PATH}/${id}`);
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
        <Label htmlFor="project-title">Nombre del proyecto</Label>
        <Input
          id="project-title"
          value={values.title}
          onChange={(event) => change("title", event.target.value)}
          maxLength={160}
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-summary">Resumen</Label>
        <p id="project-summary-help" className="text-sm text-ink-muted">
          Una o dos frases: se ve en las tarjetas del sitio.
        </p>
        <textarea
          id="project-summary"
          value={values.summary}
          onChange={(event) => change("summary", event.target.value)}
          maxLength={300}
          aria-describedby="project-summary-help"
          className={`min-h-20 ${textareaClass}`}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-objective">Objetivo (opcional)</Label>
        <textarea
          id="project-objective"
          value={values.objective}
          onChange={(event) => change("objective", event.target.value)}
          maxLength={1000}
          className={`min-h-20 ${textareaClass}`}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="project-stage">Estado del proyecto</Label>
          <NativeSelect
            id="project-stage"
            value={values.stage}
            onChange={(event) => change("stage", event.target.value as ProjectStage)}
          >
            {PROJECT_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-start">Inicio (opcional)</Label>
          <Input
            id="project-start"
            type="date"
            value={values.startDate}
            onChange={(event) => change("startDate", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-end">Fin (opcional)</Label>
          <Input
            id="project-end"
            type="date"
            value={values.endDate}
            onChange={(event) => change("endDate", event.target.value)}
          />
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
