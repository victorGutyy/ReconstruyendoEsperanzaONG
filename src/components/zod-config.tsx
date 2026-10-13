"use client";

import { z } from "zod";

// In the browser Zod would test `new Function` to speed up validation; the
// CSP forbids eval (step 9.1), so tell it not to try. Same results, no reports.
// Rendered by the panel layout and imported by the contact form: the only
// places that validate with Zod in the browser (step 9.6, docs/07 §10).
z.config({ jitless: true });

export function ZodConfig() {
  return null;
}
