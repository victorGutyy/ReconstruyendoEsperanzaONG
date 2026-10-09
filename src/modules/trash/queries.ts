import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CONTENT_TYPES } from "@/modules/content";

import { TITLE_COLUMNS, TRASH_KINDS, type TrashedItem, type TrashKind } from "./schema";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = { id: string; deleted_at: string | null; name: string | null };

export const tableFor = (kind: TrashKind) =>
  kind === "media" ? "media" : kind === "message" ? "contact_messages" : CONTENT_TYPES[kind].table;

/** The rows of one kind in the trash (or these ids, in or out of it). */
async function readRows(
  supabase: Supabase,
  kind: TrashKind,
  { ids, onlyTrash }: { ids?: string[]; onlyTrash: boolean },
): Promise<Row[]> {
  // Dynamic table and column: the generated types cannot follow them
  let query = supabase
    .from(tableFor(kind) as "posts")
    .select(`id, deleted_at, name:${TITLE_COLUMNS[kind]}`);
  if (onlyTrash) query = query.not("deleted_at", "is", null);
  if (ids) query = query.in("id", ids);
  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Row[];
}

/** Who sent each item to the trash, from the audit log (audit.read). */
async function trashedBy(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  const who = new Map<string, string>();
  if (ids.length === 0) return who;
  const [logs, profiles] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("record_id, actor_id, occurred_at")
      .eq("action", "soft_delete")
      .in("record_id", ids)
      .order("occurred_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (logs.error || profiles.error) return who;
  const names = new Map(profiles.data.map((profile) => [profile.id, profile.full_name]));
  for (const log of logs.data) {
    // Newest first: the last time it went to the trash
    if (who.has(log.record_id) || !log.actor_id) continue;
    const name = names.get(log.actor_id);
    if (name) who.set(log.record_id, name);
  }
  return who;
}

/**
 * Everything in the trash, most recently trashed first. Call after
 * authorizePage('trash.restore'): the Administrator reads every table.
 */
export async function listTrash(filter: TrashKind | null): Promise<TrashedItem[]> {
  const supabase = await createClient();
  const kinds = filter ? [filter] : TRASH_KINDS;
  const groups = await Promise.all(
    kinds.map(async (kind) =>
      (await readRows(supabase, kind, { onlyTrash: true })).map((row) => ({ kind, row })),
    ),
  );
  const rows = groups.flat();
  const who = await trashedBy(
    supabase,
    rows.map(({ row }) => row.id),
  );
  return rows
    .map(({ kind, row }) => ({
      kind,
      id: row.id,
      name: row.name?.trim() || (kind === "media" ? "Foto sin descripción" : "Sin título"),
      trashedAt: row.deleted_at!,
      trashedBy: who.get(row.id) ?? null,
    }))
    .sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

export type PhotoUse = { kind: TrashKind; name: string; inTrash: boolean };

/** Where a photo is still used, also by content in the trash. */
export async function photoUses(supabase: Supabase, mediaId: string): Promise<PhotoUse[]> {
  const { data, error } = await supabase
    .from("content_media_usages")
    .select("entity_type, entity_id")
    .eq("media_id", mediaId);
  if (error) throw error;

  const byKind = new Map<TrashKind, Set<string>>();
  for (const usage of data) {
    const kind = usage.entity_type as TrashKind;
    if (!usage.entity_id || !TRASH_KINDS.includes(kind)) continue;
    byKind.set(kind, (byKind.get(kind) ?? new Set()).add(usage.entity_id));
  }
  const groups = await Promise.all(
    [...byKind].map(async ([kind, ids]) =>
      (await readRows(supabase, kind, { ids: [...ids], onlyTrash: false })).map((row) => ({
        kind,
        name: row.name?.trim() || "Sin título",
        inTrash: row.deleted_at !== null,
      })),
    ),
  );
  return groups.flat();
}
