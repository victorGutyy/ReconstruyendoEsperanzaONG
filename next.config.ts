import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework in response headers (docs/05 §8)
  poweredByHeader: false,
};

export default nextConfig;
