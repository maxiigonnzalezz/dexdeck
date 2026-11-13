// Adaptador de PokéAPI. Todo lo que no sea red es puro: recibe respuestas ya
// descargadas y devuelve las mismas filas normalizadas que el importador de
// archivos, para que la validación y la vista previa sean únicas.
import { mapWithConcurrency } from './concurrency';
import type { ImportIssue, ParsedRow, RawRecord } from './pokemon-import';

const API = 'https://pokeapi.co/api/v2';

export type LocalizedValue = { value: string; language: string };
export type LocalizedName = { name: string; language: { name: string } };
export type FlavorText = { flavor_text: string; language: { name: string } };
export type PokedexOption = { key: string; label: string };
export type PokedexEntry = { entryNumber: number; speciesKey: string; speciesUrl: string };

export type ToRawRecordInput = {
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
    sprites?: {
      front_default?: string | null;
      other?: Record<string, { front_default?: string | null }>;
    };
  };
};

export type CollectOptions = {
  pokedexKey: string;
  maxEntries?: number;
  fetchJson: (url: string) => Promise<unknown>;
  onProgress?: (progress: { done: number; total: number; current: string }) => void;
  signal?: AbortSignal;
};

export type CollectResult = {
  records: ParsedRow[];
  issues: ImportIssue[];
  cancelled: boolean;
};

export const POKEDEX_LABELS: Record<string, string> = {
  kanto: 'Kanto',
  'updated-kanto': 'Kanto (actualizada)',
  'original-johto': 'Johto (original)',
  'updated-johto': 'Johto (actualizada)',
  hoenn: 'Hoenn',
  'updated-hoenn': 'Hoenn (actualizada)',
  sinnoh: 'Sinnoh',
  'extended-sinnoh': 'Sinnoh (extendida)',
  unova: 'Unova',
  'updated-unova': 'Unova (actualizada)',
  'kalos-central': 'Kalos (centro)',
  'kalos-coastal': 'Kalos (costa)',
  'kalos-mountain': 'Kalos (montaña)',
  'original-alola': 'Alola (original)',
  'updated-alola': 'Alola (actualizada)',
  galar: 'Galar',
  'isle-of-armor': 'Isla de la Armadura',
  'crown-tundra': 'Tundra Corona',
  hisui: 'Hisui',
  paldea: 'Paldea',
  kitakami: 'Kitakami',
  blueberry: 'Meseta Blueberry',
  'letsgo-kanto': 'Kanto (Let’s Go)',
  'conquest-gallery': 'Conquista',
  national: 'Nacional'
};

const POKEDEX_ORDER = Object.keys(POKEDEX_LABELS);

const SUGGESTIONS: Array<{ key: string; words: string[] }> = [
  { key: 'updated-johto', words: ['heartgold', 'soulsilver', 'oro heartgold', 'plata soulsilver'] },
  { key: 'kanto', words: ['firered', 'leafgreen', 'rojo fuego', 'verde hoja'] },
  { key: 'updated-hoenn', words: ['omega ruby', 'alpha sapphire', 'rubi omega', 'zafiro alfa'] },
  { key: 'sinnoh', words: ['diamond', 'pearl', 'platinum', 'diamante', 'perla', 'platino', 'brillante', 'resplandeciente'] },
  { key: 'updated-unova', words: ['black 2', 'white 2', 'negro 2', 'blanco 2'] },
  { key: 'updated-alola', words: ['ultra sun', 'ultra moon', 'ultrasol', 'ultraluna'] },
  { key: 'letsgo-kanto', words: ['lets go', 'let’s go', 'let s go'] },
  { key: 'hoenn', words: ['ruby', 'sapphire', 'emerald', 'rubi', 'zafiro', 'esmeralda'] },
  { key: 'unova', words: ['black', 'white', 'negro', 'blanco'] },
  { key: 'original-alola', words: ['sun', 'moon', 'sol', 'luna'] },
  { key: 'galar', words: ['sword', 'shield', 'espada', 'escudo'] },
  { key: 'hisui', words: ['legends', 'leyendas', 'arceus'] },
  { key: 'paldea', words: ['scarlet', 'violet', 'escarlata', 'purpura'] },
  { key: 'kanto', words: ['red', 'blue', 'yellow', 'green', 'rojo', 'azul', 'amarillo', 'verde', 'pikachu', 'eevee'] }
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Sugiere una Pokédex a partir del nombre del juego; `''` si no lo reconoce. */
export function suggestPokedexKey(gameName: string, versionLabel: string): string {
  const haystack = normalize(`${gameName} ${versionLabel}`);

  for (const suggestion of SUGGESTIONS) {
    if (suggestion.words.some((word) => haystack.includes(normalize(word)))) {
      return suggestion.key;
    }
  }

  return '';
}

export function prettyName(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function objectOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parsePokedexOptions(payload: unknown): PokedexOption[] {
  const results = arrayOf<Record<string, unknown>>(objectOf(payload).results);
  const options: PokedexOption[] = [];

  for (const result of results) {
    const key = typeof result.name === 'string' ? result.name : '';
    if (key === '') continue;
    options.push({ key, label: POKEDEX_LABELS[key] ?? prettyName(key) });
  }

  const position = (key: string) => {
    const index = POKEDEX_ORDER.indexOf(key);
    return index === -1 ? POKEDEX_ORDER.length : index;
  };

  return options.sort((a, b) => position(a.key) - position(b.key) || a.label.localeCompare(b.label));
}

export function parsePokedexEntries(payload: unknown): PokedexEntry[] {
  const container = objectOf(payload);
  const entries = container.pokemon_entries;

  if (!Array.isArray(entries)) {
    throw new Error('La respuesta de Pokédex no tiene el formato esperado.');
  }

  return entries.map((raw) => {
    const entry = objectOf(raw);
    const species = objectOf(entry.pokemon_species);
    const entryNumber = Number(entry.entry_number);
    const speciesUrl = typeof species.url === 'string' ? species.url : '';
    const speciesKey = typeof species.name === 'string' ? species.name : '';

    if (!Number.isSafeInteger(entryNumber) || entryNumber <= 0 || speciesUrl === '' || speciesKey === '') {
      throw new Error('La respuesta de Pokédex no tiene el formato esperado.');
    }

    return { entryNumber, speciesKey, speciesUrl };
  });
}

function pickLocalized<T>(
  entries: T[] | undefined,
  read: (entry: T) => string,
  language: (entry: T) => string
): LocalizedValue | null {
  const list = entries ?? [];

  for (const code of ['es', 'en']) {
    const found = list.find((entry) => language(entry) === code);
    if (found) return { value: read(found), language: code };
  }

  const first = list[0];
  return first ? { value: read(first), language: language(first) } : null;
}

export function pickLocalizedName(names: LocalizedName[] | undefined): LocalizedValue | null {
  return pickLocalized(
    names,
    (entry) => entry.name,
    (entry) => entry.language?.name ?? ''
  );
}

export function pickFlavorText(entries: FlavorText[] | undefined): LocalizedValue | null {
  return pickLocalized(
    entries,
    (entry) => entry.flavor_text,
    (entry) => entry.language?.name ?? ''
  );
}

export function cleanFlavorText(text: string): string {
  return text
    .replace(/[\n\r\f\u00ad]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STAT_KEYS: Record<string, 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe'
};

export function toRawRecord(input: ToRawRecordInput): RawRecord {
  const localizedName = pickLocalizedName(input.species.names);
  const flavor = pickFlavorText(input.species.flavor_text_entries);
  const types = [...(input.pokemon.types ?? [])]
    .sort((a, b) => a.slot - b.slot)
    .map((entry) => entry.type.name);
  const abilities = (input.pokemon.abilities ?? []).map(
    (entry) => input.abilities.get(entry.ability.name) ?? prettyName(entry.ability.name)
  );
  const stats: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> = {};

  for (const entry of input.pokemon.stats ?? []) {
    const key = STAT_KEYS[entry.stat.name];
    if (key) stats[key] = entry.base_stat;
  }

  const artwork = input.pokemon.sprites?.other?.['official-artwork']?.front_default;
  const spriteUrl = artwork ?? input.pokemon.sprites?.front_default ?? '';

  const record: RawRecord = {
    dex_number: String(input.entryNumber),
    name: localizedName?.value ?? prettyName(input.speciesKey),
    form_name: '',
    type_primary: types[0] ?? '',
    type_secondary: types[1] ?? '',
    abilities: abilities.join('|'),
    hp: String(stats.hp ?? 0),
    atk: String(stats.atk ?? 0),
    def: String(stats.def ?? 0),
    spa: String(stats.spa ?? 0),
    spd: String(stats.spd ?? 0),
    spe: String(stats.spe ?? 0),
    dex_entry: flavor ? cleanFlavorText(flavor.value) : '',
    sprite_url: spriteUrl,
    sprite_path: '',
    is_obtainable: 'si',
    source: 'pokeapi',
    source_url: `${API}/pokemon-species/${input.nationalNumber}/`,
    species_key: `pokeapi:${input.speciesKey}`,
    national_dex_number: String(input.nationalNumber)
  };

  return record;
}

export async function collectPokedex(options: CollectOptions): Promise<CollectResult> {
  const { pokedexKey, fetchJson, onProgress, signal } = options;
  const issues: ImportIssue[] = [];
  const abilityNames = new Map<string, string>();

  const pokedex = await fetchJson(`${API}/pokedex/${encodeURIComponent(pokedexKey)}`);
  let entries = parsePokedexEntries(pokedex);

  const max = options.maxEntries ?? 0;
  if (Number.isInteger(max) && max > 0) {
    entries = entries.slice(0, max);
  }

  const total = entries.length;
  let done = 0;

  const rows = await mapWithConcurrency(
    entries,
    3,
    async (entry) => {
      if (signal?.aborted) return undefined;

      try {
        const species = objectOf(await fetchJson(entry.speciesUrl));
        const speciesId = Number(species.id);

        if (!Number.isSafeInteger(speciesId) || speciesId <= 0) {
          throw new Error('La especie no tiene un identificador válido.');
        }

        const pokemon = objectOf(await fetchJson(`${API}/pokemon/${speciesId}`));
        const abilityEntries = arrayOf<{ ability: { name: string } }>(pokemon.abilities);

        for (const item of abilityEntries) {
          const abilityKey = item.ability?.name;
          if (!abilityKey || abilityNames.has(abilityKey)) continue;
          if (signal?.aborted) break;

          try {
            const ability = objectOf(await fetchJson(`${API}/ability/${encodeURIComponent(abilityKey)}`));
            const localized = pickLocalizedName(arrayOf<LocalizedName>(ability.names));
            abilityNames.set(abilityKey, localized?.value ?? prettyName(abilityKey));
          } catch {
            abilityNames.set(abilityKey, prettyName(abilityKey));
          }
        }

        const rawRecord = toRawRecord({
          entryNumber: entry.entryNumber,
          speciesKey: entry.speciesKey,
          nationalNumber: speciesId,
          abilities: abilityNames,
          species: {
            names: arrayOf<LocalizedName>(species.names),
            flavor_text_entries: arrayOf<FlavorText>(species.flavor_text_entries)
          },
          pokemon: {
            id: speciesId,
            types: arrayOf<{ slot: number; type: { name: string } }>(pokemon.types),
            abilities: abilityEntries,
            stats: arrayOf<{ base_stat: number; stat: { name: string } }>(pokemon.stats),
            sprites: objectOf(pokemon.sprites) as ToRawRecordInput['pokemon']['sprites']
          }
        });

        done += 1;
        onProgress?.({ done, total, current: String(rawRecord.name) });

        return { line: entry.entryNumber, record: rawRecord } satisfies ParsedRow;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        issues.push({
          line: entry.entryNumber,
          message: `No se pudo descargar ${prettyName(entry.speciesKey)}: ${message}`,
          severity: 'error'
        });
        done += 1;
        onProgress?.({ done, total, current: prettyName(entry.speciesKey) });
        return undefined;
      }
    },
    signal
  );

  const records = rows
    .filter((row): row is ParsedRow => row !== undefined)
    .sort((a, b) => Number(a.record.dex_number) - Number(b.record.dex_number));

  return { records, issues, cancelled: signal?.aborted ?? false };
}
