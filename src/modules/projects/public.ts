import "server-only";

import { unstable_cache } from "next/cache";

import type { RichTextDoc } from "@/lib/rich-text/schema";
import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

import { PUBLIC_STAGE_ORDER } from "./public-format";
import type { ProjectStage } from "./schema";

// What visitors see of projects (step 8.3b). Read as an anonymous visitor: the
// RLS returns only published projects and public photos. Cached 5 minutes;
// revalidatePublicSite() clears it at once.

const cached = <Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
) => unstable_cache(fn, ["public-projects", name], { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 });

const CARD_COLUMNS =
  "id, slug, title, summary, project_status, start_date, end_date, published_at, cover:media!projects_cover_media_id_fkey(public_key, width, height, alt_text)";

type CardRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  project_status: ProjectStage;
  start_date: string | null;
  end_date: string | null;
  published_at: string;
  cover: PublicMediaRow | null;
};

export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  stage: ProjectStage;
  startDate: string | null;
  endDate: string | null;
  cover: PublicPhoto | null;
};

const toCard = (row: CardRow): ProjectCard => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  stage: row.project_status,
  startDate: row.start_date,
  endDate: row.end_date,
  cover: toPublicPhoto(row.cover),
});

export type ProjectGroup = { stage: ProjectStage; projects: ProjectCard[] };

/** Every published project, grouped by stage (in progress first); no paging. */
export const listPublicProjects = cached("listing", async (): Promise<ProjectGroup[]> => {
  const { data, error } = await createPublicClient()
    .from("projects")
    .select(CARD_COLUMNS)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("title");
  if (error) throw error;
  const cards = (data as unknown as CardRow[]).map(toCard);
  return PUBLIC_STAGE_ORDER.map((stage) => ({
    stage,
    projects: cards.filter((card) => card.stage === stage),
  })).filter((group) => group.projects.length > 0);
});

export type ProjectActivity = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  category: string | null;
  cover: PublicPhoto | null;
};

export type PublicProject = ProjectCard & {
  objective: string | null;
  body: RichTextDoc | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string;
  activities: ProjectActivity[];
};

/** One published project by its address with its published activities, or null. */
export const getPublicProject = cached(
  "detail",
  async (slug: string): Promise<PublicProject | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select(`${CARD_COLUMNS}, objective, body, seo_title, seo_description`)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as CardRow & {
      objective: string | null;
      body: RichTextDoc | null;
      seo_title: string | null;
      seo_description: string | null;
    };

    // Only the published ones: the RLS hides drafts of the visitor
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select(
        "id, slug, title, summary, starts_at, ends_at, place:places(name), category:categories(name), cover:media!activities_cover_media_id_fkey(public_key, width, height, alt_text)",
      )
      .eq("project_id", row.id)
      .order("starts_at", { ascending: false });
    if (activitiesError) throw activitiesError;

    type ActivityRow = {
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      starts_at: string;
      ends_at: string | null;
      place: { name: string } | null;
      category: { name: string } | null;
      cover: PublicMediaRow | null;
    };

    return {
      ...toCard(row),
      objective: row.objective,
      body: row.body,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      publishedAt: row.published_at,
      activities: (activities as unknown as ActivityRow[]).map((activity) => ({
        id: activity.id,
        slug: activity.slug,
        title: activity.title,
        summary: activity.summary,
        startsAt: activity.starts_at,
        endsAt: activity.ends_at,
        place: activity.place?.name ?? null,
        category: activity.category?.name ?? null,
        cover: toPublicPhoto(activity.cover),
      })),
    };
  },
);
