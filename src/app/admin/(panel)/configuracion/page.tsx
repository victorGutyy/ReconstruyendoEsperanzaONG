import type { Metadata } from "next";

import { authorizePage } from "@/lib/auth/guard";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { getSiteSettings } from "@/modules/settings";
import { SettingsForm } from "@/modules/settings/client";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const authorized = await authorizePage("settings.manage");
  if (!authorized) {
    return <NoPermission reason="Solo el Administrador cambia la configuración del sitio." />;
  }

  // Same reading as the public site: what is saved is what visitors see
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Configuración</h1>
      <p className="mt-2 text-ink-muted">
        Datos de contacto, redes y descripción del sitio público. Los cambios se ven en el sitio al
        guardar.
      </p>
      <div className="mt-8 rounded-lg border bg-card p-5">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
