import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site/url";
import { robotsFor } from "@/modules/site";

// Only production may be indexed (step 8.8): staging and previews say "no".
export default function robots(): MetadataRoute.Robots {
  return robotsFor(process.env.VERCEL_ENV === "production", siteUrl().toString());
}
