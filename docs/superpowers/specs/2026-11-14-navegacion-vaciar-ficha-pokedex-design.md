# Navegación con historial, vaciado de Pokédex y ficha de Pokémon

**Fecha:** 2026-11-14
**Estado:** diseño propuesto, pendiente de aprobación
**Alcance:** corte pequeño (tres mejoras), sin rutas nuevas ni dependencias nuevas

## Intención

DexDeck ya registra y muestra datos, pero se siente incompleta en tres gestos
básicos: los botones laterales del ratón no hacen nada, vaciar una Pokédex
obliga a borrar entrada por entrada, y una fila solo deja editar o eliminar, sin
una vista rica del Pokémon. Este corte arregla los tres sin abrir Mundo,
sincronización ni caché de sprites.

## Objetivos

1. Botones laterales del ratón (atrás/adelante) y `Alt+←`/`Alt+→` navegan por el
   historial de la app como en un navegador: sección, ficha de juego, pestaña y
   panel de Pokémon.
2. Un botón «Vaciar Pokédex» elimina todas las entradas de la versión actual en
   una sola confirmación, conservando especies compartidas, fuentes y el resto
   de versiones.
3. Pulsar una fila abre un panel lateral con la ficha completa: sprite, número
   local y nacional, tipos, forma, obtenible, habilidades normales y ocultas,
   estadísticas con barras, descripción y fuente.
4. Las habilidades ocultas se guardan y se muestran como tales.

## No objetivos

- Rutas URL, enlaces profundos ni historial persistente entre reinicios.
- Caché local de sprites o descarga de imágenes.
- Exportar/importar la biblioteca.
- Encuentros, regiones, mapas o guías.
- Cambiar el orden de trabajo de `AGENTS.md`.

## Restricciones

- Svelte 5 con runes, Tauri 2, SQLite con migraciones aditivas.
- Sin dependencias nuevas.
- La app solo habla con `pokeapi.co`, `*.fandom.com` y Bulbapedia.
- Los encuentros ya caen en cascada al borrar `game_pokemon`
  (`0008_pokedex_foundation.sql:148`).
- Los datos de prueba no se tocan; el usuario decide cuándo reimportar.

## Enfoques considerados

| Decisión | Alternativas | Elegido y por qué |
|---|---|---|
| Historial | (a) migrar a rutas reales de SvelteKit; (b) pila propia en memoria; (c) solo listeners sin pila | (b): da el comportamiento de navegador con ~150 líneas y sin tocar el router; (a) es un corte mucho mayor y (c) no permite adelantar |
| Panel de Pokémon | (a) modal centrado; (b) panel lateral `<dialog>` | (b), aprobado por el usuario: se siente Pokédex y deja ver la lista |
| Habilidades ocultas | (a) sufijo «(oculta)» dentro de `abilities`; (b) columna nueva | (b): mantiene el dato limpio y la comparación de idempotencia; (a) contamina `abilities` y el CSV |
| Vaciar | (a) borrar sin confirmación; (b) confirmación con el número de entradas | (b): el borrado es irreversible y el conteo evita vaciar la versión equivocada |

## Diseño

### 1. Historial y botones laterales

Nuevo `src/lib/navigation.svelte.ts` con una pila de rutas tipadas y estado
reactivo:

```ts
type DetailTab = 'overview' | 'pokedex' | 'world' | 'guides';
type AppRoute =
  | { view: 'library' }
  | { view: 'catalog' }
  | { view: 'catalog-game'; slug: string; tab: DetailTab; pokemonId: number | null }
  | { view: 'updates' }
  | { view: 'settings' }
  | { view: 'new-game' };
```

- `push(route)`, `replace(route)`, `back()`, `forward()`, `canBack`, `canForward`;
  límite de 50 entradas; `push` con la misma ruta no duplica.
- Al abrir una ficha de juego desde el catálogo se empuja `catalog-game`; al
  cambiar de pestaña, `push` (para que atrás vuelva a la pestaña anterior) y al
  abrir el panel de un Pokémon, `push`. Al cerrarlo con ×,
  Escape o backdrop, `replace` a la ruta sin panel; al pulsar atrás, se cierra
  porque la ruta restaurada no tiene `pokemonId`.
- `+page.svelte` deja de usar `activeSection` como fuente de verdad: se deriva de
  `navigation.current.view` y los botones del sidebar llaman a `push`. Para la
  ficha, `Encyclopedia.svelte` recibe `route` y `onNavigate`, resuelve el juego
  por `slug` y mantiene `detailTab` en la ruta. `PokedexView.svelte` recibe
  `detailId` y `onDetailChange`.
- Si hay un diálogo abierto que no sea el panel (alta, edición, borrado,
  confirmaciones), `back()` lo cierra primero y no navega. Se registran con
  `registerOverlay(close)`/`unregisterOverlay(close)`.
- Listener global en `+page.svelte`:
  `mouseup` con `button === 3` → `back()`, `button === 4` → `forward()`, con
  `preventDefault` y una guarda de 300 ms contra el `auxclick` duplicado.
  `keydown` con `Alt+ArrowLeft/Right` usa el mismo camino. Si el evento no llega
  desde WebKitGTK, las flechas siguen funcionando y se documenta la limitación.

### 2. Vaciar Pokédex

- `deleteAllGamePokemon(versionId): Promise<number>` en `src/lib/pokedex.ts`:
  `DELETE FROM game_pokemon WHERE game_version_id = $1`, devuelve
  `rowsAffected`. No toca `pokemon_species`, `data_sources` ni encuentros
  (cascada).
- Botón «Vaciar Pokédex» en la cabecera de `PokedexView.svelte`, visible solo si
  hay entradas, con estilo de peligro y `data-testid="pokedex-clear"`.
- Diálogo de confirmación con el conteo y la versión; tras borrar, recarga la
  lista, avisa «Pokédex vaciada: N entradas eliminadas» y llama a `onChanged`.

### 3. Ficha de Pokémon

- Nuevo `src/lib/components/PokedexDetail.svelte`, un `<dialog>` nativo
  estilizado como panel lateral derecho (460 px, alto completo, overlay
  oscurecido; ancho completo en pantallas estrechas). Cabecera con sprite
  grande, nombre, forma, número local y nacional, tipos y etiqueta de
  obtenible. Cuerpo con habilidades normales, habilidades ocultas (o «Sin
  habilidades ocultas registradas»), estadísticas con barras y total,
  descripción y fuente con atribución, licencia y URL. Pie con Editar, Eliminar
  y Cerrar.
- La fila de `PokedexView.svelte` deja de ser solo un contenedor con botones: el
  nombre y el sprite abren el panel; Editar y Eliminar siguen en la fila.
- Accesibilidad: `aria-labelledby`, foco inicial en Cerrar, Escape y backdrop
  cierran, el foco vuelve a la fila que abrió el panel.

### 4. Habilidades ocultas

- Migración 14: `ALTER TABLE game_pokemon ADD COLUMN hidden_abilities_json TEXT
  NOT NULL DEFAULT '[]';` registrada en `lib.rs`.
- `GamePokemon.hidden_abilities: string[]` y `GamePokemonInput.hidden_abilities?`.
- `listGamePokemon` y `saveGamePokemon` leen y escriben la columna; el
  formulario manual añade un campo «Habilidades ocultas» separado por `|`.
- `src/lib/import/pokeapi.ts`: captura `is_hidden` de cada habilidad y las separa
  en `hidden_abilities`; los nombres localizados se resuelven igual que hoy.
- `src/lib/import/pokemon-import.ts`: alias `habilidades_ocultas` /
  `hidden_abilities`, validación de duplicados entre ambos grupos y comparación
  en `sameEntry`.
- Las entradas antiguas muestran «Sin habilidades ocultas registradas» hasta que
  se reimporten desde PokéAPI; la reimportación las actualiza porque la
  comparación cambia.

## Archivos previstos

- Nuevos: `src/lib/navigation.svelte.ts`, `src/lib/components/PokedexDetail.svelte`,
  `src-tauri/src/migrations/0014_hidden_abilities.sql`,
  `docs/superpowers/specs/2026-11-14-...-design.md` (este documento).
- Modificados: `src/routes/+page.svelte`, `src/lib/components/Encyclopedia.svelte`,
  `src/lib/components/PokedexView.svelte`, `src/lib/pokedex.ts`,
  `src/lib/import/pokeapi.ts`, `src/lib/import/pokemon-import.ts`,
  `scripts/import-checks.test.ts`, `src-tauri/src/lib.rs`, README.

## Verificación

- `pnpm check`, `pnpm build`, `pnpm test:import`, `cargo test --locked`.
- `pnpm test:ui` para abrir/cerrar el panel y vaciar la Pokédex con datos
  sembrados; añadir `data-testid` a panel, fila y confirmación.
- Prueba manual con ratón real de los botones laterales y con `ydotool click
  0x03`/`0x04`; si WebKitGTK no los entrega, comprobar `Alt+←`/`Alt+→`.
- Comprobación en SQLite: tras vaciar, `game_pokemon` de la versión a 0,
  `pokemon_species` y `data_sources` intactas; tras reimportar, las ocultas
  aparecen en la ficha.

## Riesgos

- **WebKitGTK puede capturar los botones 3/4 antes del DOM.** Mitigación:
  flechas y `Alt+←/→`; se prueba con el ratón del usuario antes de dar por hecho.
- **Bucles entre `$effect` y la pila.** Las rutas se comparan por valor y los
  efectos solo escriben si cambian.
- **Diálogos anidados.** El panel es modal; los formularios se abren encima con
  el mismo patrón de `<dialog>` ya usado. El registro de overlays evita que
  atrás navegue mientras hay un formulario abierto.
- **Datos existentes sin ocultas.** Se muestran como ausentes; no se inventan.
