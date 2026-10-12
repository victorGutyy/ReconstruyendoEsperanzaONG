import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, createNonce, SECURITY_HEADERS } from "./headers";

const supabaseUrl = "https://abc.supabase.co/";
const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("contentSecurityPolicy", () => {
  it("lets the public site load Turnstile, the video players and Supabase photos only", () => {
    const csp = contentSecurityPolicy({ supabaseUrl, dev: false });
    expect(directive(csp, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://challenges.cloudflare.com",
    ]);
    expect(directive(csp, "frame-src")).toEqual([
      "https://challenges.cloudflare.com",
      "https://www.youtube-nocookie.com",
      "https://player.vimeo.com",
      "https://www.tiktok.com",
    ]);
    expect(directive(csp, "img-src")).toContain("https://abc.supabase.co");
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(csp).not.toContain("unsafe-eval");
  });

  it("runs only the panel's own scripts: nonce, no inline code, no frames", () => {
    const csp = contentSecurityPolicy({ supabaseUrl, nonce: "abc123==", dev: false });
    expect(directive(csp, "script-src")).toEqual(["'nonce-abc123=='", "'strict-dynamic'"]);
    expect(directive(csp, "frame-src")).toEqual(["'none'"]);
    expect(directive(csp, "connect-src")).toEqual(["'self'", "https://abc.supabase.co"]);
  });

  it("allows eval only while developing", () => {
    expect(directive(contentSecurityPolicy({ supabaseUrl, dev: true }), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });
});

describe("headers", () => {
  it("forbids framing and sniffing on every response", () => {
    expect(SECURITY_HEADERS).toEqual(
      expect.arrayContaining([
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ]),
    );
  });

  it("makes a different nonce each time", () => {
    const nonce = createNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(nonce);
  });
});
