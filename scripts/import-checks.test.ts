import { appendGameExclusiveEntries, getPokedexGames, isExclusiveToOtherGame, suggestPokedexGameKey } from '$lib/import/game-pokedex';
import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay, shouldRetry } from '$lib/import/http-policy';
import { mapWithConcurrency } from '$lib/import/concurrency';
import { parsePokemonFile } from '$lib/import/pokemon-import';
import type { GamePokemon } from '$lib/pokedex';
import { remainingPreviewRows, safeSpriteSource, spriteFallbackName, visiblePreviewRows } from '$lib/pokedex-preview';

test('reintenta en 429 y 5xx, no en 404', () => {
  assert.equal(shouldRetry(429), true);
  assert.equal(shouldRetry(500), true);
  assert.equal(shouldRetry(404), false);
  assert.equal(shouldRetry(200), false);
});

test('respeta Retry-After y crece con el intento', () => {
  assert.equal(retryDelay(0, '3'), 3000);
  assert.ok(retryDelay(2, null) > retryDelay(1, null));
  assert.ok(retryDelay(9, null) <= 8000);
});

test('limita la concurrencia y conserva el orden', async () => {
  let active = 0;
  let peak = 0;
  const items = [30, 10, 20];
  const result = await mapWithConcurrency(items, 2, async (ms) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, ms));
    active -= 1;
    return ms * 2;
  });

  assert.deepEqual(result, [60, 20, 40]);
  assert.equal(peak, 2);
});

test('la cancelación detiene las tareas pendientes', async () => {
  const controller = new AbortController();
  const result = await mapWithConcurrency(
    [1, 2, 3, 4],
    1,
    async (n) => {
      if (n === 1) controller.abort();
      return n;
    },
    controller.signal
  );

  assert.deepEqual(result, [1, undefined, undefined, undefined]);
});

const existingPokemon: GamePokemon = {
  id: 1,
  game_version_id: 1,
  species_id: null,
  dex_number: 25,
  name: 'Pikachu',
  form_name: '',
  type_primary: 'electric',
  type_secondary: '',
  abilities: [],
  base_stats: null,
  dex_entry: '',
  sprite_url: '',
  sprite_path: '',
  is_obtainable: 1,
  source_id: null,
  source_name: null,
  source_attribution: null,
  source_license: null,
  source_url: 'https://pokeapi.co/api/v2/pokemon-species/25/',
  species_key: null,
  national_dex_number: null
};

test('un cambio solo en source_url es una actualización', () => {
  const csv = 'numero,nombre,tipo_primario,obtenible,source_url\n25,Pikachu,electric,si,https://ejemplo.test/pikachu';
  const preview = parsePokemonFile(csv, 'x.csv', [], [existingPokemon]);
  assert.equal(preview.candidates[0].action, 'update');
});

test('lee numero nacional y clave de especie', () => {
  const csv = 'numero,nombre,national_dex_number,species_key\n25,Pikachu,25,pokeapi:pikachu';
  const input = parsePokemonFile(csv, 'x.csv', [], []).candidates[0].input;
  assert.equal(input.national_dex_number, 25);
  assert.equal(input.species_key, 'pokeapi:pikachu');
});

test('una clave de especie inválida es un error de fila', () => {
  const csv = 'numero,nombre,species_key\n25,Pikachu,clave con espacios';
  const preview = parsePokemonFile(csv, 'x.csv', [], []);
  assert.equal(preview.counts.errors, 1);
});

import {
  cleanFlavorText,
  collectPokedex,
  parsePokedexEntries,
  parsePokedexOptions,
  pickFlavorText,
  pickLocalizedName,
  prettyName,
  suggestPokedexKey,
  toRawRecord
} from '$lib/import/pokeapi';

test('sugiere la Pokedex por nombre de juego', () => {
  assert.equal(suggestPokedexKey('Pokémon Rojo Fuego', ''), 'kanto');
  assert.equal(suggestPokedexKey('Pokemon Esmeralda', '3.0'), 'hoenn');
  assert.equal(suggestPokedexKey('Pokemon Insurgence', '1.2'), '');
  assert.equal(suggestPokedexKey('Pokémon X', ''), 'kalos');
  assert.equal(suggestPokedexKey('Pokémon Y', ''), 'kalos');
  assert.equal(suggestPokedexKey('Pokémon Xtreme', ''), '');
});

test('lee las entradas de la Pokedex', () => {
  assert.deepEqual(
    parsePokedexEntries({
      pokemon_entries: [
        {
          entry_number: 1,
          pokemon_species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' }
        }
      ]
    }),
    [{ entryNumber: 1, speciesKey: 'bulbasaur', speciesUrl: 'https://pokeapi.co/api/v2/pokemon-species/1/' }]
  );
});

test('elige la descripción en español', () => {
  assert.deepEqual(
    pickFlavorText([
      { flavor_text: 'A', language: { name: 'en' } },
      { flavor_text: 'B', language: { name: 'es' } }
    ]),
    { value: 'B', language: 'es' }
  );
});

test('convierte la lista de Pokedex en opciones ordenadas', () => {
  const options = parsePokedexOptions({
    results: [
      { name: 'hoenn', url: 'h' },
      { name: 'kanto', url: 'k' },
      { name: 'rara', url: 'r' },
      { name: 'original-johto', url: 'j' }
    ]
  });

  assert.deepEqual(options.map((option) => option.key), ['kanto', 'original-johto', 'hoenn']);
  assert.equal(options[0].label, 'Kanto');
});

test('ofrece únicamente las diez regiones principales en orden', () => {
  const options = parsePokedexOptions({
    results: [
      { name: 'blueberry', url: 'bb' },
      { name: 'paldea', url: 'p' },
      { name: 'updated-kanto', url: 'uk' },
      { name: 'hisui', url: 'h' },
      { name: 'kalos-mountain', url: 'km' },
      { name: 'original-johto', url: 'oj' },
      { name: 'kanto', url: 'k' },
      { name: 'isle-of-armor', url: 'ia' },
      { name: 'hoenn', url: 'ho' },
      { name: 'sinnoh', url: 's' },
      { name: 'updated-alola', url: 'ua' },
      { name: 'kalos-central', url: 'kc' },
      { name: 'national', url: 'n' },
      { name: 'galar', url: 'g' },
      { name: 'unova', url: 'u' },
      { name: 'kalos-coastal', url: 'kco' },
      { name: 'original-alola', url: 'oa' },
      { name: 'conquest-gallery', url: 'cg' },
      { name: 'kitakami', url: 'ki' }
    ]
  });

  assert.deepEqual(options.map((option) => option.key), [
    'kanto', 'original-johto', 'hoenn', 'sinnoh', 'unova',
    'kalos', 'original-alola', 'galar', 'hisui', 'paldea'
  ]);
  assert.deepEqual(options.map((option) => option.label), [
    'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia',
    'Kalos', 'Alola', 'Galar', 'Hisui', 'Paldea'
  ]);
});

test('recopila las tres Pokédex de Kalos, mantiene el orden y deduplica especies', async () => {
  const requested: string[] = [];
  const regional = {
    'kalos-central': [
      { entry_number: 2, pokemon_species: { name: 'pikachu', url: 'species/25' } },
      { entry_number: 1, pokemon_species: { name: 'bulbasaur', url: 'species/1' } }
    ],
    'kalos-coastal': [
      { entry_number: 1, pokemon_species: { name: 'bulbasaur', url: 'species/1' } },
      { entry_number: 2, pokemon_species: { name: 'meowth', url: 'species/52' } }
    ],
    'kalos-mountain': [
      { entry_number: 1, pokemon_species: { name: 'meowth', url: 'species/52' } },
      { entry_number: 2, pokemon_species: { name: 'zubat', url: 'species/41' } }
    ]
  };
  const fetchJson = async (url: string): Promise<unknown> => {
    requested.push(url);
    const region = Object.keys(regional).find((key) => url.endsWith(`/pokedex/${key}`));
    if (region) return { pokemon_entries: regional[region as keyof typeof regional] };
    const speciesMatch = url.match(/species\/(\d+)$/);
    if (speciesMatch) return { id: Number(speciesMatch[1]), names: [], flavor_text_entries: [] };
    const pokemonMatch = url.match(/pokemon\/(\d+)$/);
    if (pokemonMatch) return { id: Number(pokemonMatch[1]), types: [], abilities: [], stats: [], sprites: {} };
    throw new Error(`URL de prueba inesperada: ${url}`);
  };

  const result = await collectPokedex({ pokedexKey: 'kalos', fetchJson });
  assert.deepEqual(requested.slice(0, 3), [
    'https://pokeapi.co/api/v2/pokedex/kalos-central',
    'https://pokeapi.co/api/v2/pokedex/kalos-coastal',
    'https://pokeapi.co/api/v2/pokedex/kalos-mountain'
  ]);
  assert.equal(requested.filter((url) => url.includes('species/')).length, 4);
  assert.deepEqual(result.records.map((row) => row.record.name), ['Bulbasaur', 'Pikachu', 'Meowth', 'Zubat']);
  assert.deepEqual(result.records.map((row) => row.record.dex_number), ['1', '2', '3', '4']);
  assert.deepEqual(result.records.map((row) => row.record.national_dex_number), ['1', '25', '52', '41']);
  assert.equal(result.issues.length, 0);
});

test('limita la previsualización a 15 filas e indica las restantes', () => {
  const rows = Array.from({ length: 18 }, (_, index) => index);
  assert.equal(visiblePreviewRows(rows).length, 15);
  assert.equal(remainingPreviewRows(rows), 3);
  assert.equal(remainingPreviewRows(rows.slice(0, 15)), 0);
});

test('previsualización acepta rutas locales y URL HTTPS, rechaza fuentes inseguras y tolera sprite vacío', () => {
  assert.equal(safeSpriteSource({ sprite_path: 'sprites/025.png' }), 'sprites/025.png');
  assert.equal(safeSpriteSource({ sprite_url: 'https://img.example.test/pikachu.png' }), 'https://img.example.test/pikachu.png');
  assert.equal(safeSpriteSource({ sprite_url: 'http://img.example.test/pikachu.png' }), '');
  assert.equal(safeSpriteSource({ sprite_url: 'javascript:alert(1)' }), '');
  assert.equal(safeSpriteSource({ sprite_path: '//evil.test/p.png' }), '');
  assert.equal(safeSpriteSource({}), '');
  assert.equal(spriteFallbackName(''), '?');
  assert.equal(spriteFallbackName(undefined), '?');
});

test('prefiere español y cae al inglés', () => {
  const names = [
    { name: 'Pikachu', language: { name: 'en' } },
    { name: 'Pikachu', language: { name: 'es' } }
  ];

  assert.deepEqual(pickLocalizedName(names), { value: 'Pikachu', language: 'es' });
  assert.deepEqual(pickLocalizedName([names[0]]), { value: 'Pikachu', language: 'en' });
  assert.equal(pickLocalizedName([]), null);
});

test('limpia saltos y caracteres de control', () => {
  assert.equal(cleanFlavorText('Duerme\n\fen el suelo.'), 'Duerme en el suelo.');
});

test('humaniza los slugs de la API', () => {
  assert.equal(prettyName('mr-mime'), 'Mr Mime');
  assert.equal(prettyName('nidoran-f'), 'Nidoran F');
  assert.equal(prettyName('pikachu'), 'Pikachu');
});

test('prefiere el artwork oficial y cae a front_default', () => {
  const base = {
    entryNumber: 25,
    speciesKey: 'pikachu',
    nationalNumber: 25,
    abilities: new Map<string, string>(),
    species: {},
    pokemon: {
      id: 25,
      sprites: { front_default: 'front.png', other: { 'official-artwork': { front_default: 'art.png' } } }
    }
  };

  assert.equal(toRawRecord(base).sprite_url, 'art.png');
  assert.equal(
    toRawRecord({ ...base, pokemon: { id: 25, sprites: { front_default: 'front.png' } } }).sprite_url,
    'front.png'
  );
  assert.equal(toRawRecord({ ...base, pokemon: { id: 25, sprites: {} } }).sprite_url, '');
});

test('mapea tipos, stats, habilidades y sprite', () => {
  const record = toRawRecord({
    entryNumber: 25,
    speciesKey: 'pikachu',
    nationalNumber: 25,
    abilities: new Map([['static', 'Electrostática']]),
    species: {
      names: [{ name: 'Pikachu', language: { name: 'es' } }],
      flavor_text_entries: [{ flavor_text: 'Roe\fcosas.', language: { name: 'es' } }]
    },
    pokemon: {
      id: 25,
      types: [
        { slot: 2, type: { name: 'fairy' } },
        { slot: 1, type: { name: 'electric' } }
      ],
      abilities: [{ ability: { name: 'static' } }],
      stats: [
        { base_stat: 35, stat: { name: 'hp' } },
        { base_stat: 55, stat: { name: 'attack' } },
        { base_stat: 40, stat: { name: 'defense' } },
        { base_stat: 50, stat: { name: 'special-attack' } },
        { base_stat: 50, stat: { name: 'special-defense' } },
        { base_stat: 90, stat: { name: 'speed' } }
      ],
      sprites: { front_default: 'front.png' }
    }
  });

  assert.equal(record.type_primary, 'electric');
  assert.equal(record.type_secondary, 'fairy');
  assert.equal(record.abilities, 'Electrostática');
  assert.equal(record.sprite_url, 'front.png');
  assert.equal(record.national_dex_number, '25');
  assert.equal(record.species_key, 'pokeapi:pikachu');
  assert.equal(record.dex_entry, 'Roe cosas.');
});

test('recolecta con fetch inyectado, ordena y avisa de fallos', async () => {
  const calls: string[] = [];
  const fakeFetch = async (url: string) => {
    calls.push(url);

    if (url.endsWith('/pokedex/kanto')) {
      return {
        pokemon_entries: [
          {
            entry_number: 2,
            pokemon_species: { name: 'ivysaur', url: 'https://pokeapi.co/api/v2/pokemon-species/2/' }
          },
          {
            entry_number: 1,
            pokemon_species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' }
          }
        ]
      };
    }

    if (url.includes('/pokemon-species/1/')) throw new Error('404');

    return {
      id: 2,
      names: [{ name: 'Ivysaur', language: { name: 'es' } }],
      flavor_text_entries: [],
      varieties: [],
      types: [{ slot: 1, type: { name: 'grass' } }],
      abilities: [],
      stats: [],
      sprites: { front_default: null }
    };
  };

  const result = await collectPokedex({ pokedexKey: 'kanto', fetchJson: fakeFetch });

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].record.dex_number, '2');
  assert.equal(result.issues.length, 1);
  assert.equal(result.cancelled, false);
  assert.ok(calls.length >= 3);
});

test('el límite cero importa todo', async () => {
  const result = await collectPokedex({
    pokedexKey: 'kanto',
    maxEntries: 0,
    fetchJson: async (url) => {
      if (url.endsWith('/pokedex/kanto')) {
        return {
          pokemon_entries: [
            { entry_number: 1, pokemon_species: { name: 'bulbasaur', url: 's/1/' } }
          ]
        };
      }

      return {
        id: 1,
        names: [],
        flavor_text_entries: [],
        varieties: [],
        types: [],
        abilities: [],
        stats: [],
        sprites: {}
      };
    }
  });

  assert.equal(result.records.length, 1);
});

import { createFetchJson } from '$lib/import/http-client';

test('reintenta un 429 y termina bien', async () => {
  let calls = 0;
  const request = async () => {
    calls += 1;
    if (calls === 1) {
      return { ok: false, status: 429, headers: { get: () => '0' }, json: async () => ({}) };
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ ok: true }) };
  };

  const fetchJson = createFetchJson(request, 50);
  assert.deepEqual(await fetchJson('https://pokeapi.co/api/v2/pokemon/1'), { ok: true });
  assert.equal(calls, 2);
});

test('tras tres fallos lanza un mensaje en español', async () => {
  const request = async () => ({
    ok: false,
    status: 500,
    headers: { get: () => null },
    json: async () => ({})
  });

  const fetchJson = createFetchJson(request, 50);
  await assert.rejects(fetchJson('https://pokeapi.co/x'), /No se ha podido consultar/);
});


test('sugiere únicamente una región para juegos de distintas generaciones', () => {
  const cases: Array<[string, string]> = [
    ['Pokémon Rojo Fuego', 'kanto'],
    ['Pokémon Oro HeartGold', 'original-johto'],
    ['Pokémon Esmeralda', 'hoenn'],
    ['Pokémon Diamante', 'sinnoh'],
    ['Pokémon Negro 2', 'unova'],
    ['Pokémon X', 'kalos'],
    ['Pokémon Ultraluna', 'original-alola'],
    ['Pokémon Espada', 'galar'],
    ['Leyendas Pokémon Arceus', 'hisui'],
    ['Pokémon Púrpura', 'paldea']
  ];

  for (const [game, expected] of cases) {
    assert.equal(suggestPokedexKey(game, ''), expected, game);
  }
  assert.equal(suggestPokedexKey('Pokémon Xtreme', ''), '');
});

test('cada opción regional utiliza su identificador canónico de PokéAPI', async () => {
  const keys = [
    'kanto', 'original-johto', 'hoenn', 'sinnoh', 'unova',
    'kalos', 'original-alola', 'galar', 'hisui', 'paldea'
  ];

  for (const key of keys) {
    const requested: string[] = [];
    await collectPokedex({
      pokedexKey: key,
      fetchJson: async (url) => {
        requested.push(url);
        return { pokemon_entries: [] };
      }
    });

    if (key === 'kalos') {
      assert.deepEqual(requested, [
        'https://pokeapi.co/api/v2/pokedex/kalos-central',
        'https://pokeapi.co/api/v2/pokedex/kalos-coastal',
        'https://pokeapi.co/api/v2/pokedex/kalos-mountain'
      ]);
    } else {
      assert.deepEqual(requested, ['https://pokeapi.co/api/v2/pokedex/' + key]);
    }
  }
});


test('ofrece ediciones según la región elegida', () => {
  assert.deepEqual(getPokedexGames('kanto').map((game) => game.key), ['red', 'blue', 'yellow', 'firered', 'leafgreen', 'lets-go-pikachu', 'lets-go-eevee']);
  assert.deepEqual(getPokedexGames('paldea').map((game) => game.key), ['scarlet', 'violet']);
  for (const region of ['kanto', 'original-johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'original-alola', 'galar', 'hisui', 'paldea']) {
    assert.ok(getPokedexGames(region).length > 0, 'Faltan juegos para ' + region);
  }
  assert.equal(suggestPokedexGameKey('Pokémon Rojo Fuego', '', 'kanto'), 'firered');
  assert.equal(suggestPokedexGameKey('Pokémon Púrpura', '', 'paldea'), 'violet');
  assert.deepEqual(getPokedexGames('original-johto').map((game) => game.key), ['gold', 'silver', 'crystal', 'heartgold', 'soulsilver']);
  assert.ok(appendGameExclusiveEntries([], 'heartgold').entries.some((entry) => entry.speciesKey === 'omanyte'));
  assert.ok(appendGameExclusiveEntries([], 'soulsilver').entries.some((entry) => entry.speciesKey === 'kabuto'));
  assert.equal(isExclusiveToOtherGame('firered', 'sandshrew'), true);
  assert.equal(isExclusiveToOtherGame('firered', 'ekans'), false);
  assert.equal(isExclusiveToOtherGame('leafgreen', 'ekans'), true);
  assert.equal(isExclusiveToOtherGame('scarlet', 'misdreavus'), true);
  assert.equal(isExclusiveToOtherGame('violet', 'great-tusk'), true);
  assert.deepEqual(getPokedexGames('hoenn').map((game) => game.key), ['ruby', 'sapphire', 'emerald', 'omega-ruby', 'alpha-sapphire']);
  assert.deepEqual(getPokedexGames('sinnoh').map((game) => game.key).slice(0, 3), ['diamond', 'pearl', 'platinum']);
  assert.deepEqual(getPokedexGames('unova').map((game) => game.key), ['black', 'white', 'black-2', 'white-2']);
  assert.deepEqual(getPokedexGames('original-alola').map((game) => game.key), ['sun', 'moon', 'ultra-sun', 'ultra-moon']);
  assert.equal(getPokedexGames('hisui')[0]?.key, 'legends-arceus');
  assert.deepEqual(getPokedexGames('unknown'), []);
});

test('une exclusivos a la Pokédex regional sin duplicar especies', () => {
  const regional = [
    { entryNumber: 1, speciesKey: 'ekans', speciesUrl: 'https://pokeapi.co/api/v2/pokemon-species/ekans/' },
    { entryNumber: 2, speciesKey: 'bulbasaur', speciesUrl: 'https://pokeapi.co/api/v2/pokemon-species/bulbasaur/' }
  ];
  const result = appendGameExclusiveEntries(regional, 'firered');
  assert.ok(result.added > 0);
  assert.equal(result.entries.filter((entry) => entry.speciesKey === 'ekans').length, 1);
  assert.ok(result.entries.some((entry) => entry.speciesKey === 'scizor'));
  assert.equal(result.entries[2].entryNumber, 3);
});

test('la unión de Paldea incorpora exclusivos de ambas ediciones', () => {
  const scarlet = appendGameExclusiveEntries([], 'scarlet');
  const violet = appendGameExclusiveEntries([], 'violet');
  assert.ok(scarlet.entries.some((entry) => entry.speciesKey === 'great-tusk'));
  assert.ok(violet.entries.some((entry) => entry.speciesKey === 'iron-valiant'));
  assert.equal(scarlet.entries.some((entry) => entry.speciesKey === 'iron-valiant'), false);
  assert.equal(violet.entries.some((entry) => entry.speciesKey === 'great-tusk'), false);
});

test('collectPokedex importa extras de la edición y cuenta solo los descargados', async () => {
  const fetchJson = async (url: string): Promise<unknown> => {
    if (url.endsWith('/pokedex/kanto')) return { pokemon_entries: [] };
    if (url.endsWith('/pokemon-species/ekans/')) {
      return { id: 23, names: [{ name: 'Ekans', language: { name: 'en' } }], flavor_text_entries: [] };
    }
    if (url.endsWith('/pokemon/23')) {
      return { id: 23, types: [], abilities: [], stats: [], sprites: {} };
    }
    throw new Error('URL inesperada en la prueba: ' + url);
  };

  const result = await collectPokedex({
    pokedexKey: 'kanto',
    gameKey: 'firered',
    maxEntries: 1,
    fetchJson
  });

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].record.species_key, 'pokeapi:ekans');
  assert.equal(result.exclusiveAdded, 1);
});
