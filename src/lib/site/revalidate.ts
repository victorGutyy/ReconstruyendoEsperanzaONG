import "server-only";

import { revalidatePath } from "next/cache";

/**
 * The public pages are cached and refreshed every 5 minutes anyway, for
 * scheduled content and the date (`export const revalidate = 300`, step 8.1).
 * Call this after anything visitors see changes (settings, publishing,
 * retiring, trash) so it shows at once.
 */
export function revalidatePublicSite() {
  revalidatePath("/", "layout");
}
