"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { LinkedConsent } from "@/modules/consents";
import { CreateConsentForm, MediaConsentsPanel } from "@/modules/consents/client";
import { updateMediaPeople } from "@/modules/media/client";

export type PeoplePhoto = {
  mediaId: string;
  label: string;
  thumbnailUrl: string | null;
  people: string | null;
  issues: string[];
  linked: LinkedConsent[];
};

const OPTIONS = [
  { value: "none", label: "No" },
  { value: "identifiable", label: "Sí, adultos" },
  { value: "minors", label: "Sí, con menores" },
] as const;

const CONSENT_ISSUES = new Set(["missing_consent", "missing_guardian_consent"]);

/** Bottom sheet to link or register the authorizations of one photo (docs/07 §6.5). */
function ConsentSheet({ activityId, photo }: { activityId: string; photo: PeoplePhoto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const done = useCallback(() => {
    setRegistering(false);
    router.refresh();
  }, [router]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.refresh();
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" size="sm" variant="outline">
          Vincular autorización
          <span className="sr-only">: {photo.label}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-lg border-t bg-paper p-4 md:inset-x-auto md:top-1/2 md:left-1/2 md:w-[40rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
              Autorizaciones · {photo.label}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm">
                Cerrar
              </Button>
            </Dialog.Close>
          </div>
          <MediaConsentsPanel mediaId={photo.mediaId} linked={photo.linked} />
          <div className="mt-4">
            {registering ? (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-3 font-serif text-lg font-semibold text-green-900">
                  Registrar una autorización nueva
                </h3>
                <CreateConsentForm
                  forPhoto={{ mediaId: photo.mediaId, activityId }}
                  onDone={done}
                />
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => setRegistering(true)}>
                Registrar una nueva
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PhotoPeople({
  activityId,
  photo,
  index,
  canManageConsents,
}: {
  activityId: string;
  photo: PeoplePhoto;
  index: number;
  canManageConsents: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Marked at once; back to the saved value if saving fails (slow phones)
  const [selected, setSelected] = useState(photo.people);
  const missingConsent = photo.issues.find((code) => CONSENT_ISSUES.has(code));

  const choose = (value: string) => {
    setSelected(value);
    startTransition(async () => {
      const result = await updateMediaPeople(photo.mediaId, value);
      if (!result.ok) {
        setSelected(photo.people);
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  };

  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[8rem_1fr]">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-paper-2">
        {photo.thumbnailUrl ? (
          // Short-lived signed URL from a private bucket: next/image cannot cache it
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="grid gap-2">
        <fieldset aria-busy={pending}>
          <legend className="text-sm font-medium">
            {photo.label}: ¿aparecen personas reconocibles?
          </legend>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {OPTIONS.map((option) => (
              <label key={option.value} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={`people-${index}`}
                  value={option.value}
                  checked={selected === option.value}
                  onChange={() => choose(option.value)}
                  className="size-5 accent-green-700"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {selected === "identifiable" || selected === "minors" ? (
          <div className="grid gap-2 text-sm">
            {photo.linked.length > 0 ? (
              <p>
                Autorizaciones vinculadas:{" "}
                {photo.linked.map((consent) => consent.subjectName).join(", ")}
              </p>
            ) : null}
            {missingConsent ? (
              <p className="font-medium text-gold-700">
                {missingConsent === "missing_guardian_consent"
                  ? "Falta la autorización del representante legal."
                  : "Falta una autorización vigente."}
                {canManageConsents
                  ? ""
                  : " Un Editor o Administrador la vinculará antes de publicar."}
              </p>
            ) : (
              <p className="font-medium text-green-700">Autorización al día.</p>
            )}
            {canManageConsents ? <ConsentSheet activityId={activityId} photo={photo} /> : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Step 3 · Personas en las fotos. Whoever manages authorizations links them
 * here and confirms that every recognisable person is covered (docs/07).
 */
export function PeopleStep({
  activityId,
  photos,
  canManageConsents,
}: {
  activityId: string;
  photos: PeoplePhoto[];
  canManageConsents: boolean;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withPeople = photos.some(
    (photo) => photo.people === "identifiable" || photo.people === "minors",
  );
  const needsConfirmation = canManageConsents && withPeople;

  const next = () => {
    if (needsConfirmation && !confirmed) {
      setError("Confirma que todas las personas reconocibles están cubiertas antes de seguir.");
      return;
    }
    router.push(`/admin/actividades/${activityId}/editar?paso=4`);
  };

  return (
    <div className="grid gap-6">
      {photos.length === 0 ? (
        <p className="rounded-lg border bg-card p-4 text-ink-muted">
          La actividad no tiene fotos. Puedes seguir al último paso.
        </p>
      ) : (
        <ol aria-label="Personas en las fotos" className="divide-y rounded-lg border bg-card">
          {photos.map((photo, index) => (
            <PhotoPeople
              key={photo.mediaId}
              activityId={activityId}
              photo={photo}
              index={index}
              canManageConsents={canManageConsents}
            />
          ))}
        </ol>
      )}

      {needsConfirmation ? (
        <label className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setError(null);
            }}
            className="mt-1 size-5 accent-green-700"
          />
          <span>
            Confirmo que <strong>todas</strong> las personas reconocibles de las fotos están
            cubiertas por una autorización vigente.
          </span>
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/admin/actividades/${activityId}/editar?paso=2`}>Atrás</Link>
        </Button>
        <Button type="button" onClick={next}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
