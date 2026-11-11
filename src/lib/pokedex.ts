import Database from '@tauri-apps/plugin-sql';

export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
  'stellar',
  'unknown'
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export const POKEMON_TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#9fa39a',
  fire: '#f08030',
  water: '#6890f0',
  electric: '#f8d030',
  grass: '#78c850',
  ice: '#98d8d8',
  fighting: '#c03028',
  poison: '#a040a0',
  ground: '#e0c068',
  flying: '#a890f0',
  psychic: '#f85888',
  bug: '#a8b820',
  rock: '#b8a038',
  ghost: '#705898',
  dragon: '#7038f8',
  dark: '#705848',
  steel: '#b8b8d0',
  fairy: '#ee99ac',
  stellar: '#6fb7c9',
  unknown: '#68a090'
};


export const POKEMON_TYPE_LABELS: Record<PokemonType, string> = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
  stellar: 'Estelar',
  unknown: 'Desconocido'
};

export type PokemonStats = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
};

export const EMPTY_STATS: PokemonStats = {
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0
};

export type GamePokemon = {
  id: number;
  game_version_id: number;
  species_id: number | null;
  dex_number: number;
  name: string;
  form_name: string;
  type_primary: PokemonType | '';
  type_secondary: PokemonType | '';
  abilities: string[];
  base_stats: PokemonStats | null;
  dex_entry: string;
  sprite_url: string;
  sprite_path: string;
  is_obtainable: number;
  source_id: number | null;
  source_name: string | null;
  source_attribution: string | null;
  source_license: string | null;
};

export type GamePokemonInput = {
  dex_number: number;
  name: string;
  form_name: string;
  type_primary: PokemonType | '';
  type_secondary: PokemonType | '';
  abilities: string[];
  base_stats: PokemonStats | null;
  dex_entry: string;
  sprite_url: string;
  sprite_path: string;
  is_obtainable: boolean;
  source_id: number | null;
};

type GamePokemonRow = Omit<GamePokemon, 'abilities' | 'base_stats' | 'is_obtainable'> & {
  abilities_json: string;
  base_stats_json: string;
  is_obtainable: number;
};

let databasePromise: Promise<Database> | undefined;

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load('sqlite:dexdeck.db').catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

function parseAbilities(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  } catch {
    return [];
  }
}

function parseStats(value: string): PokemonStats | null {
  try {
    const parsed = JSON.parse(value) as Partial<PokemonStats> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    const keys: Array<keyof PokemonStats> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    const hasValue = keys.some((key) => Number(parsed[key]) > 0);
    if (!hasValue) return null;

    return {
      hp: Number(parsed.hp) || 0,
      atk: Number(parsed.atk) || 0,
      def: Number(parsed.def) || 0,
      spa: Number(parsed.spa) || 0,
      spd: Number(parsed.spd) || 0,
      spe: Number(parsed.spe) || 0
    };
  } catch {
    return null;
  }
}

function serializeAbilities(abilities: string[]): string {
  const cleaned = Array.from(
    new Set(abilities.map((ability) => ability.trim()).filter((ability) => ability !== ''))
  );

  return JSON.stringify(cleaned);
}

function serializeStats(stats: PokemonStats | null): string {
  if (!stats) return '{}';

  const keys: Array<keyof PokemonStats> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const hasValue = keys.some((key) => Number(stats[key]) > 0);

  return hasValue ? JSON.stringify(stats) : '{}';
}

async function validateSourceId(db: Database, sourceId: number | null): Promise<number | null> {
  if (sourceId === null) return null;

  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) {
    throw new Error('La fuente seleccionada no es válida.');
  }

  const rows = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM data_sources WHERE id = $1',
    [sourceId]
  );

  if ((rows[0]?.total ?? 0) === 0) {
    throw new Error('La fuente seleccionada ya no existe.');
  }

  return sourceId;
}

export async function listGamePokemon(versionId: number): Promise<GamePokemon[]> {
  const db = await getDatabase();

  if (!Number.isSafeInteger(versionId) || versionId <= 0) {
    throw new Error('La versión seleccionada no es válida.');
  }

  const rows = await db.select<GamePokemonRow[]>(`
    SELECT
      gp.id,
      gp.game_version_id,
      gp.species_id,
      gp.dex_number,
      gp.name,
      gp.form_name,
      gp.type_primary,
      gp.type_secondary,
      gp.abilities_json,
      gp.base_stats_json,
      gp.dex_entry,
      gp.sprite_url,
      gp.sprite_path,
      gp.is_obtainable,
      gp.source_id,
      ds.name AS source_name,
      ds.attribution_text AS source_attribution,
      ds.license_name AS source_license
    FROM game_pokemon gp
    LEFT JOIN data_sources ds ON ds.id = gp.source_id
    WHERE gp.game_version_id = $1
    ORDER BY gp.dex_number ASC, gp.form_name COLLATE NOCASE ASC, gp.name COLLATE NOCASE ASC
  `, [versionId]);

  return rows.map((row) => ({
    ...row,
    type_primary: row.type_primary as PokemonType | '',
    type_secondary: row.type_secondary as PokemonType | '',
    abilities: parseAbilities(row.abilities_json),
    base_stats: parseStats(row.base_stats_json),
    is_obtainable: row.is_obtainable
  }));
}

export async function saveGamePokemon(
  versionId: number,
  input: GamePokemonInput,
  pokemonId?: number
): Promise<void> {
  const db = await getDatabase();
  const name = input.name.trim();
  const formName = input.form_name.trim();
  const dexNumber = Number(input.dex_number);

  if (!name) {
    throw new Error('El nombre del Pokémon es obligatorio.');
  }

  if (!Number.isSafeInteger(dexNumber) || dexNumber <= 0) {
    throw new Error('El número de la Pokédex debe ser un entero mayor que cero.');
  }

  if (input.type_primary && input.type_primary === input.type_secondary) {
    throw new Error('El tipo secundario debe ser distinto del primario.');
  }

  const sourceId = await validateSourceId(db, input.source_id);
  const abilities = serializeAbilities(input.abilities);
  const stats = serializeStats(input.base_stats);

  try {
    if (pokemonId === undefined) {
      await db.execute(`
        INSERT INTO game_pokemon (
          game_version_id,
          dex_number,
          name,
          form_name,
          type_primary,
          type_secondary,
          abilities_json,
          base_stats_json,
          dex_entry,
          sprite_url,
          sprite_path,
          is_obtainable,
          source_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        versionId,
        dexNumber,
        name,
        formName,
        input.type_primary,
        input.type_secondary,
        abilities,
        stats,
        input.dex_entry.trim(),
        input.sprite_url.trim(),
        input.sprite_path.trim(),
        input.is_obtainable ? 1 : 0,
        sourceId
      ]);
      return;
    }

    const result = await db.execute(`
      UPDATE game_pokemon
      SET
        dex_number = $1,
        name = $2,
        form_name = $3,
        type_primary = $4,
        type_secondary = $5,
        abilities_json = $6,
        base_stats_json = $7,
        dex_entry = $8,
        sprite_url = $9,
        sprite_path = $10,
        is_obtainable = $11,
        source_id = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 AND game_version_id = $14
    `, [
      dexNumber,
      name,
      formName,
      input.type_primary,
      input.type_secondary,
      abilities,
      stats,
      input.dex_entry.trim(),
      input.sprite_url.trim(),
      input.sprite_path.trim(),
      input.is_obtainable ? 1 : 0,
      sourceId,
      pokemonId,
      versionId
    ]);

    if (result.rowsAffected === 0) {
      throw new Error('La entrada ya no existe en esta versión.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE constraint failed')) {
      throw new Error('Ya hay una entrada con ese número y esa forma en esta versión.');
    }
    throw error;
  }
}

export async function deleteGamePokemon(pokemonId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM game_pokemon WHERE id = $1', [pokemonId]);
}
