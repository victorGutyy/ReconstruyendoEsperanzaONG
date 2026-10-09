import "server-only";

import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createPublicClient } from "@/lib/supabase/public";
import { getClientIp } from "@/lib/utils/request";

import { SEARCH_PAGE_SIZE } from "./schema";

// Public search (step 8.6): never cached (it depends on what is typed), so
// each visitor gets 30 searches a minute (docs/05 §7).

export type SearchKind = "activity" | "post" | "project";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  eventAt: string;
};

export type SearchResult =
  | { ok: true; hits: SearchHit[]; total: number; pageCount: number }
  | { ok: false; reason: "limited" };

export async function searchContent(query: string, page: number): Promise<SearchResult> {
  const ip = await getClientIp();
  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.publicSearch,
    rateLimitKey("search", ip),
  );
  if (!attempt.success) return { ok: false, reason: "limited" };

  const { data, error } = await createPublicClient().rpc("search_content", {
    p_query: query,
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: (page - 1) * SEARCH_PAGE_SIZE,
  });
  if (error) throw error;
  const total = Number(data[0]?.total ?? 0);
  return {
    ok: true,
    hits: data.map((row) => ({
      kind: row.entity_type as SearchKind,
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      eventAt: row.event_at,
    })),
    total,
    pageCount: Math.ceil(total / SEARCH_PAGE_SIZE),
  };
}
