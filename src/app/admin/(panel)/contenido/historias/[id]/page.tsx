import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import {
  ContentReview,
  CoverField,
  displayStatus,
  ReviewNote,
  STATUS_LABELS,
  StatusActions,
  TagsField,
} from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TrashContentButton } from "@/modules/trash/client";
import { PostEditor } from "@/modules/posts/components/post-editor";
import { publishPost, setPostCover, setPostTag, submitPost } from "@/modules/posts/actions";
import { getContentCover } from "@/modules/content";
import { getPost, listPostCategories, listPostTags } from "@/modules/posts/queries";
import { POSTS_PATH, reviewPost } from "@/modules/posts/schema";

export const metadata: Metadata = { title: "Editar historia" };

export default async function EditPostPage({
  params,
}: PageProps<"/admin/contenido/historias/[id]">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const post = await getPost(id);
  if (!post) notFound();

  const { profile, user } = authorized;
  const canTrash = hasPermission(profile, "content.delete");
  const publisher = hasPermission(profile, "content.publish");
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !post.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        post.createdBy === user.id &&
        (post.status === "draft" || post.status === "review")));

  const [categories, tags, cover] = await Promise.all([
    listPostCategories(),
    listPostTags(),
    getContentCover(post.coverMediaId),
  ]);
  const review = reviewPost(
    { excerpt: post.excerpt, categoryId: post.categoryId, coverIssues: cover?.issues ?? null },
    publisher,
  );
  const coverWithdrawn = post.status === "published" && (cover?.issues.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={POSTS_PATH} className="font-medium text-green-700 underline">
        Volver a historias
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Historia · {STATUS_LABELS[displayStatus(post.status, post.publishedAt)]}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{post.title}</h1>

      {(publisher || canTrash) && !post.inTrash ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {publisher ? <StatusActions type="post" id={post.id} status={post.status} /> : null}
          {canTrash ? (
            <TrashContentButton type="post" id={post.id} published={post.status === "published"} />
          ) : null}
        </div>
      ) : null}

      {post.reviewNote && post.status === "draft" ? <ReviewNote note={post.reviewNote} /> : null}

      {coverWithdrawn ? (
        <section
          aria-labelledby="withdrawn-title"
          className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
        >
          <h2 id="withdrawn-title" className="font-semibold text-green-900">
            Portada retirada del sitio
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            La historia sigue publicada sin portada. Vuelve sola al sitio cuando se resuelve lo que
            falta.
          </p>
          <Link
            href={`/admin/medios/${post.coverMediaId}`}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-green-700 underline"
          >
            Resolver la portada
          </Link>
        </section>
      ) : null}

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {post.inTrash
            ? "Esta historia está en la papelera."
            : "No puedes editar esta historia: ya fue publicada o la escribió otra persona. Un Editor o Administrador puede hacerlo."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <PostEditor
              postId={post.id}
              serverUpdatedAt={post.updatedAt}
              initial={{
                title: post.title,
                excerpt: post.excerpt ?? "",
                categoryId: post.categoryId ?? "",
                byline: post.byline ?? "",
                body: post.body,
              }}
              categories={categories}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <TagsField tags={tags} selected={post.tagIds} save={setPostTag.bind(null, post.id)} />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <CoverField contentId={post.id} cover={cover} setCover={setPostCover} />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="post"
              contentId={post.id}
              items={review.items}
              publisher={publisher}
              status={post.status}
              submit={submitPost}
              publish={publishPost}
            />
          </div>
        </div>
      )}
    </div>
  );
}
