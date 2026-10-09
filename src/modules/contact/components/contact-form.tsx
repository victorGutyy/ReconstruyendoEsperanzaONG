"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { startTransition, useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { submitContactMessage } from "../actions";
import { type ContactState, MESSAGE_MAX } from "../schema";

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string | HTMLElement) => void };
  }
}

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
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />

      <div className="space-y-2">
        <Label htmlFor="contact-name">Nombre</Label>
        <Input id="contact-name" name="fullName" autoComplete="name" maxLength={120} required />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-email">Correo</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Teléfono o WhatsApp</Label>
          <Input
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
        <Label htmlFor="contact-message">Mensaje</Label>
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
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Enviar mensaje"}
          </Button>
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
