import type { Metadata } from "next";

// The panel is never indexed by search engines (docs/07 §9)
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel · Reconstruyendo Esperanza" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
