import type { Metadata } from "next";

import { Breadcrumbs } from "@/modules/site";

import { getPublicPage } from "../public";
import { PAGE_ADDRESSES, type PageKey } from "../schema";
import { PublicPageBody } from "./public-page";

type LegalKey = Extract<PageKey, "privacy-policy" | "privacy-notice">;

const FALLBACK_TITLES: Record<LegalKey, string> = {
  "privacy-policy": "Política de tratamiento de datos personales",
  "privacy-notice": "Aviso de privacidad",
};

export async function legalMetadata(key: LegalKey): Promise<Metadata> {
  const page = await getPublicPage(key);
  return {
    title: page?.seoTitle ?? page?.title ?? FALLBACK_TITLES[key],
    description: page?.seoDescription ?? undefined,
    alternates: { canonical: PAGE_ADDRESSES[key] },
  };
}

/** A legal page (RF-A-11) with the version in force (step 8.5). */
export async function LegalPage({ pageKey }: { pageKey: LegalKey }) {
  const page = await getPublicPage(pageKey);
  const title = page?.title ?? FALLBACK_TITLES[pageKey];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: title }]} />
      <h1 className="mt-4 font-serif text-4xl leading-tight font-semibold text-green-900">
        {title}
      </h1>
      <PublicPageBody
        page={page}
        legal
        preparing="Este documento está en revisión. Pronto estará disponible."
      />
    </div>
  );
}
