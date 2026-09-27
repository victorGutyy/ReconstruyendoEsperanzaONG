import Link from "next/link";

import { ADMIN_HOME } from "@/lib/auth/rules";

/** Shown when a signed-in member opens a section their role does not include. */
export function NoPermission({ reason }: { reason: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-3xl font-semibold text-green-900">No tienes permiso</h1>
      <p className="mt-4 text-ink-muted">{reason}</p>
      <Link href={ADMIN_HOME} className="mt-6 inline-block font-medium text-green-700 underline">
        Volver al inicio del panel
      </Link>
    </div>
  );
}
