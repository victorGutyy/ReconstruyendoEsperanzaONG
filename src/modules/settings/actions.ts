"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { revalidatePublicSite } from "@/lib/site/revalidate";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, SETTINGS_PATH, SOCIAL_KEYS, settingsSchema } from "./schema";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/**
 * Saves the site settings (settings.manage: the Administrator, with MFA). The
 * public site shows the change at once, without a new deploy (HU-11).
 */
export async function updateSiteSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authorized = await authorizeAction("settings.manage");
  if (!authorized.ok) return { error: authorized.error };

  const parsed = settingsSchema.safeParse({
    organizationName: field(formData, "organizationName"),
    tagline: field(formData, "tagline"),
    contactEmail: field(formData, "contactEmail"),
    whatsappNumber: field(formData, "whatsappNumber"),
    phone: field(formData, "phone"),
    facebook: field(formData, "facebook"),
    instagram: field(formData, "instagram"),
    tiktok: field(formData, "tiktok"),
    youtube: field(formData, "youtube"),
    x: field(formData, "x"),
    seoDescription: field(formData, "seoDescription"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(authorized.auth.user.id),
  );
  if (!attempt.success) return { error: "Demasiadas acciones seguidas. Espera un momento." };

  const values = parsed.data;
  const socialLinks = Object.fromEntries(
    SOCIAL_KEYS.flatMap((key) => (values[key] ? [[key, values[key]]] : [])),
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .update({
      organization_name: values.organizationName,
      tagline: values.tagline,
      contact_email: values.contactEmail,
      whatsapp_number: values.whatsappNumber,
      phone: values.phone,
      social_links: socialLinks,
      default_seo: values.seoDescription ? { description: values.seoDescription } : {},
    })
    .eq("id", true)
    .select("id");
  if (error) return { error: "No se pudo guardar la configuración. Vuelve a intentarlo." };
  if (data.length === 0) return { error: "No tienes permiso para cambiar la configuración." };

  revalidatePublicSite();
  revalidatePath(SETTINGS_PATH);
  return { notice: "Configuración guardada. El sitio ya muestra los cambios." };
}
