import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { PostEditor } from "@/modules/posts/components/post-editor";
import { listPostCategories } from "@/modules/posts/queries";
import { POSTS_PATH } from "@/modules/posts/schema";

export const metadata: Metadata = { title: "Nueva historia" };

export default async function NewPostPage() {
  const authorized = await authorizePage("content.create");
  if (!authorized) return <NoPermission reason="Tu rol no permite crear historias." />;

  const categories = await listPostCategories();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={POSTS_PATH} className="font-medium text-green-700 underline">
        Volver a historias
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Historias
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Nueva historia</h1>
      <p className="mt-2 text-ink-muted">
        Guarda el borrador para elegir la portada y enviarla a revisión.
      </p>
      <div className="mt-6 rounded-lg border bg-card p-5">
        <PostEditor
          initial={{ title: "", excerpt: "", categoryId: "", byline: "", body: null }}
          categories={categories}
        />
      </div>
    </div>
  );
}
