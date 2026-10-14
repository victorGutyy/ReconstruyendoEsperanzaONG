import Link from "next/link";

const TAXONOMY_PATH = "/admin/categorias-y-lugares";

/**
 * Why a list in an editor is empty and where to fill it (found testing on
 * staging, before the organization had loaded its places and categories).
 * Authors cannot manage places and categories, so they are told whom to ask
 * instead of getting a link they cannot use.
 */
export function EmptyListNote({
  id,
  what,
  canCreate,
}: {
  /** Referenced by the select's aria-describedby. */
  id: string;
  /** Plural, e.g. "lugares" or "categorías de historias". */
  what: string;
  canCreate: boolean;
}) {
  return (
    <p id={id} className="text-sm text-ink-muted">
      Todavía no hay {what}.{" "}
      {canCreate ? (
        <Link
          href={TAXONOMY_PATH}
          className="font-medium text-green-700 underline underline-offset-4"
        >
          Créalos en Categorías y lugares
        </Link>
      ) : (
        "Pídele a un Editor o Administrador que los cree en Categorías y lugares."
      )}
    </p>
  );
}
