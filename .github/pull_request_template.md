## Qué cambia y por qué

<!-- Requisito o historia de usuario relacionada (docs/02), p. ej. RF-A-20 / HU-04 -->

## Cómo se probó

<!-- Comandos ejecutados. Si hay cambios visuales, capturas en celular (360 px) y escritorio. -->

## Checklist (Definition of Done — docs/08 §4)

- [ ] Cumple los criterios de aceptación de la HU
- [ ] Probado en celular y escritorio
- [ ] Server Actions: usuario → MFA (aal2) → permiso → Zod → rate limit
- [ ] Tablas nuevas con RLS + pruebas pgTAP; `get_advisors` sin alertas nuevas
- [ ] Pruebas unitarias / E2E según corresponda
- [ ] Accesibilidad: teclado, foco visible, etiquetas, `alt`, contraste
- [ ] Sin textos inventados: contenido real o `[PENDIENTE]` / `[DEMO]`
- [ ] Sin secretos ni datos personales en código, logs o capturas
- [ ] Documentación afectada actualizada en este mismo PR
