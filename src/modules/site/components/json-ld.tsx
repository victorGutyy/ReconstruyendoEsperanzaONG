import { jsonLdText } from "../seo";

/**
 * Structured data for search engines (step 8.8). The JSON is built from our
 * own objects and "<" is escaped (jsonLdText), so panel text cannot break out
 * of the script: the one safe use of a raw script body.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />
  );
}
