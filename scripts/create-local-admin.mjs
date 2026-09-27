// Creates a [DEMO] Administrator in the LOCAL Supabase so the panel can be tried
// without any setup. Refuses to run against anything that is not this machine.
//
//   npm run db:local-admin                      → admin@example.test
//   npm run db:local-admin -- tu@correo.test    → another e-mail
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const email = process.argv[2] ?? "admin@example.test";

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
      "NEXT_PUBLIC_SUPABASE_URL apunta a otro lugar: no se creó nada.",
  );
  process.exit(1);
}
if (!secret) {
  console.error("Falta SUPABASE_SECRET_KEY en .env.local (ver README).");
  process.exit(1);
}

const password = `Demo-${randomBytes(12).toString("base64url")}`;
const admin = createClient(url, secret, { auth: { persistSession: false } });

const { error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "admin", full_name: "[DEMO] Administración" },
});

if (error) {
  console.error(`No se pudo crear ${email}: ${error.message}`);
  process.exit(1);
}

console.log("✅ Administrador [DEMO] creado en el Supabase LOCAL");
console.log(`   Correo:     ${email}`);
console.log(`   Contraseña: ${password}   (se muestra solo esta vez)`);
console.log("   Entra en http://localhost:3000/admin y registra tu app autenticadora.");
