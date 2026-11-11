import Database from '@tauri-apps/plugin-sql';

export type CatalogGameType = 'official' | 'fangame' | 'rom_hack' | 'other';

export type DataSource = {
  id: number;
  source_key: string;
  name: string;
  source_type: string;
  homepage_url: string;
  api_base_url: string;
  license_name: string;
  attribution_text: string;
  terms_url: string;
  is_enabled: number;
};

export type DataSourceInput = {
  source_key: string;
  name: string;
  source_type: string;
  homepage_url: string;
  license_name: string;
  attribution_text: string;
  terms_url: string;
};

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
  source_id: number | null;
  source_name: string | null;
  source_attribution: string | null;
  source_homepage: string | null;
  source_license: string | null;
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
  source_id: number | null;
};

export type CatalogGameUpdateInput = Pick<
  CatalogGameInput,
  'slug' | 'name' | 'developer' | 'game_type' | 'description' | 'cover_url' | 'official_url' | 'source_id'
>;

export type CatalogGameVersion = {
  id: number;
  catalog_game_id: number;
  version_label: string;
  platform: string;
  release_date: string;
  notes: string;
  is_default: number;
  source_id: number | null;
  source_name: string | null;
  source_attribution: string | null;
  source_homepage: string | null;
  source_license: string | null;
};

export type CatalogGameVersionInput = {
  version_label: string;
  platform: string;
  release_date: string;
  notes: string;
  is_default: boolean;
  source_id: number | null;
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

function slugifySourceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function validateSourceId(
  db: Database,
  sourceId: number | null
): Promise<number | null> {
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

export async function listDataSources(): Promise<DataSource[]> {
  const db = await getDatabase();

  return db.select<DataSource[]>(`
    SELECT
      id,
      source_key,
      name,
      source_type,
      homepage_url,
      api_base_url,
      license_name,
      attribution_text,
      terms_url,
      is_enabled
    FROM data_sources
    ORDER BY name COLLATE NOCASE ASC
  `);
}

export async function createDataSource(input: DataSourceInput): Promise<number> {
  const db = await getDatabase();
  const name = input.name.trim();
  const sourceKey = input.source_key.trim() || slugifySourceKey(name);

  if (!name) {
    throw new Error('La fuente necesita un nombre.');
  }

  if (!sourceKey) {
    throw new Error('La fuente necesita una clave interna.');
  }

  const result = await db.execute(`
    INSERT INTO data_sources (
      source_key,
      name,
      source_type,
      homepage_url,
      license_name,
      attribution_text,
      terms_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    sourceKey,
    name,
    input.source_type.trim() || 'manual',
    input.homepage_url.trim(),
    input.license_name.trim(),
    input.attribution_text.trim(),
    input.terms_url.trim()
  ]);

  if (typeof result.lastInsertId === 'number') {
    return result.lastInsertId;
  }

  const rows = await db.select<Array<{ id: number }>>(
    'SELECT id FROM data_sources WHERE source_key = $1 LIMIT 1',
    [sourceKey]
  );

  if (typeof rows[0]?.id !== 'number') {
    throw new Error('La fuente se ha guardado, pero no se ha podido recuperar su identificador.');
  }

  return rows[0].id;
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
      cg.source_id,
      ds.name AS source_name,
      ds.attribution_text AS source_attribution,
      ds.homepage_url AS source_homepage,
      ds.license_name AS source_license,
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
    LEFT JOIN data_sources ds ON ds.id = cg.source_id
    ORDER BY cg.name COLLATE NOCASE ASC
  `);
}

export async function listCatalogGameVersions(
  catalogGameId: number
): Promise<CatalogGameVersion[]> {
  const db = await getDatabase();

  return db.select<CatalogGameVersion[]>(`
    SELECT
      gv.id,
      gv.catalog_game_id,
      gv.version_label,
      gv.platform,
      gv.release_date,
      gv.notes,
      gv.is_default,
      gv.source_id,
      ds.name AS source_name,
      ds.attribution_text AS source_attribution,
      ds.homepage_url AS source_homepage,
      ds.license_name AS source_license
    FROM game_versions gv
    LEFT JOIN data_sources ds ON ds.id = gv.source_id
    WHERE gv.catalog_game_id = $1
    ORDER BY gv.is_default DESC, gv.id ASC
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
  const sourceId = await validateSourceId(db, input.source_id);

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
      is_default,
      source_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    catalogGameId,
    versionLabel,
    platform,
    releaseDate,
    notes,
    hasVersions ? isDefault : 1,
    sourceId
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
  const sourceId = await validateSourceId(db, input.source_id);

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
      source_id = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
  `, [versionLabel, platform, releaseDate, notes, isDefault, sourceId, versionId]);

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

export type CatalogGameLink = {
  installed_game_id: number;
  name: string;
  developer: string;
  version: string;
  is_hidden: number;
  catalog_game_version_id: number | null;
  version_label: string | null;
  platform: string | null;
  linked_at: string;
};

export type LinkableLibraryGame = {
  id: number;
  name: string;
  developer: string;
  version: string;
  linked_catalog_game_id: number | null;
  linked_catalog_game_name: string | null;
};

export async function listCatalogGameLinks(
  catalogGameId: number
): Promise<CatalogGameLink[]> {
  const db = await getDatabase();

  return db.select<CatalogGameLink[]>(`
    SELECT
      l.installed_game_id,
      g.name,
      g.developer,
      g.version,
      g.is_hidden,
      l.catalog_game_version_id,
      gv.version_label,
      gv.platform,
      l.linked_at
    FROM installed_game_catalog_links l
    JOIN games g ON g.id = l.installed_game_id
    LEFT JOIN game_versions gv ON gv.id = l.catalog_game_version_id
    WHERE l.catalog_game_id = $1
    ORDER BY g.name COLLATE NOCASE ASC
  `, [catalogGameId]);
}

export async function listLinkableLibraryGames(): Promise<LinkableLibraryGame[]> {
  const db = await getDatabase();

  return db.select<LinkableLibraryGame[]>(`
    SELECT
      g.id,
      g.name,
      g.developer,
      g.version,
      l.catalog_game_id AS linked_catalog_game_id,
      cg.name AS linked_catalog_game_name
    FROM games g
    LEFT JOIN installed_game_catalog_links l ON l.installed_game_id = g.id
    LEFT JOIN catalog_games cg ON cg.id = l.catalog_game_id
    WHERE g.is_hidden = 0
    ORDER BY g.name COLLATE NOCASE ASC
  `);
}

export async function linkLibraryGameToCatalog(
  catalogGameId: number,
  installedGameId: number,
  catalogGameVersionId: number | null,
  moveExisting = false
): Promise<void> {
  const db = await getDatabase();

  const catalogRows = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM catalog_games WHERE id = $1',
    [catalogGameId]
  );
  if ((catalogRows[0]?.total ?? 0) === 0) {
    throw new Error('La ficha del catálogo no existe.');
  }

  const gameRows = await db.select<Array<{ total: number }>>(
    'SELECT COUNT(*) AS total FROM games WHERE id = $1',
    [installedGameId]
  );
  if ((gameRows[0]?.total ?? 0) === 0) {
    throw new Error('La entrada de la biblioteca no existe.');
  }

  if (catalogGameVersionId !== null) {
    const versionRows = await db.select<Array<{ total: number }>>(
      `SELECT COUNT(*) AS total FROM game_versions
       WHERE id = $1 AND catalog_game_id = $2`,
      [catalogGameVersionId, catalogGameId]
    );
    if ((versionRows[0]?.total ?? 0) === 0) {
      throw new Error('La versión seleccionada no pertenece a esta ficha.');
    }
  }

  const existingRows = await db.select<Array<{
    catalog_game_id: number;
    catalog_game_name: string;
  }>>(`
    SELECT l.catalog_game_id, cg.name AS catalog_game_name
    FROM installed_game_catalog_links l
    JOIN catalog_games cg ON cg.id = l.catalog_game_id
    WHERE l.installed_game_id = $1
  `, [installedGameId]);
  const existing = existingRows[0];

  if (existing && existing.catalog_game_id !== catalogGameId && !moveExisting) {
    throw new Error(
      `Esta entrada ya está vinculada a «${existing.catalog_game_name}». Confirma que quieres mover el vínculo.`
    );
  }

  await db.execute(`
    INSERT INTO installed_game_catalog_links (
      installed_game_id,
      catalog_game_id,
      catalog_game_version_id
    ) VALUES ($1, $2, $3)
    ON CONFLICT(installed_game_id) DO UPDATE SET
      catalog_game_id = excluded.catalog_game_id,
      catalog_game_version_id = excluded.catalog_game_version_id,
      linked_at = CURRENT_TIMESTAMP
  `, [installedGameId, catalogGameId, catalogGameVersionId]);
}

export async function unlinkLibraryGameFromCatalog(
  catalogGameId: number,
  installedGameId: number
): Promise<void> {
  const db = await getDatabase();

  await db.execute(`
    DELETE FROM installed_game_catalog_links
    WHERE catalog_game_id = $1 AND installed_game_id = $2
  `, [catalogGameId, installedGameId]);
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

  const sourceId = await validateSourceId(db, input.source_id);

  await db.execute(`
    INSERT INTO catalog_games (
      slug,
      name,
      developer,
      game_type,
      description,
      cover_url,
      official_url,
      source_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    slug,
    name,
    input.developer.trim() || 'Desarrollador desconocido',
    input.game_type,
    input.description.trim(),
    input.cover_url.trim(),
    input.official_url.trim(),
    sourceId
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
        is_default,
        source_id
      ) VALUES ($1, $2, $3, 1, $4)
    `, [catalogGameId, versionLabel, input.platform, sourceId]);
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

  const sourceId = await validateSourceId(db, input.source_id);

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
      source_id = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
  `, [
    slug,
    name,
    input.developer.trim() || 'Desarrollador desconocido',
    input.game_type,
    input.description.trim(),
    input.cover_url.trim(),
    input.official_url.trim(),
    sourceId,
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
