import type { DataSource } from '$lib/encyclopedia';
import {
  EMPTY_STATS,
  POKEMON_TYPE_LABELS,
  POKEMON_TYPES,
  type GamePokemon,
  type GamePokemonInput,
  type PokemonStats,
  type PokemonType,
  saveGamePokemon
} from '$lib/pokedex';
import { isWebUrl } from '$lib/url';
import { parseCsv } from './csv';

export type ImportSeverity = 'error' | 'warning';

export type ImportIssue = {
  line: number;
  message: string;
  severity: ImportSeverity;
};

export type ImportAction = 'insert' | 'update' | 'skip';

export type ImportCandidate = {
  line: number;
  action: ImportAction;
  label: string;
  input: GamePokemonInput;
  previousId: number | null;
};

export type ImportPreview = {
  format: 'csv' | 'json';
  candidates: ImportCandidate[];
  issues: ImportIssue[];
  counts: { insert: number; update: number; skip: number; errors: number; warnings: number };
  packGame: string;
  packVersion: string;
};

export type ImportFailure = { line: number; label: string; message: string };

export type ImportApplyResult = {
  imported: number;
  updated: number;
  skipped: number;
  failures: ImportFailure[];
};

type RawRecord = Record<string, string>;

const HEADER_ALIASES: Record<string, string[]> = {
  dex_number: ['numero', 'numero_local', 'numero_pokedex', 'number', 'dex_number', 'n'],
  name: ['nombre', 'name', 'pokemon', 'especie'],
  form_name: ['forma', 'form', 'form_name', 'variante'],
  type_primary: ['tipo_primario', 'tipo1', 'tipo', 'type_primary', 'type1', 'type'],
  type_secondary: ['tipo_secundario', 'tipo2', 'type_secondary', 'type2'],
  abilities: ['habilidades', 'abilities', 'habilidad', 'ability'],
  hp: ['ps', 'hp', 'vida', 'puntos_de_salud'],
  atk: ['ataque', 'atk', 'attack'],
  def: ['defensa', 'def', 'defense'],
  spa: ['atq_esp', 'atq_especial', 'ataque_especial', 'spa', 'sp_atk'],
  spd: ['def_esp', 'def_especial', 'defensa_especial', 'spd', 'sp_def'],
  spe: ['velocidad', 'spe', 'speed'],
  dex_entry: ['descripcion', 'dex_entry', 'entrada', 'entry', 'texto'],
  sprite_url: ['sprite_url', 'sprite', 'imagen', 'url_sprite'],
  sprite_path: ['sprite_path', 'ruta_sprite', 'ruta_imagen'],
  is_obtainable: ['obtenible', 'is_obtainable', 'obtainable', 'disponible'],
  source: ['fuente', 'source', 'origen', 'source_key']
};

const TYPE_LOOKUP = new Map<string, PokemonType>();

for (const type of POKEMON_TYPES) {
  TYPE_LOOKUP.set(type, type);
  TYPE_LOOKUP.set(normalizeKey(POKEMON_TYPE_LABELS[type]), type);
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pick(record: RawRecord, field: keyof typeof HEADER_ALIASES): string {
  for (const alias of HEADER_ALIASES[field]) {
    const value = record[alias];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}

function parseInteger(value: string): number | null {
  const cleaned = value.trim().replace(/\s+/g, '');
  if (cleaned === '') return null;
  const parsed = Number(cleaned.replace(/^#/, ''));
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

function parseBoolean(value: string): boolean {
  const normalized = normalizeKey(value);
  if (normalized === '') return true;
  return ['si', 's', 'true', '1', 'yes', 'y', 'x', 'obtenible'].includes(normalized);
}

function parseType(value: string): { type: PokemonType | ''; invalid: string | null } {
  const normalized = normalizeKey(value);
  if (normalized === '' || normalized === 'sin_especificar' || normalized === 'ninguno') {
    return { type: '', invalid: null };
  }
  const type = TYPE_LOOKUP.get(normalized) ?? TYPE_LOOKUP.get(value.trim().toLowerCase());
  return { type: type ?? '', invalid: type ? null : value.trim() };
}

function parseAbilities(value: string): string[] {
  return value
    .split(/[|;]/)
    .flatMap((chunk) => chunk.split(','))
    .map((ability) => ability.trim())
    .filter((ability) => ability !== '');
}

function formatNumber(value: number): string {
  return `#${String(value).padStart(4, '0')}`;
}

function normalizeStats(stats: PokemonStats): string {
  return [stats.hp, stats.atk, stats.def, stats.spa, stats.spd, stats.spe].join('|');
}

const STAT_LABELS = [
  { key: 'hp', label: 'PS' },
  { key: 'atk', label: 'Ataque' },
  { key: 'def', label: 'Defensa' },
  { key: 'spa', label: 'Ataque especial' },
  { key: 'spd', label: 'Defensa especial' },
  { key: 'spe', label: 'Velocidad' }
] as const;

function buildStats(record: RawRecord): { stats: PokemonStats | null; missing: string[]; invalid: boolean } {
  const stats: PokemonStats = { ...EMPTY_STATS };
  let filled = 0;

  for (const { key } of STAT_LABELS) {
    const raw = pick(record, key);
    if (raw === '') continue;
    const parsed = parseInteger(raw);
    if (parsed === null || parsed < 0 || parsed > 999) {
      return { stats: null, missing: [], invalid: true };
    }
    stats[key] = parsed;
    filled += 1;
  }

  if (filled === 0) return { stats: null, missing: [], invalid: false };
  if (filled === 6) return { stats, missing: [], invalid: false };

  return {
    stats,
    missing: STAT_LABELS.filter(({ key }) => record[key] === undefined || record[key] === '').map(
      ({ label }) => label
    ),
    invalid: false
  };
}

function statsEqual(a: PokemonStats | null, b: PokemonStats | null): boolean {
  if (!a || !b) return a === b;
  return normalizeStats(a) === normalizeStats(b);
}

function sameEntry(existing: GamePokemon, input: GamePokemonInput): boolean {
  return (
    existing.dex_number === input.dex_number &&
    existing.name === input.name.trim() &&
    existing.form_name === input.form_name.trim() &&
    existing.type_primary === input.type_primary &&
    existing.type_secondary === input.type_secondary &&
    existing.abilities.join('|').toLowerCase() ===
      [...input.abilities].map((ability) => ability.trim()).filter(Boolean).join('|').toLowerCase() &&
    statsEqual(existing.base_stats, input.base_stats) &&
    existing.dex_entry === input.dex_entry.trim() &&
    existing.sprite_url === input.sprite_url.trim() &&
    existing.sprite_path === input.sprite_path.trim() &&
    existing.is_obtainable === (input.is_obtainable ? 1 : 0) &&
    existing.source_id === input.source_id
  );
}

function resolveSource(value: string, sources: DataSource[]): DataSource | null {
  const normalized = normalizeKey(value);
  if (normalized === '' || normalized === 'manual' || normalized === 'entrada_manual') return null;
  return (
    sources.find((source) => normalizeKey(source.source_key) === normalized) ??
    sources.find((source) => normalizeKey(source.name) === normalized) ??
    null
  );
}

const STAT_KEY_ALIASES: Record<string, 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'> = {
  hp: 'hp',
  ps: 'hp',
  vida: 'hp',
  health: 'hp',
  atk: 'atk',
  ataque: 'atk',
  attack: 'atk',
  def: 'def',
  defensa: 'def',
  defense: 'def',
  spa: 'spa',
  sp_atk: 'spa',
  special_attack: 'spa',
  ataque_especial: 'spa',
  atq_esp: 'spa',
  spd: 'spd',
  sp_def: 'spd',
  special_defense: 'spd',
  defensa_especial: 'spd',
  def_esp: 'spd',
  spe: 'spe',
  speed: 'spe',
  velocidad: 'spe'
};

function normalizeRecord(record: Record<string, unknown>): RawRecord {
  const result: RawRecord = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    const normalized = normalizeKey(key);

    // Los paquetes JSON suelen agrupar los tipos y las estadísticas.
    if (normalized === 'types' && Array.isArray(value)) {
      const [primary, secondary] = value.map((item) => String(item));
      result.type_primary = primary ?? '';
      result.type_secondary = secondary ?? '';
      continue;
    }

    if (
      (normalized === 'base_stats' || normalized === 'stats' || normalized === 'estadisticas') &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      for (const [statKey, statValue] of Object.entries(value as Record<string, unknown>)) {
        const target = STAT_KEY_ALIASES[normalizeKey(statKey)];
        if (target && statValue !== null && statValue !== undefined) {
          result[target] = String(statValue);
        }
      }
      continue;
    }

    if (Array.isArray(value)) {
      result[normalized] = value.map((item) => String(item)).join('|');
    } else if (typeof value === 'object') {
      result[normalized] = JSON.stringify(value);
    } else {
      result[normalized] = String(value);
    }
  }

  return result;
}

type RowOutcome = { input: GamePokemonInput; label: string } | { error: string };

function buildInput(
  record: RawRecord,
  sources: DataSource[],
  issues: ImportIssue[],
  line: number
): RowOutcome {
  const name = pick(record, 'name').trim();
  const dexRaw = pick(record, 'dex_number');
  const dexNumber = parseInteger(dexRaw);

  const fail = (message: string): RowOutcome => {
    issues.push({ line, message, severity: 'error' });
    return { error: message };
  };

  if (name === '') return fail('Falta el nombre del Pokémon.');
  if (name.length > 80) return fail(`El nombre «${name}» supera los 80 caracteres.`);
  if (dexNumber === null) return fail('El número de la Pokédex debe ser un entero.');
  if (dexNumber <= 0 || dexNumber > 9999) return fail('El número debe estar entre 1 y 9999.');

  const formName = pick(record, 'form_name').trim();
  if (formName.length > 60) return fail('El nombre de la forma supera los 60 caracteres.');

  const primary = parseType(pick(record, 'type_primary'));
  if (primary.invalid) return fail(`Tipo primario desconocido: «${primary.invalid}».`);

  const secondary = parseType(pick(record, 'type_secondary'));
  if (secondary.invalid) return fail(`Tipo secundario desconocido: «${secondary.invalid}».`);

  if (primary.type !== '' && primary.type === secondary.type) {
    return fail('El tipo secundario no puede ser igual al primario.');
  }

  const abilities = parseAbilities(pick(record, 'abilities'));
  if (abilities.length > 6) return fail('Se admiten como máximo seis habilidades por entrada.');

  const stats = buildStats(record);
  if (stats.invalid) {
    return fail('Las estadísticas deben ser números enteros entre 0 y 999.');
  }
  if (stats.missing.length > 0) {
    issues.push({
      line,
      message: `Faltan estadísticas (${stats.missing.join(', ')}); se guardarán como 0.`,
      severity: 'warning'
    });
  }

  const dexEntry = pick(record, 'dex_entry').trim();
  if (dexEntry.length > 2000) return fail('La descripción supera los 2000 caracteres.');

  const spriteUrl = pick(record, 'sprite_url').trim();
  if (spriteUrl !== '' && !isWebUrl(spriteUrl)) {
    issues.push({
      line,
      message: `La URL del sprite no es válida y se ignorará: «${spriteUrl}».`,
      severity: 'warning'
    });
  }

  const spritePath = pick(record, 'sprite_path').trim();
  const sourceValue = pick(record, 'source');
  const source = resolveSource(sourceValue, sources);
  if (sourceValue !== '' && !source) {
    issues.push({
      line,
      message: `La fuente «${sourceValue}» no está registrada; la entrada quedará como manual.`,
      severity: 'warning'
    });
  }

  const label = `${formatNumber(dexNumber)} ${name}${formName ? ` · ${formName}` : ''}`;

  return {
    input: {
      dex_number: dexNumber,
      name,
      form_name: formName,
      type_primary: primary.type,
      type_secondary: secondary.type,
      abilities,
      base_stats: stats.stats,
      dex_entry: dexEntry,
      sprite_url: isWebUrl(spriteUrl) ? spriteUrl : '',
      sprite_path: spritePath,
      is_obtainable: parseBoolean(pick(record, 'is_obtainable')),
      source_id: source?.id ?? null
    },
    label
  };
}

type ParsedRow = {
  line: number;
  record: RawRecord;
  columns?: { expected: number; found: number };
};

export function buildPreview(
  records: ParsedRow[],
  format: 'csv' | 'json',
  sources: DataSource[],
  existing: GamePokemon[],
  packGame = '',
  packVersion = ''
): ImportPreview {
  const issues: ImportIssue[] = [];
  const candidates: ImportCandidate[] = [];
  const existingByKey = new Map<string, GamePokemon>();

  for (const entry of existing) {
    existingByKey.set(`${entry.dex_number}\u0000${entry.form_name.toLowerCase()}`, entry);
  }

  const seen = new Map<string, number>();

  for (const { line, record, columns } of records) {
    if (columns && columns.expected !== columns.found) {
      issues.push({
        line,
        message: `La fila tiene ${columns.found} columnas y la cabecera ${columns.expected}; revisa que los datos estén alineados.`,
        severity: 'warning'
      });
    }

    const outcome = buildInput(record, sources, issues, line);
    if ('error' in outcome) continue;

    const key = `${outcome.input.dex_number}\u0000${outcome.input.form_name.toLowerCase()}`;
    const previousLine = seen.get(key);

    if (previousLine !== undefined) {
      issues.push({
        line,
        message: `Repite el número ${outcome.input.dex_number} con la forma «${outcome.input.form_name || 'sin forma'}» que ya aparece en la línea ${previousLine}.`,
        severity: 'error'
      });
      continue;
    }

    seen.set(key, line);

    const previous = existingByKey.get(key) ?? null;
    const action: ImportAction = !previous
      ? 'insert'
      : sameEntry(previous, outcome.input)
        ? 'skip'
        : 'update';

    candidates.push({
      line,
      action,
      label: outcome.label,
      input: outcome.input,
      previousId: previous?.id ?? null
    });
  }

  const counts = {
    insert: candidates.filter((candidate) => candidate.action === 'insert').length,
    update: candidates.filter((candidate) => candidate.action === 'update').length,
    skip: candidates.filter((candidate) => candidate.action === 'skip').length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length
  };

  return { format, candidates, issues, counts, packGame, packVersion };
}

function recordsFromCsv(text: string): ParsedRow[] {
  const table = parseCsv(text);

  if (table.header.length === 0) {
    throw new Error('El archivo CSV está vacío.');
  }

  const header = table.header.map(normalizeKey);

  return table.records.map((record) => {
    const mapped: RawRecord = {};
    record.values.forEach((value, index) => {
      const key = header[index];
      if (key) mapped[key] = value.trim();
    });

    const columns =
      record.values.length === header.length
        ? undefined
        : { expected: header.length, found: record.values.length };

    return { line: record.line, record: mapped, columns };
  });
}

function recordsFromJson(text: string): {
  records: ParsedRow[];
  packGame: string;
  packVersion: string;
} {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`El JSON no es válido: ${message}`);
  }

  const list: unknown[] = [];
  let packGame = '';
  let packVersion = '';

  if (Array.isArray(parsed)) {
    list.push(...parsed);
  } else if (parsed && typeof parsed === 'object') {
    const container = parsed as Record<string, unknown>;
    const entries = container.pokemon ?? container.pokemons ?? container.entries;

    if (Array.isArray(entries)) {
      list.push(...entries);
      const game = container.game;
      if (game && typeof game === 'object') {
        const gameObject = game as Record<string, unknown>;
        packGame = typeof gameObject.name === 'string' ? gameObject.name : '';
        packVersion = typeof gameObject.version_label === 'string' ? gameObject.version_label : '';
      }
    } else if ('name' in container || 'nombre' in container) {
      list.push(container);
    } else {
      throw new Error('El JSON debe ser una lista de Pokémon o un paquete con la clave «pokemon».');
    }
  } else {
    throw new Error('El JSON no contiene datos reconocibles.');
  }

  const records = list.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`La entrada ${index + 1} del JSON no es un objeto.`);
    }
    return { line: index + 1, record: normalizeRecord(entry as Record<string, unknown>) };
  });

  return { records, packGame, packVersion };
}

export function parsePokemonFile(
  text: string,
  fileName: string,
  sources: DataSource[],
  existing: GamePokemon[]
): ImportPreview {
  const isJson = fileName.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{') || text.trimStart().startsWith('[');

  if (isJson) {
    const { records, packGame, packVersion } = recordsFromJson(text);
    return buildPreview(records, 'json', sources, existing, packGame, packVersion);
  }

  return buildPreview(recordsFromCsv(text), 'csv', sources, existing);
}

export async function applyImport(
  versionId: number,
  preview: ImportPreview,
  mode: 'merge' | 'insert-only'
): Promise<ImportApplyResult> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const failures: ImportFailure[] = [];

  for (const candidate of preview.candidates) {
    if (candidate.action === 'skip' || (mode === 'insert-only' && candidate.action === 'update')) {
      skipped += 1;
      continue;
    }

    try {
      await saveGamePokemon(
        versionId,
        candidate.input,
        candidate.action === 'update' ? (candidate.previousId ?? undefined) : undefined
      );

      if (candidate.action === 'update') {
        updated += 1;
      } else {
        imported += 1;
      }
    } catch (error) {
      failures.push({
        line: candidate.line,
        label: candidate.label,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { imported, updated, skipped, failures };
}
