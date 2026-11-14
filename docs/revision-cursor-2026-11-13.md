# Revisión externa (Cursor) — 2026-11-13

Notas guardadas de una revisión de Cursor sobre DexDeck. No son un plan aprobado:
son la lista de cortes que más compensan y los puntos flojos ya detectados.
Sirven como referencia para elegir el siguiente corte.

## Estado actual según esa revisión

- App de escritorio usable: Tauri 2, Svelte 5, SQLite.
- Biblioteca con lanzamiento de `.exe`, enciclopedia con versiones y Pokédex
  (manual, CSV/JSON o PokéAPI).
- Huecos grandes: mundo del juego, offline real y lanzador de ROMs.
- Separación biblioteca/catálogo correcta: `games` = instalado,
  `catalog_games` + `game_versions` = ficha.
- Ocultar juego ya vive en SQLite (`is_hidden`); `+page.svelte` solo migra IDs
  viejos de `localStorage` y los borra.
- Centro de actualizaciones propio real (`app-updates.svelte.ts` + plugin updater).
- README desactualizado: describe el actualizador como provisional y el ocultado
  como solo `localStorage`.
- Pokédex es el módulo más maduro: vista previa antes de escribir, atribución,
  reintentos y lista blanca de red (`pokeapi.co`, `*.fandom.com`, Bulbapedia).
- Mundo, encuentros, objetos y guías existen como tablas en
  `0008_pokedex_foundation.sql` y como contadores en la ficha, pero las pestañas
  Mundo y Guías de `Encyclopedia.svelte` son paneles vacíos.

## Cortes priorizados (orden recomendado)

1. **Editor mínimo de regiones y ubicaciones.** Alta, edición y borrado de una
   región y de ubicaciones anidadas (ruta, cueva, planta), y que el contador del
   resumen deje de ser siempre cero. Sin mapas ni encuentros: solo el árbol
   navegable. Esquema ya listo: `regions`, `locations`.
2. **Encuentros en una sola dirección.** Sobre la ubicación: Pokémon, método,
   nivel y probabilidad. La consulta inversa («dónde sale este Pokémon») sale
   gratis porque `encounters` apunta a `game_pokemon`. Objetos y mapas esperan.
3. **Caché local de sprites.** Hoy se guarda `sprite_url` y un `sprite_path`
   escrito a mano; sin red la ficha se queda sin imagen, contra el criterio
   offline-first. Al importar desde PokéAPI, descargar el sprite a la carpeta de
   datos de la app y guardar la ruta. Misma lista blanca de dominios.
4. **Número nacional visible y evoluciones.** El import ya acepta
   `numero_nacional` y lo guarda en `pokemon_species`, pero `PokedexView.svelte`
   no lo muestra (barato de arreglar). Evoluciones: migración aditiva
   (`from_species`, `to_species`, método, nivel u objeto) y una línea en la ficha.
   Movimientos: corte aparte y más grande; no mezclar.
5. **Primer adaptador de ROM, solo GBA.** El lanzador `.exe`/Wine ya está en
   `src-tauri/src/lib.rs`. Adaptador `.gba` con ruta de mGBA, argumentos y error
   claro si falta el emulador. Cubre el caso más común de ROM hack sin diseñar
   NDS, 3DS ni parches.
6. **Exportar e importar biblioteca y catálogo.** No hay copia de seguridad. JSON
   (o SQLite copiado) con juegos, fichas, versiones y Pokédex, más restauración
   con vista previa al estilo del importador actual. Cierra el riesgo de perder
   datos propios antes de sincronizar con nadie.
7. **Guía en Markdown, una por versión.** Visor de texto renderizado y editor
   `<textarea>`. Publicar, ordenar y enlazar con rutas después. `guides` ya existe
   y la pestaña solo dice que aún no hay guías.

Fuera de este orden y solo cuando lo anterior exista: fuentes de versión de
fangames (`UpdatesView.svelte` sigue siendo placeholder), parches IPS/BPS y
MediaWiki. PokéAPI no cubre Fakémon ni ROM hacks; para eso el CSV ya presente es
la herramienta correcta, no otra API.

## Mejoras sobre lo ya hecho

- **Partir `src/routes/+page.svelte`** (~1 200 líneas: formulario, lanzamiento,
  tema, desinstalación y biblioteca). `LibraryView.svelte` ya existe; sacar el
  formulario de alta y el lanzamiento sin cambiar comportamiento. Único ítem
  abierto de la Fase 1 que reduce el riesgo de los cortes siguientes.
- **Restaurar y borrar de verdad un juego oculto.** `hideGame` marca
  `is_hidden = 1` y `listGames` filtra; no hay pantalla para recuperarlos ni para
  borrar la fila.
- **Meter `pnpm test:import` en CI.** `.github/workflows/ci.yml` corre
  `pnpm check`, `pnpm build` y `cargo test`, pero no las 20 pruebas de importación.
- **Alinear el README** con el ocultado en SQLite y el actualizador propio.
- **Accesibilidad de diálogos.** Fase 1 abierta: foco inicial, Escape y etiquetas
  en los diálogos de biblioteca e importación. Hacerlo antes del editor de mundo,
  que abrirá más modales.

## No tocar todavía

Sincronización, resolución de conflictos y lanzador universal completo. El modelo
y la Pokédex ya dan base; el valor siguiente está en rellenar Mundo con datos
editables y en que las imágenes sobrevivan sin red.

## Comprobado en el repo (2026-11-13)

- `is_hidden`: `src/lib/db.ts:56` (filtro en `listGames`), `src/lib/db.ts:136`
  (`hideGame`), `src/routes/+page.svelte:722`.
- `src/routes/+page.svelte`: 1 206 líneas.
- Pestañas Mundo/Guías vacías: `src/lib/components/Encyclopedia.svelte:768-769`
  y paneles en `:815-825`.
- `pnpm test:import` existe en `package.json:13` y no aparece en
  `.github/workflows/ci.yml`.
