import Database from '@tauri-apps/plugin-sql';

export type CatalogGameType = 'official' | 'fangame' | 'rom_hack' | 'other';

export type CatalogGame = {
  id: number;
  slug: string;
  name: string;
  developer: string;
  game_type: CatalogGameType;
  description: string;
  cover_url: string;
  official_url: string;
  version_count: number;
  primary_version: string | null;
};

export type CatalogGameInput = {
  slug: string;
  name: string;
  developer: string;
  game_type: CatalogGameType;
  description: string;
  cover_url: string;
  official_url: string;
  version_label: string;
  platform: string;
};

export type CatalogGameUpdateInput = Pick<
  CatalogGameInput,
  'slug' | 'name' | 'developer' | 'game_type' | 'description' | 'cover_url' | 'official_url'
>;

export type CatalogGameVersion = {
  id: number;
  catalog_game_id: number;
  version_label: string;
  platform: string;
  release_date: string;
  notes: string;
  is_default: number;
};

export type VersionSummary = {
  pokemon_count: number;
  region_count: number;
  location_count: number;
  encounter_count: number;
  item_count: number;
  guide_count: number;
  map_count: number;
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

export async function listCatalogGames(): Promise<CatalogGame[]> {
  const db = await getDatabase();

  return db.select<CatalogGame[]>(`
    SELECT
      cg.id,
      cg.slug,
      cg.name,
      cg.developer,
      cg.game_type,
      cg.description,
      cg.cover_url,
      cg.official_url,
      (
        SELECT COUNT(*)
        FROM game_versions gv
        WHERE gv.catalog_game_id = cg.id
      ) AS version_count,
      (
        SELECT gv.version_label
        FROM game_versions gv
        WHERE gv.catalog_game_id = cg.id
        ORDER BY gv.is_default DESC, gv.id ASC
        LIMIT 1
      ) AS primary_version
    FROM catalog_games cg
    ORDER BY cg.name COLLATE NOCASE ASC
  `);
}

export async function listCatalogGameVersions(
  catalogGameId: number
): Promise<CatalogGameVersion[]> {
  const db = await getDatabase();

  return db.select<CatalogGameVersion[]>(`
    SELECT
      id,
      catalog_game_id,
      version_label,
      platform,
      release_date,
      notes,
      is_default
    FROM game_versions
    WHERE catalog_game_id = $1
    ORDER BY is_default DESC, id ASC
  `, [catalogGameId]);
}

export async function getVersionSummary(versionId: number): Promise<VersionSummary> {
  const db = await getDatabase();
  const rows = await db.select<VersionSummary[]>(`
    SELECT
      (SELECT COUNT(*) FROM game_pokemon WHERE game_version_id = $1) AS pokemon_count,
      (SELECT COUNT(*) FROM regions WHERE game_version_id = $1) AS region_count,
      (SELECT COUNT(*)
         FROM locations l
         JOIN regions r ON r.id = l.region_id
        WHERE r.game_version_id = $1) AS location_count,
      (SELECT COUNT(*)
         FROM encounters e
         JOIN locations l ON l.id = e.location_id
         JOIN regions r ON r.id = l.region_id
        WHERE r.game_version_id = $1) AS encounter_count,
      (SELECT COUNT(*) FROM game_items WHERE game_version_id = $1) AS item_count,
      (SELECT COUNT(*) FROM guides WHERE game_version_id = $1 AND status = 'published') AS guide_count,
      (SELECT COUNT(*) FROM map_assets WHERE game_version_id = $1) AS map_count
  `, [versionId]);

  if (!rows[0]) {
    throw new Error('No se ha podido consultar el resumen de esta versión.');
  }

  return rows[0];
}

export async function createCatalogGame(input: CatalogGameInput): Promise<number> {
  const db = await getDatabase();
  const slug = input.slug.trim();
  const name = input.name.trim();
  const versionLabel = input.version_label.trim();

  if (!name || !slug || !versionLabel) {
    throw new Error('El nombre, el identificador y la versión son obligatorios.');
  }

  await db.execute(`
    INSERT INTO catalog_games (
      slug,
      name,
      developer,
      game_type,
      description,
      cover_url,
      official_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    slug,
    name,
    input.developer.trim() || 'Desarrollador desconocido',
    input.game_type,
    input.description.trim(),
    input.cover_url.trim(),
    input.official_url.trim()
  ]);

  const createdRows = await db.select<Array<{ id: number }>>(
    'SELECT id FROM catalog_games WHERE slug = $1 LIMIT 1',
    [slug]
  );
  const catalogGameId = createdRows[0]?.id;

  if (typeof catalogGameId !== 'number') {
    throw new Error('El juego se ha guardado, pero no se ha podido recuperar su identificador.');
  }

  try {
    await db.execute(`
      INSERT INTO game_versions (
        catalog_game_id,
        version_label,
        platform,
        is_default
      ) VALUES ($1, $2, $3, 1)
    `, [catalogGameId, versionLabel, input.platform]);
  } catch (error) {
    try {
      await db.execute('DELETE FROM catalog_games WHERE id = $1', [catalogGameId]);
    } catch (cleanupError) {
      console.error('No se pudo limpiar el registro incompleto del catálogo:', cleanupError);
    }
    throw error;
  }

  return catalogGameId;
}


export async function updateCatalogGame(
  catalogGameId: number,
  input: CatalogGameUpdateInput
): Promise<void> {
  const db = await getDatabase();
  const slug = input.slug.trim();
  const name = input.name.trim();

  if (!name || !slug) {
    throw new Error('El nombre y el identificador son obligatorios.');
  }

  // Solo actualiza los metadatos generales. Las versiones y sus datos asociados
  // permanecen intactos.
  await db.execute(`
    UPDATE catalog_games SET
      slug = $1,
      name = $2,
      developer = $3,
      game_type = $4,
      description = $5,
      cover_url = $6,
      official_url = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
  `, [
    slug,
    name,
    input.developer.trim() || 'Desarrollador desconocido',
    input.game_type,
    input.description.trim(),
    input.cover_url.trim(),
    input.official_url.trim(),
    catalogGameId
  ]);
}
