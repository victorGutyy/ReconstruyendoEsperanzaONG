"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { RichTextDoc } from "@/lib/rich-text/schema";

import { saveActivityBasics } from "../actions";
import type { Option } from "../queries";
import type { BasicsInput } from "../schema";

export type BasicsValues = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  placeId: string;
  categoryId: string;
  summary: string;
  body: RichTextDoc | null;
};

type Backup = { values: BasicsValues; savedAt: number };

/** Autosave a few seconds after the person stops typing (decision F7-D4). */
const AUTOSAVE_MS = 3000;
const storageKey = (id?: string) => `actividad-borrador:${id ?? "nueva"}`;
const noopSubscribe = () => () => undefined;

function readBackup(id?: string): Backup | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}
function writeBackup(id: string | undefined, values: BasicsValues) {
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify({ values, savedAt: Date.now() }));
  } catch {
    // Private mode or full storage: the server autosave still works
  }
}
function clearBackup(id?: string) {
  try {
    window.localStorage.removeItem(storageKey(id));
  } catch {
    // Nothing to clear
  }
}

const toInput = (values: BasicsValues): BasicsInput => ({ ...values, body: values.body });

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/**
 * Step 1 · Lo básico. The draft is created on the first "Siguiente" or
 * "Guardar borrador"; after that every change is saved automatically and a
 * copy stays on the phone in case the signal drops.
 */
export function BasicsForm({
  activityId,
  initial,
  serverUpdatedAt,
  places,
  categories,
}: {
  activityId?: string;
  initial: BasicsValues;
  serverUpdatedAt?: string;
  places: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const bodyLabelId = useId();
  const [values, setValues] = useState(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [showEnd, setShowEnd] = useState(Boolean(initial.endTime));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The copy on the phone is read once, when the page opens (never on the server)
  const [openingBackup] = useState(() =>
    typeof window === "undefined" ? null : readBackup(activityId),
  );
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const dirty = useRef(false);

  // A copy on the phone newer than the server version: offer it back
  const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
  const recovery =
    mounted &&
    !recoveryDismissed &&
    openingBackup &&
    openingBackup.savedAt > serverTime &&
    JSON.stringify(openingBackup.values) !== JSON.stringify(initial)
      ? openingBackup
      : null;

  const save = useCallback(
    async (next: BasicsValues, mode: "auto" | "manual") => {
      setSaving(true);
      // Without signal the call throws instead of answering: keep the local copy
      const result = await saveActivityBasics({ id: activityId, fields: toInput(next) }).catch(
        () => ({
          ok: false as const,
          error: "Sin conexión: se guardó una copia en este dispositivo.",
        }),
      );
      setSaving(false);
      if (!result.ok) {
        writeBackup(activityId, next);
        setError(result.error);
        setStatus(
          mode === "auto" ? "No se pudo guardar; se guardó una copia en este dispositivo." : null,
        );
        return null;
      }
      dirty.current = false;
      setError(null);
      clearBackup(activityId);
      setStatus(`Guardado a las ${timeFormat.format(new Date(result.savedAt))}.`);
      return result.id;
    },
    [activityId],
  );

  // Server autosave (only once the draft exists), always a local copy
  useEffect(() => {
    if (!dirty.current) return;
    writeBackup(activityId, values);
    if (!activityId) return;
    const timer = window.setTimeout(() => void save(values, "auto"), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, activityId, save]);

  const change = <K extends keyof BasicsValues>(key: K, value: BasicsValues[K]) => {
    dirty.current = true;
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (next: "stay" | "photos") => {
    const id = await save(values, "manual");
    if (!id) return;
    if (next === "photos") router.push(`/admin/actividades/${id}/editar?paso=2`);
    else if (!activityId) router.replace(`/admin/actividades/${id}/editar?paso=1`);
    else router.refresh();
  };

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit("photos");
      }}
    >
      {recovery ? (
        <div role="alert" className="grid gap-3 rounded-lg border border-gold-500 bg-card p-4">
          <p className="text-sm">
            Recuperamos lo que escribiste sin conexión. ¿Quieres usar esa versión?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                dirty.current = true;
                setValues(recovery.values);
                setEditorKey((key) => key + 1);
                setRecoveryDismissed(true);
              }}
            >
              Usar esta versión
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                clearBackup(activityId);
                setRecoveryDismissed(true);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="activity-title">Título</Label>
        <Input
          id="activity-title"
          value={values.title}
          onChange={(event) => change("title", event.target.value)}
          maxLength={160}
          autoComplete="off"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="activity-date">Fecha</Label>
          <Input
            id="activity-date"
            type="date"
            value={values.date}
            onChange={(event) => change("date", event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-start">Hora de inicio</Label>
          <Input
            id="activity-start"
            type="time"
            value={values.startTime}
            onChange={(event) => change("startTime", event.target.value)}
            required
          />
        </div>
      </div>

      {showEnd ? (
        <div className="space-y-2 sm:max-w-[50%]">
          <Label htmlFor="activity-end">Hora de fin (opcional)</Label>
          <Input
            id="activity-end"
            type="time"
            value={values.endTime}
            onChange={(event) => change("endTime", event.target.value)}
          />
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setShowEnd(true)}
            className="min-h-11 font-medium text-green-700 underline"
          >
            Agregar hora de fin
          </button>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="activity-place">Lugar general</Label>
          <NativeSelect
            id="activity-place"
            value={values.placeId}
            onChange={(event) => change("placeId", event.target.value)}
          >
            <option value="">Elige un lugar</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-category">Categoría</Label>
          <NativeSelect
            id="activity-category"
            value={values.categoryId}
            onChange={(event) => change("categoryId", event.target.value)}
          >
            <option value="">Elige una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-summary">Resumen</Label>
        <p id="activity-summary-help" className="text-sm text-ink-muted">
          Una o dos frases: se ve en las tarjetas del sitio.
        </p>
        <textarea
          id="activity-summary"
          value={values.summary}
          onChange={(event) => change("summary", event.target.value)}
          maxLength={300}
          aria-describedby="activity-summary-help"
          className="min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <span id={bodyLabelId} className="text-sm font-medium">
          Relato
        </span>
        <RichTextEditor
          key={editorKey}
          name="body"
          labelledBy={bodyLabelId}
          defaultValue={values.body}
          onChange={(doc) => change("body", doc)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          Siguiente
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => void submit("stay")}
        >
          Guardar borrador
        </Button>
        <p aria-live="polite" className="text-sm text-ink-muted">
          {saving ? "Guardando…" : status}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
