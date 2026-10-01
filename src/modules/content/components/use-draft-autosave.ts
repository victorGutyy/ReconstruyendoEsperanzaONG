"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { SaveResult } from "../types";

// Autosave for the single-page content editors (steps 7.6a–b, decision F7-D4):
// a few seconds after the person stops typing, plus a copy on the phone in
// case the signal drops, offered back when the page opens again.

const AUTOSAVE_MS = 3000;
const noopSubscribe = () => () => undefined;

type Backup<V> = { values: V; savedAt: number };

function readBackup<V>(key: string): Backup<V> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Backup<V>) : null;
  } catch {
    return null;
  }
}
function writeBackup<V>(key: string, values: V) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ values, savedAt: Date.now() }));
  } catch {
    // Private mode or full storage: the server autosave still works
  }
}
function clearBackup(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear
  }
}

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/**
 * `storagePrefix` names the copy on the phone ("historia-borrador"), `id` is
 * missing until the draft is created (then only the local copy is kept).
 */
export function useDraftAutosave<V extends object>({
  id,
  storagePrefix,
  initial,
  serverUpdatedAt,
  save,
}: {
  id?: string;
  storagePrefix: string;
  initial: V;
  serverUpdatedAt?: string;
  save: (input: { id?: string; fields: V }) => Promise<SaveResult>;
}) {
  const storageKey = `${storagePrefix}:${id ?? "nueva"}`;
  const [values, setValues] = useState(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The copy on the phone is read once, when the page opens (never on the server)
  const [openingBackup] = useState(() =>
    typeof window === "undefined" ? null : readBackup<V>(storageKey),
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

  const run = useCallback(
    async (next: V, mode: "auto" | "manual") => {
      setSaving(true);
      // Without signal the call throws instead of answering: keep the local copy
      const result = await save({ id, fields: next }).catch(() => ({
        ok: false as const,
        error: "Sin conexión: se guardó una copia en este dispositivo.",
      }));
      setSaving(false);
      if (!result.ok) {
        writeBackup(storageKey, next);
        setError(result.error);
        setStatus(
          mode === "auto" ? "No se pudo guardar; se guardó una copia en este dispositivo." : null,
        );
        return null;
      }
      dirty.current = false;
      setError(null);
      clearBackup(storageKey);
      setStatus(`Guardado a las ${timeFormat.format(new Date(result.savedAt))}.`);
      return result.id;
    },
    [id, save, storageKey],
  );

  // Server autosave (only once the draft exists), always a local copy
  useEffect(() => {
    if (!dirty.current) return;
    writeBackup(storageKey, values);
    if (!id) return;
    const timer = window.setTimeout(() => void run(values, "auto"), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, id, run, storageKey]);

  const change = <K extends keyof V>(key: K, value: V[K]) => {
    dirty.current = true;
    setValues((current) => ({ ...current, [key]: value }));
  };

  return {
    values,
    change,
    /** Remount key for uncontrolled fields (the rich text editor). */
    editorKey,
    saving,
    status,
    error,
    recovery,
    applyRecovery: () => {
      if (!recovery) return;
      dirty.current = true;
      setValues(recovery.values);
      setEditorKey((key) => key + 1);
      setRecoveryDismissed(true);
    },
    discardRecovery: () => {
      clearBackup(storageKey);
      setRecoveryDismissed(true);
    },
    /** "Guardar borrador": returns the id, or null when it failed. */
    saveNow: () => run(values, "manual"),
  };
}
