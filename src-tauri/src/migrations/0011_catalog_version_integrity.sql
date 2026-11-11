-- DexDeck migration 11: integrity rules for catalogue versions.
-- This migration is additive. It does not delete catalogue games, library
-- games or any other content.

-- Normalise historical data before enforcing the rule. If a catalogue game
-- somehow has several default versions, keep the oldest one.
UPDATE game_versions
SET is_default = 0
WHERE is_default = 1
  AND id NOT IN (
    SELECT MIN(id)
    FROM game_versions
    WHERE is_default = 1
    GROUP BY catalog_game_id
  );

-- At most one default version per catalogue game.
CREATE UNIQUE INDEX idx_game_versions_one_default
ON game_versions(catalog_game_id)
WHERE is_default = 1;

-- Choosing a new default replaces the previous one in the same statement.
CREATE TRIGGER trg_game_versions_default_insert
BEFORE INSERT ON game_versions
WHEN NEW.is_default = 1
BEGIN
    UPDATE game_versions
    SET is_default = 0
    WHERE catalog_game_id = NEW.catalog_game_id
      AND is_default = 1;
END;

CREATE TRIGGER trg_game_versions_default_update
BEFORE UPDATE OF is_default ON game_versions
WHEN NEW.is_default = 1 AND OLD.is_default = 0
BEGIN
    UPDATE game_versions
    SET is_default = 0
    WHERE catalog_game_id = NEW.catalog_game_id
      AND id <> OLD.id
      AND is_default = 1;
END;

-- Every catalogue game keeps at least one version. The parent check keeps the
-- cascaded deletion of a whole catalogue game working.
CREATE TRIGGER trg_game_versions_keep_one
BEFORE DELETE ON game_versions
WHEN EXISTS (SELECT 1 FROM catalog_games WHERE id = OLD.catalog_game_id)
 AND (SELECT COUNT(*) FROM game_versions WHERE catalog_game_id = OLD.catalog_game_id) <= 1
BEGIN
    SELECT RAISE(ABORT, 'Cada juego del catálogo debe conservar al menos una versión.');
END;

-- Deleting the default version promotes the oldest remaining version.
CREATE TRIGGER trg_game_versions_promote_default
AFTER DELETE ON game_versions
WHEN OLD.is_default = 1
 AND EXISTS (SELECT 1 FROM catalog_games WHERE id = OLD.catalog_game_id)
 AND NOT EXISTS (
    SELECT 1 FROM game_versions
    WHERE catalog_game_id = OLD.catalog_game_id
      AND is_default = 1
 )
BEGIN
    UPDATE game_versions
    SET is_default = 1
    WHERE id = (
        SELECT id FROM game_versions
        WHERE catalog_game_id = OLD.catalog_game_id
        ORDER BY id ASC
        LIMIT 1
    );
END;
