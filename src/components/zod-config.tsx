"use client";

import { z } from "zod";

// In the browser Zod would test `new Function` to speed up validation; the
// CSP forbids eval (step 9.1), so tell it not to try. Same results, no reports.
z.config({ jitless: true });

export function ZodConfig() {
  return null;
}
