import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { listOwnerOptions } from "@/modules/content";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { VideoEditor } from "@/modules/videos/components/video-editor";
import { VIDEOS_PATH } from "@/modules/videos/schema";

export const metadata: Metadata = { title: "Nuevo video" };

export default async function NewVideoPage() {
  const authorized = await authorizePage("content.create");
  if (!authorized) return <NoPermission reason="Tu rol no permite agregar videos." />;

  const owners = await listOwnerOptions({ activityId: null, projectId: null });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={VIDEOS_PATH} className="font-medium text-green-700 underline">
        Volver a videos
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Videos</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Nuevo video</h1>
      <p className="mt-2 text-ink-muted">
        Guarda el borrador para elegir una imagen y enviarlo a revisión.
      </p>
      <div className="mt-6 rounded-lg border bg-card p-5">
        <VideoEditor initial={{ title: "", description: "", url: "", owner: "" }} owners={owners} />
      </div>
    </div>
  );
}
