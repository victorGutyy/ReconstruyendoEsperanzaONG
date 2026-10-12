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
  /**
   * The limiter could not answer (not configured, error or timeout): the
   * request was refused without knowing whether the limit was reached.
   * Sensitive actions treat it as a refusal; public reading may go on (docs/05 §7).
   */
  unavailable?: true;
};

/** What a limiter answers when it cannot answer: refuse, retry in a minute. */
export const UNAVAILABLE: RateLimitResult = {
  success: false,
  retryAfterSeconds: 60,
  unavailable: true,
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
  // New password from the recovery link (step 9.2)
  passwordUpdate: { name: "password-update", limit: 5, windowSeconds: 15 * 60 },
  userInvites: { name: "user-invites", limit: 20, windowSeconds: 60 * 60 },
  panelActions: { name: "panel-actions", limit: 120, windowSeconds: 60 },
  mediaUploads: { name: "media-uploads", limit: 60, windowSeconds: 60 * 60 },
  // Public search reads the database on every request (step 8.6)
  publicSearch: { name: "public-search", limit: 30, windowSeconds: 60 },
  // Contact form (step 8.7, docs/05 §7), on top of Turnstile
  contactForm: { name: "contact-form", limit: 5, windowSeconds: 10 * 60 },
} as const satisfies Record<string, RateLimitRule>;
