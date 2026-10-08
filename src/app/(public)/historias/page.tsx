import type { Metadata } from "next";
import Link from "next/link";

import { FilterLink } from "@/components/ui/filter-link";
import { PublicPostCard } from "@/modules/posts/components/public-post-card";
import { getPostCategories, listPublicPosts } from "@/modules/posts/public";
import {
  parsePostFilters,
  PUBLIC_POSTS_PATH,
  publicPostsHref,
} from "@/modules/posts/public-filters";
import { Breadcrumbs, Pagination } from "@/modules/site";

export const metadata: Metadata = {
  title: "Historias",
  description: "Historias de la comunidad y de la organización en Calarcá.",
  alternates: { canonical: PUBLIC_POSTS_PATH },
};

export default async function PostsPage({ searchParams }: PageProps<"/historias">) {
  const filters = parsePostFilters(await searchParams);
  const [categories, listing] = await Promise.all([getPostCategories(), listPublicPosts(filters)]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Historias" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        Historias
      </h1>

      {categories.length > 1 ? (
        <nav aria-label="Categorías de historias" className="mt-6 flex flex-wrap gap-2">
          <FilterLink href={PUBLIC_POSTS_PATH} active={filters.category === null}>
            Todas
          </FilterLink>
          {categories.map((category) => (
            <FilterLink
              key={category.slug}
              href={publicPostsHref(filters, { category: category.slug })}
              active={filters.category === category.slug}
            >
              {category.name}
            </FilterLink>
          ))}
        </nav>
      ) : null}

      {listing.posts.length === 0 ? (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          {filters.category || filters.page > 1 ? (
            <>
              No hay historias aquí.{" "}
              <Link href={PUBLIC_POSTS_PATH} className="font-medium text-green-700 underline">
                Ver todas las historias
              </Link>
            </>
          ) : (
            "Pronto publicaremos las historias de la comunidad."
          )}
        </p>
      ) : (
        <ul aria-label="Historias" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listing.posts.map((post) => (
            <li key={post.id}>
              <PublicPostCard post={post} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        label="Páginas de historias"
        current={filters.page}
        pageCount={listing.pageCount}
        hrefFor={(page) => publicPostsHref(filters, { page })}
      />
    </div>
  );
}
