"use server";

import { createHmac } from "node:crypto";

import { getServerEnv, isLocalRuntime } from "@/lib/env/server";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { getClientIp } from "@/lib/utils/request";
import { getPublicPage } from "@/modules/pages";

import { type ContactState, contactSchema } from "./schema";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** The key of the IP's HMAC, or null: without it the form stays closed. */
function ipHashSecret(): string | null {
  return (
    getServerEnv().CONTACT_IP_HASH_SECRET ?? (isLocalRuntime() ? "local-development-only" : null)
  );
}

const CLOSED =
  "El formulario no está disponible en este momento. Escríbenos por WhatsApp o correo.";

/**
 * Receives a message from the contact form (RF-A-09, HU-03), in this order:
 * Turnstile, the rate limit (5 every 10 minutes per IP), the data, and only
 * then the database, with the server key (visitors cannot insert: docs/06).
 */
export async function submitContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values = {
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    message: field(formData, "message"),
  };

  // Without the published policy, no authorization can be asked (docs/09)
  const policy = await getPublicPage("privacy-policy");
  const secret = ipHashSecret();
  if (!policy?.version || !secret) return { error: CLOSED };

  const ip = await getClientIp();
  if (!(await verifyTurnstile(field(formData, "cf-turnstile-response"), ip))) {
    return { error: "No pudimos comprobar que eres una persona. Vuelve a intentarlo." };
  }

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.contactForm,
    rateLimitKey("contact", ip),
  );
  if (!attempt.success) {
    return {
      error: "Ya recibimos varios mensajes desde aquí. Espera unos minutos y vuelve a intentarlo.",
    };
  }

  const parsed = contactSchema.safeParse({ ...values, accepted: formData.get("accepted") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const { error } = await createAdminClient()
    .from("contact_messages")
    .insert({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      message: parsed.data.message,
      privacy_policy_version: policy.version,
      consent_accepted_at: new Date().toISOString(),
      ip_hash: createHmac("sha256", secret).update(ip).digest("hex"),
    });
  if (error) return { error: "No pudimos enviar tu mensaje. Vuelve a intentarlo." };

  return { sent: true };
}
