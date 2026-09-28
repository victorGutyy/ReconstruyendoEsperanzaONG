import type { Metadata } from "next";

import { authorizePage } from "@/lib/auth/guard";
import { MediaUploader } from "@/modules/media/components/media-uploader";
import { RecentUploads } from "@/modules/media/components/recent-uploads";
import { listMyRecentUploads } from "@/modules/media/queries";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Medios" };

export default async function MediaPage() {
  const authorized = await authorizePage("media.upload");

  if (!authorized) {
    return <NoPermission reason="Tu rol no permite subir fotos." />;
  }

  const uploads = await listMyRecentUploads(authorized.user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Medios</h1>
      <p className="mt-2 text-ink-muted">
        Las fotos se guardan en privado. Solo se vuelven públicas al publicar un contenido que las
        use y que tenga las autorizaciones necesarias.
      </p>

      <section aria-labelledby="upload-title" className="mt-8">
        <h2 id="upload-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Subir fotos
        </h2>
        <MediaUploader />
      </section>

      <section aria-labelledby="recent-title" className="mt-10">
        <h2 id="recent-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Mis fotos recientes
        </h2>
        <RecentUploads uploads={uploads} />
      </section>
    </div>
  );
}
