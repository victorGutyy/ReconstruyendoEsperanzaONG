import Link from "next/link";

import { Photo } from "@/modules/site";

import { formatPostDate, PUBLIC_POSTS_PATH } from "../public-filters";
import type { PostCard } from "../public";

/** A story in a public list: cover, category, title, excerpt, date and signature. */
export function PublicPostCard({ post }: { post: PostCard }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-sm border bg-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2">
      {post.cover ? (
        <Photo
          photo={post.cover}
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3]"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[4/3] bg-paper-2" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        {post.category ? (
          <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
            {post.category}
          </p>
        ) : null}
        <h3 className="font-serif text-xl leading-snug font-semibold text-green-900">
          {/* The whole card opens the story; the link is the title */}
          <Link
            href={`${PUBLIC_POSTS_PATH}/${post.slug}`}
            className="outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline"
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? <p className="text-ink-muted">{post.excerpt}</p> : null}
        <p className="mt-auto pt-2 text-sm text-ink-muted">
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
          {post.byline ? ` · ${post.byline}` : ""}
        </p>
      </div>
    </article>
  );
}
