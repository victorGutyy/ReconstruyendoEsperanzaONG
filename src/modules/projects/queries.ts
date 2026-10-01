import "server-only";

import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/utils/like";
import type { ContentStatus } from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { type ProjectFilters, PROJECTS_PAGE_SIZE } from "./list";
import type { ProjectStage } from "./schema";

export type ProjectSummary = {
  id: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  isMine: boolean;
  stage: ProjectStage;
  /** Published with a cover that is no longer publishable (step 7.5b). */
  coverWithdrawn: boolean;
};

/** One page of the panel list, newest changes first. */
export async function listProjects(
  filters: ProjectFilters,
  userId: string,
): Promise<{ items: ProjectSummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("projects")
    .select(
      "id, title, status, published_at, updated_at, created_by, cover_media_id, project_status",
      { count: "exact" },
    )
    .is("deleted_at", null);
  if (filters.status === "scheduled") {
    query = query.eq("status", "published").gt("published_at", now);
  } else if (filters.status === "published") {
    query = query.eq("status", "published").lte("published_at", now);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.stage) query = query.eq("project_status", filters.stage);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);
  if (filters.mine) query = query.eq("created_by", userId);

  const offset = (filters.page - 1) * PROJECTS_PAGE_SIZE;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + PROJECTS_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;

  const rows = error ? [] : data;
  const covers = rows
    .filter((row) => row.status === "published" && row.cover_media_id)
    .map((row) => row.cover_media_id!);
  const issues = await getPublishIssues(covers);
  const total = count ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      isMine: row.created_by === userId,
      stage: row.project_status as ProjectStage,
      coverWithdrawn:
        row.status === "published" &&
        row.cover_media_id !== null &&
        (issues.get(row.cover_media_id) ?? []).length > 0,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE)),
  };
}

/** Counts for the dashboard and the "Por revisar" tab. */
export async function countProjects(userId: string) {
  const supabase = await createClient();
  const live = () =>
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null);
  const results = await Promise.all([
    live().eq("status", "review"),
    live().eq("status", "draft").eq("created_by", userId),
  ]);
  const [toReview, myDrafts] = results.map(({ count, error }) => {
    if (error) throw error;
    return count ?? 0;
  });
  return { toReview: toReview!, myDrafts: myDrafts! };
}

export type ProjectForEditor = {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  title: string;
  summary: string | null;
  objective: string | null;
  stage: ProjectStage;
  startDate: string | null;
  endDate: string | null;
  body: unknown;
  coverMediaId: string | null;
  createdBy: string | null;
  updatedAt: string;
  inTrash: boolean;
  reviewNote: { text: string; at: string | null } | null;
};

/** One project, or null when RLS hides it. */
export async function getProject(id: string): Promise<ProjectForEditor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, status, published_at, title, summary, objective, project_status, start_date, end_date, body, cover_media_id, created_by, updated_at, deleted_at, review_note, review_note_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    publishedAt: data.published_at,
    title: data.title,
    summary: data.summary,
    objective: data.objective,
    stage: data.project_status as ProjectStage,
    startDate: data.start_date,
    endDate: data.end_date,
    body: data.body,
    coverMediaId: data.cover_media_id,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    inTrash: data.deleted_at !== null,
    reviewNote: data.review_note ? { text: data.review_note, at: data.review_note_at } : null,
  };
}

export type ProjectActivity = {
  id: string;
  title: string;
  status: ContentStatus;
  publishedAt: string | null;
  startsAt: string;
};

/** The activities that belong to the project (read only in the panel). */
export async function listProjectActivities(projectId: string): Promise<ProjectActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, title, status, published_at, starts_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    publishedAt: row.published_at,
    startsAt: row.starts_at,
  }));
}

export type ProjectOption = { id: string; name: string };

/**
 * Projects an activity can belong to: not in the trash and not archived. It
 * may still be a draft (decision 7.6b). `keep` stays listed even if archived,
 * so editing an activity never drops its current project silently.
 */
export async function listProjectOptions(keep?: string | null): Promise<ProjectOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, status")
    .is("deleted_at", null)
    .order("title");
  if (error) throw error;
  return data
    .filter((row) => row.status !== "archived" || row.id === keep)
    .map((row) => ({ id: row.id, name: row.title }));
}
