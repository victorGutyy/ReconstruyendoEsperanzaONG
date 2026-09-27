// Loads [DEMO] places and categories into the LOCAL Supabase so the panel has
// something to show. Refuses to run against anything that is not this machine:
// the real lists are loaded by the organization from the panel (docs/06 §4).
//
//   npm run db:local-demo
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();

if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(
    "✋ Este script solo funciona con el Supabase local (127.0.0.1). " +
      "NEXT_PUBLIC_SUPABASE_URL apunta a otro lugar: no se cargó nada.",
  );
  process.exit(1);
}
if (!secret) {
  console.error("Falta SUPABASE_SECRET_KEY en .env.local (ver README).");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false } });

const places = [
  { name: "[DEMO] Barrio Centro", slug: "demo-barrio-centro", kind: "neighborhood" },
  { name: "[DEMO] Barrio La Esperanza", slug: "demo-barrio-la-esperanza", kind: "neighborhood" },
  { name: "[DEMO] Vereda El Túnel", slug: "demo-vereda-el-tunel", kind: "vereda" },
];

const categories = [
  {
    scope: "activity",
    name: "[DEMO] Jornada comunitaria",
    slug: "demo-jornada-comunitaria",
    position: 1,
  },
  { scope: "activity", name: "[DEMO] Taller", slug: "demo-taller", position: 2 },
  { scope: "post", name: "[DEMO] Historias de vida", slug: "demo-historias-de-vida", position: 1 },
];

/** Inserts only the rows whose key is not there yet: running it twice changes nothing. */
async function insertMissing(table, rows, keyOf) {
  const { data, error } = await db.from(table).select("*").is("deleted_at", null);
  if (error) return error;
  const existing = new Set(data.map(keyOf));
  const missing = rows.filter((row) => !existing.has(keyOf(row)));
  if (missing.length === 0) return null;
  return (await db.from(table).insert(missing)).error;
}

const error =
  (await insertMissing("places", places, (row) => row.slug)) ??
  (await insertMissing("categories", categories, (row) => `${row.scope}/${row.slug}`));

if (error) {
  console.error(`No se pudieron cargar los datos [DEMO]: ${error.message}`);
  process.exitCode = 1;
} else {
  console.log("✅ Lugares y categorías [DEMO] cargados en el Supabase LOCAL");
}
