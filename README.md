# Reconstruyendo Esperanza

Plataforma web de **Reconstruyendo Esperanza**, iniciativa social sin ánimo de lucro de Calarcá (Quindío, Colombia): portal público tipo revista + panel `/admin` (CMS). Es la memoria digital del trabajo social de la organización.

> Estado: **F0–F3 completas** (documentación y prototipo UX/UI) · **F4 base del proyecto** en cierre: Next.js, Supabase local, calidad automática, CI y staging. Siguiente: **F5 — acceso y auditoría**. Plan completo en [`docs/08-plan-de-fases.md`](docs/08-plan-de-fases.md).

## Documentación

| Archivo | Contenido |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Reglas de trabajo, stack, arquitectura y seguridad (resumen) |
| [`docs/01-vision-y-alcance.md`](docs/01-vision-y-alcance.md) | Problema, alcance del MVP, riesgos, preguntas pendientes |
| [`docs/02-requisitos.md`](docs/02-requisitos.md) | Requisitos funcionales, no funcionales e historias de usuario |
| [`docs/03-stack-tecnologico.md`](docs/03-stack-tecnologico.md) | Stack, alternativas, límites gratuitos y costos |
| [`docs/04-arquitectura.md`](docs/04-arquitectura.md) | Diagramas, carpetas, flujos y ambientes |
| [`docs/05-seguridad.md`](docs/05-seguridad.md) | Amenazas, controles, OWASP, incidentes y checklist |
| [`docs/06-modelo-datos.md`](docs/06-modelo-datos.md) | Tablas, relaciones, índices, RLS y migraciones |
| [`docs/07-diseno-ux-ui.md`](docs/07-diseno-ux-ui.md) | Identidad visual, mapa del sitio, wireframes, accesibilidad y SEO |
| [`docs/08-plan-de-fases.md`](docs/08-plan-de-fases.md) | Fases, flujo de Git, Definition of Done y checklist de producción |
| [`docs/09-privacidad-y-marco-legal.md`](docs/09-privacidad-y-marco-legal.md) | Protección de datos, autorizaciones de imagen y separación de lo electoral (borrador para revisión legal) |

> **Repositorio público.** Los documentos originales del cliente y el material de marca **no** se versionan: se guardan en una carpeta privada fuera del repositorio (`reconstruyendo-esperanza-privado/`). Las rutas `docs/fuentes/` y `docs/marca/` están en `.gitignore`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS v4 · shadcn/ui · Supabase (PostgreSQL + Auth + Storage) · Vitest · Playwright + axe · GitHub Actions · Vercel. Detalle y justificación en [`docs/03-stack-tecnologico.md`](docs/03-stack-tecnologico.md).

## Cómo empezar

### Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | 24 o superior | Ejecutar la app y las herramientas |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Actual, abierto y con ≥ 4 GB de RAM asignados | Supabase local |
| Git | Actual | Control de versiones |

La CLI de Supabase **no** se instala aparte: viene como dependencia del proyecto y se usa con `npx supabase`.

### Primera vez

```bash
# 1. Clonar e instalar exactamente las versiones del lockfile
git clone https://github.com/victorGutyy/ReconstruyendoEsperanzaONG.git
cd ReconstruyendoEsperanzaONG
npm ci

# 2. Navegador para las pruebas E2E (solo Chromium, ~170 MB)
npx playwright install chromium

# 3. Levantar Supabase local (la primera vez descarga ~2–3 GB de imágenes de Docker)
npx supabase start
```

**4. Variables de entorno.** Copia `.env.example` como `.env.local` y llénalo con los valores que muestra `npx supabase status -o env`:

| Variable en `.env.local` | Valor en `npx supabase status -o env` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` |

Son claves **locales**: solo funcionan en tu equipo. `.env.local` está en `.gitignore` y **nunca** se sube al repositorio. Si falta una variable, la app falla con un mensaje que dice cuál (sin mostrar valores).

```bash
# 5. Arrancar la app
npm run dev
```

| Servicio | Dirección |
|---|---|
| Sitio (desarrollo) | http://localhost:3000 |
| Supabase Studio (panel de la BD local) | http://127.0.0.1:54323 |
| API de Supabase local | http://127.0.0.1:54321 |

Al terminar el día puedes detener Supabase con `npx supabase stop` (los datos locales se conservan).

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` · `npm start` | Compilar y servir la versión de producción |
| `npm run check` | **Antes de cada commit**: formato + lint + tipos + pruebas unitarias (lo mismo que el CI) |
| `npm run format` | Aplicar formato con Prettier |
| `npm test` · `npm run test:watch` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas E2E + accesibilidad (Playwright + axe) sobre el build de producción |
| `npx supabase start` · `stop` · `status` | Encender, apagar y ver el Supabase local |
| `npx supabase migration new <nombre>` | Crear una migración en `supabase/migrations/` |
| `npm run db:local-admin` | Crear un Administrador `[DEMO]` en el Supabase **local** para probar el panel (muestra la contraseña una sola vez) |
| `npm run db:local-demo` | Cargar lugares y categorías `[DEMO]` en el Supabase **local** (se puede correr varias veces) |
| `npx supabase db reset` | Recrear la BD local y reaplicar todas las migraciones |

### Flujo de trabajo

1. Rama nueva desde `develop`: `feature/*`, `fix/*` o `docs/*`.
2. Commits con [Conventional Commits](https://www.conventionalcommits.org/) en inglés.
3. `npm run check` en verde.
4. PR a `develop`: el CI (*Quality* + *E2E*) debe pasar y Vercel genera una vista previa protegida.
5. Merge con *squash*. `main` solo recibe versiones desde `release/*`.

Reglas completas en [`CLAUDE.md`](CLAUDE.md) y [`docs/08-plan-de-fases.md`](docs/08-plan-de-fases.md).

### Ambientes

| Ambiente | App | Base de datos |
|---|---|---|
| Local | `npm run dev` | Supabase en Docker |
| Staging | Vercel Preview (cada PR, requiere iniciar sesión en Vercel) | Supabase `reconstruyendo-esperanza-staging` |
| Producción | Se configura en la F10 | Se crea en la F10 |

Detalle en [`docs/04-arquitectura.md`](docs/04-arquitectura.md) §8.

### Problemas comunes (Windows)

| Síntoma | Solución |
|---|---|
| `npx supabase start` falla al conectar con Docker | Abrir Docker Desktop y esperar a que diga *Engine running* |
| El contenedor `vector` se reinicia en bucle | Ya resuelto: `analytics` está desactivado en `supabase/config.toml` para local |
| Avisos `LF will be replaced by CRLF` | Normales; `.gitattributes` guarda todo con LF en el repositorio |
| `npm warn allow-scripts … unrs-resolver` | Esperado: npm bloquea ese script de instalación y ESLint funciona igual |
