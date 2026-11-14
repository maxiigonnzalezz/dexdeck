# AGENTS.md — DexDeck

Contexto y prioridades del proyecto. Antes de proponer o empezar un corte, lee
`docs/revision-cursor-2026-11-13.md`.

## Orden de trabajo acordado

1. Editor mínimo de regiones y ubicaciones (árbol navegable, sin mapas).
2. Encuentros en una sola dirección (Pokémon, método, nivel, probabilidad).
3. Caché local de sprites al importar desde PokéAPI (offline real).
4. Número nacional visible en `PokedexView.svelte` + tabla aditiva de evoluciones.
5. Adaptador de ROM solo GBA (mGBA), con error claro si falta el emulador.
6. Exportar/importar biblioteca + catálogo + Pokédex con vista previa.
7. Guía Markdown por versión (visor renderizado + editor `<textarea>`).

Antes de eso o en paralelo, mejoras baratas: partir `src/routes/+page.svelte`,
pantalla para restaurar/borrar juegos ocultos, `pnpm test:import` en CI,
accesibilidad de diálogos (foco inicial, Escape, etiquetas) y alinear el README.

No empezar sincronización, resolución de conflictos ni lanzador universal
completo. PokéAPI no cubre Fakémon ni ROM hacks: para eso, CSV.

## Pruebas de interfaz

Orden obligatorio antes de tocar el escritorio:

1. `pnpm test:ui` — Chromium con backend Tauri simulado. Es el bucle rápido:
   navegación, formularios, validaciones, mocks y estados.
2. `pnpm test:e2e` — app real (Tauri + WebKitGTK + SQLite). Si cambió el
   frontend o Rust, recompila antes con `pnpm test:e2e:build`.
3. MCP `computer-use-linux` — solo para lo que WDIO no puede comprobar:
   canvas, diálogos nativos del sistema, otras apps o el estado real de Niri.
   No lo uses para sustituir una prueba de interfaz que ya existe.

Detalles, selectores y limitaciones: `tests/wdio/README.md`. Al añadir una
pantalla, añade `data-testid` y su selector en `tests/wdio/helpers/selectors.ts`.

## Convenciones

- Respuestas y comentarios en español; UI en español.
- Svelte 5 (runes), Tauri 2, SQLite vía `src/lib/db.ts`; migraciones aditivas en
  `src-tauri/src/migrations/`.
- Verifica con `pnpm check`, `pnpm build`, `pnpm test:import`, `pnpm test:ui`
  y, cuando toque integración, `pnpm test:e2e` y `cargo test`.
