-- DexDeck migration 12: allow several forms sharing the local Pokédex number.
-- SQLite cannot drop a table constraint in place, so game_pokemon is rebuilt
-- with the same columns and data. Encounters reference game_pokemon by name
-- and validate it from two triggers, so those triggers are detached and
-- recreated around the rebuild; encounter rows are preserved as well.

CREATE TABLE game_pokemon_new (
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
    UNIQUE (game_version_id, dex_number, form_name)
);

INSERT INTO game_pokemon_new (
    id,
    game_version_id,
    species_id,
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
    source_id,
    created_at,
    updated_at
)
SELECT
    id,
    game_version_id,
    species_id,
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
    source_id,
    created_at,
    updated_at
FROM game_pokemon;

CREATE TEMP TABLE encounters_backup AS SELECT * FROM encounters;
DELETE FROM encounters;

DROP TRIGGER IF EXISTS trg_encounter_same_game_version_insert;
DROP TRIGGER IF EXISTS trg_encounter_same_game_version_update;

DROP TABLE game_pokemon;
ALTER TABLE game_pokemon_new RENAME TO game_pokemon;

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

INSERT INTO encounters SELECT * FROM encounters_backup;
DROP TABLE encounters_backup;

CREATE INDEX idx_game_pokemon_version ON game_pokemon(game_version_id);
CREATE INDEX idx_game_pokemon_species ON game_pokemon(species_id);
