import { redirect } from "next/navigation";

import { CONTENT_TABS, CONTENT_TYPES } from "@/modules/content/client";

// The section opens on its first tab (each page checks its own permission)
export default function ContentPage() {
  redirect(CONTENT_TYPES[CONTENT_TABS[0].type].listPath);
}
