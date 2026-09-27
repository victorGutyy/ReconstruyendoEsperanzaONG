import type { Metadata } from "next";

import { authorizePage } from "@/lib/auth/guard";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { CategoryItem, CreateCategoryForm } from "@/modules/taxonomy/components/category-forms";
import { CreatePlaceForm, PlaceItem } from "@/modules/taxonomy/components/place-forms";
import { listTaxonomy } from "@/modules/taxonomy/queries";
import { CATEGORY_SCOPE_LABELS, CATEGORY_SCOPES } from "@/modules/taxonomy/schema";

export const metadata: Metadata = { title: "Categorías y lugares" };

export default async function TaxonomyPage() {
  const authorized = await authorizePage("taxonomy.manage");

  if (!authorized) {
    return (
      <NoPermission reason="Solo las personas con rol de Editor o Administrador pueden gestionar las categorías y los lugares." />
    );
  }

  const { places, categories } = await listTaxonomy();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">
        Categorías y lugares
      </h1>
      <p className="mt-2 text-ink-muted">
        Sirven para clasificar el contenido y para los filtros del sitio público.
      </p>

      <section aria-labelledby="places-title" className="mt-10">
        <h2 id="places-title" className="font-serif text-xl font-semibold text-green-900">
          Lugares ({places.length})
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Solo lugares generales, como un barrio o una vereda. Nunca direcciones.
        </p>
        <div className="rounded-lg border bg-card p-5">
          <CreatePlaceForm />
        </div>
        {places.length > 0 ? (
          <ul aria-label="Lugares" className="mt-4 divide-y rounded-lg border bg-card">
            {places.map((place) => (
              <PlaceItem key={place.id} place={place} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-muted">Todavía no hay lugares.</p>
        )}
      </section>

      {CATEGORY_SCOPES.map((scope) => {
        const list = categories[scope];
        const titleId = `categories-${scope}-title`;
        return (
          <section key={scope} aria-labelledby={titleId} className="mt-12">
            <h2 id={titleId} className="mb-4 font-serif text-xl font-semibold text-green-900">
              {CATEGORY_SCOPE_LABELS[scope]} ({list.length})
            </h2>
            <div className="rounded-lg border bg-card p-5">
              <CreateCategoryForm scope={scope} />
            </div>
            {list.length > 0 ? (
              <ol
                aria-label={CATEGORY_SCOPE_LABELS[scope]}
                className="mt-4 divide-y rounded-lg border bg-card"
              >
                {list.map((category, index) => (
                  <CategoryItem
                    key={category.id}
                    category={category}
                    isFirst={index === 0}
                    isLast={index === list.length - 1}
                  />
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-ink-muted">Todavía no hay categorías.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
