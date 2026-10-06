import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

/** Tag of every cached public query (step 8.2). */
export const PUBLIC_CONTENT_TAG = "public-content";

/**
 * The public pages are cached and refreshed every 5 minutes anyway, for
 * scheduled content and the date (`export const revalidate = 300`, step 8.1).
 * Call this after anything visitors see changes (settings, publishing,
 * retiring, trash, photos) so it shows at once. Works in Server Actions and
 * Route Handlers (the daily photo sync).
 */
export function revalidatePublicSite() {
  // Visitors never get stale content after a change: the next request rebuilds
  revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
