import type { NextConfig } from "next";

import { contentSecurityPolicy, CSP_HEADER, SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  // Don't advertise the framework in response headers (docs/05 §8)
  poweredByHeader: false,
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for the CSP");
    const dev = process.env.NODE_ENV === "development";
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Public site: a fixed policy, so pages stay cached. The panel gets its
      // own, with a nonce per request, from src/proxy.ts (step 9.1)
      {
        source: "/((?!admin(?:/|$)).*)",
        headers: [{ key: CSP_HEADER, value: contentSecurityPolicy({ supabaseUrl, dev }) }],
      },
    ];
  },
};

export default nextConfig;
