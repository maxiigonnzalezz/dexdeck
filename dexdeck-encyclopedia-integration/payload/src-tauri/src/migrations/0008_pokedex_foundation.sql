-- DexDeck migration 8: foundation for the offline-first game encyclopedia.
-- This migration is intentionally additive. It does not alter or delete rows
-- from the existing `games` table.

-- ---------------------------------------------------------------------------
-- Data provenance. A NULL source_id means the record was entered manually.
-- ---------------------------------------------------------------------------
CREATE TABLE data_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual',
    homepage_url TEXT NOT NULL DEFAULT '',
    api_base_url TEXT NOT NULL DEFAULT '',
    license_name TEXT NOT NULL DEFAULT '',
    attribution_text TEXT NOT NULL DEFAULT '',
    terms_url TEXT NOT NULL DEFAULT '',
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Canonical catalogue, kept separate from the user's installed library.
-- ---------------------------------------------------------------------------
CREATE TABLE catalog_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    developer TEXT NOT NULL DEFAULT 'Desarrollador desconocido',
    game_type TEXT NOT NULL DEFAULT 'fangame'
        CHECK (game_type IN ('official', 'fangame', 'rom_hack', 'other')),
    description TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    official_url TEXT NOT NULL DEFAULT '',
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_game_id INTEGER NOT NULL
        REFERENCES catalog_games(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'unknown',
    release_date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (catalog_game_id, version_label, platform),
    UNIQUE (id, catalog_game_id)
);

-- Optional association: existing installed games remain valid without a link.
-- A link may identify a game only, or a specific catalogue version as well.
CREATE TABLE installed_game_catalog_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installed_game_id INTEGER NOT NULL UNIQUE
        REFERENCES games(id) ON DELETE CASCADE,
    catalog_game_id INTEGER NOT NULL
        REFERENCES catalog_games(id) ON DELETE CASCADE,
    catalog_game_version_id INTEGER
        REFERENCES game_versions(id) ON DELETE SET NULL,
    linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Species are global canonical identities; game_pokemon stores each game's
-- Pokédex entry, local number, form, types, stats and availability.
-- A NULL species_id allows fangames to define fakemon/custom creatures.
-- ---------------------------------------------------------------------------
CREATE TABLE pokemon_species (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    species_key TEXT NOT NULL UNIQUE COLLATE NOCASE,
    national_dex_number INTEGER UNIQUE
        CHECK (national_dex_number IS NULL OR national_dex_number > 0),
    canonical_name TEXT NOT NULL,
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_pokemon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_version_id INTEGER NOT NULL
        REFERENCES game_versions(id) ON DELETE CASCADE,
    species_id INTEGER REFERENCES pokemon_species(id) ON DELETE SET NULL,
    dex_number INTEGER NOT NULL CHECK (dex_number > 0),
    name TEXT NOT NULL,
    form_name TEXT NOT NULL DEFAULT '',
    type_primary TEXT NOT NULL DEFAULT '',
    type_secondary TEXT NOT NULL DEFAULT '',
    abilities_json TEXT NOT NULL DEFAULT '[]',
    base_stats_json TEXT NOT NULL DEFAULT '{}',
    dex_entry TEXT NOT NULL DEFAULT '',
    sprite_url TEXT NOT NULL DEFAULT '',
    sprite_path TEXT NOT NULL DEFAULT '',
    is_obtainable INTEGER NOT NULL DEFAULT 1 CHECK (is_obtainable IN (0, 1)),
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_version_id, dex_number)
);

-- ---------------------------------------------------------------------------
-- World model. A region belongs to one game version; locations belong to a
-- region and may be nested (for example, a floor inside a cave).
-- ---------------------------------------------------------------------------
CREATE TABLE regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_version_id INTEGER NOT NULL
        REFERENCES game_versions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_version_id, slug)
);

CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    parent_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    location_type TEXT NOT NULL DEFAULT 'other'
        CHECK (location_type IN ('route', 'city', 'town', 'building', 'cave', 'dungeon', 'forest', 'water', 'other')),
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (region_id, slug)
);

-- ---------------------------------------------------------------------------
-- Encounters join a location with a game-specific Pokédex entry. Keeping the
-- game version on game_pokemon and region avoids duplicated version IDs here.
-- ---------------------------------------------------------------------------
CREATE TABLE encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    game_pokemon_id INTEGER NOT NULL REFERENCES game_pokemon(id) ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'grass',
    min_level INTEGER CHECK (min_level IS NULL OR min_level > 0),
    max_level INTEGER CHECK (max_level IS NULL OR max_level > 0),
    chance_percent REAL CHECK (chance_percent IS NULL OR (chance_percent >= 0 AND chance_percent <= 100)),
    time_condition TEXT NOT NULL DEFAULT '',
    other_conditions TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (min_level IS NULL OR max_level IS NULL OR min_level <= max_level)
);

-- ---------------------------------------------------------------------------
-- Items and their placements. One item may appear in several locations.
-- ---------------------------------------------------------------------------
CREATE TABLE game_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_version_id INTEGER NOT NULL
        REFERENCES game_versions(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL DEFAULT '',
    icon_url TEXT NOT NULL DEFAULT '',
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_version_id, item_key)
);

CREATE TABLE item_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_item_id INTEGER NOT NULL REFERENCES game_items(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    acquisition_method TEXT NOT NULL DEFAULT '',
    is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
    notes TEXT NOT NULL DEFAULT '',
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Guides are Markdown documents tied to a precise game version and language.
-- ---------------------------------------------------------------------------
CREATE TABLE guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_version_id INTEGER NOT NULL
        REFERENCES game_versions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    language TEXT NOT NULL DEFAULT 'es',
    summary TEXT NOT NULL DEFAULT '',
    content_markdown TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_version_id, slug, language)
);

-- Maps can belong to a whole game version, one region, or one location.
-- local_path supports offline use; source and licence metadata preserve provenance.
CREATE TABLE map_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_version_id INTEGER NOT NULL
        REFERENCES game_versions(id) ON DELETE CASCADE,
    region_id INTEGER REFERENCES regions(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL DEFAULT 'other'
        CHECK (asset_type IN ('world_map', 'region_map', 'location_map', 'other')),
    title TEXT NOT NULL DEFAULT '',
    remote_url TEXT NOT NULL DEFAULT '',
    local_path TEXT NOT NULL DEFAULT '',
    checksum TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    attribution_text TEXT NOT NULL DEFAULT '',
    license_name TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_id INTEGER REFERENCES data_sources(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (region_id IS NULL OR location_id IS NULL)
);

-- ---------------------------------------------------------------------------
-- Synchronisation ledger. A row identifies one independently syncable data
-- resource from a source; it does not perform network requests by itself.
-- ---------------------------------------------------------------------------
CREATE TABLE sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_source_id INTEGER NOT NULL
        REFERENCES data_sources(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    remote_revision TEXT NOT NULL DEFAULT '',
    local_revision TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    last_checked_at TEXT,
    last_synced_at TEXT,
    last_error TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (data_source_id, resource_type, resource_key)
);

-- ---------------------------------------------------------------------------
-- Consistency guards for relationships that span two versioned branches.
-- Ordinary foreign keys still handle missing referenced rows and deletions.
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_installed_catalog_version_insert
BEFORE INSERT ON installed_game_catalog_links
WHEN NEW.catalog_game_version_id IS NOT NULL
 AND NOT EXISTS (
    SELECT 1 FROM game_versions
    WHERE id = NEW.catalog_game_version_id
      AND catalog_game_id = NEW.catalog_game_id
 )
BEGIN
    SELECT RAISE(ABORT, 'La version seleccionada no pertenece al juego del catalogo.');
END;

CREATE TRIGGER trg_installed_catalog_version_update
BEFORE UPDATE OF catalog_game_id, catalog_game_version_id ON installed_game_catalog_links
WHEN NEW.catalog_game_version_id IS NOT NULL
 AND NOT EXISTS (
    SELECT 1 FROM game_versions
    WHERE id = NEW.catalog_game_version_id
      AND catalog_game_id = NEW.catalog_game_id
 )
BEGIN
    SELECT RAISE(ABORT, 'La version seleccionada no pertenece al juego del catalogo.');
END;

CREATE TRIGGER trg_location_parent_same_region_insert
BEFORE INSERT ON locations
WHEN NEW.parent_location_id IS NOT NULL
 AND NOT EXISTS (
    SELECT 1 FROM locations
    WHERE id = NEW.parent_location_id AND region_id = NEW.region_id
 )
BEGIN
    SELECT RAISE(ABORT, 'La ubicacion superior debe pertenecer a la misma region.');
END;

CREATE TRIGGER trg_location_parent_same_region_update
BEFORE UPDATE OF region_id, parent_location_id ON locations
WHEN NEW.parent_location_id IS NOT NULL
 AND NOT EXISTS (
    SELECT 1 FROM locations
    WHERE id = NEW.parent_location_id AND region_id = NEW.region_id
 )
BEGIN
    SELECT RAISE(ABORT, 'La ubicacion superior debe pertenecer a la misma region.');
END;

CREATE TRIGGER trg_encounter_same_game_version_insert
BEFORE INSERT ON encounters
WHEN NOT EXISTS (
    SELECT 1
    FROM game_pokemon gp
    JOIN regions r ON r.game_version_id = gp.game_version_id
    JOIN locations l ON l.region_id = r.id
    WHERE gp.id = NEW.game_pokemon_id AND l.id = NEW.location_id
)
BEGIN
    SELECT RAISE(ABORT, 'El encuentro y la ubicacion deben pertenecer a la misma version del juego.');
END;

CREATE TRIGGER trg_encounter_same_game_version_update
BEFORE UPDATE OF location_id, game_pokemon_id ON encounters
WHEN NOT EXISTS (
    SELECT 1
    FROM game_pokemon gp
    JOIN regions r ON r.game_version_id = gp.game_version_id
    JOIN locations l ON l.region_id = r.id
    WHERE gp.id = NEW.game_pokemon_id AND l.id = NEW.location_id
)
BEGIN
    SELECT RAISE(ABORT, 'El encuentro y la ubicacion deben pertenecer a la misma version del juego.');
END;

CREATE TRIGGER trg_item_location_same_game_version_insert
BEFORE INSERT ON item_locations
WHEN NOT EXISTS (
    SELECT 1
    FROM game_items gi
    JOIN regions r ON r.game_version_id = gi.game_version_id
    JOIN locations l ON l.region_id = r.id
    WHERE gi.id = NEW.game_item_id AND l.id = NEW.location_id
)
BEGIN
    SELECT RAISE(ABORT, 'El objeto y la ubicacion deben pertenecer a la misma version del juego.');
END;

CREATE TRIGGER trg_item_location_same_game_version_update
BEFORE UPDATE OF game_item_id, location_id ON item_locations
WHEN NOT EXISTS (
    SELECT 1
    FROM game_items gi
    JOIN regions r ON r.game_version_id = gi.game_version_id
    JOIN locations l ON l.region_id = r.id
    WHERE gi.id = NEW.game_item_id AND l.id = NEW.location_id
)
BEGIN
    SELECT RAISE(ABORT, 'El objeto y la ubicacion deben pertenecer a la misma version del juego.');
END;

CREATE TRIGGER trg_map_asset_region_version_insert
BEFORE INSERT ON map_assets
WHEN NEW.region_id IS NOT NULL
 AND NOT EXISTS (
    SELECT 1 FROM regions
    WHERE id = NEW.region_id AND game_version_id = NEW.game_version_id
 )
BEGIN
    SELECT RAISE(ABORT, 'El mapa y la region deben pertenecer a la misma version del juego.');
END;

CREATE TRIGGER trg_map_asset_location_version_insert
BEFORE INSERT ON map_assets
WHEN NEW.location_id IS NOT NULL
 AND NOT EXISTS (
    SELECT 1 FROM locations l
    JOIN regions r ON r.id = l.region_id
    WHERE l.id = NEW.location_id AND r.game_version_id = NEW.game_version_id
 )
BEGIN
    SELECT RAISE(ABORT, 'El mapa y la ubicacion deben pertenecer a la misma version del juego.');
END;

CREATE TRIGGER trg_map_asset_version_update
BEFORE UPDATE OF game_version_id, region_id, location_id ON map_assets
WHEN (NEW.region_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM regions
        WHERE id = NEW.region_id AND game_version_id = NEW.game_version_id
      ))
  OR (NEW.location_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM locations l
        JOIN regions r ON r.id = l.region_id
        WHERE l.id = NEW.location_id AND r.game_version_id = NEW.game_version_id
      ))
BEGIN
    SELECT RAISE(ABORT, 'El mapa y su region o ubicacion deben pertenecer a la misma version del juego.');
END;

-- ---------------------------------------------------------------------------
-- Query indexes for the expected encyclopedia screens and sync operations.
-- ---------------------------------------------------------------------------
CREATE INDEX idx_game_versions_catalog_game ON game_versions(catalog_game_id);
CREATE INDEX idx_installed_catalog_catalog_game ON installed_game_catalog_links(catalog_game_id);
CREATE INDEX idx_installed_catalog_version ON installed_game_catalog_links(catalog_game_version_id);
CREATE INDEX idx_game_pokemon_version ON game_pokemon(game_version_id);
CREATE INDEX idx_game_pokemon_species ON game_pokemon(species_id);
CREATE INDEX idx_regions_version ON regions(game_version_id);
CREATE INDEX idx_locations_region ON locations(region_id);
CREATE INDEX idx_locations_parent ON locations(parent_location_id);
CREATE INDEX idx_encounters_location ON encounters(location_id);
CREATE INDEX idx_encounters_pokemon ON encounters(game_pokemon_id);
CREATE INDEX idx_game_items_version ON game_items(game_version_id);
CREATE INDEX idx_item_locations_item ON item_locations(game_item_id);
CREATE INDEX idx_item_locations_location ON item_locations(location_id);
CREATE INDEX idx_guides_version_category ON guides(game_version_id, category, sort_order);
CREATE INDEX idx_map_assets_version ON map_assets(game_version_id);
CREATE INDEX idx_map_assets_region ON map_assets(region_id);
CREATE INDEX idx_map_assets_location ON map_assets(location_id);
CREATE INDEX idx_sync_state_source ON sync_state(data_source_id);
