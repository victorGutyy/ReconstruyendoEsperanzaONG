import { parseEnv, type PublicEnv, publicEnvSchema } from "./schema";

let cached: PublicEnv | undefined;

// Safe in the browser. Each variable is referenced literally so Next.js can inline it at build time.
export function getPublicEnv(): PublicEnv {
  cached ??= parseEnv(publicEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
