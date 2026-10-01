import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { GalleryEditor } from "@/modules/galleries/components/gallery-editor";
import { listOwnerOptions } from "@/modules/galleries/queries";
import { GALLERIES_PATH } from "@/modules/galleries/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Nueva galería" };

export default async function NewGalleryPage() {
  const authorized = await authorizePage("content.create");
  if (!authorized) return <NoPermission reason="Tu rol no permite crear galerías." />;

  const owners = await listOwnerOptions({ activityId: null, projectId: null });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={GALLERIES_PATH} className="font-medium text-green-700 underline">
        Volver a galerías
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Galerías
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Nueva galería</h1>
      <p className="mt-2 text-ink-muted">Guarda el borrador para agregarle fotos.</p>
      <div className="mt-6 rounded-lg border bg-card p-5">
        <GalleryEditor initial={{ title: "", description: "", owner: "" }} owners={owners} />
      </div>
    </div>
  );
}
