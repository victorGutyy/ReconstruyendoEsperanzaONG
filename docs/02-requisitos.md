# 02 · Requisitos de la Etapa A (Portal público + CMS)

> Versión 0.1 (borrador para aprobación) · 26-sep-2026
> Fuentes: `01-vision-y-alcance.md` · `CLAUDE.md` · `fuentes/Requerimientos_Plataforma_Calarca_v1.0.docx`

Este documento dice **qué** debe hacer la plataforma en la Etapa A, no **cómo** (eso va en `04-arquitectura.md` y `06-modelo-datos.md`).

---

## 1. Convenciones

- **RF-A-xx**: requisito funcional de la Etapa A. **RNF-A-xx**: no funcional. **HU-xx**: historia de usuario.
- La columna **Origen** conecta cada requisito con el documento del cliente (`RF-0xx`/`RNF-0xx` del .docx) o con el Prompt Maestro (`PM`). Así se ve qué pidió el cliente y qué se añadió.
- **Prioridad**: **M** = obligatorio para lanzar (Must) · **S** = importante, puede llegar en una versión 1.x (Should) · **C** = deseable (Could).

## 2. Actores y roles

| Actor | Descripción | Qué puede hacer |
|---|---|---|
| **Visitante** | Cualquier persona de la comunidad | Ver solo contenido **publicado**; enviar mensaje de contacto |
| **Autor** | Crea contenido | Crear y editar **sus propios** borradores; enviarlos a revisión; subir medios |
| **Editor** | Revisa y publica | Todo lo del Autor sobre **cualquier** contenido; aprobar, programar, publicar, archivar; leer mensajes de contacto |
| **Administrador** | Responsable de la plataforma | Todo lo del Editor + usuarios, configuración del sitio, auditoría, papelera |

> **Propuesta a validar:** con un equipo pequeño es probable que al inicio solo exista el rol Administrador (Angélica y/o Victor). El sistema igual se construye con permisos por acción (`modulo.accion`) para que agregar los otros roles no requiera reescribir nada — y para que en la Etapa B se sumen los 6 roles del .docx.

### Matriz de permisos (resumen)

| Permiso | Autor | Editor | Admin |
|---|:-:|:-:|:-:|
| `content.create` / `content.update_own` | ✅ | ✅ | ✅ |
| `content.update_any` | | ✅ | ✅ |
| `content.publish` (publicar, programar, archivar) | | ✅ | ✅ |
| `media.upload` | ✅ | ✅ | ✅ |
| `consent.manage` (autorizaciones de imagen) | | ✅ | ✅ |
| `messages.read` | | ✅ | ✅ |
| `users.manage` · `settings.manage` · `audit.read` · `trash.restore` | | | ✅ |

## 3. Requisitos funcionales — Portal público

| ID | Requisito | Prio | Origen |
|---|---|:-:|---|
| RF-A-01 | **Inicio** con portada editorial: historia destacada, últimas actividades, próximas actividades, proyectos y llamado a apoyar | M | PM, RF-001 |
| RF-A-02 | **Quiénes somos**: historia, misión/visión/valores, perfil de Angélica María Díaz y equipo (solo textos y fotos aprobados) | M | PM |
| RF-A-03 | **Actividades**: listado de realizadas y próximas, filtrable por año, categoría y lugar general; detalle con fecha, lugar general, descripción, galería y resultados | M | RF-001, RF-004, RF-013 |
| RF-A-04 | **Historias/Blog**: listado paginado y detalle con autor, fecha, categoría, etiquetas y relacionados | M | PM, RF-003 |
| RF-A-05 | **Proyectos**: listado y detalle con objetivo, estado, fechas y actividades relacionadas | M | RF-005 |
| RF-A-06 | **Galería** de álbumes con visor de imágenes accesible (teclado, texto alternativo) | M | PM, RF-021 |
| RF-A-07 | **Videos** embebidos solo desde proveedores permitidos (YouTube, Facebook, TikTok, Vimeo), a partir de su URL | S | PM |
| RF-A-08 | **Memoria**: línea de tiempo por año con todo lo publicado (actividades, proyectos, historias) | M | PM |
| RF-A-09 | **Contacto**: formulario (nombre, correo o teléfono, mensaje, aceptación de política de datos) con protección antispam; datos de contacto y redes | M | PM |
| RF-A-10 | **Apóyanos**: formas de ayudar (voluntariado, donaciones en especie, etc.) según lo que defina la organización. **Sin pasarela de pago** | M | PM |
| RF-A-11 | **Páginas legales**: Política de tratamiento de datos y Aviso de privacidad | M | RNF-002 |
| RF-A-12 | **Búsqueda** de contenido publicado por texto | S | RF-022 |
| RF-A-13 | **Compartir** en WhatsApp/Facebook/X/copiar enlace + botón flotante de WhatsApp | M | PM |
| RF-A-14 | **SEO**: metadatos por página, Open Graph con imagen, `sitemap.xml`, `robots.txt`, datos estructurados (Organization, Article, Event) | M | PM |
| RF-A-15 | Solo se muestra contenido en estado **publicado** y con fecha de publicación ≤ ahora | M | RF-032, criterio de aceptación del .docx |
| RF-A-16 | Páginas de error 404/500 amigables, con enlaces útiles | M | PM |

## 4. Requisitos funcionales — Panel `/admin`

| ID | Requisito | Prio | Origen |
|---|---|:-:|---|
| RF-A-20 | **Inicio de sesión** con correo + contraseña + **MFA TOTP obligatorio** (app autenticadora). Sin registro público | M | RF-006, PM |
| RF-A-21 | **Recuperación de contraseña** por correo; recuperación de MFA solo por un Administrador | M | RF-007 |
| RF-A-22 | **Usuarios por invitación**: crear, asignar rol, desactivar, reactivar (nunca borrar: se conserva la trazabilidad) | M | RF-008, RF-009 |
| RF-A-23 | **Dashboard** con conteos reales (publicados, borradores, en revisión, mensajes sin leer) y actividad reciente | M | RF-023 |
| RF-A-24 | **CRUD de contenido**: historias, actividades, proyectos, galerías, videos, testimonios, equipo, categorías y etiquetas | M | RF-003 a RF-005, RF-018 |
| RF-A-25 | **Flujo editorial**: `borrador → revisión → programado → publicado → archivado`, con reglas de quién mueve cada estado | M | RF-032 |
| RF-A-26 | **Programación**: el contenido programado se publica solo en la fecha/hora indicada (zona America/Bogota) | M | RF-003 |
| RF-A-27 | **Editor enriquecido** (títulos, listas, citas, enlaces, imágenes, embeds permitidos), guardado como JSON, con vista previa | M | PM |
| RF-A-28 | **Biblioteca de medios**: subir desde el celular, optimización automática, eliminación de metadatos EXIF/GPS, texto alternativo obligatorio | M | RF-021, PM |
| RF-A-29 | **Autorización de imagen**: una foto marcada "con personas identificables" no se puede publicar sin autorización registrada; con menores, del representante legal | M | RF-011, PM |
| RF-A-30 | **Configuración del sitio**: datos de contacto, redes, WhatsApp, textos institucionales, SEO por defecto | M | RF-029 |
| RF-A-31 | **Bandeja de mensajes** de contacto: leer, marcar como atendido, archivar | M | PM |
| RF-A-32 | **Auditoría**: registro de quién creó/modificó/publicó/borró qué y cuándo, con valores antes/después; consulta con filtros | M | RF-026, RF-033 |
| RF-A-33 | **Borrado lógico y papelera**: lo eliminado se puede restaurar; la purga definitiva la hace solo un Administrador | M | RF-027 |
| RF-A-34 | **Historial de versiones** del contenido con opción de restaurar una versión anterior | C | RF-033 |

## 5. Requisitos no funcionales

| ID | Categoría | Requisito medible | Origen |
|---|---|---|---|
| RNF-A-01 | Rendimiento | LCP < 2,5 s en 4G; Lighthouse ≥ 90 en las 4 categorías en Inicio, listado y detalle | RNF-007, PM |
| RNF-A-02 | Responsive | Diseño mobile-first probado en 360 px, 768 px y 1280 px | RNF-012 |
| RNF-A-03 | Usabilidad | Un Administrador publica una actividad con 10 fotos **desde el celular en < 10 min** | 01 §3 |
| RNF-A-04 | Accesibilidad | WCAG 2.2 AA: contraste, teclado, foco visible, etiquetas, `alt`, `prefers-reduced-motion` | RNF-013 |
| RNF-A-05 | Seguridad | Controles de `05-seguridad.md`: RLS en todas las tablas, permisos verificados en servidor, MFA, rate limiting, cabeceras de seguridad | RNF-001, RNF-004 |
| RNF-A-06 | Privacidad | Cero datos personales de beneficiarios publicados sin autorización; sin direcciones; minimización | RNF-002, RNF-017, RNF-018 |
| RNF-A-07 | Costo | US$0/mes en infraestructura (solo el dominio anual) | RNF-024 |
| RNF-A-08 | Respaldo | Backup diario automático de BD y medios; restauración probada antes de producción | RNF-015, RNF-028 |
| RNF-A-09 | Portabilidad | PostgreSQL estándar y exportación de todo el contenido en formato estructurado | RNF-019, RNF-025 |
| RNF-A-10 | Mantenibilidad | TypeScript estricto, módulos por dominio, lint + pruebas en CI en cada PR | RNF-009, RNF-022 |
| RNF-A-11 | Pruebas | Unitarias (Vitest), E2E de flujos críticos (Playwright), políticas RLS (pgTAP) | RNF-010 |
| RNF-A-12 | Observabilidad | Errores registrados sin datos personales; monitor de disponibilidad | RNF-020 |
| RNF-A-13 | Compatibilidad | Últimas 2 versiones de Chrome, Safari (iOS), Firefox y Edge; Android 10+ | RNF-014 |
| RNF-A-14 | Localización | Español (Colombia); fechas `dd/mm/aaaa` y zona America/Bogota | PM |

## 6. Historias de usuario y criterios de aceptación

Formato: *Como … quiero … para …* + criterios **Dado / Cuando / Entonces**.

**HU-01 · Conocer lo que se ha hecho** (RF-A-03, RF-A-08)
Como vecino de Calarcá quiero ver las actividades realizadas por año para saber qué ha hecho la iniciativa.
- Dado que existen actividades publicadas de varios años, cuando entro a **Memoria**, entonces las veo agrupadas por año, de la más reciente a la más antigua.
- Dado que una actividad está en borrador o archivada, entonces **no** aparece en ninguna página pública ni en el sitemap.

**HU-02 · Compartir por WhatsApp** (RF-A-13, RF-A-14)
Como seguidora quiero compartir una actividad por WhatsApp para invitar a otras personas.
- Cuando pego el enlace en WhatsApp, entonces se muestran título, descripción e imagen de la actividad.

**HU-03 · Escribir a la organización** (RF-A-09)
Como ciudadano quiero enviar un mensaje para ofrecer ayuda o pedir información.
- Dado que no acepto la política de datos, entonces no puedo enviar el formulario.
- Dado que envío más de 5 mensajes en 10 minutos, entonces el sistema me pide esperar.
- Cuando envío un mensaje válido, entonces veo una confirmación y el mensaje aparece en la bandeja del panel.

**HU-04 · Entrar al panel de forma segura** (RF-A-20)
Como Administradora quiero iniciar sesión con contraseña y código de mi celular para que nadie más entre con mi cuenta.
- Dado que ingreso la contraseña correcta pero no el código TOTP, entonces no accedo a ninguna página de `/admin` ni a ningún dato privado.
- Dado que fallo 5 intentos seguidos, entonces se bloquean temporalmente los intentos desde esa cuenta/IP.

**HU-05 · Publicar una actividad desde el celular** (RF-A-24, RF-A-25, RF-A-28, RNF-A-03)
Como Administradora quiero registrar una jornada con fotos desde el celular para publicarla el mismo día.
- Cuando subo fotos tomadas con el celular, entonces se guardan optimizadas y **sin coordenadas GPS**.
- Dado que no escribo el texto alternativo de una foto, entonces no puedo publicar.
- Cuando publico, entonces la actividad aparece en Inicio, Actividades y Memoria.

**HU-06 · Proteger la imagen de las personas** (RF-A-29)
Como Editor quiero que el sistema me impida publicar fotos de personas sin autorización para evitar problemas legales.
- Dado que una foto está marcada "con personas identificables" y no tiene autorización registrada, cuando intento publicar el contenido que la usa, entonces el sistema lo bloquea e indica qué foto falta.
- Dado que la foto está marcada "con menores", entonces la autorización debe ser del representante legal.

**HU-07 · Flujo de revisión** (RF-A-25)
Como Autor quiero enviar mi historia a revisión para que un Editor la apruebe.
- Dado que soy Autor, entonces no veo el botón "Publicar" y el servidor rechaza la acción si la intento directamente.
- Cuando el Editor publica, entonces queda registrado en auditoría quién y cuándo.

**HU-08 · Programar una publicación** (RF-A-26)
Como Editor quiero programar un anuncio para una fecha futura.
- Dado que programo para el 01/12 a las 8:00 a. m. (hora Colombia), entonces el contenido no es visible antes y sí lo es después de esa hora.

**HU-09 · Recuperar algo borrado** (RF-A-33)
Como Administrador quiero restaurar un contenido eliminado por error.
- Cuando elimino una historia, entonces desaparece del sitio pero aparece en la papelera y en auditoría.
- Cuando la restauro, entonces vuelve a su estado anterior.

**HU-10 · Saber quién cambió qué** (RF-A-32)
Como Administrador quiero ver el historial de cambios para tener trazabilidad.
- Cuando filtro la auditoría por usuario o por fecha, entonces veo acción, contenido afectado, fecha/hora y cambios realizados.

**HU-11 · Actualizar datos del sitio sin programador** (RF-A-30)
Como Administradora quiero cambiar el número de WhatsApp y las redes sociales desde el panel.
- Cuando guardo la configuración, entonces el cambio se refleja en el sitio público sin un nuevo despliegue.

## 7. Reglas de negocio de la Etapa A

| ID | Regla | Origen |
|---|---|---|
| RN-A-01 | El contenido público está separado de cualquier registro interno | RB-008 |
| RN-A-02 | Toda actividad publicada tiene fecha, lugar general y categoría | RB-001 |
| RN-A-03 | Nunca se publican direcciones de residencia ni datos de contacto de beneficiarios | 01, RB-004 |
| RN-A-04 | Toda imagen con personas identificables requiere autorización registrada antes de publicarse | RB-004, RB-005 |
| RN-A-05 | Toda evidencia (foto/video) queda asociada a un contenido: actividad, proyecto, historia o galería | RB-009 |
| RN-A-06 | Las acciones administrativas críticas quedan en auditoría | RB-012 |
| RN-A-07 | Un usuario solo ejecuta acciones para las que tiene permiso, verificado en el servidor | RB-002 |
| RN-A-08 | El sitio no tiene contenido ni funciones electorales | 01, `09-privacidad…` |

## 8. Fuera de alcance de la Etapa A

Ver `01-vision-y-alcance.md` §4. Resumen: personas/beneficiarios, territorio jerárquico, bitácora interna, necesidades, tareas, reportes exportables, comentarios públicos, pasarela de pagos, PWA, IA y cualquier función electoral.

## 9. Preguntas abiertas que afectan estos requisitos

1. ¿Qué roles se usarán al lanzar? (¿solo Administrador?)
2. ¿Qué categorías de actividades existen? (p. ej. salud, educación, jornadas…) — **no se inventan**, se definen con la organización.
3. ¿Qué formas de apoyo se aceptan y qué datos se muestran en "Apóyanos"?
4. ¿Se publicarán testimonios? Si sí, cada uno requiere autorización de la persona.
5. ¿Qué redes sociales oficiales existen (para videos y botones)?
