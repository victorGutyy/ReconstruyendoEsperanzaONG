import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { ACTION_LABELS, SECTIONS } from "../format";
import { AUDIT_ACTIONS, AUDIT_SECTIONS, type AuditFilters, SYSTEM_ACTOR } from "../schema";

/**
 * A plain GET form: filters live in the URL (shareable, back button works) and
 * it works without JavaScript. The server validates every value again.
 */
export function AuditFiltersForm({
  filters,
  people,
}: {
  filters: AuditFilters;
  people: { id: string; name: string }[];
}) {
  return (
    <form
      method="get"
      action="/admin/auditoria"
      aria-label="Filtrar auditoría"
      className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="grid gap-2">
        <Label htmlFor="filter-actor">Persona</Label>
        <NativeSelect id="filter-actor" name="actor" defaultValue={filters.actor ?? ""}>
          <option value="">Todas</option>
          <option value={SYSTEM_ACTOR}>Sistema</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-action">Acción</Label>
        <NativeSelect id="filter-action" name="action" defaultValue={filters.action ?? ""}>
          <option value="">Todas</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-section">Sección</Label>
        <NativeSelect id="filter-section" name="section" defaultValue={filters.section ?? ""}>
          <option value="">Todas</option>
          {AUDIT_SECTIONS.map((section) => (
            <option key={section} value={section}>
              {SECTIONS[section].label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-from">Desde</Label>
        <Input id="filter-from" name="from" type="date" defaultValue={filters.from ?? ""} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="filter-to">Hasta</Label>
        <Input id="filter-to" name="to" type="date" defaultValue={filters.to ?? ""} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button type="submit">Filtrar</Button>
        <Link
          href="/admin/auditoria"
          className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
        >
          Quitar filtros
        </Link>
      </div>
    </form>
  );
}
