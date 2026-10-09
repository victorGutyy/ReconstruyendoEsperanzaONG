// Site settings (step 8.1, RF-A-30): form rules. Pure, unit-tested in schema.test.ts.

import { z } from "zod";

import { normalizeColombianPhone } from "@/lib/utils/phone";

export { formatColombianPhone, normalizeColombianPhone } from "@/lib/utils/phone";

export const SETTINGS_PATH = "/admin/configuracion";

/** Networks the site links to, each only on its own domains (docs/05). */
export const SOCIAL_NETWORKS = {
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"] },
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"] },
  youtube: { label: "YouTube", hosts: ["youtube.com"] },
  x: { label: "X", hosts: ["x.com", "twitter.com"] },
} as const;

export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;
export const SOCIAL_KEYS = Object.keys(SOCIAL_NETWORKS) as SocialNetwork[];

/** The https link of a profile on that network, or null. */
export function normalizeSocialLink(network: SocialNetwork, value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (!(SOCIAL_NETWORKS[network].hosts as readonly string[]).includes(host)) return null;
  if (url.pathname === "/" || url.pathname === "") return null;
  return url.toString();
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const phone = normalizeColombianPhone(value);
      if (!phone) {
        ctx.addIssue({
          code: "custom",
          message: `${label}: escribe un número colombiano de 10 dígitos, por ejemplo 300 123 4567.`,
        });
        return z.NEVER;
      }
      return phone;
    });

const socialField = (network: SocialNetwork) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const link = normalizeSocialLink(network, value);
      if (!link) {
        const { label, hosts } = SOCIAL_NETWORKS[network];
        ctx.addIssue({
          code: "custom",
          message: `${label}: pega el enlace https:// del perfil en ${hosts[0]}.`,
        });
        return z.NEVER;
      }
      return link;
    });

export const settingsSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la organización.")
    .max(120, "El nombre tiene máximo 120 caracteres."),
  tagline: optionalText(160, "La frase corta tiene máximo 160 caracteres."),
  contactEmail: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!z.email().safeParse(value).success || value.length > 254) {
        ctx.addIssue({ code: "custom", message: "Escribe un correo válido." });
        return z.NEVER;
      }
      return value.toLowerCase();
    }),
  whatsappNumber: optionalPhone("WhatsApp"),
  phone: optionalPhone("Teléfono"),
  facebook: socialField("facebook"),
  instagram: socialField("instagram"),
  tiktok: socialField("tiktok"),
  youtube: socialField("youtube"),
  x: socialField("x"),
  seoDescription: optionalText(160, "La descripción tiene máximo 160 caracteres."),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export type SiteSettings = {
  organizationName: string;
  tagline: string | null;
  contactEmail: string | null;
  whatsappNumber: string | null;
  phone: string | null;
  socialLinks: Partial<Record<SocialNetwork, string>>;
  seoDescription: string | null;
  updatedAt: string;
};

export type ActionState = { error?: string; notice?: string };

/** Text still waiting for the organization (CLAUDE.md: nothing invented). */
export const isPending = (value: string | null | undefined) =>
  !value || value.includes("[PENDIENTE");
