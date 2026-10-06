import Link from "next/link";

import { Photo } from "@/modules/site";

import { formatActivityDate, PUBLIC_ACTIVITIES_PATH } from "../public-filters";
import type { ActivityCard } from "../public";

/** An activity in a public list: cover, category, title, date and place. */
export function PublicActivityCard({
  activity,
  headingLevel = "h3",
}: {
  activity: ActivityCard;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-sm border bg-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2">
      {activity.cover ? (
        <Photo
          photo={activity.cover}
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3]"
        />
      ) : (
        <div aria-hidden="true" className="aspect-[4/3] bg-paper-2" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        {activity.category ? (
          <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
            {activity.category}
          </p>
        ) : null}
        <Heading className="font-serif text-xl leading-snug font-semibold text-green-900">
          {/* The whole card opens the activity; the link is the title */}
          <Link
            href={`${PUBLIC_ACTIVITIES_PATH}/${activity.slug}`}
            className="outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline"
          >
            {activity.title}
          </Link>
        </Heading>
        <p className="mt-auto pt-2 text-sm text-ink-muted">
          <time dateTime={activity.startsAt}>
            {formatActivityDate(activity.startsAt, activity.endsAt)}
          </time>
          {activity.place ? ` · ${activity.place}` : ""}
        </p>
      </div>
    </article>
  );
}
