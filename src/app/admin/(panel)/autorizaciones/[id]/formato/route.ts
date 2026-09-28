import { NextResponse } from "next/server";

import { isAuthError } from "@/lib/auth/errors";
import { LOGIN_PATH } from "@/lib/auth/rules";
import { requirePermission } from "@/lib/auth/session";
import { getConsentDocumentUrl } from "@/modules/consents/queries";
import { idSchema } from "@/modules/consents/schema";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Opens the photo of a signed form: checks consent.manage + MFA, then
 * redirects to a 5-minute signed URL. Nothing is cached anywhere.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/admin/autorizaciones/[id]/formato">,
) {
  try {
    await requirePermission("consent.manage");
  } catch (error) {
    if (!isAuthError(error)) throw error;
    if (error.code === "FORBIDDEN") {
      return new NextResponse("No tienes permiso.", { status: 403, headers: NO_STORE });
    }
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url), { headers: NO_STORE });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return new NextResponse("No encontrado.", { status: 404, headers: NO_STORE });
  }

  const url = await getConsentDocumentUrl(id);
  if (!url) return new NextResponse("No encontrado.", { status: 404, headers: NO_STORE });

  return NextResponse.redirect(url, { status: 303, headers: NO_STORE });
}
