# 01 · Visión, análisis y alcance del MVP

> Documentos 1 y 2 del Prompt Maestro · Versión 1.1 · 26-sep-2026
> Fuentes: `PROMPT MAESTRO — Reconstruyendo Esperanza` + `Requerimientos_Plataforma_Calarca_v1.0.docx`

---

## 1. El problema que resuelve

Reconstruyendo Esperanza hace trabajo social en Calarcá (Quindío) y sus alrededores, liderado por la abogada **Angélica María Díaz**. Hoy ese trabajo vive disperso (fotos en celulares, publicaciones sueltas en redes, conversaciones de WhatsApp). Consecuencias:

- La comunidad no tiene un lugar único y confiable para ver **qué se ha hecho, dónde y con qué resultados**.
- Las redes sociales "entierran" el contenido: una jornada de hace 6 meses es prácticamente imposible de encontrar.
- No hay trazabilidad interna (quién hizo qué, qué compromisos quedaron pendientes).

**La plataforma será la memoria digital del trabajo social**: pública hacia la comunidad y ordenada hacia adentro.

## 2. Reconciliación de los dos documentos

Los dos documentos de partida **no describen el mismo producto**, y es importante verlo antes de escribir código:

| | Prompt Maestro | Documento v1.0 (.docx) |
|---|---|---|
| Qué es | Sitio informativo + blog + CMS | Sistema de gestión social y territorial |
| Usuarios internos | 1 rol (Administrador), luego Editor/Autor | 6 roles (Admin, Coordinador, Gestor territorial, Comunicaciones, Voluntario, Consulta) |
| Datos personales | Casi ninguno (solo mensajes de contacto) | Personas, consentimientos, participantes, necesidades |
| Complejidad | Media | Alta |

**Decisión propuesta:** no son dos proyectos, son **dos etapas del mismo producto**, construidas sobre la misma base técnica:

- **Etapa A — Portal público + CMS (MVP).** Lo que pide el Prompt Maestro. Es lo que la comunidad ve y lo que da resultados visibles rápido.
- **Etapa B — Gestión social interna.** Lo que pide el .docx (personas, territorio, bitácora, necesidades, tareas, reportes).
- **Etapa C — IA asistiva.** Resúmenes, redacción asistida de publicaciones, búsqueda. Con los controles del .docx (RB-007, RNF-027).
- **Etapa D — Uso electoral eventual.** Solo tras revisión jurídica (ver `09-privacidad-y-marco-legal.md`). Recomendación fuerte: **producto y datos separados**.

¿Por qué así? Porque la Etapa A no maneja datos personales sensibles, se puede lanzar rápido y segura, y **deja lista la arquitectura** (roles/permisos, auditoría, borrado lógico, RLS) que la Etapa B necesita. Así no se reescribe nada.

## 3. Objetivos medibles de la Etapa A

1. Que una búsqueda en Google de *"Reconstruyendo Esperanza Calarcá"* muestre el sitio en la primera posición.
2. Que un administrador pueda publicar una actividad con fotos **desde el celular en menos de 10 minutos**.
3. Que el sitio cargue rápido en datos móviles (objetivo: LCP < 2,5 s en 4G, Lighthouse ≥ 90 en las 4 categorías).
4. Costo recurrente de infraestructura: **US$0/mes** (solo el dominio, ≈ US$10–12/año).
5. Cero datos personales de beneficiarios publicados sin autorización registrada.

## 4. Alcance del MVP (Etapa A)

### Dentro del alcance

**Portal público**
- Inicio, Quiénes somos, Actividades (realizadas + próximas), Historias/Blog, Proyectos, Galería, Videos, Contacto, Apóyanos.
- Página "Memoria" (línea de tiempo de todo lo realizado, por año) — refuerza el concepto de memoria digital.
- Páginas legales: Política de tratamiento de datos, Aviso de privacidad.
- SEO completo, Open Graph para WhatsApp/Facebook, sitemap, datos estructurados.
- Botón flotante de WhatsApp y botones de compartir.

**Panel `/admin`**
- Inicio de sesión con contraseña + **segundo factor (MFA) obligatorio**. Sin registro público: solo por invitación.
- Dashboard con conteos reales y publicaciones recientes.
- CRUD de: publicaciones, actividades, proyectos, galerías, videos (por URL), categorías/etiquetas, testimonios, equipo, usuarios.
- Estados de publicación: borrador → revisión → programado → publicado → archivado.
- Biblioteca de medios con optimización automática y **registro de autorización de imagen**.
- Configuración del sitio (contacto, redes, textos institucionales).
- Bandeja de mensajes de contacto.
- Registro de auditoría (quién cambió qué y cuándo).

### Fuera del alcance de la Etapa A (va a Etapa B o posterior)

- Registro de personas/beneficiarios, participantes y consentimientos de tratamiento de datos generales.
- Gestión territorial detallada (barrios, veredas, sectores con jerarquía).
- Bitácora interna, necesidades, compromisos, tareas, documentos internos, reportes exportables.
- Roles distintos a Administrador/Editor/Autor.
- Comentarios públicos (generan moderación y spam; se recomienda no tenerlos).
- Donaciones en línea con pasarela de pago (en la Etapa A "Apóyanos" muestra cómo ayudar y datos de contacto; una pasarela implica obligaciones contables y de plataforma).
- PWA instalable y notificaciones.
- Funciones de IA.

## 5. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Publicar fotos de menores o personas sin autorización | Alto (legal y reputacional) | Registro de autorización obligatorio por foto con personas; bloqueo de publicación si falta |
| Fotos con ubicación GPS en metadatos (revelan dónde vive alguien) | Alto | Re-codificación de todas las imágenes: se eliminan EXIF/GPS automáticamente |
| Acceso no autorizado al panel | Alto | MFA obligatorio, sin registro público, RLS en base de datos, rate limiting, auditoría |
| Confusión entre labor social y propaganda electoral | Alto | Separación funcional y de datos; revisión jurídica antes de la Etapa D |
| Supabase gratis se pausa tras 7 días sin actividad | Medio | Backup nocturno automático (que además mantiene el proyecto activo) + monitor de disponibilidad |
| Límites del plan gratuito (egress de imágenes) | Medio | Imágenes públicas en Cloudflare R2 (egress gratis) y optimizadas en la subida |
| Inventar contenido (historia, cifras, testimonios) | Alto | Regla explícita en `CLAUDE.md`; contenido de ejemplo marcado como `[PENDIENTE]` |
| Proyecto construido por una sola persona en tiempo parcial | Medio | Fases pequeñas, documentación, código simple y estándar |

## 6. Información pendiente del cliente (no se inventa)

Estas respuestas son necesarias antes de la Fase 3 (UX/UI) o de construir las páginas correspondientes:

**Identidad**
1. ¿Existe logo? ¿Colores o tipografías ya usados en redes?
2. ¿La iniciativa está constituida legalmente (ESAL/fundación con NIT) o es un grupo informal? (Afecta: política de datos, cuentas bancarias para donaciones, acceso a Google for Nonprofits.)
3. Historia de la iniciativa: fecha de inicio, cómo nació.
4. Misión, visión y valores (si no existen, podemos redactar un borrador para que ella lo apruebe).

**Angélica María Díaz**
5. Biografía autorizada, foto oficial y qué datos quiere hacer públicos.

**Equipo**
6. Integrantes que aparecerán, cargo/función, foto y autorización de cada uno.

**Contenido real**
7. Lista de actividades realizadas (fecha, lugar, descripción, fotos disponibles).
8. Proyectos actuales y su estado.
9. Canales: WhatsApp oficial, Facebook, Instagram, YouTube, TikTok, correo.
10. Formas de apoyo aceptadas (voluntariado, donaciones en especie, dinero — y a qué cuenta).

**Dominio**
11. Nombre de dominio preferido (ver opciones en `03-stack-tecnologico.md`).

**Fotos existentes**
12. ¿Las fotos ya tomadas tienen autorización de las personas que aparecen? ¿Hay menores?
