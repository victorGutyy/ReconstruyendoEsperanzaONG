import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { ContentTabs, statusLabel } from "@/modules/content/client";
import { listPages } from "@/modules/pages/queries";
import { isLegalPage, PAGES_PATH } from "@/modules/pages/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Páginas" };

export default async function PagesPage() {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const pages = await listPages();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Páginas</h1>
      <ContentTabs
        current="page"
        canManageConsents={hasPermission(authorized.profile, "consent.manage")}
      />

      <p className="mt-6 text-ink-muted">
        Las páginas fijas del sitio. Las institucionales las editan los editores; las legales solo
        el Administrador, y cada versión publicada queda guardada.
      </p>
      <ul aria-label="Páginas" className="mt-4 divide-y rounded-lg border bg-card">
        {pages.map((page) => (
          <li key={page.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="min-w-0">
              <Link
                href={`${PAGES_PATH}/${page.id}`}
                className="font-semibold text-green-900 underline-offset-4 hover:underline"
              >
                {page.title}
              </Link>
              <p className="text-sm text-ink-muted">
                {isLegalPage(page.key)
                  ? `Legal${page.version ? ` · versión ${page.version}` : ""}`
                  : "Institucional"}
              </p>
            </div>
            <span className="flex flex-wrap gap-2">
              {page.pendingText ? (
                <span className="rounded-sm border border-gold-500 bg-card px-2 py-1 text-xs font-semibold text-gold-700">
                  Texto pendiente
                </span>
              ) : null}
              <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold">
                {statusLabel("page", page.status, page.publishedAt)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
