-- Motivo por el que un Pokémon no se puede obtener en una versión concreta.
-- Se rellena al importar desde PokéAPI (exclusivo de la edición pareja) o a
-- mano desde el formulario de la Pokédex.
ALTER TABLE game_pokemon ADD COLUMN obtain_note TEXT NOT NULL DEFAULT '';

-- Descripción del efecto de cada habilidad, indexada por su nombre visible:
-- {"Electrostática": "Puede paralizar al contacto..."}.
ALTER TABLE game_pokemon ADD COLUMN ability_details_json TEXT NOT NULL DEFAULT '{}';
