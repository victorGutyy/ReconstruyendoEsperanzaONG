import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/rich-text/rich-text";
import { absoluteUrl } from "@/lib/site/url";
import { PublicPostCard } from "@/modules/posts/components/public-post-card";
import { getPublicPost, listRelatedPosts } from "@/modules/posts/public";
import { formatPostDate, PUBLIC_POSTS_PATH, publicPostsHref } from "@/modules/posts/public-filters";
import { getSiteSettings, isPending } from "@/modules/settings";
import { Breadcrumbs, Photo, ShareButtons } from "@/modules/site";

// Built on the first visit and cached; publishing or retiring refreshes it
export const revalidate = 300;

/** None at build time (it has no database): each page is built when first visited. */
export async function generateStaticParams() {
  return [];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function load(slug: string) {
  return SLUG.test(slug) && slug.length <= 120 ? getPublicPost(slug) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/historias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) return { title: "Historia no encontrada" };

  const settings = await getSiteSettings();
  const fallback = isPending(settings.seoDescription) ? undefined : settings.seoDescription;
  const description = post.seoDescription ?? post.excerpt ?? fallback ?? undefined;
  const url = absoluteUrl(`${PUBLIC_POSTS_PATH}/${post.slug}`);
  const cover = post.cover;
  const ogWidth = cover ? Math.min(cover.width, 1920) : 0;

  return {
    title: post.seoTitle ?? post.title,
    description,
    alternates: { canonical: url },
    // What WhatsApp and the networks show when the link is shared (HU-02)
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description,
      siteName: settings.organizationName,
      locale: "es_CO",
      publishedTime: post.publishedAt,
      images: cover
        ? [
            {
              url: cover.large,
              width: ogWidth,
              height: Math.round((ogWidth / cover.width) * cover.height),
              alt: cover.alt,
            },
          ]
        : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary" },
  };
}

export default async function PostPage({ params }: PageProps<"/historias/[slug]">) {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) notFound();

  const related = await listRelatedPosts(post.id, post.categoryId);
  const url = absoluteUrl(`${PUBLIC_POSTS_PATH}/${post.slug}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Inicio" },
          { href: PUBLIC_POSTS_PATH, label: "Historias" },
          { label: post.title },
        ]}
      />

      <article className="mt-4">
        {post.category && post.categorySlug ? (
          <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
            <Link
              href={publicPostsHref({ category: null, page: 1 }, { category: post.categorySlug })}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {post.category}
            </Link>
          </p>
        ) : null}
        <h1 className="font-serif text-4xl leading-tight font-semibold text-green-900 md:text-5xl">
          {post.title}
        </h1>
        {post.excerpt ? <p className="mt-4 text-lg text-ink-muted">{post.excerpt}</p> : null}
        <p className="mt-4 border-b pb-4 text-sm text-ink-muted">
          {post.byline ? (
            <>
              Por <span className="font-semibold text-ink">{post.byline}</span> ·{" "}
            </>
          ) : null}
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
        </p>

        {post.cover ? (
          <figure className="mt-6">
            <Photo
              photo={post.cover}
              sizes="(min-width: 768px) 48rem, 100vw"
              priority
              className="max-h-[32rem] rounded-sm"
            />
          </figure>
        ) : null}

        {post.body ? <RichText doc={post.body} className="mt-8" /> : null}

        {post.tags.length > 0 ? (
          <section aria-labelledby="tags-title" className="mt-10">
            <h2 id="tags-title" className="text-sm font-semibold text-green-900">
              Etiquetas
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded-sm bg-paper-2 px-2 py-1 text-sm">
                  {tag}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-8 border-t pt-6">
          <ShareButtons url={url} title={post.title} />
        </div>
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="mt-12">
          <h2
            id="related-title"
            className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
          >
            Relacionadas
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {related.map((item) => (
              <li key={item.id}>
                <PublicPostCard post={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
