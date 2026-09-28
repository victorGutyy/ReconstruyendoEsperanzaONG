import { z } from "zod";

// Media library (step 6.4): pending issues, filters and the photo form.
// Pure: unit-tested in library.test.ts.

export const PEOPLE_OPTIONS = ["none", "identifiable", "minors"] as const;
export type PeopleInPhoto = (typeof PEOPLE_OPTIONS)[number];

export const PEOPLE_LABELS: Record<PeopleInPhoto, string> = {
  none: "No",
  identifiable: "Sí, adultos",
  minors: "Sí, hay menores",
};

/** Codes from public.media_publish_status / private.media_publish_issues. */
export const ISSUE_CODES = [
  "in_trash",
  "not_processed",
  "missing_alt_text",
  "people_unclassified",
  "missing_consent",
  "missing_guardian_consent",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export const ISSUES: Record<IssueCode, { badge: string; help: string }> = {
  in_trash: {
    badge: "En la papelera",
    help: "La foto está en la papelera: no se puede usar en contenido.",
  },
  not_processed: {
    badge: "Sin procesar",
    help: "La foto no terminó de procesarse. Vuelve a subirla.",
  },
  missing_alt_text: {
    badge: "Falta descripción",
    help: "Escribe una descripción: la leen las personas que no pueden ver la foto.",
  },
  people_unclassified: {
    badge: "Sin clasificar personas",
    help: "Indica si aparecen personas reconocibles.",
  },
  missing_consent: {
    badge: "Falta autorización",
    help: "Aparecen personas y no hay una autorización vigente vinculada. Quien maneja las autorizaciones puede vincularla en Autorizaciones.",
  },
  missing_guardian_consent: {
    badge: "Falta autorización del representante",
    help: "Aparecen menores: hace falta la autorización firmada por su representante legal, vinculada a la foto en Autorizaciones.",
  },
};

/** Unknown codes (a newer database) are kept but shown generically. */
export function describeIssues(codes: readonly string[]) {
  return codes.map((code) =>
    Object.hasOwn(ISSUES, code)
      ? { code, ...ISSUES[code as IssueCode] }
      : { code, badge: "Revisar", help: "La foto tiene un pendiente." },
  );
}

export const LIBRARY_PAGE_SIZE = 24;
const MAX_PAGE = 500;

const flag = z.preprocess((value) => value === "1", z.boolean());

export const libraryFiltersSchema = z.object({
  mine: flag,
  pending: flag,
  trash: flag,
  page: z.coerce.number().int().min(1).max(MAX_PAGE).catch(1),
});
export type LibraryFilters = z.output<typeof libraryFiltersSchema>;

export function parseLibraryFilters(
  searchParams: Record<string, string | string[] | undefined>,
): LibraryFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return libraryFiltersSchema.parse({
    mine: first(searchParams.mine),
    pending: first(searchParams.pending),
    trash: first(searchParams.trash),
    page: first(searchParams.page),
  });
}

export function libraryHref(filters: LibraryFilters, changes: Partial<LibraryFilters> = {}) {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.mine) params.set("mine", "1");
  if (next.pending) params.set("pending", "1");
  if (next.trash) params.set("trash", "1");
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/medios?${query}` : "/admin/medios";
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((text) => (text === "" ? null : text));

export const updateMediaSchema = z.object({
  id: z.uuid(),
  altText: optionalText(300, "La descripción es demasiado larga (máximo 300 caracteres)."),
  caption: optionalText(500, "El pie de foto es demasiado largo (máximo 500 caracteres)."),
  credit: optionalText(120, "El crédito es demasiado largo (máximo 120 caracteres)."),
  // Not chosen yet = null ("sin clasificar")
  people: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.enum(PEOPLE_OPTIONS, { message: "Elige una opción válida." }).nullable(),
  ),
});

export type MediaFormState = {
  error?: string;
  notice?: string;
};
