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

export type CatalogGameVersionInput = {
  version_label: string;
  platform: string;
  release_date: string;
  notes: string;
  is_default: boolean;
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

export type CatalogGameDeletionInfo = {
  version_count: number;
  link_count: number;
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

function normalizeVersionInput(input: CatalogGameVersionInput) {
  const versionLabel = input.version_label.trim();
  const releaseDate = input.release_date.trim();

  if (!versionLabel) {
    throw new Error('La versión necesita un nombre o número.');
  }

  if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    throw new Error('La fecha de lanzamiento debe tener el formato AAAA-MM-DD.');
  }

  return {
    versionLabel,
    platform: input.platform.trim() || 'unknown',
    releaseDate,
    notes: input.notes.trim(),
    isDefault: input.is_default ? 1 : 0
  };
}

export async function createCatalogGameVersion(
  catalogGameId: number,
  input: CatalogGameVersionInput
): Promise<number> {
  const db = await getDatabase();
  const { versionLabel, platform, releaseDate, notes, isDefault } =
    normalizeVersionInput(input);

  const gameRows = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM catalog_games WHERE id = $1',
    [catalogGameId]
  );

  if ((gameRows[0]?.total ?? 0) === 0) {
    throw new Error('La ficha del catálogo no existe.');
  }

  const versionRows = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM game_versions WHERE catalog_game_id = $1',
    [catalogGameId]
  );
  const hasVersions = (versionRows[0]?.total ?? 0) > 0;
  const result = await db.execute(`
    INSERT INTO game_versions (
      catalog_game_id,
      version_label,
      platform,
      release_date,
      notes,
      is_default
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    catalogGameId,
    versionLabel,
    platform,
    releaseDate,
    notes,
    hasVersions ? isDefault : 1
  ]);

  if (typeof result.lastInsertId === 'number') {
    return result.lastInsertId;
  }

  const createdRows = await db.select<Array<{ id: number }>>(
    `SELECT id FROM game_versions
     WHERE catalog_game_id = $1 AND version_label = $2 AND platform = $3
     LIMIT 1`,
    [catalogGameId, versionLabel, platform]
  );

  if (typeof createdRows[0]?.id !== 'number') {
    throw new Error('La versión se ha guardado, pero no se ha podido recuperar su identificador.');
  }

  return createdRows[0].id;
}

export async function updateCatalogGameVersion(
  versionId: number,
  input: CatalogGameVersionInput
): Promise<void> {
  const db = await getDatabase();
  const { versionLabel, platform, releaseDate, notes, isDefault } =
    normalizeVersionInput(input);

  const currentRows = await db.select<Array<{
    catalog_game_id: number;
    is_default: number;
  }>>(
    'SELECT catalog_game_id, is_default FROM game_versions WHERE id = $1',
    [versionId]
  );
  const current = currentRows[0];

  if (!current) {
    throw new Error('La versión ya no existe.');
  }

  await db.execute(`
    UPDATE game_versions SET
      version_label = $1,
      platform = $2,
      release_date = $3,
      notes = $4,
      is_default = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
  `, [versionLabel, platform, releaseDate, notes, isDefault, versionId]);

  if (current.is_default === 1 && isDefault === 0) {
    const others = await db.select<Array<{ id: number }>>(
      `SELECT id FROM game_versions
       WHERE catalog_game_id = $1 AND id <> $2
       ORDER BY id ASC
       LIMIT 1`,
      [current.catalog_game_id, versionId]
    );

    if (!others[0]) {
      await db.execute(
        'UPDATE game_versions SET is_default = 1 WHERE id = $1',
        [versionId]
      );
      throw new Error('La única versión de una ficha debe seguir siendo la predeterminada.');
    }

    await db.execute(
      'UPDATE game_versions SET is_default = 1 WHERE id = $1',
      [others[0].id]
    );
  }
}

export async function deleteCatalogGameVersion(versionId: number): Promise<void> {
  const db = await getDatabase();
  const currentRows = await db.select<Array<{ catalog_game_id: number }>>(
    'SELECT catalog_game_id FROM game_versions WHERE id = $1',
    [versionId]
  );
  const current = currentRows[0];

  if (!current) {
    throw new Error('La versión ya no existe.');
  }

  const countRows = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM game_versions WHERE catalog_game_id = $1',
    [current.catalog_game_id]
  );

  if ((countRows[0]?.total ?? 0) <= 1) {
    throw new Error('Cada juego del catálogo debe conservar al menos una versión.');
  }

  // Los vínculos que apuntaban a esta versión quedan sin versión concreta,
  // pero conservan su relación con la ficha.
  await db.execute(
    'UPDATE installed_game_catalog_links SET catalog_game_version_id = NULL WHERE catalog_game_version_id = $1',
    [versionId]
  );

  await db.execute('DELETE FROM game_versions WHERE id = $1', [versionId]);
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

export async function getCatalogGameDeletionInfo(
  catalogGameId: number
): Promise<CatalogGameDeletionInfo> {
  const db = await getDatabase();
  const rows = await db.select<CatalogGameDeletionInfo[]>(`
    SELECT
      (SELECT COUNT(*) FROM game_versions WHERE catalog_game_id = $1) AS version_count,
      (SELECT COUNT(*) FROM installed_game_catalog_links WHERE catalog_game_id = $1) AS link_count
  `, [catalogGameId]);

  if (!rows[0]) {
    throw new Error('No se ha podido consultar el contenido de esta ficha.');
  }

  return rows[0];
}

export async function deleteCatalogGame(
  catalogGameId: number
): Promise<CatalogGameDeletionInfo> {
  const db = await getDatabase();
  const existing = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM catalog_games WHERE id = $1',
    [catalogGameId]
  );

  if ((existing[0]?.total ?? 0) === 0) {
    throw new Error('La ficha del catálogo ya no existe.');
  }

  const info = await getCatalogGameDeletionInfo(catalogGameId);

  // Los vínculos con la biblioteca se eliminan explícitamente. Las filas de
  // `games` nunca se borran desde el catálogo.
  await db.execute(
    'DELETE FROM installed_game_catalog_links WHERE catalog_game_id = $1',
    [catalogGameId]
  );

  // Las versiones se van con la ficha mediante ON DELETE CASCADE.
  await db.execute('DELETE FROM catalog_games WHERE id = $1', [catalogGameId]);

  // Salvaguarda por si SQLite no tuviera activadas las claves foráneas.
  await db.execute(
    'DELETE FROM game_versions WHERE catalog_game_id = $1',
    [catalogGameId]
  );

  return info;
}
