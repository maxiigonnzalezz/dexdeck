# Recolección desde PokéAPI — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una versión de la enciclopedia llene su Pokédex desde PokéAPI, en español, con progreso, vista previa y procedencia, sin escribir nada hasta que el usuario confirme.

**Architecture:** Un adaptador puro convierte las respuestas de PokéAPI en las mismas filas que ya consume el importador CSV/JSON. La red vive en un cliente con reintentos y lista blanca. La vista previa se extrae a un componente compartido. Nada se escribe hasta pulsar «Importar».

**Tech Stack:** Svelte 5 (runes), TypeScript, `tauri-plugin-http`, SQLite vía `@tauri-apps/plugin-sql`, Node 26 `node:test` con `--experimental-strip-types`.

**Spec:** diseño aprobado en la conversación del 13 de noviembre de 2026 (corte 4a, opción A).

## Global Constraints

- Todo en español: UI, mensajes, comentarios y commits.
- Svelte 5 con runes; nada de stores clásicas.
- No añadir más dependencias que `tauri-plugin-http` y `@tauri-apps/plugin-http`.
- No hacer `git push`; commits locales en español.
- No lanzar `pnpm tauri dev` sin pedir permiso en el momento de probar.
- Verificación final: `pnpm check` (0 errores, 0 avisos), `pnpm build`, `cargo test --manifest-path src-tauri/Cargo.toml --locked` (8 pruebas).
- La línea pendiente del usuario en `src-tauri/Cargo.toml` (`tauri = { version = "2", features = [] }`) no entra en ningún commit.
- La app no puede llamar a dominios fuera de `pokeapi.co`, `*.fandom.com` y `bulbapedia.bulbagarden.net`.
- Toda fila importada guarda `source_id` y `source_url`; la atribución es visible en la vista previa.

## Review Focus

1. **Sin traducción al español:** una especie sin `names` en `es` debe usar inglés y avisar, nunca dejar el nombre vacío.
2. **Cancelar a mitad:** no se escribe nada en la base; los datos ya descargados se descartan al cerrar.
3. **429 o 5xx:** se reintenta con espera; tras agotar intentos se avisa y se conservan las filas ya descargadas.
4. **Nombres con guiones (`mr-mime`, `nidoran-f`):** nombre legible o conservado tal cual, sin romper la fila.
5. **Sprite ausente:** `official-artwork` puede faltar; se usa `front_default` y, si tampoco, cadena vacía.
6. **Reimportar con solo la URL de origen cambiada:** la fila se marca como actualización, no como «sin cambios».
7. **Límite vacío o 0:** importa todas las entradas, no cero.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `scripts/register-imports.mjs` | Resolver `$lib/` y extensiones `.ts` para las pruebas en Node |
| `scripts/import-checks.test.ts` | Pruebas de las piezas puras |
| `src/lib/import/http-policy.ts` | Decisión de reintento y espera (puro) |
| `src/lib/import/http-client.ts` | Cliente con timeout y reintentos sobre un `fetch` inyectado |
| `src/lib/import/http.ts` | Une el cliente con el `fetch` de Tauri |
| `src/lib/import/concurrency.ts` | Ejecuta tareas con concurrencia limitada y cancelación |
| `src/lib/import/pokeapi.ts` | Adaptador PokéAPI: opciones, sugerencia, mapeo y recolección |
| `src-tauri/src/migrations/0013_remote_sources.sql` | Semillas de fuentes, `source_url` y `remote_pokedex_key` |
| `src/lib/pokedex.ts` | `source_url`, `species_key`, `national_dex_number` y enlace de especie |
| `src/lib/encyclopedia.ts` | Leer y guardar la Pokédex remota de una versión |
| `src/lib/components/PokedexImportPreview.svelte` | Vista previa compartida (contadores, tabla, avisos, modo) |
| `src/lib/components/PokedexRemote.svelte` | Diálogo de recolección con progreso y cancelación |
| `PokedexImport.svelte`, `PokedexView.svelte` | Usar el componente compartido y añadir el botón |

---

### Task 1: Arnés de pruebas y utilidades puras

**Files:**
- Create: `scripts/register-imports.mjs`
- Create: `scripts/import-checks.test.ts`
- Create: `src/lib/import/http-policy.ts`
- Create: `src/lib/import/concurrency.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `shouldRetry(status: number): boolean`
- Produces: `retryDelay(attempt: number, retryAfter: string | null): number`
- Produces: `mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<Array<R | undefined>>`

- [ ] **Step 1: Crear el resolutor de imports**

`scripts/register-imports.mjs` registra un hook que resuelve `$lib/` a `src/lib/` y añade `.ts` a los imports relativos sin extensión. Sin dependencias: solo `node:module`, `node:fs`, `node:url` y `node:path`.

- [ ] **Step 2: Añadir el script de pruebas**

En `package.json`:

```json
"test:import": "node --experimental-strip-types --import ./scripts/register-imports.mjs --test scripts/import-checks.test.ts"
```

- [ ] **Step 3: Escribir las pruebas que fallan**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay, shouldRetry } from '$lib/import/http-policy';
import { mapWithConcurrency } from '$lib/import/concurrency';

test('reintenta en 429 y 5xx, no en 404', () => {
  assert.equal(shouldRetry(429), true);
  assert.equal(shouldRetry(500), true);
  assert.equal(shouldRetry(404), false);
  assert.equal(shouldRetry(200), false);
});

test('respeta Retry-After y crece con el intento', () => {
  assert.equal(retryDelay(0, '3'), 3000);
  assert.ok(retryDelay(2, null) > retryDelay(1, null));
  assert.ok(retryDelay(9, null) <= 8000);
});

test('limita la concurrencia y conserva el orden', async () => {
  let active = 0;
  let peak = 0;
  const items = [30, 10, 20];
  const result = await mapWithConcurrency(items, 2, async (ms) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, ms));
    active -= 1;
    return ms * 2;
  });
  assert.deepEqual(result, [60, 20, 40]);
  assert.equal(peak, 2);
});

test('la cancelación detiene las tareas pendientes', async () => {
  const controller = new AbortController();
  const result = await mapWithConcurrency([1, 2, 3, 4], 1, async (n) => {
    if (n === 1) controller.abort();
    return n;
  }, controller.signal);
  assert.deepEqual(result, [1, undefined, undefined, undefined]);
});
```

- [ ] **Step 4: Ejecutar y comprobar que falla**

Run: `pnpm test:import`
Expected: FAIL por no encontrar `http-policy` ni `concurrency`.

- [ ] **Step 5: Implementar**

`retryDelay` devuelve 0 si el estado no se reintenta; si hay `Retry-After`, segundos × 1000; si no, `Math.min(800 * 2 ** attempt, 8000)`. `mapWithConcurrency` arranca hasta `limit` trabajadores, escribe cada resultado en su índice y, si `signal` está abortada, deja los pendientes en `undefined` sin lanzar.

- [ ] **Step 6: Ejecutar y comprobar que pasa**

Run: `pnpm test:import`
Expected: 4 pruebas, 4 correctas.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts src/lib/import/http-policy.ts src/lib/import/concurrency.ts
git commit -m "Arnes de pruebas y utilidades de red"
```

---

### Task 2: Migración, procedencia y enlace de especie

**Files:**
- Create: `src-tauri/src/migrations/0013_remote_sources.sql`
- Modify: `src-tauri/src/lib.rs` (registrar versión 13)
- Modify: `src/lib/pokedex.ts`
- Modify: `src/lib/encyclopedia.ts`
- Modify: `src/lib/import/pokemon-import.ts`
- Test: `scripts/import-checks.test.ts`

**Interfaces:**
- Produces: `GamePokemonInput` gana `source_url?: string`, `species_key?: string`, `national_dex_number?: number | null`.
- Produces: `GamePokemon` gana `source_url: string`, `species_key: string | null`, `national_dex_number: number | null`.
- Produces: `getVersionRemotePokedex(versionId: number): Promise<string>`
- Produces: `setVersionRemotePokedex(versionId: number, key: string): Promise<void>`
- Produces: `ImportFormat = 'csv' | 'json' | 'pokeapi' | 'mediawiki'`

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `scripts/import-checks.test.ts`:

```ts
import { parsePokemonFile } from '$lib/import/pokemon-import';
import type { GamePokemon } from '$lib/pokedex';

const base: GamePokemon = {
  id: 1, game_version_id: 1, species_id: null, dex_number: 25, name: 'Pikachu',
  form_name: '', type_primary: 'electric', type_secondary: '', abilities: [],
  base_stats: null, dex_entry: '', sprite_url: '', sprite_path: '', is_obtainable: 1,
  source_id: null, source_name: null, source_attribution: null, source_license: null,
  source_url: 'https://pokeapi.co/api/v2/pokemon-species/25/',
  species_key: null, national_dex_number: null
};

test('un cambio solo en source_url es una actualización', () => {
  const csv = 'numero,nombre,source_url\n25,Pikachu,https://ejemplo.test/pikachu';
  const preview = parsePokemonFile(csv, 'x.csv', [], [base]);
  assert.equal(preview.candidates[0].action, 'update');
});

test('lee numero nacional y clave de especie', () => {
  const csv = 'numero,nombre,national_dex_number,species_key\n25,Pikachu,25,pokeapi:pikachu';
  const input = parsePokemonFile(csv, 'x.csv', [], []).candidates[0].input;
  assert.equal(input.national_dex_number, 25);
  assert.equal(input.species_key, 'pokeapi:pikachu');
});

test('una clave de especie inválida es un error de fila', () => {
  const csv = 'numero,nombre,species_key\n25,Pikachu,clave con espacios';
  const preview = parsePokemonFile(csv, 'x.csv', [], []);
  assert.equal(preview.counts.errors, 1);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `pnpm test:import`
Expected: FAIL porque `source_url` no existe en el tipo y el CSV lo ignora.

- [ ] **Step 3: Crear la migración 0013**

Contenido exacto:

```sql
ALTER TABLE game_pokemon ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE game_versions ADD COLUMN remote_pokedex_key TEXT NOT NULL DEFAULT '';

INSERT OR IGNORE INTO data_sources
    (source_key, name, source_type, homepage_url, api_base_url, license_name, attribution_text, terms_url)
VALUES
    ('pokeapi', 'PokéAPI', 'api', 'https://pokeapi.co/', 'https://pokeapi.co/api/v2/',
     'BSD-3-Clause (código); datos de The Pokémon Company',
     'Datos servidos por PokéAPI', 'https://pokeapi.co/docs/v2#fairuse'),
    ('fandom', 'Fandom', 'wiki', 'https://www.fandom.com/', '',
     'CC BY-SA 3.0', 'Contenido de Fandom bajo CC BY-SA', 'https://www.fandom.com/licensing'),
    ('bulbapedia', 'Bulbapedia', 'wiki', 'https://bulbapedia.bulbagarden.net/', '',
     'CC BY-NC-SA 2.5', 'Contenido de Bulbapedia bajo CC BY-NC-SA',
     'https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights');
```

Registrar `version: 13` en `src-tauri/src/lib.rs` con `include_str!("migrations/0013_remote_sources.sql")`, siguiendo el patrón de las anteriores.

- [ ] **Step 4: Extender `pokedex.ts`**

- Añadir `source_url`, `species_key` y `national_dex_number` a `GamePokemonRow`, `GamePokemon` y `GamePokemonInput` (los dos últimos opcionales en el input).
- En `listGamePokemon`, añadir `gp.source_url`, `ps.species_key` y `ps.national_dex_number` con `LEFT JOIN pokemon_species ps ON ps.id = gp.species_id`.
- En `saveGamePokemon`, resolver la especie antes de escribir:

```ts
async function resolveSpeciesId(
  db: Database,
  input: GamePokemonInput,
  sourceId: number | null
): Promise<number | null | undefined>
```

- Sin `species_key`: devuelve `undefined` (no tocar `species_id` en un UPDATE, `NULL` en un INSERT).
- Con `species_key`: busca por clave; si no existe, busca por `national_dex_number` para no chocar con el índice único; si tampoco, inserta en `pokemon_species` con `species_key`, número nacional, nombre canónico y `source_id`.
- Incluir `source_url` y `species_id` en INSERT y UPDATE. En UPDATE, solo asignar `species_id` si el resolvedor devolvió un número.

- [ ] **Step 5: Extender el importador**

- Añadir alias: `source_url` (`source_url`, `url_fuente`, `url_origen`), `species_key` (`species_key`, `clave_especie`), `national_dex_number` (`national_dex_number`, `numero_nacional`, `national_dex`).
- Validar: `national_dex_number` entero entre 1 y 9999 si viene; `species_key` debe cumplir `/^[a-z0-9][a-z0-9:_-]{0,79}$/i`, si no, error de fila.
- Propagar los tres campos al `GamePokemonInput`.
- Comparar `source_url` en `sameEntry`.
- Ampliar `ImportPreview.format` a `'csv' | 'json' | 'pokeapi'`.

- [ ] **Step 6: Guardar la Pokédex remota**

En `encyclopedia.ts`, dos funciones tipadas con `game_versions.remote_pokedex_key`. `setVersionRemotePokedex` valida `key` con `/^[a-z0-9-]{1,60}$/` y lanza «La Pokédex remota no es válida.» si no cumple.

- [ ] **Step 7: Ejecutar y comprobar que pasa**

Run: `pnpm test:import && pnpm check`
Expected: 7 pruebas correctas y 0 errores/0 avisos.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/migrations/0013_remote_sources.sql src-tauri/src/lib.rs src/lib/pokedex.ts src/lib/encyclopedia.ts src/lib/import/pokemon-import.ts scripts/import-checks.test.ts
git commit -m "Procedencia remota y enlace de especie en la Pokedex"
```

---

### Task 3: Adaptador PokéAPI

**Files:**
- Create: `src/lib/import/pokeapi.ts`
- Modify: `src/lib/import/pokemon-import.ts` (exportar `RawRecord` y `ParsedRow`)
- Test: `scripts/import-checks.test.ts`

**Interfaces:**
- Produces: `suggestPokedexKey(gameName: string, versionLabel: string): string`
- Produces: `POKEDEX_LABELS: Record<string, string>`
- Produces: `parsePokedexOptions(payload: unknown): PokedexOption[]` con `{ key, label }`
- Produces: `parsePokedexEntries(payload: unknown): PokedexEntry[]` con `{ entryNumber, speciesKey, speciesUrl }`
- Produces: `pickLocalizedName(names: LocalizedName[]): LocalizedValue | null`
- Produces: `pickFlavorText(entries: FlavorText[]): LocalizedValue | null`
- Produces: `cleanFlavorText(text: string): string`
- Produces: `prettyName(slug: string): string` (`mr-mime` → `Mr Mime`)
- Produces: `toRawRecord(input: ToRawRecordInput): RawRecord`
- Produces: `collectPokedex(options: CollectOptions): Promise<CollectResult>`

```ts
type LocalizedValue = { value: string; language: string };
type LocalizedName = { name: string; language: { name: string } };
type FlavorText = { flavor_text: string; language: { name: string } };
type PokedexOption = { key: string; label: string };
type PokedexEntry = { entryNumber: number; speciesKey: string; speciesUrl: string };
type ToRawRecordInput = {
  entryNumber: number;
  speciesKey: string;
  nationalNumber: number;
  abilities: Map<string, string>;
  species: { names?: LocalizedName[]; flavor_text_entries?: FlavorText[] };
  pokemon: {
    id: number;
    types?: Array<{ slot: number; type: { name: string } }>;
    abilities?: Array<{ ability: { name: string } }>;
    stats?: Array<{ base_stat: number; stat: { name: string } }>;
    sprites?: { front_default?: string | null; other?: Record<string, { front_default?: string | null }> };
  };
};
type CollectOptions = {
  pokedexKey: string;
  maxEntries?: number;
  fetchJson: (url: string) => Promise<unknown>;
  onProgress?: (progress: { done: number; total: number; current: string }) => void;
  signal?: AbortSignal;
};
type CollectResult = {
  records: ParsedRow[];
  issues: ImportIssue[];
  cancelled: boolean;
};
```

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `scripts/import-checks.test.ts` pruebas con objetos pequeños que imiten la API:

```ts
import {
  cleanFlavorText, collectPokedex, parsePokedexEntries, parsePokedexOptions,
  pickFlavorText, pickLocalizedName, prettyName, suggestPokedexKey, toRawRecord
} from '$lib/import/pokeapi';

test('sugiere la Pokedex por nombre de juego', () => {
  assert.equal(suggestPokedexKey('Pokémon Rojo Fuego', ''), 'kanto');
  assert.equal(suggestPokedexKey('Pokemon Esmeralda', '3.0'), 'hoenn');
  assert.equal(suggestPokedexKey('Pokemon Insurgence', '1.2'), '');
});

test('lee las entradas de la Pokedex', () => {
  assert.deepEqual(parsePokedexEntries({
    pokemon_entries: [
      { entry_number: 1, pokemon_species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' } }
    ]
  }), [
    { entryNumber: 1, speciesKey: 'bulbasaur', speciesUrl: 'https://pokeapi.co/api/v2/pokemon-species/1/' }
  ]);
});

test('elige la descripción en español', () => {
  assert.deepEqual(pickFlavorText([
    { flavor_text: 'A', language: { name: 'en' } },
    { flavor_text: 'B', language: { name: 'es' } }
  ]), { value: 'B', language: 'es' });
});

test('convierte la lista de Pokedex en opciones ordenadas', () => {
  const options = parsePokedexOptions({
    results: [
      { name: 'hoenn', url: 'h' },
      { name: 'kanto', url: 'k' },
      { name: 'rara', url: 'r' }
    ]
  });
  assert.deepEqual(options.map((option) => option.key), ['kanto', 'hoenn', 'rara']);
  assert.equal(options[0].label, 'Kanto');
});

test('prefiere español y cae al inglés', () => {
  const names = [
    { name: 'Pikachu', language: { name: 'en' } },
    { name: 'Pikachu', language: { name: 'es' } }
  ];
  assert.deepEqual(pickLocalizedName(names), { value: 'Pikachu', language: 'es' });
  assert.deepEqual(pickLocalizedName([names[0]]), { value: 'Pikachu', language: 'en' });
  assert.equal(pickLocalizedName([]), null);
});

test('limpia saltos y caracteres de control', () => {
  assert.equal(cleanFlavorText('Duerme\n\fen el suelo.'), 'Duerme en el suelo.');
});

test('humaniza los slugs de la API', () => {
  assert.equal(prettyName('mr-mime'), 'Mr Mime');
  assert.equal(prettyName('nidoran-f'), 'Nidoran F');
  assert.equal(prettyName('pikachu'), 'Pikachu');
});

test('prefiere el artwork oficial y cae a front_default', () => {
  const base = {
    entryNumber: 25, speciesKey: 'pikachu', nationalNumber: 25, abilities: new Map<string, string>(),
    species: {}, pokemon: { id: 25, sprites: { front_default: 'front.png', other: { 'official-artwork': { front_default: 'art.png' } } } }
  };
  assert.equal(toRawRecord(base).sprite_url, 'art.png');
  assert.equal(toRawRecord({ ...base, pokemon: { id: 25, sprites: { front_default: 'front.png' } } }).sprite_url, 'front.png');
  assert.equal(toRawRecord({ ...base, pokemon: { id: 25, sprites: {} } }).sprite_url, '');
});

test('mapea tipos, stats, habilidades y sprite', () => {
  const record = toRawRecord({
    entryNumber: 25,
    speciesKey: 'pikachu',
    nationalNumber: 25,
    abilities: new Map([['static', 'Electrostática']]),
    species: {
      names: [{ name: 'Pikachu', language: { name: 'es' } }],
      flavor_text_entries: [{ flavor_text: 'Roe\fcosas.', language: { name: 'es' } }]
    },
    pokemon: {
      id: 25,
      types: [{ slot: 2, type: { name: 'fairy' } }, { slot: 1, type: { name: 'electric' } }],
      abilities: [{ ability: { name: 'static' } }],
      stats: [
        { base_stat: 35, stat: { name: 'hp' } },
        { base_stat: 55, stat: { name: 'attack' } },
        { base_stat: 40, stat: { name: 'defense' } },
        { base_stat: 50, stat: { name: 'special-attack' } },
        { base_stat: 50, stat: { name: 'special-defense' } },
        { base_stat: 90, stat: { name: 'speed' } }
      ],
      sprites: { front_default: 'front.png' }
    }
  });

  assert.equal(record.type_primary, 'electric');
  assert.equal(record.type_secondary, 'fairy');
  assert.equal(record.abilities, 'Electrostática');
  assert.equal(record.sprite_url, 'front.png');
  assert.equal(record.national_dex_number, '25');
  assert.equal(record.species_key, 'pokeapi:pikachu');
  assert.equal(record.dex_entry, 'Roe cosas.');
});

test('recolecta con fetch inyectado, ordena y avisa de fallos', async () => {
  const calls: string[] = [];
  const fakeFetch = async (url: string) => {
    calls.push(url);
    if (url.endsWith('/pokedex/kanto')) {
      return { pokemon_entries: [
        { entry_number: 2, pokemon_species: { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon-species/2/' } },
        { entry_number: 1, pokemon_species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' } }
      ] };
    }
    if (url.includes('/pokemon-species/1/')) throw new Error('404');
    return {
      id: 2,
      names: [{ name: 'Ivysaur', language: { name: 'es' } }],
      flavor_text_entries: [],
      varieties: [],
      types: [{ slot: 1, type: { name: 'grass' } }],
      abilities: [],
      stats: [],
      sprites: { front_default: null }
    };
  };

  const result = await collectPokedex({ pokedexKey: 'kanto', fetchJson: fakeFetch });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].record.dex_number, '2');
  assert.equal(result.issues.length, 1);
  assert.equal(result.cancelled, false);
  assert.ok(calls.length >= 3);
});

test('el límite cero importa todo', async () => {
  const result = await collectPokedex({
    pokedexKey: 'kanto',
    maxEntries: 0,
    fetchJson: async (url) => {
      if (url.endsWith('/pokedex/kanto')) {
        return { pokemon_entries: [{ entry_number: 1, pokemon_species: { name: 'bulbasaur', url: 's/1/' } }] };
      }
      return { id: 1, names: [], flavor_text_entries: [], varieties: [], types: [], abilities: [], stats: [], sprites: {} };
    }
  });
  assert.equal(result.records.length, 1);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `pnpm test:import`
Expected: FAIL porque `$lib/import/pokeapi` no existe.

- [ ] **Step 3: Implementar las piezas puras**

- `suggestPokedexKey`: normaliza a minúsculas sin acentos y recorre una tabla ordenada de palabras clave: remakes antes que originales (`heartgold` → `updated-johto`, `firered` → `kanto`), luego oficiales. Devuelve `''` si no hay coincidencia.
- `parsePokedexOptions`: lee `results[]` con `name` y `url`, genera etiqueta desde `POKEDEX_LABELS` o humaniza el slug (`updated-kanto` → `Updated Kanto`), y ordena por la lista conocida.
- `parsePokedexEntries`: lee `pokemon_entries[]`, exige `entry_number` entero y `pokemon_species.url`; lanza «La respuesta de Pokédex no tiene el formato esperado.» si la forma es inválida.
- `pickLocalizedName` / `pickFlavorText`: buscan `es`, luego `en`, luego el primero; devuelven `{ value, language }`.
- `cleanFlavorText`: reemplaza `\n`, `\r`, `\f`, `\u00ad` y espacios repetidos por un espacio.
- `toRawRecord`: ordena tipos por `slot`, traduce habilidades con el mapa, mapea los seis stats, elige `sprites.other['official-artwork'].front_default ?? sprites.front_default ?? ''`, tolera arrays ausentes (`?? []`) y devuelve las claves normalizadas que ya entiende `buildInput` (`dex_number`, `name`, `type_primary`, `abilities`, `hp`, `dex_entry`, `sprite_url`, `source`, `source_url`, `species_key`, `national_dex_number`). Si no hay nombre en español ni en inglés, usa `prettyName(speciesKey)`.

- [ ] **Step 4: Implementar `collectPokedex`**

1. `GET {API}/pokedex/{key}` y `parsePokedexEntries`; aplicar `maxEntries` solo si es un entero mayor que 0.
2. Recorrer con `mapWithConcurrency(..., 3, ...)`; antes de cada entrada, si `signal?.aborted`, salir.
3. Por entrada: `GET speciesUrl` y `GET {API}/pokemon/{species.id}`; si la especie falla, añadir `ImportIssue` de error con la línea y continuar.
4. Resolver nombres de habilidades: para cada `ability.name` que falte en el mapa, `GET {API}/ability/{name}` una sola vez (caché compartida entre entradas).
5. `toRawRecord`, `onProgress({ done, total, current: nombre })`.
6. Ordenar los registros por `dex_number` numérico y devolver `cancelled` según el estado de la señal.

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `pnpm test:import && pnpm check`
Expected: 18 pruebas correctas y 0/0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/pokeapi.ts src/lib/import/pokemon-import.ts scripts/import-checks.test.ts
git commit -m "Adaptador de Pokedex desde PokeAPI"
```

---

### Task 4: Plugin HTTP, lista blanca y cliente

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/import/http-client.ts`
- Create: `src/lib/import/http.ts`
- Modify: `package.json`, `pnpm-lock.yaml`
- Test: `scripts/import-checks.test.ts`

**Interfaces:**
- Produces: `createFetchJson(request: RequestLike, timeoutMs?: number): (url: string) => Promise<unknown>`
- Produces: `fetchJson(url: string): Promise<unknown>` (instancia de Tauri)

```ts
type RequestLike = (
  input: string,
  init?: { signal?: AbortSignal; connectTimeout?: number }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;
```

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
import { createFetchJson } from '$lib/import/http-client';

test('reintenta un 429 y termina bien', async () => {
  let calls = 0;
  const request = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 429, headers: { get: () => '0' }, json: async () => ({}) };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ ok: true }) };
  };
  const fetchJson = createFetchJson(request, 50);
  assert.deepEqual(await fetchJson('https://pokeapi.co/api/v2/pokemon/1'), { ok: true });
  assert.equal(calls, 2);
});

test('tras tres fallos lanza un mensaje en español', async () => {
  const request = async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) });
  const fetchJson = createFetchJson(request, 50);
  await assert.rejects(fetchJson('https://pokeapi.co/x'), /No se ha podido consultar/);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `pnpm test:import`
Expected: FAIL porque `http-client` no existe.

- [ ] **Step 3: Implementar `http-client.ts`**

- Hasta 3 intentos; reintenta con `shouldRetry` y `retryDelay`, leyendo `headers.get('retry-after')`.
- Timeout por intento con `AbortController` y `setTimeout(timeoutMs)`, limpio en `finally`.
- Error final: «No se ha podido consultar PokéAPI. Comprueba la conexión e inténtalo de nuevo.».
- Cancelación del usuario: si la señal externa está abortada, lanza «Descarga cancelada.».

- [ ] **Step 4: Instalar y registrar el plugin**

- `pnpm add @tauri-apps/plugin-http@~2`
- Añadir `tauri-plugin-http = "2"` a `src-tauri/Cargo.toml` (sin tocar la línea del usuario).
- `.plugin(tauri_plugin_http::init())` en `lib.rs`.
- En `capabilities/default.json`, añadir dentro de `permissions`:

```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://pokeapi.co/*" },
    { "url": "https://*.fandom.com/*" },
    { "url": "https://bulbapedia.bulbagarden.net/*" }
  ]
}
```

- `http.ts` solo hace `import { fetch } from '@tauri-apps/plugin-http'` y exporta `createFetchJson(fetch)`.

- [ ] **Step 5: Ejecutar y comprobar**

Run: `pnpm test:import && pnpm check && cargo check --manifest-path src-tauri/Cargo.toml --locked`
Expected: pruebas correctas, 0/0 y compilación Rust correcta.

- [ ] **Step 6: Commit** (sin la línea pendiente del usuario)

```bash
cp src-tauri/Cargo.toml /tmp/opencode/Cargo.toml.con-cambio
git checkout -- src-tauri/Cargo.toml
# volver a añadir solo tauri-plugin-http = "2"
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json pnpm-lock.yaml src/lib/import/http-client.ts src/lib/import/http.ts scripts/import-checks.test.ts
git commit -m "Acceso HTTP con lista blanca para fuentes remotas"
cp /tmp/opencode/Cargo.toml.con-cambio src-tauri/Cargo.toml
```

---

### Task 5: Vista previa compartida

**Files:**
- Create: `src/lib/components/PokedexImportPreview.svelte`
- Modify: `src/lib/components/PokedexImport.svelte`

**Interfaces:**
- Produces: componente con props `{ preview: ImportPreview; mode: 'merge' | 'insert-only' ($bindable); applying: boolean; onApply: () => void; onCancel: () => void; applyLabel: string }`.

- [ ] **Step 1: Extraer el bloque de vista previa**

Mover el marcado y los estilos de contadores, tabla, avisos, modos y botones desde `PokedexImport.svelte`. Mantener las clases `pdi-*` y los mismos textos. La tabla muestra como máximo 40 filas y los avisos 25, con el «y N más…».

- [ ] **Step 2: Conectar el importador de archivos**

`PokedexImport.svelte` conserva la elección de archivo, la ayuda de formato y el resultado; renderiza `<PokedexImportPreview bind:mode ... />` cuando hay `preview`. Sin cambios de comportamiento.

- [ ] **Step 3: Verificar**

Run: `pnpm check`
Expected: 0 errores, 0 avisos. El importador CSV sigue mostrando el mismo resumen (se comprueba en la app en la Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/PokedexImportPreview.svelte src/lib/components/PokedexImport.svelte
git commit -m "Vista previa de importacion compartida"
```

---

### Task 6: Diálogo de recolección y botón

**Files:**
- Create: `src/lib/components/PokedexRemote.svelte`
- Modify: `src/lib/components/PokedexView.svelte`

**Interfaces:**
- Consumes: `collectPokedex`, `suggestPokedexKey`, `parsePokedexOptions`, `fetchJson`, `buildPreview`, `applyImport`, `getVersionRemotePokedex`, `setVersionRemotePokedex`.
- Props: `{ versionId: number; gameName: string; versionLabel: string; sources: DataSource[]; onImported: () => void }`.

- [ ] **Step 1: Crear el diálogo**

Estados: `options`, `pokedexKey`, `maxEntries`, `loadingOptions`, `downloading`, `progress`, `preview`, `result`, `error`, `cancelled`. Al abrir: limpiar y pedir `getVersionRemotePokedex(versionId)`; cargar opciones con `parsePokedexOptions(await fetchJson('https://pokeapi.co/api/v2/pokedex?limit=100'))`. Sugerencia inicial con `suggestPokedexKey(gameName, versionLabel)`.

- [ ] **Step 2: Descarga con progreso y cancelación**

`AbortController` en el componente. `collectPokedex` con `fetchJson`, `maxEntries` (vacío → 0), `onProgress` y `signal`. Al terminar: `listGamePokemon(versionId)`, `buildPreview(records, 'pokeapi', sources, existing, gameName, versionLabel)`, `setVersionRemotePokedex`. Si `cancelled`, mostrar «Descarga cancelada; no se ha guardado nada.» y no abrir la vista previa. Deshabilitar el cierre mientras `downloading`.

- [ ] **Step 3: Aplicar**

Reutilizar `applyImport` y `PokedexImportPreview`; llamar a `onImported()` tras aplicar. Mostrar la atribución de PokéAPI bajo la vista previa y el aviso de que los datos pertenecen a The Pokémon Company.

- [ ] **Step 4: Conectar en `PokedexView.svelte`**

Añadir `<PokedexRemote ... />` antes del botón de importar archivo, dentro de `.pdx-header-actions`.

- [ ] **Step 5: Verificar**

Run: `pnpm check && pnpm build`
Expected: 0 errores/0 avisos y build correcto.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/PokedexRemote.svelte src/lib/components/PokedexView.svelte
git commit -m "Recoleccion de la Pokedex desde PokeAPI"
```

---

### Task 7: Verificación real, documentación y cierre

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Copia de seguridad de la base**

```bash
cp ~/.config/com.dexdeck.launcher/dexdeck.db \
   ~/.config/com.dexdeck.launcher/dexdeck-pre-pokeapi-$(date +%Y%m%d-%H%M%S).db
```

- [ ] **Step 2: Pedir permiso y probar en la app**

Preguntar antes de lanzar `pnpm tauri dev`. En la app:
1. Abrir una ficha con versión y entrar en Pokédex.
2. «Recolectar de PokéAPI», elegir Kanto, límite 15, descargar.
3. Comprobar nombres en español, tipos, habilidades, stats y sprite.
4. Cancelar una segunda descarga a mitad y verificar que no cambia la base.
5. Aplicar 15, reimportar y comprobar «sin cambios».
6. Revisar en SQLite: `source_id`, `source_url`, `species_id` y número nacional.

- [ ] **Step 3: Limpiar los datos de prueba**

Borrar las filas importadas de prueba (`game_pokemon` de esa versión) y dejar la base como estaba, salvo las migraciones y las fuentes sembradas.

- [ ] **Step 4: Actualizar el README**

- Tabla de áreas: Pokédex «importación CSV/JSON y recolección desde PokéAPI».
- Fase 7: marcar integración con fuentes oficiales (PokéAPI), validación/vista previa y atribución.
- Nueva sección «Recolección desde PokéAPI»: qué descarga, límites, licencia y que los datos son de The Pokémon Company.
- Entrada del 13 de noviembre de 2026 en el registro de progreso.

- [ ] **Step 5: Verificación completa**

Run:
```bash
pnpm check
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml --locked
pnpm test:import
```
Expected: 0/0, build correcto, 8 pruebas Rust y 20 pruebas TS.

- [ ] **Step 6: Commit final**

```bash
git add README.md
git commit -m "Documentacion de la recoleccion desde PokeAPI"
git status --short
```

`git status` solo debe mostrar `M src-tauri/Cargo.toml` (la línea pendiente del usuario).
