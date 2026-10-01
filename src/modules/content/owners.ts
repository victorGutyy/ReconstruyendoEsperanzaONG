import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { OwnerOptions } from "./types";

/**
 * Activities and projects a gallery can belong to: not in the trash and not
 * archived (the current owner stays listed so it is never dropped silently).
 */
export async function listOwnerOptions(keep: {
  activityId: string | null;
  projectId: string | null;
}): Promise<OwnerOptions> {
  const supabase = await createClient();
  const [activities, projects] = await Promise.all([
    supabase
      .from("activities")
      .select("id, title, status")
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(200),
    supabase.from("projects").select("id, title, status").is("deleted_at", null).order("title"),
  ]);
  if (activities.error) throw activities.error;
  if (projects.error) throw projects.error;
  const usable = (keepId: string | null) => (row: { id: string; status: string }) =>
    row.status !== "archived" || row.id === keepId;
  return {
    activities: activities.data
      .filter(usable(keep.activityId))
      .map((row) => ({ id: row.id, name: row.title })),
    projects: projects.data
      .filter(usable(keep.projectId))
      .map((row) => ({ id: row.id, name: row.title })),
  };
}
