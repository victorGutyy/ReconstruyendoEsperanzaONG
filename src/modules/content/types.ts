// Results shared by the content editors (pure types, usable on both sides).

export type SaveResult = { ok: true; id: string; savedAt: string } | { ok: false; error: string };

export type PublishResult =
  { ok: true; outcome: "review" | "published" | "scheduled" } | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Activities and projects a gallery or a video can belong to. */
export type OwnerOptions = {
  activities: { id: string; name: string }[];
  projects: { id: string; name: string }[];
};
