"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { startTransition, useActionState, useEffect, useRef } from "react";

import { submitContactMessage } from "../actions";
import { type ContactState, MESSAGE_MAX } from "../shared";

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string | HTMLElement) => void };
  }
}

// Plain elements with the panel's look (Input, Label, Button), so this public
// page does not download the panel's class utilities (step 9.6, docs/07 §10)
const labelClass = "flex items-center gap-2 text-sm leading-none font-medium select-none";
const inputClass =
  "h-12 w-full min-w-0 rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const submitClass =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const textareaClass =
  "min-h-36 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The contact form (step 8.7, HU-03). Cloudflare Turnstile checks that a
 * person is writing, without a puzzle. Submitted without React's automatic
 * reset, so a mistake never erases what the person wrote.
 */
export function ContactForm({
  siteKey,
  policyHref,
  noticeHref,
}: {
  siteKey: string;
  policyHref: string;
  noticeHref: string;
}) {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(
    submitContactMessage,
    {},
  );
  const widget = useRef<HTMLDivElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A Turnstile token works once: after an error the widget gets a new one
    if (state.error && widget.current) window.turnstile?.reset(widget.current);
    if (state.sent) confirmation.current?.focus();
  }, [state]);

  if (state.sent) {
    return (
      <div
        ref={confirmation}
        tabIndex={-1}
        role="status"
        className="rounded-sm border-2 border-green-700 bg-card p-6 outline-none"
      >
        <p className="flex items-center gap-2 font-serif text-xl font-semibold text-green-900">
          <CheckCircle2 aria-hidden="true" className="size-6" />
          Recibimos tu mensaje
        </p>
        <p className="mt-2 text-ink-muted">Gracias por escribirnos. Te responderemos pronto.</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />

      <div className="space-y-2">
        <label htmlFor="contact-name" className={labelClass}>
          Nombre
        </label>
        <input
          className={inputClass}
          id="contact-name"
          name="fullName"
          autoComplete="name"
          maxLength={120}
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contact-email" className={labelClass}>
            Correo
          </label>
          <input
            className={inputClass}
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="contact-phone" className={labelClass}>
            Teléfono o WhatsApp
          </label>
          <input
            className={inputClass}
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-describedby="contact-reach"
          />
        </div>
        <p id="contact-reach" className="-mt-3 text-sm text-ink-muted sm:col-span-2">
          Déjanos al menos uno de los dos para poder responderte.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-message" className={labelClass}>
          Mensaje
        </label>
        <textarea
          id="contact-message"
          name="message"
          maxLength={MESSAGE_MAX}
          required
          className={textareaClass}
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="accepted"
          required
          className="mt-0.5 size-5 shrink-0 accent-green-700"
        />
        <span>
          Acepto la{" "}
          <Link
            href={policyHref}
            className="font-medium text-green-700 underline underline-offset-4"
          >
            política de tratamiento de datos
          </Link>{" "}
          y que usen mis datos solo para responder este mensaje (
          <Link
            href={noticeHref}
            className="font-medium text-green-700 underline underline-offset-4"
          >
            aviso de privacidad
          </Link>
          ).
        </span>
      </label>

      <div
        ref={widget}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-language="es"
        data-theme="light"
      />

      <div className="grid gap-3">
        <div>
          <button type="submit" disabled={pending} className={submitClass}>
            {pending ? "Enviando…" : "Enviar mensaje"}
          </button>
        </div>
        <div aria-live="polite">
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
