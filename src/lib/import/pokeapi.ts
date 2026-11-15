// Adaptador de PokéAPI. Todo lo que no sea red es puro: recibe respuestas ya
// descargadas y devuelve las mismas filas normalizadas que el importador de
// archivos, para que la validación y la vista previa sean únicas.
import { mapWithConcurrency } from './concurrency';
import { appendGameExclusiveEntries, exclusiveNote, isExclusiveToOtherGame } from './game-pokedex';
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
  /** Efecto de cada habilidad por su slug de PokéAPI. */
  abilityDetails?: Map<string, string>;
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
  gameKey?: string;
  maxEntries?: number;
  fetchJson: (url: string) => Promise<unknown>;
  onProgress?: (progress: { done: number; total: number; current: string }) => void;
  signal?: AbortSignal;
};

export type CollectResult = {
  records: ParsedRow[];
  issues: ImportIssue[];
  cancelled: boolean;
  exclusiveAdded: number;
};

export const REGIONAL_POKEDEXES = [
  { key: 'kanto', label: 'Kanto', sourceKeys: ['kanto'] },
  { key: 'original-johto', label: 'Johto', sourceKeys: ['original-johto'] },
  { key: 'hoenn', label: 'Hoenn', sourceKeys: ['hoenn'] },
  { key: 'sinnoh', label: 'Sinnoh', sourceKeys: ['sinnoh'] },
  { key: 'unova', label: 'Teselia', sourceKeys: ['unova'] },
  {
    key: 'kalos',
    label: 'Kalos',
    sourceKeys: ['kalos-central', 'kalos-coastal', 'kalos-mountain']
  },
  { key: 'original-alola', label: 'Alola', sourceKeys: ['original-alola'] },
  { key: 'galar', label: 'Galar', sourceKeys: ['galar'] },
  { key: 'hisui', label: 'Hisui', sourceKeys: ['hisui'] },
  { key: 'paldea', label: 'Paldea', sourceKeys: ['paldea'] }
] as const;

export const POKEDEX_LABELS: Record<string, string> = Object.fromEntries(
  REGIONAL_POKEDEXES.map(({ key, label }) => [key, label])
);


const SUGGESTIONS: Array<{ key: string; words: string[] }> = [
  { key: 'hisui', words: ['legends arceus', 'leyendas arceus', 'arceus'] },
  { key: 'kalos', words: ['pokemon x', 'pokemon y', 'kalos'] },
  { key: 'paldea', words: ['scarlet', 'violet', 'escarlata', 'purpura', 'paldea'] },
  { key: 'galar', words: ['sword', 'shield', 'espada', 'escudo', 'galar'] },
  { key: 'original-alola', words: ['ultra sun', 'ultra moon', 'ultrasol', 'ultraluna', 'pokemon sun', 'pokemon moon', 'pokemon sol', 'pokemon luna', 'alola'] },
  { key: 'unova', words: ['black 2', 'white 2', 'negro 2', 'blanco 2', 'pokemon black', 'pokemon white', 'pokemon negro', 'pokemon blanco', 'unova', 'teselia'] },
  { key: 'sinnoh', words: ['brilliant diamond', 'shining pearl', 'diamante brillante', 'perla reluciente', 'diamond', 'pearl', 'platinum', 'diamante', 'perla', 'platino', 'sinnoh'] },
  { key: 'hoenn', words: ['omega ruby', 'alpha sapphire', 'rubi omega', 'zafiro alfa', 'ruby', 'sapphire', 'emerald', 'rubi', 'zafiro', 'esmeralda', 'hoenn'] },
  { key: 'original-johto', words: ['heartgold', 'soulsilver', 'oro heartgold', 'plata soulsilver', 'pokemon gold', 'pokemon silver', 'pokemon crystal', 'oro', 'plata', 'cristal', 'johto'] },
  { key: 'kanto', words: ['fire red', 'leaf green', 'firered', 'leafgreen', 'rojo fuego', 'verde hoja', 'lets go', 'let s go', 'red', 'blue', 'yellow', 'green', 'rojo', 'azul', 'amarillo', 'verde', 'kanto'] }
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
  const haystack = ` ${normalize(`${gameName} ${versionLabel}`)} `;

  for (const suggestion of SUGGESTIONS) {
    if (suggestion.words.some((word) => haystack.includes(` ${normalize(word)} `))) {
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
  const availableKeys = new Set(
    results
      .map((result) => (typeof result.name === 'string' ? result.name : ''))
      .filter((key) => key !== '')
  );

  // Una sola Pokédex base por región. Kalos se recolecta desde sus tres zonas.
  return REGIONAL_POKEDEXES
    .filter((region) => region.sourceKeys.some((sourceKey) => availableKeys.has(sourceKey)))
    .map((region) => ({ key: region.key, label: region.label }));
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

  const abilityDetails: Record<string, string> = {};
  for (const entry of input.pokemon.abilities ?? []) {
    const slug = entry.ability?.name;
    if (!slug) continue;
    const effect = input.abilityDetails?.get(slug);
    if (!effect) continue;
    const name = input.abilities.get(slug) ?? prettyName(slug);
    abilityDetails[name] = effect;
  }
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
    obtain_note: '',
    ability_details: JSON.stringify(abilityDetails),
    source: 'pokeapi',
    source_url: `${API}/pokemon-species/${input.nationalNumber}/`,
    species_key: `pokeapi:${input.speciesKey}`,
    national_dex_number: String(input.nationalNumber)
  };

  return record;
}

export async function collectPokedex(options: CollectOptions): Promise<CollectResult> {
  const { pokedexKey, gameKey = '', fetchJson, onProgress, signal } = options;
  const issues: ImportIssue[] = [];
  const abilityNames = new Map<string, string>();
  const abilityDetails = new Map<string, string>();

  let entries: PokedexEntry[] = [];

  if (pokedexKey === 'kalos') {
    const [central, coastal, mountain] = await Promise.all([
      fetchJson(`${API}/pokedex/kalos-central`),
      fetchJson(`${API}/pokedex/kalos-coastal`),
      fetchJson(`${API}/pokedex/kalos-mountain`)
    ]);

    const seenSpecies = new Set<string>();
    let num = 1;

    for (const dex of [central, coastal, mountain]) {
      const regionEntries = parsePokedexEntries(dex).sort((a, b) => a.entryNumber - b.entryNumber);
      for (const entry of regionEntries) {
        const speciesIdentity = entry.speciesKey.toLocaleLowerCase('en');
        if (!seenSpecies.has(speciesIdentity)) {
          seenSpecies.add(speciesIdentity);
          entries.push({
            entryNumber: num++,
            speciesKey: entry.speciesKey,
            speciesUrl: entry.speciesUrl
          });
        }
      }
    }
  } else {
    const pokedex = await fetchJson(`${API}/pokedex/${encodeURIComponent(pokedexKey)}`);
    entries = parsePokedexEntries(pokedex);
  }

  // La selección de edición amplía la Pokédex regional; nunca elimina entradas regionales.
  const regionalSpecies = new Set(entries.map((entry) => entry.speciesKey.trim().toLowerCase()));
  if (gameKey !== '') {
    const extended = appendGameExclusiveEntries(entries, gameKey, API);
    entries = extended.entries;
  }

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

            const flavor = pickFlavorText(arrayOf<FlavorText>(ability.flavor_text_entries));
            if (flavor) abilityDetails.set(abilityKey, cleanFlavorText(flavor.value));
          } catch {
            abilityNames.set(abilityKey, prettyName(abilityKey));
          }
        }

        const rawRecord = toRawRecord({
          entryNumber: entry.entryNumber,
          speciesKey: entry.speciesKey,
          nationalNumber: speciesId,
          abilities: abilityNames,
          abilityDetails,
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

        if (isExclusiveToOtherGame(gameKey, entry.speciesKey)) {
          rawRecord.is_obtainable = 'no';
          rawRecord.obtain_note = exclusiveNote(gameKey, entry.speciesKey);
        }
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

  const exclusiveAdded = records.filter(({ record }) => {
    const speciesKey = (record.species_key ?? '').replace(/^pokeapi:/, '').trim().toLowerCase();
    return speciesKey !== '' && !regionalSpecies.has(speciesKey);
  }).length;
  return { records, issues, cancelled: signal?.aborted ?? false, exclusiveAdded };
}
