import Link from "next/link";

/** Numbered pages of a public list; each page has its own address. */
export function Pagination({
  label,
  current,
  pageCount,
  hrefFor,
}: {
  label: string;
  current: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="mt-8">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
          <li key={page}>
            <Link
              href={hrefFor(page)}
              aria-current={page === current ? "page" : undefined}
              className="inline-flex size-11 items-center justify-center rounded-md border bg-card font-medium outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-green-700 aria-[current=page]:bg-green-50 aria-[current=page]:text-green-900"
            >
              <span className="sr-only">Página </span>
              {page}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
