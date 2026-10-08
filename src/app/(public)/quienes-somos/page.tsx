import type { Metadata } from "next";

import { PublicPageBody } from "@/modules/pages/components/public-page";
import { getPublicPage } from "@/modules/pages/public";
import { PAGE_ADDRESSES } from "@/modules/pages/schema";
import { Breadcrumbs, Photo } from "@/modules/site";
import { listPublicTeam } from "@/modules/team/public";
import { listPublicTestimonials } from "@/modules/testimonials/public";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicPage("about");
  return {
    title: page?.seoTitle ?? "Quiénes somos",
    description: page?.seoDescription ?? undefined,
    alternates: { canonical: PAGE_ADDRESSES.about },
  };
}

const sectionTitle =
  "border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900";

export default async function AboutPage() {
  const [page, team, testimonials] = await Promise.all([
    getPublicPage("about"),
    listPublicTeam(),
    listPublicTestimonials(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Quiénes somos" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        {page?.title ?? "Quiénes somos"}
      </h1>
      <div className="max-w-3xl">
        <PublicPageBody page={page} />
      </div>

      {team.length > 0 ? (
        <section aria-labelledby="team-title" className="mt-12">
          <h2 id="team-title" className={sectionTitle}>
            Equipo
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <li key={member.id} className="overflow-hidden rounded-sm border bg-card">
                {member.photo ? (
                  <Photo
                    photo={member.photo}
                    sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                    className="aspect-square"
                  />
                ) : null}
                <div className="p-4">
                  <h3 className="font-serif text-xl font-semibold text-green-900">{member.name}</h3>
                  <p className="text-sm font-semibold text-gold-700">{member.role}</p>
                  {member.bio ? (
                    <p className="mt-2 whitespace-pre-line text-ink-muted">{member.bio}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {testimonials.length > 0 ? (
        <section aria-labelledby="testimonials-title" className="mt-12">
          <h2 id="testimonials-title" className={sectionTitle}>
            Testimonios
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id}>
                <figure className="flex h-full gap-4 rounded-sm border bg-paper-2 p-5">
                  {testimonial.photo ? (
                    <Photo
                      photo={testimonial.photo}
                      sizes="5rem"
                      className="size-20 shrink-0 rounded-full"
                    />
                  ) : null}
                  <div>
                    <blockquote className="font-serif text-lg text-ink italic">
                      «{testimonial.quote}»
                    </blockquote>
                    <figcaption className="mt-3 text-sm">
                      <span className="font-semibold text-green-900">{testimonial.author}</span>
                      {testimonial.context ? (
                        <span className="text-ink-muted"> · {testimonial.context}</span>
                      ) : null}
                    </figcaption>
                  </div>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
