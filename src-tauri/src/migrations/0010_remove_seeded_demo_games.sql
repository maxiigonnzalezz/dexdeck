-- DexDeck migration 10: remove only the original, untouched demo games.
-- Rows that users have customized are intentionally preserved.
-- The encyclopedia tables are not modified.

DELETE FROM games
WHERE
    (
        id = 1
        AND name = 'Pokémon Añil'
        AND developer = 'Eric Lostie'
        AND version = '2.0'
        AND type = 'Aventura'
        AND color = 'blue'
        AND symbol = '✦'
        AND status = 'En biblioteca'
        AND description = ''
        AND cover = ''
        AND official_url = ''
        AND install_path = ''
        AND executable_path = ''
        AND is_hidden = 0
    )
    OR
    (
        id = 2
        AND name = 'Pokémon Ópalo'
        AND developer = 'Eric Lostie'
        AND version = '1.3'
        AND type = 'Aventura'
        AND color = 'purple'
        AND symbol = '◇'
        AND status = 'En biblioteca'
        AND description = ''
        AND cover = ''
        AND official_url = ''
        AND install_path = ''
        AND executable_path = ''
        AND is_hidden = 0
    )
    OR
    (
        id = 3
        AND name = 'Pokémon Iberia'
        AND developer = 'Eric Lostie'
        AND version = '2.04'
        AND type = 'RPG'
        AND color = 'red'
        AND symbol = '✧'
        AND status = 'En biblioteca'
        AND description = ''
        AND cover = ''
        AND official_url = ''
        AND install_path = ''
        AND executable_path = ''
        AND is_hidden = 0
    );
