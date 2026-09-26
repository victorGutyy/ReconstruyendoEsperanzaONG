# 09 · Privacidad y marco legal

> Versión 0.1 (borrador técnico para aprobación) · 26-sep-2026
> Relacionado: `05-seguridad.md` · `06-modelo-datos.md` · `.docx` §10 y RNF-026

> ⚖️ **Aviso importante.** Este documento lo redactó el equipo técnico para **traducir la normativa en decisiones de diseño**. **No es asesoría legal.** Antes de lanzar, un abogado con experiencia en protección de datos (y en normativa electoral, si aplica) debe revisar este documento, la política de tratamiento, el aviso de privacidad y los formatos de autorización. Las referencias normativas deben verificarse en su versión vigente.

---

## 1. Marco normativo aplicable (resumen)

| Norma | Qué exige y por qué nos importa |
|---|---|
| **Constitución Política, art. 15** | Derecho a la intimidad, al buen nombre y *habeas data* (conocer, actualizar y rectificar la información personal) |
| **Ley 1581 de 2012** | Régimen general de protección de datos personales: principios, autorización, derechos de los titulares, deberes del responsable, datos sensibles y de menores |
| **Decreto 1377 de 2013** (compilado en el **Decreto 1074 de 2015**) | Reglamenta la ley: contenido de la política de tratamiento, aviso de privacidad, autorización, datos de niños, niñas y adolescentes, transmisiones |
| **Ley 1098 de 2006** (Código de la Infancia y la Adolescencia) | Prevalencia del interés superior del menor y protección de su intimidad e imagen |
| Jurisprudencia de la Corte Constitucional | Derecho a la **propia imagen**: el uso de la imagen de una persona requiere su consentimiento |
| **Normativa electoral** (Ley 130 de 1994, Ley 1475 de 2011 y demás) | Reglas sobre propaganda electoral y sus tiempos. Relevante porque la plataforma **no debe** convertirse en propaganda (ver §9) |
| Instrucciones de la **SIC** (Superintendencia de Industria y Comercio) | Autoridad de protección de datos: vigila, sanciona, define países con nivel adecuado para transferencias y el Registro Nacional de Bases de Datos |

### Principios de la Ley 1581 y cómo se aplican aquí

| Principio | En la plataforma |
|---|---|
| **Legalidad** | Tratamiento solo según esta ley y la política publicada |
| **Finalidad** | Cada dato tiene una finalidad escrita (§3). **Datos del trabajo social nunca se usan para fines electorales** |
| **Libertad** | Autorización previa, expresa e informada (formulario de contacto, formatos de imagen) |
| **Veracidad** | Los titulares pueden pedir corrección; el panel permite editar |
| **Transparencia** | Política de tratamiento y aviso de privacidad visibles; el titular puede saber qué datos suyos hay |
| **Acceso y circulación restringida** | Solo roles con permiso ven datos personales (RLS, `05` §5) |
| **Seguridad** | Medidas técnicas del `05-seguridad.md` |
| **Confidencialidad** | Quienes usan el panel se comprometen a reserva (acuerdo de confidencialidad, §10) |

## 2. ¿Quién es el responsable del tratamiento?

⚠️ **Pendiente del cliente (pregunta 2 del `01`).**

| Situación | Responsable | Consecuencia |
|---|---|---|
| La iniciativa es una **ESAL/fundación con NIT** | La entidad | Documentos a nombre de la entidad; cuentas y dominio a su nombre |
| Es un **grupo informal** | Una **persona natural** (probablemente Angélica María Díaz) asume como responsable | Implica obligaciones a título personal y mezcla su nombre con el tratamiento de datos. Conviene evaluar con el abogado constituir una entidad |

Los proveedores tecnológicos (Supabase, Vercel/Cloudflare, Resend, Upstash) actúan como **encargados** del tratamiento: procesan datos por cuenta del responsable.

## 3. Inventario de datos personales (Etapa A)

| Base de datos | Titulares | Datos | Finalidad | Base | Conservación propuesta | Quién accede |
|---|---|---|---|---|---|---|
| **Usuarios del panel** | Equipo de la organización | Nombre, correo, factor MFA, registros de acceso | Administrar el sitio de forma segura | Relación con la organización + autorización | Mientras sea usuario activo + 2 años (trazabilidad) | Administradores |
| **Mensajes de contacto** | Ciudadanos que escriben | Nombre, correo y/o teléfono, mensaje, versión de política aceptada, IP cifrada (HMAC) | Responder la solicitud | Autorización en el formulario | **12 meses** después de atendido; luego se elimina | Editores y Administradores |
| **Autorizaciones de imagen** | Personas en fotos (y representantes de menores) | Nombre, si es menor, firmante, fecha, alcance, documento firmado | Probar que hay permiso para publicar su imagen | Autorización escrita | Mientras la imagen esté publicada + **5 años** (prueba ante reclamos) | Editores y Administradores (`consent.manage`) |
| **Fotografías con personas** | Personas que aparecen | Imagen (dato personal; puede ser sensible según el contexto) | Mostrar el trabajo social | Autorización de imagen | Mientras esté publicada; al revocar se retira del sitio | Público (solo si está publicada y autorizada) |
| **Equipo y testimonios** | Integrantes y personas que dan testimonio | Nombre, cargo/contexto, foto, texto | Presentar a la organización | Autorización | Mientras esté publicado | Público |
| **Auditoría** | Usuarios del panel | Acciones realizadas, fecha, cambios | Seguridad y trazabilidad | Interés legítimo de seguridad / obligación de seguridad | **2 años** | Administradores |

**No se recogen en la Etapa A:** cédulas, direcciones, datos de salud, orientación política, afiliación a partidos, datos biométricos para identificación, ni datos de beneficiarios. (Etapa B requerirá su propio análisis antes de construir el módulo de personas — `.docx` §10.)

**Cookies:** la Etapa A usa solo cookies **técnicas** de sesión en el panel. Sin cookies de publicidad ni de analítica con seguimiento; si se mide tráfico, se usa analítica **sin cookies** (p. ej. Cloudflare Web Analytics). Por eso el sitio público no necesita banner de cookies; se informa en el aviso de privacidad.

## 4. Autorización de uso de imagen

### 4.1 Cuándo se requiere
- **Siempre** que una persona sea **identificable** en una foto o video que se va a publicar.
- **Con menores**: autorización del **representante legal** (padre, madre o tutor) y, según su edad y madurez, **escuchar la opinión del niño, niña o adolescente**. Si el menor no quiere aparecer, no se publica aunque el adulto firme.
- Personas **no identificables** (de espaldas, a lo lejos, desenfocadas) y fotos sin personas: no requieren autorización. Ante la duda, se trata como identificable.

### 4.2 Recomendaciones especiales con menores
- Preferir fotos **grupales o de espaldas**; evitar primeros planos.
- **Nunca** publicar nombre completo, colegio, barrio específico o cualquier dato que permita ubicar a un menor.
- No publicar imágenes de menores en situaciones que puedan afectar su dignidad (enfermedad, pobreza extrema, llanto).

### 4.3 Contenido mínimo del formato (borrador para el abogado)
1. Responsable del tratamiento y datos de contacto.
2. Nombre de la persona fotografiada; si es menor, nombre del representante y parentesco.
3. **Finalidad**: publicación en el sitio web y redes oficiales de la organización para mostrar su labor social. **Expresamente excluido**: uso electoral o publicitario de cualquier candidatura.
4. Alcance: actividad, fecha y tipo de material (fotos/videos).
5. Duración de la autorización.
6. Derechos del titular (conocer, actualizar, rectificar, **revocar**, presentar quejas ante la SIC) y cómo ejercerlos.
7. Carácter **voluntario**: negarse no afecta la participación en ninguna actividad ni el acceso a ninguna ayuda.
8. Espacio para la opinión del menor (si aplica).
9. Firma, fecha y versión del formato.

> El punto 7 es crítico: en contextos de ayuda social, la persona puede sentirse obligada a firmar para recibir apoyo. La autorización debe ser realmente libre.

### 4.4 Revocación
Cuando alguien revoca: se registra `revoked_at`, la imagen se **retira del sitio y de R2** de inmediato (`06` §6) y los contenidos afectados quedan marcados para revisión. Se conserva el registro de la revocación como prueba.

## 5. Derechos de los titulares y procedimiento

| Derecho (Ley 1581, art. 8) | Cómo se atiende |
|---|---|
| Conocer, actualizar y rectificar | Solicitud al canal oficial → el equipo consulta y corrige en el panel |
| Pedir prueba de la autorización | Se entrega copia del registro/formato |
| Ser informado del uso de sus datos | Respuesta escrita con finalidades y datos tratados |
| Revocar la autorización y/o pedir supresión | Procedimiento de §4.4; supresión salvo deber legal de conservar |
| Presentar quejas ante la SIC | Informado en la política; requisito previo: haber reclamado ante el responsable |
| Acceso gratuito | Sin costo |

**Plazos legales** (a confirmar con el abogado):
- **Consultas**: máximo **10 días hábiles** (prorrogable 5).
- **Reclamos** (corrección, supresión, revocación): máximo **15 días hábiles** (prorrogable 8).

**Canal oficial:** ⚠️ Pendiente — un correo dedicado (p. ej. `datos@dominio`) y un responsable designado dentro de la organización.

## 6. Documentos legales que publica el sitio

| Documento | Contenido mínimo (Decreto 1377/2013) | Dónde |
|---|---|---|
| **Política de tratamiento de datos** | Responsable (nombre, domicilio, contacto) · tratamientos y finalidades · derechos · área responsable de atender solicitudes · procedimiento de consultas y reclamos · fecha de vigencia y versión | `/legal/politica-de-datos` |
| **Aviso de privacidad** | Responsable · tratamiento y finalidad · derechos · dónde consultar la política completa | `/legal/aviso-de-privacidad` y resumido junto al formulario de contacto |

- Se guardan en la tabla `pages` con **versión**; el formulario de contacto registra qué versión aceptó cada persona (`06` §7).
- Los textos iniciales serán `[PENDIENTE: revisión legal]`. **No se lanza sin textos revisados.**

## 7. Transferencias y transmisiones internacionales

Los servidores de los proveedores están fuera de Colombia, así que los datos viajan al exterior. Medidas propuestas:
- Elegir regiones de proveedores en países que la SIC reconozca con **nivel adecuado de protección** (verificar la lista vigente de la SIC antes de crear los proyectos de Supabase y R2).
- Aceptar y archivar los **acuerdos de procesamiento de datos (DPA)** de cada proveedor, que funcionan como contrato de transmisión con el encargado.
- Informarlo en la política de tratamiento.

## 8. Registro Nacional de Bases de Datos (RNBD) e incidentes

- La inscripción en el RNBD de la SIC es obligatoria para algunas entidades según su naturaleza y el valor de sus activos. ⚠️ **El abogado debe determinar si aplica** según cómo esté constituida la organización.
- Si aplica, los **incidentes de seguridad** que afecten datos personales deben reportarse a la SIC en el plazo que fija la normativa (se integra en el plan de incidentes, `05` §14).
- En cualquier caso, ante un incidente se informa a los titulares afectados.

## 9. Separación de lo social y lo electoral

Esta es una **regla de diseño**, no solo una recomendación.

| Regla | Cómo se garantiza |
|---|---|
| La plataforma es de **labor social y no partidista** | Sin contenido ni funciones electorales: nada de "vota por", logos de partidos, candidaturas, cuentas regresivas electorales ni recolección de datos de simpatizantes |
| Los datos recogidos aquí **no se usan para fines electorales** | Principio de finalidad: las autorizaciones y la política lo dicen expresamente; no existe exportación de mensajes de contacto ni de autorizaciones |
| Ninguna función clasifica a las personas por su posible orientación política | RB-007 del `.docx`; aplica también a la IA de la Etapa C |
| Una eventual **Etapa D** (uso electoral) | Solo después de revisión jurídica, como **producto separado**, con **datos separados**, nuevas autorizaciones y respetando los tiempos que fija la ley para la propaganda |
| Contenido con la imagen de Angélica María Díaz | Presentarla como líder de la iniciativa (biografía, labor), no como aspirante. Si en algún momento aspira a un cargo, **revisar con el abogado** todo el contenido publicado y los tiempos electorales |

## 10. Medidas organizativas (no técnicas)

- **Acuerdo de confidencialidad** para cada usuario del panel (reserva sobre datos personales y autorizaciones).
- **Capacitación** breve al equipo: qué se puede publicar, cómo pedir y registrar autorizaciones, qué hacer si alguien pide retirar su foto.
- Los formatos de autorización en papel se **digitalizan** y se guardan en el bucket privado; los originales físicos se custodian en lugar seguro.
- Revisión **anual** de la política, formatos y tiempos de conservación.

## 11. Preguntas para el cliente y el abogado

**Para la organización**
1. ¿Está constituida (NIT)? ¿Quién será el responsable del tratamiento?
2. ¿Qué correo y qué persona atenderán solicitudes de datos?
3. ¿Las fotos existentes tienen autorización? ¿Hay menores en ellas? (pregunta 12 del `01`)
4. ¿Angélica María Díaz aspira o planea aspirar a un cargo de elección popular? (Afecta §9 y los tiempos de revisión.)

**Para el abogado**
1. Validar el inventario (§3), finalidades y tiempos de conservación.
2. Redactar política de tratamiento, aviso de privacidad y formatos de autorización (adultos y menores).
3. Confirmar la aplicabilidad del RNBD y el procedimiento de reporte de incidentes.
4. Validar las regiones de los proveedores frente a la lista de países adecuados de la SIC.
5. Revisar el contenido institucional frente a la normativa electoral, según la respuesta a la pregunta 4.
