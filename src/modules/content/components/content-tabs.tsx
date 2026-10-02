import { FilterLink } from "@/components/ui/filter-link";

import { CONTENT_TABS, CONTENT_TYPES, type ContentType } from "../registry";

/**
 * The content types of the "Contenido" section, the current one marked.
 * Testimonials (and the team) only show to people who manage authorizations.
 */
export function ContentTabs({
  current,
  canManageConsents,
}: {
  current: ContentType;
  canManageConsents: boolean;
}) {
  return (
    <nav aria-label="Tipos de contenido" className="mt-6 flex flex-wrap gap-2">
      {CONTENT_TABS.filter((tab) => canManageConsents || !tab.consentManagersOnly).map((tab) => (
        <FilterLink
          key={tab.type}
          href={CONTENT_TYPES[tab.type].listPath}
          active={tab.type === current}
        >
          {tab.label}
        </FilterLink>
      ))}
    </nav>
  );
}
