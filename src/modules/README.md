# `src/modules/`

Lógica por dominio (ver `docs/04-arquitectura.md` §3). Un módulo por dominio: `posts`, `activities`, `projects`, `galleries`, `videos`, `media`, `consents`, `messages`, `users`, `settings`, `audit`, `taxonomy`, `team`, `testimonials`.

```
<modulo>/
├── schema.ts     # Esquemas Zod (servidor y navegador)
├── queries.ts    # Lecturas de BD — empieza con import 'server-only'
├── actions.ts    # Server Actions: requireUser → aal2 → requirePermission → Zod → rate limit
├── components/   # UI del módulo
└── index.ts      # Lo único que otros módulos pueden importar
```

Reglas: `app/` → `modules/` → `lib/`, nunca al revés. Un módulo no importa archivos internos de otro.
