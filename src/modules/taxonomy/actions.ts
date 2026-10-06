"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { revalidatePublicSite } from "@/lib/site/revalidate";
import { createClient } from "@/lib/supabase/server";

import {
  type ActionState,
  createCategorySchema,
  createPlaceSchema,
  moveCategorySchema,
  moveInOrder,
  slugify,
  trashSchema,
  updateCategorySchema,
  updatePlaceSchema,
} from "./schema";

const TAXONOMY_PATH = "/admin/categorias-y-lugares";
const UNIQUE_VIOLATION = "23505";

type Authorized = { ok: true } | { ok: false; state: ActionState };

/** taxonomy.manage + MFA, then the per-user panel rate limit. RLS checks again. */
async function authorize(): Promise<Authorized> {
  const authorized = await authorizeAction("taxonomy.manage");
  if (!authorized.ok) return { ok: false, state: { error: authorized.error } };

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(authorized.auth.user.id),
  );
  if (!attempt.success) {
    return { ok: false, state: { error: "Demasiadas acciones seguidas. Espera un momento." } };
  }
  return { ok: true };
}

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Revisa los datos.";

export async function createPlace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const allowed = await authorize();
  if (!allowed.ok) return allowed.state;

  const parsed = createPlaceSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("places").insert({
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    kind: parsed.data.kind,
  });
  if (error) {
    return {
      error:
        error.code === UNIQUE_VIOLATION
          ? "Ya existe un lugar con ese nombre (o uno muy parecido)."
          : "No se pudo agregar el lugar.",
    };
  }

  revalidatePath(TAXONOMY_PATH);
  revalidatePublicSite();
  return { notice: `Lugar «${parsed.data.name}» agregado.` };
}

export async function updatePlace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const allowed = await authorize();
  if (!allowed.ok) return allowed.state;

  const parsed = updatePlaceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  // The slug is kept on purpose: it will be part of public URLs
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("places")
    .update({ name: parsed.data.name, kind: parsed.data.kind, is_active: parsed.data.active })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) return { error: "No se pudo guardar el lugar." };

  revalidatePath(TAXONOMY_PATH);
  revalidatePublicSite();
  return { notice: "Cambios guardados." };
}

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const allowed = await authorize();
  if (!allowed.ok) return allowed.state;

  const parsed = createCategorySchema.safeParse({
    scope: formData.get("scope"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const supabase = await createClient();
  // New categories go to the end of their list
  const { data: last } = await supabase
    .from("categories")
    .select("position")
    .eq("scope", parsed.data.scope)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("categories").insert({
    scope: parsed.data.scope,
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    description: parsed.data.description,
    position: (last?.position ?? 0) + 1,
  });
  if (error) {
    return {
      error:
        error.code === UNIQUE_VIOLATION
          ? "Ya existe una categoría con ese nombre (o uno muy parecido)."
          : "No se pudo agregar la categoría.",
    };
  }

  revalidatePath(TAXONOMY_PATH);
  revalidatePublicSite();
  return { notice: `Categoría «${parsed.data.name}» agregada.` };
}

export async function updateCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const allowed = await authorize();
  if (!allowed.ok) return allowed.state;

  const parsed = updateCategorySchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name, description: parsed.data.description })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) return { error: "No se pudo guardar la categoría." };

  revalidatePath(TAXONOMY_PATH);
  revalidatePublicSite();
  return { notice: "Cambios guardados." };
}

/** Moves a category one place up or down, renumbering its list 1…n. */
export async function moveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const allowed = await authorize();
  if (!allowed.ok) return allowed.state;

  const parsed = moveCategorySchema.safeParse({
    id: formData.get("id"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return { error: "Acción no válida." };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("categories")
    .select("scope")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!target) return { error: "No se encontró la categoría." };

  const { data: siblings, error } = await supabase
    .from("categories")
    .select("id, position")
    .eq("scope", target.scope)
    .is("deleted_at", null)
    .order("position")
    .order("name");
  if (error) return { error: "No se pudo cambiar el orden." };

  const next = moveInOrder(siblings, parsed.data.id, parsed.data.direction);
  if (!next) return {};

  // Only rows whose position really changes are written (and audited)
  for (const [index, item] of next.entries()) {
    if (item.position === index + 1) continue;
    const { error: moveError } = await supabase
      .from("categories")
      .update({ position: index + 1 })
      .eq("id", item.id);
    if (moveError) return { error: "No se pudo cambiar el orden." };
  }

  revalidatePath(TAXONOMY_PATH);
  revalidatePublicSite();
  return {};
}

/** Soft delete: the row goes to the trash (restored from the trash in F7). */
export async function trashTaxonomyItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const allowed = await authorize();
  if (!allowed.ok) return allowed.state;

  const parsed = trashSchema.safeParse({ table: formData.get("table"), id: formData.get("id") });
  if (!parsed.success) return { error: "Acción no válida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(parsed.data.table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) return { error: "No se pudo enviar a la papelera." };

  revalidatePath(TAXONOMY_PATH);
  revalidatePublicSite();
  return { notice: "Enviado a la papelera." };
}
