// Contact form constants the browser needs, without Zod: the form page stays
// light (step 9.6, docs/07 §10). The rules themselves live in schema.ts.

export const CONTACT_PATH = "/contacto";
export const MESSAGE_MAX = 5000;

export type ContactState = {
  error?: string;
  sent?: boolean;
};
