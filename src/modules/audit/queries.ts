import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { AuditEntry, AuditLookups } from "./format";
import { type AuditFilters, dateRangeBounds, PAGE_SIZE, SYSTEM_ACTOR } from "./schema";

export type AuditPage = {
  entries: AuditEntry[];
  total: number;
  pageCount: number;
  lookups: AuditLookups;
  /** People for the "Persona" filter, sorted by name. */
  people: { id: string; name: string }[];
};

// PostgREST answers "range not satisfiable" for a page past the end
const RANGE_NOT_SATISFIABLE = "PGRST103";

const asObject = (value: unknown) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * One page of the audit log, newest first, read through RLS (audit.read + MFA).
 * Call after authorizePage('audit.read').
 */
export async function listAuditEntries(filters: AuditFilters): Promise<AuditPage> {
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select(
      "id, occurred_at, actor_id, action, table_name, record_id, old_data, new_data, changed_fields",
      { count: "exact" },
    );

  if (filters.actor === SYSTEM_ACTOR) query = query.is("actor_id", null);
  else if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.section) query = query.eq("table_name", filters.section);

  const { gte, lt } = dateRangeBounds(filters);
  if (gte) query = query.gte("occurred_at", gte);
  if (lt) query = query.lt("occurred_at", lt);

  const offset = (filters.page - 1) * PAGE_SIZE;
  const [logs, profiles, roles] = await Promise.all([
    query
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    // Names: RLS returns every profile to user managers, only their own to others
    supabase.from("profiles").select("id, full_name"),
    supabase.from("roles").select("id, name"),
  ]);

  if (logs.error && logs.error.code !== RANGE_NOT_SATISFIABLE) throw logs.error;
  if (profiles.error) throw profiles.error;
  if (roles.error) throw roles.error;

  const total = logs.count ?? 0;
  const entries: AuditEntry[] = (logs.error ? [] : logs.data).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorId: row.actor_id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    oldData: asObject(row.old_data),
    newData: asObject(row.new_data),
    changedFields: row.changed_fields,
  }));

  const people = profiles.data
    .map((profile) => ({ id: profile.id, name: profile.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    entries,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    lookups: {
      people: new Map(people.map((person) => [person.id, person.name])),
      roles: new Map(roles.data.map((role) => [role.id, role.name])),
    },
    people,
  };
}
