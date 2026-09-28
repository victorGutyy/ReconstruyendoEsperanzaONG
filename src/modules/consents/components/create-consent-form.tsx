"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getPublicEnv } from "@/lib/env/public";
import { preparePhoto, UnreadablePhotoError, uploadWithProgress } from "@/lib/images/browser";

import { createConsent, createConsentForPhoto, requestConsentDocumentUpload } from "../actions";
import { type ConsentFormState, readConsentFields } from "../schema";
import { ConsentFields } from "./consent-fields";

/**
 * Register an authorization. The photo of the signed form is uploaded first
 * (reduced in the browser, private bucket), then the record is created with it.
 */
export function CreateConsentForm({
  forPhoto,
  onDone,
}: {
  /** From the activity wizard: the new authorization is linked to this photo. */
  forPhoto?: { mediaId: string; activityId: string };
  onDone?: () => void;
} = {}) {
  const [state, formAction, saving] = useActionState<ConsentFormState, FormData>(
    forPhoto ? createConsentForPhoto : createConsent,
    {},
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const busy = saving || progress !== null;

  useEffect(() => {
    if (state.done) onDone?.();
  }, [state.done, onDone]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    const formData = new FormData(event.currentTarget);

    // Check the fields first: nothing is uploaded for a form that cannot be saved
    const fields = readConsentFields(formData);
    if (!fields.success) {
      setUploadError(fields.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }

    const file = formData.get("document");
    if (!(file instanceof File) || file.size === 0) {
      setUploadError("Adjunta la foto del formato firmado.");
      return;
    }

    try {
      setProgress(0);
      const photo = await preparePhoto(file);
      const request = await requestConsentDocumentUpload({ type: photo.type, size: photo.size });
      if (!request.ok) {
        setUploadError(request.error);
        return;
      }
      await uploadWithProgress(
        request.signedUrl,
        photo,
        getPublicEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        setProgress,
      );
      formData.delete("document");
      formData.set("uploadId", request.uploadId);
      startTransition(() => formAction(formData));
    } catch (error) {
      setUploadError(
        error instanceof UnreadablePhotoError
          ? "No pudimos abrir la foto del formato. Tómala de nuevo o envíala como JPEG."
          : "No se pudo subir la foto del formato. Vuelve a intentarlo.",
      );
    } finally {
      setProgress(null);
    }
  }

  const message = uploadError ?? state.error;

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {forPhoto ? (
        <>
          <input type="hidden" name="mediaId" value={forPhoto.mediaId} />
          <input type="hidden" name="activityId" value={forPhoto.activityId} />
        </>
      ) : null}
      <ConsentFields />

      <div className="space-y-2">
        <Label htmlFor="consent-document">Foto del formato firmado</Label>
        <p id="consent-document-help" className="text-sm text-ink-muted">
          Se guarda en privado, sin ubicación ni datos ocultos. Solo la ven Editores y
          Administradores.
        </p>
        <input
          id="consent-document"
          name="document"
          type="file"
          accept="image/*"
          required
          aria-describedby="consent-document-help"
          className="block w-full text-base file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-[1.5px] file:border-green-700 file:bg-transparent file:px-4 file:font-semibold file:text-green-700"
        />
        {progress !== null ? (
          <progress
            className="h-2 w-full accent-green-700"
            max={100}
            value={progress}
            aria-label="Progreso de la foto del formato"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Registrar autorización"}
        </Button>
        {message ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
