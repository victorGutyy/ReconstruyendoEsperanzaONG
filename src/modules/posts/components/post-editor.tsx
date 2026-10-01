"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { RichTextDoc } from "@/lib/rich-text/schema";

import { savePost } from "../actions";
import type { Option } from "../queries";
import { POSTS_PATH, type PostValues } from "../schema";

type Backup = { values: PostValues; savedAt: number };

/** Autosave a few seconds after the person stops typing (decision F7-D4). */
const AUTOSAVE_MS = 3000;
const storageKey = (id?: string) => `historia-borrador:${id ?? "nueva"}`;
const noopSubscribe = () => () => undefined;

function readBackup(id?: string): Backup | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}
function writeBackup(id: string | undefined, values: PostValues) {
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

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  timeStyle: "short",
  timeZone: "America/Bogota",
});

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
}: {
  postId?: string;
  initial: PostValues;
  serverUpdatedAt?: string;
  categories: Option[];
}) {
  const router = useRouter();
  const bodyLabelId = useId();
  const [values, setValues] = useState(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The copy on the phone is read once, when the page opens (never on the server)
  const [openingBackup] = useState(() =>
    typeof window === "undefined" ? null : readBackup(postId),
  );
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const dirty = useRef(false);

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
    async (next: PostValues, mode: "auto" | "manual") => {
      setSaving(true);
      // Without signal the call throws instead of answering: keep the local copy
      const result = await savePost({ id: postId, fields: next }).catch(() => ({
        ok: false as const,
        error: "Sin conexión: se guardó una copia en este dispositivo.",
      }));
      setSaving(false);
      if (!result.ok) {
        writeBackup(postId, next);
        setError(result.error);
        setStatus(
          mode === "auto" ? "No se pudo guardar; se guardó una copia en este dispositivo." : null,
        );
        return null;
      }
      dirty.current = false;
      setError(null);
      clearBackup(postId);
      setStatus(`Guardado a las ${timeFormat.format(new Date(result.savedAt))}.`);
      return result.id;
    },
    [postId],
  );

  // Server autosave (only once the draft exists), always a local copy
  useEffect(() => {
    if (!dirty.current) return;
    writeBackup(postId, values);
    if (!postId) return;
    const timer = window.setTimeout(() => void save(values, "auto"), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, postId, save]);

  const change = <K extends keyof PostValues>(key: K, value: PostValues[K]) => {
    dirty.current = true;
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const id = await save(values, "manual");
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
                clearBackup(postId);
                setRecoveryDismissed(true);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
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
          >
            <option value="">Elige una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
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
          key={editorKey}
          name="body"
          labelledBy={bodyLabelId}
          defaultValue={values.body as RichTextDoc | null}
          onChange={(doc) => change("body", doc)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={saving}>
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
