import "server-only";

import { parseEnv, type ServerEnv, serverEnvSchema } from "./schema";

let cached: ServerEnv | undefined;

// Secrets: importing this file from client code fails the build (docs/05 §9).
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  return cached;
}
