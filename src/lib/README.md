# `src/lib/`

Código compartido sin lógica de negocio (ver `docs/04-arquitectura.md` §3 y §6).

| Carpeta | Contenido |
|---|---|
| `supabase/` | `server.ts`, `client.ts` y `admin.ts` (este último con `import 'server-only'` y la clave secreta) |
| `auth/` | `requireUser`, `requirePermission` |
| `storage/` · `email/` · `rate-limit/` | Interfaz propia + implementación del proveedor (R2, Resend, Upstash) |
| `images/` | Validación de firma binaria y procesamiento con sharp |
| `utils/` | Fechas en America/Bogota, slugs, etc. |

Cualquier archivo que use un secreto empieza con `import 'server-only'`.
