import type { Metadata } from "next";

import { ZodConfig } from "@/components/zod-config";

// The panel is never indexed by search engines (docs/07 §9)
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel · Reconstruyendo Esperanza" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      {/* The panel validates forms in the browser; the public site loads no Zod (9.6) */}
      <ZodConfig />
      {children}
    </>
  );
}
