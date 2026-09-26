# Reconstruyendo Esperanza

Plataforma web de **Reconstruyendo Esperanza**, iniciativa social sin ánimo de lucro de Calarcá (Quindío, Colombia): portal público tipo revista + panel `/admin` (CMS). Es la memoria digital del trabajo social de la organización.

> Estado: **Fases 0–2 documentadas** (análisis, arquitectura, seguridad, datos y privacidad). Siguiente: Fase 3 — prototipo UX/UI. Aún no hay código.

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

## Cómo empezar

Los comandos de desarrollo se documentarán cuando se cree la base del proyecto (Next.js + Supabase).
