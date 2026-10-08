import type { Metadata } from "next";

import { Breadcrumbs } from "@/modules/site";
import { PublicVideoCard } from "@/modules/videos/components/public-video-card";
import { listPublicVideos } from "@/modules/videos/public";

// One cached page, refreshed when a video is published or retired
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Videos",
  description: "Videos de las actividades y proyectos de la organización.",
  alternates: { canonical: "/videos" },
};

export default async function VideosPage() {
  const videos = await listPublicVideos();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Videos" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">Videos</h1>
      <p className="mt-2 text-ink-muted">
        Los videos se cargan desde YouTube, Vimeo o TikTok solo cuando tocas «Reproducir».
      </p>

      {videos.length === 0 ? (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          Pronto publicaremos los videos de la organización.
        </p>
      ) : (
        <ul aria-label="Videos" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <li key={video.id}>
              <PublicVideoCard video={video} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
