// Memoria (step 8.6): kinds, filter and links. Pure, tested in schema.test.ts.

export const MEMORY_PATH = "/memoria";

export const MEMORY_KINDS = ["activity", "post", "project"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** Filter links of the page, in the wireframe's order (docs/07 §6.4). */
export const MEMORY_FILTERS: { kind: MemoryKind | null; label: string; param: string | null }[] = [
  { kind: null, label: "Todo", param: null },
  { kind: "activity", label: "Actividades", param: "actividades" },
  { kind: "post", label: "Historias", param: "historias" },
  { kind: "project", label: "Proyectos", param: "proyectos" },
];

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  activity: "Actividad",
  post: "Historia",
  project: "Proyecto",
};

const BASES: Record<MemoryKind, string> = {
  activity: "/actividades",
  post: "/historias",
  project: "/proyectos",
};

export const memoryItemHref = (kind: MemoryKind, slug: string) => `${BASES[kind]}/${slug}`;

/** `?tipo=historias` → "post"; anything else → all. */
export function parseMemoryKind(value: string | string[] | undefined): MemoryKind | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return MEMORY_FILTERS.find((filter) => filter.param && filter.param === raw)?.kind ?? null;
}

export function memoryHref(kind: MemoryKind | null): string {
  const param = MEMORY_FILTERS.find((filter) => filter.kind === kind)?.param;
  return param ? `${MEMORY_PATH}?tipo=${param}` : MEMORY_PATH;
}

const DAY = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "America/Bogota",
});

/** "12 oct" (the wireframe's "12 OCT" in capitals by CSS), in Colombia. */
export function formatMemoryDay(iso: string): string {
  const parts = DAY.formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = (parts.find((part) => part.type === "month")?.value ?? "").replace(".", "");
  return `${day} ${month}`;
}
