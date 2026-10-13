# 10 · Prueba manual de accesibilidad

> Paso 9.6 · Lo que las pruebas automáticas no pueden comprobar: cómo se **oye** el sitio con un lector de pantalla y cómo se **usa** solo con el teclado. Se hace una vez antes del lanzamiento (`08` lista de lanzamiento, `07` §8) y cada vez que cambie mucho el diseño. Toma unos 30 minutos.

Las pruebas automáticas ya verifican en cada cambio: axe (WCAG 2.2 AA) en todas las páginas del sitio y del panel, celular y escritorio (`a11y.spec`); que "Saltar al contenido" sea lo primero, que todo lo que se alcanza con el teclado muestre el foco, y que menú y visor se cierren con Escape devolviendo el foco (`keyboard.spec`, `public-activities.spec`).

## Antes de empezar

- Un celular Android con **TalkBack** (Ajustes → Accesibilidad → TalkBack). Gestos básicos: **deslizar a la derecha** = siguiente elemento · **deslizar a la izquierda** = anterior · **doble toque** = activar · **deslizar abajo y luego derecha** = menú de TalkBack.
- Un computador con teclado (sin mouse): **Tab** avanza · **Shift+Tab** retrocede · **Enter** abre enlaces y botones · **Espacio** marca casillas · **Esc** cierra.
- La dirección de staging (o la de producción antes de lanzar).
- Anota cada problema con: página, qué hiciste, qué esperabas, qué pasó.

## A. Celular con TalkBack

| # | Dónde | Qué hacer | Debe pasar |
|---|---|---|---|
| A1 | Inicio | Abrir la página y deslizar a la derecha desde arriba | Lo primero que dice es "Saltar al contenido, enlace"; luego el nombre de la organización y "Abrir menú, botón" |
| A2 | Inicio | Doble toque en "Abrir menú" | Dice "Menú, diálogo"; se recorren las secciones; la actual dice "página actual" |
| A3 | Menú | Tocar "Cerrar menú" | El menú se cierra y el foco vuelve a "Abrir menú" |
| A4 | Inicio | Recorrer las tarjetas | Cada tarjeta se lee como un solo enlace con su título; las fotos dicen su descripción, no un nombre de archivo |
| A5 | Una actividad | Recorrer la página | Título como encabezado, fecha y lugar, resultados; cada foto dice "Ver foto 1 de N" y su descripción |
| A6 | Una actividad | Doble toque en una foto, luego deslizar | Dice "Foto 1 de N, diálogo"; los botones "Anterior", "Siguiente" y "Cerrar" se anuncian; al cerrar vuelve a la foto |
| A7 | Videos | Ir a un video | Dice "Reproducir: título, botón"; el video no arranca solo |
| A8 | Contacto | Recorrer el formulario | Cada campo dice su nombre ("Nombre", "Correo", "Teléfono o WhatsApp", "Mensaje") y si es obligatorio; la casilla de la política se anuncia con su texto |
| A9 | Contacto | Enviar el formulario vacío | El error se anuncia en voz sin tener que buscarlo |
| A10 | Contacto | Enviar un mensaje de prueba `[DEMO]` | Se anuncia el mensaje de "Gracias por escribirnos" |
| A11 | Buscar | Buscar "jornada" | Se anuncia cuántos resultados hay |
| A12 | Cualquier página | Activar "Texto grande" del celular (Ajustes → Pantalla) | Nada se corta ni se monta encima de otra cosa |

## B. Computador solo con teclado

| # | Dónde | Qué hacer | Debe pasar |
|---|---|---|---|
| B1 | Inicio | Pulsar Tab una vez | Aparece "Saltar al contenido"; Enter lleva al contenido principal |
| B2 | Todo el sitio | Recorrer con Tab | Siempre se ve dónde está el foco (contorno verde); el orden sigue la lectura (de arriba abajo, de izquierda a derecha) |
| B3 | Una galería | Abrir una foto con Enter, cambiar con ← →, cerrar con Esc | El visor responde a las flechas; Esc lo cierra y el foco vuelve a la foto |
| B4 | Contacto | Llenar y enviar solo con teclado | Se puede marcar la casilla con Espacio; Turnstile no bloquea el teclado |
| B5 | Panel | Entrar (correo, contraseña, código) solo con teclado | Todo el ingreso funciona sin mouse |
| B6 | Panel | Crear una actividad `[DEMO]` con el asistente | Se avanza por los pasos con Tab/Enter; en fecha y hora se escribe con números y flechas |
| B7 | Panel | Abrir el menú del panel en una ventana angosta | Se abre y se cierra con el teclado; Esc lo cierra |
| B8 | Navegador | Zoom al 200 % (Ctrl + +) en Inicio y Contacto | Todo se puede leer y usar sin desplazarse de lado |

## Al terminar

- Si todo pasó: marcar "Prueba manual de accesibilidad" en la lista de lanzamiento (`08`) con la fecha y quién la hizo.
- Si algo falló: abrir un issue en GitHub con lo anotado (sin datos personales ni capturas con personas reales) y corregirlo antes de lanzar.
