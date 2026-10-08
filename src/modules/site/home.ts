// The home page's editorial blocks (step 8.5, docs/07 §6.1–6.2). Pure, tested
// in home.test.ts: which item leads and what each block gets.

type WithCover = { id: string; cover: unknown };

export type Featured<P, A> = { kind: "post"; item: P } | { kind: "activity"; item: A } | null;

/**
 * The lead of the home page: the newest story with a cover; without one, the
 * newest past activity (with a cover if any). No "feature" switch is needed
 * (decision 8.5); the lists come already newest first.
 */
export function pickFeatured<P extends WithCover, A extends WithCover>(
  posts: P[],
  pastActivities: A[],
): Featured<P, A> {
  const post = posts.find((item) => item.cover);
  if (post) return { kind: "post", item: post };
  const activity = pastActivities.find((item) => item.cover) ?? pastActivities[0];
  return activity ? { kind: "activity", item: activity } : null;
}

/** The first `count` items that are not the featured one. */
export function without<T extends { id: string }>(
  items: T[],
  featuredId: string | null,
  count: number,
) {
  return items.filter((item) => item.id !== featuredId).slice(0, count);
}
