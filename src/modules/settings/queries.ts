import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

import { SOCIAL_KEYS, type SiteSettings, type SocialNetwork } from "./schema";

const FALLBACK: SiteSettings = {
  organizationName: "Reconstruyendo Esperanza",
  tagline: null,
  contactEmail: null,
  whatsappNumber: null,
  phone: null,
  socialLinks: {},
  seoDescription: null,
  updatedAt: new Date(0).toISOString(),
};

/**
 * The site settings as any visitor reads them (no cookies: public pages stay
 * cacheable). Unknown keys in the stored JSON are ignored.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await createPublicClient()
    .from("site_settings")
    .select(
      "organization_name, tagline, contact_email, whatsapp_number, phone, social_links, default_seo, updated_at",
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) return FALLBACK;

  const stored = (data.social_links ?? {}) as Record<string, unknown>;
  const socialLinks: Partial<Record<SocialNetwork, string>> = {};
  for (const key of SOCIAL_KEYS) {
    const value = stored[key];
    if (typeof value === "string" && value.startsWith("https://")) socialLinks[key] = value;
  }
  const seo = (data.default_seo ?? {}) as Record<string, unknown>;

  return {
    organizationName: data.organization_name,
    tagline: data.tagline,
    contactEmail: data.contact_email,
    whatsappNumber: data.whatsapp_number,
    phone: data.phone,
    socialLinks,
    seoDescription: typeof seo.description === "string" ? seo.description : null,
    updatedAt: data.updated_at,
  };
}
