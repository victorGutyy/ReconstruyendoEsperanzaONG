import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_TAG } from "@/lib/site/revalidate";
import { createPublicClient } from "@/lib/supabase/public";
import { type PublicMediaRow, type PublicPhoto, toPublicPhoto } from "@/modules/media";

// The team as visitors see it (step 8.5): only published profiles whose
// authorization is still valid (the RLS checks it), in the panel's order.

export type PublicTeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  photo: PublicPhoto | null;
};

export const listPublicTeam = unstable_cache(
  async (): Promise<PublicTeamMember[]> => {
    const { data, error } = await createPublicClient()
      .from("team_members")
      .select(
        "id, full_name, role_title, bio, photo:media!team_members_cover_media_id_fkey(public_key, width, height, alt_text)",
      )
      .order("position")
      .order("full_name");
    if (error) throw error;
    type Row = {
      id: string;
      full_name: string;
      role_title: string;
      bio: string | null;
      photo: PublicMediaRow | null;
    };
    return (data as unknown as Row[]).map((row) => ({
      id: row.id,
      name: row.full_name,
      role: row.role_title,
      bio: row.bio,
      photo: toPublicPhoto(row.photo),
    }));
  },
  ["public-team", "list"],
  { tags: [PUBLIC_CONTENT_TAG], revalidate: 300 },
);
