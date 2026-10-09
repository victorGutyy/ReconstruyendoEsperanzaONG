import "server-only";

import { parseEnv, type ServerEnv, serverEnvSchema } from "./schema";

let cached: ServerEnv | undefined;

// Secrets: importing this file from client code fails the build (docs/05 §9).
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(serverEnvSchema, {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RATE_LIMIT_DRIVER: process.env.RATE_LIMIT_DRIVER,
    CRON_SECRET: process.env.CRON_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CONTACT_IP_HASH_SECRET: process.env.CONTACT_IP_HASH_SECRET,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  });
  return cached;
}

/**
 * Local development and CI: the in-memory rate limiter is only set there and
 * never on Vercel (docs/05 §7), so it also marks where test keys are allowed.
 */
export const isLocalRuntime = () => getServerEnv().RATE_LIMIT_DRIVER === "memory";

/** Throws a clear error naming the variable (never its value) when it is missing. */
export function requireServerEnv<K extends keyof ServerEnv>(name: K): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[name];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing environment variable: ${String(name)}. See .env.example.`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
