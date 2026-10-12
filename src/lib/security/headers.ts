// Security headers (step 9.1, docs/05 §8). Pure: used by next.config.ts for
// the public site and by src/proxy.ts for the panel; tested in headers.test.ts.

const TURNSTILE = "https://challenges.cloudflare.com";
// The only video players the site embeds (videos/parse.ts embedUrl)
const VIDEO_PLAYERS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://www.tiktok.com",
];

/**
 * Report-Only while the policy is checked on staging (docs/05 §8, CSP in two
 * steps); switching this name to "Content-Security-Policy" enforces it.
 */
export const CSP_HEADER = "Content-Security-Policy-Report-Only";

export type CspOptions = {
  /** NEXT_PUBLIC_SUPABASE_URL: photos, uploads and the panel's session. */
  supabaseUrl: string;
  /**
   * Panel only: a fresh value per request. Then only scripts carrying it (and
   * what they load) run, with no 'unsafe-inline'. The public site has none so
   * its pages stay cached, and allows Next's inline scripts instead; nothing
   * typed in the panel is ever rendered as raw HTML there.
   */
  nonce?: string;
  /** next dev: React needs eval to rebuild stack traces. */
  dev: boolean;
};

export function contentSecurityPolicy({ supabaseUrl, nonce, dev }: CspOptions): string {
  const supabase = new URL(supabaseUrl).origin;
  const eval_ = dev ? ["'unsafe-eval'"] : [];
  const script = nonce
    ? [`'nonce-${nonce}'`, "'strict-dynamic'", ...eval_]
    : ["'self'", "'unsafe-inline'", TURNSTILE, ...eval_];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": script,
    // Next and the fonts inject inline styles; styles cannot run code
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, ...(nonce ? [] : [TURNSTILE])],
    "frame-src": nonce ? ["'none'"] : [TURNSTILE, ...VIDEO_PLAYERS],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/** The headers every response carries, besides the CSP. */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

/** A nonce for one panel request: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
