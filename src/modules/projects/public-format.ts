// Public projects (step 8.3b): how visitors read a project's stage and dates.
// Pure, tested in public-format.test.ts.

import type { ProjectStage } from "./schema";

export const PUBLIC_PROJECTS_PATH = "/proyectos";

/** Groups of the listing, in this order (decision 8.3). */
export const PUBLIC_STAGE_ORDER: readonly ProjectStage[] = [
  "active",
  "planned",
  "paused",
  "completed",
];

export const PUBLIC_STAGE_GROUPS: Record<ProjectStage, string> = {
  active: "En curso",
  planned: "En planeación",
  paused: "Pausados",
  completed: "Finalizados",
};

/** The stage of one project, as its card and its facts show it. */
export const PUBLIC_STAGE_LABELS: Record<ProjectStage, string> = {
  active: "En curso",
  planned: "En planeación",
  paused: "Pausado",
  completed: "Finalizado",
};

const MONTH = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-03-15" (a calendar date, no time zone) → "marzo de 2026". */
const month = (date: string) => MONTH.format(new Date(`${date}T12:00:00Z`));

/** "Desde marzo de 2026", "Marzo de 2026 a junio de 2026" or null. */
export function formatProjectDates(start: string | null, end: string | null): string | null {
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  if (start && end) {
    const from = month(start);
    const to = month(end);
    return capital(from === to ? from : `${from} a ${to}`);
  }
  if (start) return `Desde ${month(start)}`;
  if (end) return `Hasta ${month(end)}`;
  return null;
}
