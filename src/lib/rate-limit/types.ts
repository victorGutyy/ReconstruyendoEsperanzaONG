/** A named rule: at most `limit` hits per `windowSeconds` for the same key. */
export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  success: boolean;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSeconds: number;
};

/** Provider-agnostic interface (docs/04 §6): Upstash in the cloud, memory locally. */
export interface RateLimiter {
  limit(rule: RateLimitRule, key: string): Promise<RateLimitResult>;
}

/** Limits from docs/05 §7. */
export const RATE_LIMITS = {
  loginPerAccount: { name: "login-account", limit: 5, windowSeconds: 15 * 60 },
  loginPerIp: { name: "login-ip", limit: 30, windowSeconds: 15 * 60 },
  mfaPerUser: { name: "mfa-user", limit: 5, windowSeconds: 15 * 60 },
  passwordRecovery: { name: "password-recovery", limit: 3, windowSeconds: 60 * 60 },
  userInvites: { name: "user-invites", limit: 20, windowSeconds: 60 * 60 },
  panelActions: { name: "panel-actions", limit: 120, windowSeconds: 60 },
  mediaUploads: { name: "media-uploads", limit: 60, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;
