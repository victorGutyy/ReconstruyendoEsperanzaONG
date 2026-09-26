# 03 · Stack tecnológico

> Versión 0.1 (borrador para aprobación) · 26-sep-2026
> Relacionado: `02-requisitos.md` (RNF-A-07 costo US$0, RNF-A-09 portabilidad) · `04-arquitectura.md`

Este documento explica **por qué** se eligió cada herramienta, qué alternativas se descartaron, qué límites tienen los planes gratuitos y cuánto costaría crecer.

> ⚠️ **Los precios y límites cambian.** Las cifras de este documento son referenciales; antes de crear cada cuenta se verifican en la página oficial enlazada y se actualiza la tabla con la fecha de verificación.

---

## 1. Criterios de decisión

En orden de importancia para este proyecto:

1. **Seguridad por defecto** (MFA, permisos en la base de datos, secretos fuera del navegador).
2. **Costo US$0/mes** para la Etapa A.
3. **Una sola persona lo construye y lo mantiene** → un solo lenguaje (TypeScript) de punta a punta, herramientas populares con buena documentación.
4. **SEO y velocidad** en celulares con datos móviles.
5. **Portabilidad**: PostgreSQL estándar, poder irse de cualquier proveedor sin reescribir.
6. **Preparado para la Etapa B** (roles, auditoría, datos personales) sin cambiar de tecnología.

## 2. Alternativas evaluadas

| Opción | A favor | En contra | Veredicto |
|---|---|---|---|
| **A. Next.js + Supabase** (elegida) | Un solo lenguaje; SEO excelente (render en servidor); Auth con MFA incluido; RLS protege los datos en la propia BD; plan gratuito generoso | Next.js tiene curva de aprendizaje (Server Components); dependencia de Supabase mitigada porque es PostgreSQL estándar | ✅ Mejor equilibrio |
| B. React + FastAPI (Python) — sugerida en el .docx | Backend muy claro; Python útil para IA en la Etapa C | Dos lenguajes y dos despliegues; hay que construir auth, MFA y permisos a mano; más superficie de error para una sola persona | ❌ Más trabajo sin beneficio en la Etapa A |
| C. React + Laravel (PHP) — sugerida en el .docx | Framework maduro, auth incluida | Dos lenguajes; hosting PHP gratuito de calidad es escaso | ❌ |
| D. WordPress | Rápido de montar, CMS conocido | Superficie de ataque grande (plugins); rendimiento y seguridad dependen de mantenimiento constante; difícil llevarlo a la Etapa B | ❌ |
| E. Astro + CMS headless (Sanity/Strapi) | Sitio público ultra rápido | Dos sistemas; el CMS gratuito limita usuarios/roles; la Etapa B igual necesitaría otro backend | ❌ |

## 3. Stack elegido y por qué

### Aplicación
| Herramienta | Para qué | Por qué esta |
|---|---|---|
| **Next.js 16** (App Router) + **React 19** | Sitio público y panel en una sola app | Render en servidor = buen SEO y carga rápida; Server Actions evitan escribir una API aparte |
| **TypeScript estricto** | Todo el código | Detecta errores antes de ejecutar; tipos generados desde la BD |
| **Tailwind CSS v4** + **shadcn/ui** | Estilos y componentes | shadcn copia el código de los componentes al proyecto (no es una dependencia cerrada) y es accesible (Radix) |
| **Lucide** | Íconos | Livianos, consistentes |
| **Motion** | Animaciones | Respetando `prefers-reduced-motion` |
| **Fraunces + Inter** con `next/font` | Tipografía | Fraunces: serif cálida, editorial, afín al logo. Inter: muy legible en pantalla. `next/font` las sirve desde el mismo dominio (sin llamadas a Google en el navegador) |
| **Zod** + **React Hook Form** | Validación de formularios | El mismo esquema valida en el navegador y en el servidor |
| **Tiptap** | Editor enriquecido | Guarda JSON (no HTML) → se renderiza de forma segura, sin riesgo de inyectar código |
| **TanStack Table** | Tablas del panel | Filtros, orden y paginación |
| **sharp** | Procesar imágenes | Redimensiona, convierte a WebP/AVIF y **elimina EXIF/GPS** |

### Servicios
| Servicio | Para qué | Plan |
|---|---|---|
| **Supabase** | PostgreSQL + Auth (MFA TOTP) + Storage privado | Free |
| **Cloudflare R2** | Imágenes públicas ya procesadas | Free |
| **Vercel** | Hosting de la app | Ver §5 (decisión pendiente) |
| **Upstash Redis** | Rate limiting (límite de intentos) | Free |
| **Cloudflare Turnstile** | Antispam del formulario de contacto (sin CAPTCHA molesto) | Gratis |
| **Resend** | Correos (invitaciones, recuperación, aviso de nuevo mensaje) | Free |
| **GitHub** + **Actions** | Código, PRs, CI y backups programados | Free |

### Calidad
| Herramienta | Qué prueba |
|---|---|
| **Vitest** | Funciones y validaciones (unitarias) |
| **Playwright** | Flujos completos en navegador (HU del `02`) |
| **pgTAP** | Que las políticas RLS realmente bloqueen lo que deben bloquear |
| **ESLint** + `tsc` | Estilo y tipos en cada PR |

## 4. Límites de los planes gratuitos (referenciales — verificar)

| Servicio | Límite relevante | ¿Nos alcanza en la Etapa A? | Página oficial |
|---|---|---|---|
| Supabase Free | 500 MB de BD · 1 GB Storage · 5 GB de transferencia/mes · 2 proyectos · **se pausa tras 7 días sin actividad** · sin backups descargables | Sí: el contenido es texto; las imágenes públicas van a R2. La pausa y los backups se resuelven en §6 | supabase.com/pricing |
| Cloudflare R2 | 10 GB almacenados · **transferencia de salida gratis** · 1 M escrituras y 10 M lecturas/mes | Sí: ~10.000 fotos optimizadas (~300 KB c/u × 3 tamaños) | developers.cloudflare.com/r2/pricing |
| Vercel Hobby | ~100 GB de transferencia/mes, funciones con límites de uso · **solo uso personal no comercial** | Técnicamente sí; **el problema es el uso permitido** (ver §5) | vercel.com/pricing |
| Upstash Redis Free | ~500 mil comandos/mes | Sí, sobrado | upstash.com/pricing |
| Resend Free | 3.000 correos/mes · 100/día · 1 dominio | Sí | resend.com/pricing |
| GitHub Actions | Ilimitado en repos públicos · 2.000 min/mes en privados | Sí (repo privado) | github.com/pricing |
| Turnstile | Gratis | Sí | — |

## 5. Decisión pendiente: hosting (Vercel Hobby vs. alternativas)

**El punto:** el plan Hobby de Vercel está pensado para **proyectos personales no comerciales**. El sitio de una organización social no genera ingresos, pero **tampoco es un proyecto personal**, así que hay una zona gris en los términos de uso. No queremos que el sitio dependa de algo que podría incumplir las condiciones.

| Opción | Costo | Ventajas | Limitaciones |
|---|---|---|---|
| **1. Vercel Hobby** | US$0 | Es donde Next.js funciona "sin fricción"; despliegues de vista previa por PR | Zona gris en los términos para una organización |
| **2. Vercel Pro** | ~US$20/mes | Uso comercial/organizacional permitido, más límites | Rompe el objetivo de US$0/mes |
| **3. Cloudflare Workers** con el adaptador **OpenNext** | US$0 (plan gratuito de Workers, ~100 mil solicitudes/día) | Uso organizacional permitido; misma empresa que R2 y Turnstile; lo sugería el .docx | Algunas funciones de Next.js tardan en ser compatibles; hay que probarlo (sharp no corre en Workers → el procesamiento de imágenes iría en otro lugar) |

**Recomendación:**
- Desarrollo y *staging* en **Vercel Hobby** (uso de desarrollo, sin conflicto).
- Antes de producción (Fase de lanzamiento): **escribir a Vercel** preguntando si el sitio de una iniciativa sin ánimo de lucro califica para Hobby. Si no califica → probar **Cloudflare Workers + OpenNext** en staging; si algo crítico no funciona → Vercel Pro y se documenta el costo.
- El código se escribe **sin depender de funciones exclusivas de Vercel** (imágenes, KV, cron propietarios) para que moverlo sea sencillo. Esto ya cumple RNF-025 del .docx (independencia tecnológica).

## 6. Riesgos del plan gratuito de Supabase y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Pausa tras 7 días sin actividad | Un GitHub Action diario (el mismo del backup) consulta la BD → el proyecto nunca queda inactivo. Además, un monitor de disponibilidad gratuito (UptimeRobot o similar) |
| Sin backups descargables en Free | GitHub Action nocturno: `pg_dump` → archivo **cifrado** → bucket privado de R2, con retención de 30 días. Restauración probada en staging antes de lanzar (RNF-A-08) |
| Solo 2 proyectos gratuitos | Proyecto 1 = **staging**, proyecto 2 = **producción**. Desarrollo local con `supabase start` (Docker) |

## 7. Costos proyectados

| Escenario | Qué cambia | Costo aproximado |
|---|---|---|
| **Etapa A — lanzamiento** | Todo en planes gratuitos | **US$0/mes + dominio** |
| Si Vercel no admite Hobby y OpenNext no sirve | Vercel Pro | + US$20/mes |
| Etapa B (datos personales de beneficiarios) | **Supabase Pro recomendado**: backups diarios gestionados, sin pausa, mejor soporte. Con datos personales ya no conviene depender de backups caseros | + US$25/mes |
| Mucho tráfico o fotos | R2 pasa de 10 GB | ~US$0,015 por GB/mes adicional |

## 8. Dominio (pregunta 11 del `01`)

Nombres posibles (disponibilidad **no verificada**; se revisa con el cliente antes de comprar):

| Opción | Costo anual aprox. | Comentario |
|---|---|---|
| `reconstruyendoesperanza.org` | US$10–15 | `.org` comunica organización social. **Recomendado** |
| `reconstruyendoesperanza.com` | US$10–15 | El más fácil de recordar |
| `reconstruyendoesperanza.co` | US$25–40 | Identidad colombiana, más costoso |
| `reconstruyendoesperanzacalarca.org` | US$10–15 | Si los anteriores no están disponibles; largo |

- Registrar en **Cloudflare Registrar** (vende al precio de costo, sin recargos de renovación) y a nombre de la **organización**, no de una persona.
- Correo `contacto@dominio` → reenvío gratuito con Cloudflare Email Routing a la bandeja existente.

## 9. Versiones

Se fijan al crear el proyecto (Fase de base del proyecto) en `package.json` y se documentan aquí. Regla: versiones estables actuales; actualizaciones de dependencias con PR propio y CI en verde.
