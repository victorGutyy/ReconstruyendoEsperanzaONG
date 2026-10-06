import Link from "next/link";

/** "Inicio › Actividades › Título" (docs/07 §6.3); the last one is the current page. */
export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-x-2">
            {index > 0 ? <span aria-hidden="true">›</span> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-green-900"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="line-clamp-1">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
