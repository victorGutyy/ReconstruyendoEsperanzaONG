import { z } from "zod";

// Variable names follow docs/04-arquitectura.md §8. Values never appear in errors or logs.
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

// Server variables are optional here and required where they are used, so a
// missing secret only breaks the feature that needs it.
export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Only for local development and CI (single process). Never set it on Vercel.
  RATE_LIMIT_DRIVER: z.enum(["memory"]).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseEnv<T extends z.ZodType>(
  schema: T,
  input: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(
      `Missing or invalid environment variables: ${names.join(", ")}. ` +
        "Copy .env.example to .env.local and fill in the values (see README).",
    );
  }
  return result.data;
}
