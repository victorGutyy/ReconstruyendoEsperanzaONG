"use client";

import { startTransition, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateSiteSettings } from "../actions";
import {
  type ActionState,
  formatColombianPhone,
  SOCIAL_KEYS,
  SOCIAL_NETWORKS,
  type SiteSettings,
} from "../schema";

function Field({
  id,
  label,
  help,
  ...input
}: {
  id: string;
  label: string;
  help?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-describedby={help ? `${id}-help` : undefined} {...input} />
      {help ? (
        <p id={`${id}-help`} className="text-sm text-ink-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** Contact details, networks and default SEO of the public site (step 8.1, HU-11). */
export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateSiteSettings,
    {},
  );

  return (
    <form
      className="grid gap-8"
      noValidate
      // Not `action={…}`: React would clear every field after each save, also
      // after an error, and the person would lose what they typed
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <fieldset className="grid gap-5">
        <legend className="mb-2 font-serif text-xl font-semibold text-green-900">
          La organización
        </legend>
        <Field
          id="organizationName"
          label="Nombre"
          defaultValue={settings.organizationName}
          maxLength={120}
          autoComplete="organization"
          required
        />
        <Field
          id="tagline"
          label="Frase corta"
          help="Aparece bajo el nombre en el sitio. Máximo 160 caracteres."
          defaultValue={settings.tagline ?? ""}
          maxLength={160}
          autoComplete="off"
        />
        <Field
          id="seoDescription"
          label="Descripción para buscadores y redes"
          help="La que muestran Google y WhatsApp cuando una página no tiene la suya. Máximo 160 caracteres."
          defaultValue={settings.seoDescription ?? ""}
          maxLength={160}
          autoComplete="off"
        />
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-2 font-serif text-xl font-semibold text-green-900">Contacto</legend>
        <Field
          id="contactEmail"
          label="Correo"
          type="email"
          defaultValue={settings.contactEmail ?? ""}
          maxLength={254}
          autoComplete="off"
        />
        <Field
          id="whatsappNumber"
          label="WhatsApp"
          help="Número colombiano de 10 dígitos. Sin él, el sitio no muestra el botón de WhatsApp."
          type="tel"
          inputMode="tel"
          defaultValue={
            settings.whatsappNumber ? formatColombianPhone(settings.whatsappNumber) : ""
          }
          autoComplete="off"
        />
        <Field
          id="phone"
          label="Teléfono"
          type="tel"
          inputMode="tel"
          defaultValue={settings.phone ? formatColombianPhone(settings.phone) : ""}
          autoComplete="off"
        />
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-2 font-serif text-xl font-semibold text-green-900">
          Redes sociales
        </legend>
        <p className="-mt-3 text-sm text-ink-muted">
          Pega el enlace completo del perfil (empieza por https://). Las que queden vacías no se
          muestran.
        </p>
        {SOCIAL_KEYS.map((key) => (
          <Field
            key={key}
            id={key}
            label={SOCIAL_NETWORKS[key].label}
            type="url"
            inputMode="url"
            placeholder={`https://${SOCIAL_NETWORKS[key].hosts[0]}/…`}
            defaultValue={settings.socialLinks[key] ?? ""}
            autoComplete="off"
          />
        ))}
      </fieldset>

      <div className="grid gap-3">
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar configuración"}
          </Button>
        </div>
        <div aria-live="polite">
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          {state.notice ? (
            <p role="status" className="text-sm font-medium text-green-700">
              {state.notice}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
