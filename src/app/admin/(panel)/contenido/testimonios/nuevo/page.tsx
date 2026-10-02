import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { listOwnerOptions } from "@/modules/content";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TestimonialEditor } from "@/modules/testimonials/components/testimonial-editor";
import { TESTIMONIALS_PATH } from "@/modules/testimonials/schema";

export const metadata: Metadata = { title: "Nuevo testimonio" };

export default async function NewTestimonialPage() {
  const authorized = await authorizePage("consent.manage");
  if (!authorized || !hasPermission(authorized.profile, "content.create")) {
    return <NoPermission reason="Los testimonios los gestiona quien maneja las autorizaciones." />;
  }

  const owners = await listOwnerOptions({ activityId: null, projectId: null });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={TESTIMONIALS_PATH} className="font-medium text-green-700 underline">
        Volver a testimonios
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Testimonios
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Nuevo testimonio</h1>
      <p className="mt-2 text-ink-muted">
        Primero elige la autorización de la persona: sin ella no se puede guardar.
      </p>
      <div className="mt-6 rounded-lg border bg-card p-5">
        <TestimonialEditor
          initial={{ quote: "", authorName: "", authorContext: "", consentId: "", owner: "" }}
          initialConsent={null}
          owners={owners}
        />
      </div>
    </div>
  );
}
