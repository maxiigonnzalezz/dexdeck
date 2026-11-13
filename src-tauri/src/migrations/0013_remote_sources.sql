-- DexDeck migration 13: procedencia de datos remotos.
-- `source_url` guarda la página o recurso exacto del que salió cada fila y
-- `remote_pokedex_key` recuerda qué Pokédex remota se usó en cada versión.
-- Las fuentes se siembran aquí para que la atribución y la licencia viajen
-- con los datos importados desde el primer momento.

ALTER TABLE game_pokemon ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE game_versions ADD COLUMN remote_pokedex_key TEXT NOT NULL DEFAULT '';

INSERT OR IGNORE INTO data_sources
    (source_key, name, source_type, homepage_url, api_base_url, license_name, attribution_text, terms_url)
VALUES
    ('pokeapi', 'PokéAPI', 'api', 'https://pokeapi.co/', 'https://pokeapi.co/api/v2/',
     'BSD-3-Clause (código); datos de The Pokémon Company',
     'Datos servidos por PokéAPI', 'https://pokeapi.co/docs/v2#fairuse'),
    ('fandom', 'Fandom', 'wiki', 'https://www.fandom.com/', '',
     'CC BY-SA 3.0', 'Contenido de Fandom bajo CC BY-SA', 'https://www.fandom.com/licensing'),
    ('bulbapedia', 'Bulbapedia', 'wiki', 'https://bulbapedia.bulbagarden.net/', '',
     'CC BY-NC-SA 2.5', 'Contenido de Bulbapedia bajo CC BY-NC-SA',
     'https://bulbapedia.bulbagarden.net/wiki/Bulbapedia:Copyrights');
