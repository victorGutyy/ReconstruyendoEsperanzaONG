import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAuthError } from "@/lib/auth/errors";
import { ADMIN_HOME, hasPermission, LOGIN_PATH, MFA_PATH } from "@/lib/auth/rules";
import { getCurrentProfile, requireAal2 } from "@/lib/auth/session";
import { activitiesHref, parseActivityFilters } from "@/modules/activities/list";
import { countActivities, findActivitiesWithWithdrawnPhotos } from "@/modules/activities/queries";
import { countPendingPhotos } from "@/modules/media";
import { parsePostFilters, postsHref } from "@/modules/posts/list";
import { countPosts } from "@/modules/posts/queries";
import { parseProjectFilters, projectsHref } from "@/modules/projects/list";
import { countProjects } from "@/modules/projects/queries";
import { galleriesHref, parseGalleryFilters } from "@/modules/galleries/list";
import { countGalleries } from "@/modules/galleries/queries";
import { parseVideoFilters, videosHref } from "@/modules/videos/list";
import { countVideos } from "@/modules/videos/queries";
import { parseTestimonialFilters, testimonialsHref } from "@/modules/testimonials/list";
import { countTestimonials } from "@/modules/testimonials/queries";
import { countTeam } from "@/modules/team/queries";
import { TEAM_PATH } from "@/modules/team/schema";
import { navFor } from "@/modules/panel/navigation";

type Pending = { href: string; count: number; label: string };

const noFilters = parseActivityFilters({});
const noPostFilters = parsePostFilters({});
const noProjectFilters = parseProjectFilters({});
const noGalleryFilters = parseGalleryFilters({});
const noVideoFilters = parseVideoFilters({});
const noTestimonialFilters = parseTestimonialFilters({});

export const metadata: Metadata = { title: "Inicio" };

export default async function AdminHomePage() {
  let userId: string;
  try {
    userId = (await requireAal2()).id;
  } catch (error) {
    if (isAuthError(error)) redirect(error.code === "MFA_REQUIRED" ? MFA_PATH : LOGIN_PATH);
    throw error;
  }

  const profile = await getCurrentProfile();
  const sections = navFor(profile).filter((item) => item.href !== ADMIN_HOME);
  const pending = await pendingFor(profile, userId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">
        Hola, {profile?.fullName ?? "equipo"}
      </h1>

      {pending ? (
        <section aria-labelledby="pending-title" className="mt-8">
          <h2 id="pending-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
            Pendientes
          </h2>
          {pending.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-3">
              {pending.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex h-full items-baseline gap-2 rounded-lg border border-gold-500 bg-card p-4 outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-serif text-2xl font-semibold text-green-900">
                      {item.count}
                    </span>{" "}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border bg-card p-5 text-ink-muted">
              Todo al día: no tienes pendientes.
            </p>
          )}
        </section>
      ) : null}

      {sections.length > 0 ? (
        <section aria-labelledby="sections-title" className="mt-10">
          <h2 id="sections-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
            Secciones
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {sections.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col rounded-lg border bg-card p-5 outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between font-serif text-lg font-semibold text-green-900">
                    {item.label}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-5 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                  <span className="mt-1 text-ink-muted">{item.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * What is waiting for this person, by permission. Null when the role has no
 * content sections; zero counts are left out.
 */
async function pendingFor(
  profile: Awaited<ReturnType<typeof getCurrentProfile>>,
  userId: string,
): Promise<Pending[] | null> {
  const canRead = hasPermission(profile, "content.read");
  const canUpload = hasPermission(profile, "media.upload");
  if (!canRead && !canUpload) return null;

  const canPublish = hasPermission(profile, "content.publish");
  const canManageConsents = hasPermission(profile, "consent.manage");
  const [activities, posts, projects, galleries, videos, testimonials, team, photos, withdrawn] =
    await Promise.all([
      canRead ? countActivities(userId) : null,
      canRead ? countPosts(userId) : null,
      canRead ? countProjects(userId) : null,
      canRead ? countGalleries(userId) : null,
      canRead ? countVideos(userId) : null,
      canRead && canManageConsents ? countTestimonials(userId) : null,
      canRead && canManageConsents ? countTeam(userId) : null,
      canUpload ? countPendingPhotos() : 0,
      canPublish ? findActivitiesWithWithdrawnPhotos().then((ids) => ids.size) : 0,
    ]);

  const items: Pending[] = [];
  if (withdrawn > 0) {
    items.push({
      href: activitiesHref(noFilters, { withdrawn: true }),
      count: withdrawn,
      label: withdrawn === 1 ? "actividad con fotos retiradas" : "actividades con fotos retiradas",
    });
  }
  if (activities && canPublish) {
    items.push({
      href: activitiesHref(noFilters, { status: "review" }),
      count: activities.toReview,
      label: activities.toReview === 1 ? "actividad por revisar" : "actividades por revisar",
    });
  } else if (activities) {
    items.push({
      href: activitiesHref(noFilters, { status: "review", mine: true }),
      count: activities.myInReview,
      label: activities.myInReview === 1 ? "tuya en revisión" : "tuyas en revisión",
    });
  }
  if (activities) {
    items.push({
      href: activitiesHref(noFilters, { status: "draft", mine: true }),
      count: activities.myDrafts,
      label: activities.myDrafts === 1 ? "borrador tuyo" : "borradores tuyos",
    });
  }
  if (posts && canPublish) {
    items.push({
      href: postsHref(noPostFilters, { status: "review" }),
      count: posts.toReview,
      label: posts.toReview === 1 ? "historia por revisar" : "historias por revisar",
    });
  }
  if (posts) {
    items.push({
      href: postsHref(noPostFilters, { status: "draft", mine: true }),
      count: posts.myDrafts,
      label: posts.myDrafts === 1 ? "historia tuya en borrador" : "historias tuyas en borrador",
    });
  }
  if (projects && canPublish) {
    items.push({
      href: projectsHref(noProjectFilters, { status: "review" }),
      count: projects.toReview,
      label: projects.toReview === 1 ? "proyecto por revisar" : "proyectos por revisar",
    });
  }
  if (projects) {
    items.push({
      href: projectsHref(noProjectFilters, { status: "draft", mine: true }),
      count: projects.myDrafts,
      label: projects.myDrafts === 1 ? "proyecto tuyo en borrador" : "proyectos tuyos en borrador",
    });
  }
  if (galleries && canPublish) {
    items.push({
      href: galleriesHref(noGalleryFilters, { status: "review" }),
      count: galleries.toReview,
      label: galleries.toReview === 1 ? "galería por revisar" : "galerías por revisar",
    });
  }
  if (galleries) {
    items.push({
      href: galleriesHref(noGalleryFilters, { status: "draft", mine: true }),
      count: galleries.myDrafts,
      label: galleries.myDrafts === 1 ? "galería tuya en borrador" : "galerías tuyas en borrador",
    });
  }
  if (videos && canPublish) {
    items.push({
      href: videosHref(noVideoFilters, { status: "review" }),
      count: videos.toReview,
      label: videos.toReview === 1 ? "video por revisar" : "videos por revisar",
    });
  }
  if (videos) {
    items.push({
      href: videosHref(noVideoFilters, { status: "draft", mine: true }),
      count: videos.myDrafts,
      label: videos.myDrafts === 1 ? "video tuyo en borrador" : "videos tuyos en borrador",
    });
  }
  if (testimonials) {
    items.push({
      href: testimonialsHref(noTestimonialFilters, { withdrawn: true }),
      count: testimonials.withdrawn,
      label:
        testimonials.withdrawn === 1
          ? "testimonio con autorización revocada o vencida"
          : "testimonios con autorización revocada o vencida",
    });
    if (canPublish) {
      items.push({
        href: testimonialsHref(noTestimonialFilters, { status: "review" }),
        count: testimonials.toReview,
        label: testimonials.toReview === 1 ? "testimonio por revisar" : "testimonios por revisar",
      });
    }
    items.push({
      href: testimonialsHref(noTestimonialFilters, { status: "draft", mine: true }),
      count: testimonials.myDrafts,
      label:
        testimonials.myDrafts === 1
          ? "testimonio tuyo en borrador"
          : "testimonios tuyos en borrador",
    });
  }
  if (team) {
    // The team is short: every card leads to the whole list
    items.push({
      href: TEAM_PATH,
      count: team.withdrawn,
      label:
        team.withdrawn === 1
          ? "perfil del equipo con autorización revocada o vencida"
          : "perfiles del equipo con autorización revocada o vencida",
    });
    if (canPublish) {
      items.push({
        href: TEAM_PATH,
        count: team.toReview,
        label:
          team.toReview === 1 ? "perfil del equipo por revisar" : "perfiles del equipo por revisar",
      });
    }
    items.push({
      href: TEAM_PATH,
      count: team.myDrafts,
      label:
        team.myDrafts === 1
          ? "perfil del equipo tuyo en borrador"
          : "perfiles del equipo tuyos en borrador",
    });
  }
  items.push({
    href: "/admin/medios?pending=1",
    count: photos,
    label: photos === 1 ? "foto con pendientes" : "fotos con pendientes",
  });
  return items.filter((item) => item.count > 0);
}
