"use client";

import Link from "next/link";

/**
 * Friendly error page (RF-A-16): no technical details, a way to try again.
 * Plain elements, not the panel's Button: every public page loads this
 * boundary, so it must stay light (step 9.6, docs/07 §10).
 */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Error</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-green-900">
        Algo salió mal al cargar esta página
      </h1>
      <p className="mt-4 text-ink-muted">Vuelve a intentarlo en un momento.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md border px-5 font-semibold text-green-900 outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
