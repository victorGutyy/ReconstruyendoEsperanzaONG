import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { CategoryScope, PlaceKind } from "./schema";

export type Place = {
  id: string;
  name: string;
  slug: string;
  kind: PlaceKind;
  isActive: boolean;
};

export type Category = {
  id: string;
  scope: CategoryScope;
  name: string;
  slug: string;
  description: string | null;
  position: number;
};

export type Taxonomy = {
  places: Place[];
  categories: Record<CategoryScope, Category[]>;
};

/** Places and categories that are not in the trash, read through RLS. */
export async function listTaxonomy(): Promise<Taxonomy> {
  const supabase = await createClient();
  const [places, categories] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, slug, kind, is_active")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("categories")
      .select("id, scope, name, slug, description, position")
      .is("deleted_at", null)
      .order("position")
      .order("name"),
  ]);

  if (places.error) throw places.error;
  if (categories.error) throw categories.error;

  const byScope: Record<CategoryScope, Category[]> = { activity: [], post: [] };
  for (const row of categories.data) {
    const scope = row.scope as CategoryScope;
    byScope[scope]?.push({ ...row, scope });
  }

  return {
    places: places.data.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: row.kind as PlaceKind,
      isActive: row.is_active,
    })),
    categories: byScope,
  };
}
