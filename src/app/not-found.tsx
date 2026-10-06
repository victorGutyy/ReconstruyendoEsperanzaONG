import type { Metadata } from "next";
import Link from "next/link";

import { PublicFrame } from "@/modules/site";

export const metadata: Metadata = { title: "Página no encontrada" };

/** Friendly 404 with useful links (RF-A-16), inside the public frame. */
export default function NotFound() {
  return (
    <PublicFrame>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Error 404</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-green-900">
          No encontramos esta página
        </h1>
        <p className="mt-4 text-ink-muted">
          Puede que la dirección esté mal escrita o que el contenido ya no esté publicado.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-green-700 px-5 font-semibold text-paper outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Volver al inicio
        </Link>
      </div>
    </PublicFrame>
  );
}
