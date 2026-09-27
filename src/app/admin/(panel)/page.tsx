import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthError } from "@/lib/auth/errors";
import { ADMIN_HOME, LOGIN_PATH, MFA_PATH } from "@/lib/auth/rules";
import { getCurrentProfile, requireAal2 } from "@/lib/auth/session";
import { navFor } from "@/modules/panel/navigation";

export const metadata: Metadata = { title: "Inicio" };

export default async function AdminHomePage() {
  try {
    await requireAal2();
  } catch (error) {
    if (isAuthError(error)) redirect(error.code === "MFA_REQUIRED" ? MFA_PATH : LOGIN_PATH);
    throw error;
  }

  const profile = await getCurrentProfile();
  const sections = navFor(profile).filter((item) => item.href !== ADMIN_HOME);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">
        Hola, {profile?.fullName ?? "equipo"}
      </h1>
      <p className="mt-4 text-ink-muted">
        Entraste con verificación en dos pasos. Las secciones de contenido se suman al panel en las
        próximas fases.
      </p>

      {sections.length > 0 ? (
        <section aria-labelledby="sections-title" className="mt-10">
          <h2 id="sections-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
            Secciones
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {sections.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-lg border bg-card p-5 outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between font-serif text-lg font-semibold text-green-900">
                    {item.label}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                  <span className="mt-1 text-ink-muted">{item.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
