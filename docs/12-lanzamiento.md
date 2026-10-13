# 12 · Guion del lanzamiento

> Paso 10.5 · El orden exacto para poner el sitio en producción, quién hace cada cosa y cómo se comprueba. Se sigue de arriba abajo; no se salta un paso sin cerrar el anterior. Al terminar, la lista de `08` §5 queda completa.
>
> **Quién:** **O** = la organización (dueña de las cuentas: Owner de Supabase, dominio, tarjeta) · **V** = Victor · **C** = Claude (código, migraciones y verificaciones, siempre con aprobación de Victor).
>
> **Regla de secretos:** ninguna clave se pega en chats, correos ni capturas. Se copian del servicio que la genera al gestor de contraseñas y de ahí a Vercel o GitHub.

---

## 0. Antes de empezar (decisiones)

| # | Qué | Quién | Listo cuando… |
|---|---|---|---|
| 0.1 | Respuesta de Vercel sobre el plan Hobby (`03` §5): Hobby, Cloudflare Workers o Vercel Pro | V | Decisión anotada en `03` §5 |
| 0.2 | Nombre del dominio (ver §1) | O | Elegido y disponible |
| 0.3 | Políticas de datos y aviso de privacidad **aprobados por el abogado** | O | Texto final entregado |
| 0.4 | Textos institucionales (Quiénes somos, Apóyanos, descripción para Google) aprobados | O | Texto final entregado |
| 0.5 | Respaldos (9.4) funcionando en staging, con restauración probada | V + C | Paso 9.4 integrado |
| 0.6 | Prueba manual de accesibilidad hecha (`10-prueba-accesibilidad.md`) | V | Marcada con fecha |

## 1. Comprar el dominio (O)

**Elegir el nombre:**
- Corto, igual al nombre de la organización, **sin guiones** y fácil de dictar por teléfono (por ejemplo, `reconstruyendoesperanza` + extensión — [PENDIENTE: verificar disponibilidad]).
- Extensión: **`.org`** (reconocible para organizaciones, se compra en Cloudflare) o una colombiana (**`.org.co`**, **`.co`**), que se compra en un registrador acreditado por .CO Internet. Precios y requisitos los confirma quien compra, en la página del registrador.

**Comprarlo:**
1. A **nombre de la organización**, con un **correo de la organización** (no personal) como contacto del titular.
2. **Renovación automática** activada y un medio de pago de la organización.
3. Acceso a la cuenta del registrador para **al menos dos personas** de la organización, con MFA.
4. Anotar en el **plan de incidentes** (carpeta privada) dónde está la cuenta del registrador.

**Pasar los DNS a Cloudflare** (si no se compró ahí):
1. Cloudflare → **Add a site** → escribir el dominio → plan **Free**.
2. Cloudflare muestra **dos nameservers**; en el registrador, reemplazar los nameservers por esos dos.
3. Esperar a que Cloudflare diga **Active** (de minutos a 24 horas).

✅ **Comprobación:** Cloudflare muestra el dominio como *Active*.

## 2. Supabase de producción

| # | Qué | Quién |
|---|---|---|
| 2.1 | En la organización *Reconstruyendo Esperanza* de Supabase: **New project** `reconstruyendo-esperanza-prod`, región en un país que la SIC reconozca con nivel adecuado de protección (`09` §7, verificar la lista vigente), contraseña de la base generada y guardada en el gestor | O (Owner) |
| 2.2 | Confirmar que la organización tiene **≥ 2 Owners** con MFA | O |
| 2.3 | *Settings → API*: **Data API** activada, **"Automatically expose new tables" desactivado**, RLS automático activado (igual que staging, `04` §8.1) | O |
| 2.4 | Aplicar las **migraciones** del repositorio, en orden, con aprobación de Victor; luego `list_migrations` igual al repositorio y `get_advisors` revisado | C (con OK de V) |
| 2.5 | *Authentication*: **Allow new users to sign up = off**; proveedor Email activado; contraseña mínima 12; MFA TOTP activado | O |
| 2.6 | *Authentication → URL Configuration*: **Site URL** `https://<dominio>/admin/auth/confirm` · **Redirect URLs** `https://<dominio>/**` (sin los de Vercel de pruebas) | O |
| 2.7 | *Authentication → Emails*: plantillas de invitación y recuperación de `supabase/templates/` (igual que staging) | O |

✅ **Comprobación:** las migraciones de producción coinciden con las del repositorio; el asesor de seguridad solo muestra lo ya conocido (`05` §15).

## 3. Correo desde el dominio (Resend)

1. **O:** crear la cuenta de Resend con el correo de la organización (MFA activado).
2. **O:** *Domains → Add domain* → `<dominio>` (o un subdominio como `correo.<dominio>`).
3. **O + V:** copiar los registros que muestra Resend (**SPF**, **DKIM**, y agregar **DMARC**) en **Cloudflare → DNS**. Esperar a que Resend diga *Verified*.
4. **O:** en Supabase producción, *Authentication → Emails → SMTP Settings*: servidor y usuario de Resend, la **API key** de Resend como contraseña (se genera en Resend → *API Keys* y se pega directamente ahí), remitente `no-responder@<dominio>` con el nombre de la organización.

✅ **Comprobación:** Supabase envía un correo de prueba (por ejemplo, la invitación del paso 6) y llega a la bandeja de entrada, no a spam.

## 4. Turnstile y el límite de intentos

1. **O/V:** Cloudflare → **Turnstile** → crear un widget **de producción** para `<dominio>` (no reutilizar el de staging). Guardar *Site key* y *Secret key* en el gestor.
2. **O/V:** **Upstash** → crear una base Redis **de producción** (separada de la de staging). Guardar la URL REST y el token.

## 5. Vercel: dominio y variables de producción

**Dominio:**
1. **V:** Vercel → proyecto → *Settings → Domains* → agregar `<dominio>` (y `www.<dominio>` redirigiendo al principal).
2. **V:** en Cloudflare → DNS, crear los registros que pide Vercel. Esperar a que Vercel muestre el dominio **Valid** con certificado.
3. **V:** *Settings → Deployment Protection*: confirmar que **el dominio de producción es público** y que las direcciones de vista previa siguen protegidas (`04` §8.1).

**Variables (ambiente *Production*, tipo *Secret* salvo las públicas):**

| Variable | De dónde sale | ¿Pública? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<dominio>` | Sí |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase prod → *Settings → API* | Sí |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase prod → *API Keys* (publishable) | Sí |
| `SUPABASE_SECRET_KEY` | Supabase prod → *API Keys* (secret) | **No** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile de producción | Sí |
| `TURNSTILE_SECRET_KEY` | Turnstile de producción | **No** |
| `CONTACT_IP_HASH_SECRET` | 32+ caracteres aleatorios nuevos (gestor de contraseñas) | **No** |
| `CRON_SECRET` | 32+ caracteres aleatorios nuevos | **No** |
| `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` | Upstash de producción | **No** |

- Todas **nuevas para producción**: nunca copiadas de staging (`08` §5).
- **Nunca** `RATE_LIMIT_DRIVER` en Vercel (sin Upstash el sitio falla cerrado, como debe).

## 6. Primer Administrador de producción (una sola vez)

Igual que en staging (`04` §8.1, "Primer Administrador"):
1. **O (Owner):** *Authentication → Users → Add user → Create new user* con *Auto Confirm User*; la persona escribe su propia contraseña.
2. **C prepara, V aprueba, la persona corre** en el *SQL Editor* el SQL que le da el rol de Administrador.
3. La persona entra en `https://<dominio>/admin/login` y registra su app autenticadora.
4. Desde **Usuarios** invita al **segundo Administrador** (meta: ≥ 2 con MFA) y al resto del equipo.

## 7. Respaldos de producción (9.4)

1. **V:** en GitHub, los secretos del respaldo apuntando a la base **de producción** (además de los de R2).
2. **C:** correr el respaldo una vez a mano y **restaurarlo** en local para comprobarlo.

✅ **Comprobación:** hay un respaldo cifrado de producción en el bucket privado de R2 y la restauración funcionó.

## 8. Contenido antes de abrir

El sitio de producción **arranca vacío** (sin datos `[DEMO]`).

| # | Qué | Quién |
|---|---|---|
| 8.1 | Configuración: nombre, contacto, WhatsApp, redes, descripción para Google | O (Administrador) |
| 8.2 | Publicar **Política de tratamiento de datos** y **Aviso de privacidad** aprobados (sin esto el formulario de contacto no se abre) | O |
| 8.3 | Quiénes somos y Apóyanos con su texto aprobado | O |
| 8.4 | Al menos una actividad real, con fotos **autorizadas** (manual `11` §4) | O |

## 9. Publicar (V con OK explícito)

1. **C:** abrir el PR `develop → main` con el resumen de todo lo que sale. CI en verde.
2. **V:** OK explícito → se integra a `main` → Vercel despliega producción.

## 10. Verificación final

| # | Qué | Cómo | Quién |
|---|---|---|---|
| 10.1 | Nada de marcadores ni configuración faltante | `npm run check:launch -- https://<dominio>` en verde | C |
| 10.2 | Prueba de humo | `SMOKE_URL=https://<dominio> npm run test:smoke` en verde | C |
| 10.3 | Rendimiento | Lighthouse ≥ 90 en Inicio, Actividades y un detalle (celular) | C |
| 10.4 | Cabeceras | securityheaders.com: nota **A** o mejor | C |
| 10.5 | Vista previa al compartir | Pegar el enlace de una actividad en WhatsApp; Facebook *Sharing Debugger* | V |
| 10.6 | Correos | Recuperar contraseña de prueba con una cuenta real del equipo | V |
| 10.7 | Monitor | UptimeRobot: monitor HTTP a `https://<dominio>/api/health` cada 5 min, alertas al correo de 2 personas | V |
| 10.8 | Google | Search Console: verificar el dominio (registro TXT en Cloudflare) y **enviar** `https://<dominio>/sitemap.xml` | O/V |
| 10.9 | Opcional | Perfil de Empresa de Google si hay sede o punto de atención (`07` §9) | O |

## 11. Después del lanzamiento

- **Capacitación:** sesión con el equipo usando el manual (`11`); cada persona publica una actividad de prueba en staging y una real en producción. **Criterio de cierre de la F10:** la organización publica sola una actividad (`08`).
- Enlace del sitio en las biografías de todas las redes oficiales.
- Primera semana: revisar a diario el monitor y los mensajes de contacto.
- Primer mes: la revisión mensual del manual (`11` §9).
