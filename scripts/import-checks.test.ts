import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay, shouldRetry } from '$lib/import/http-policy';
import { mapWithConcurrency } from '$lib/import/concurrency';
import { parsePokemonFile } from '$lib/import/pokemon-import';
import type { GamePokemon } from '$lib/pokedex';

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
      { name: 'rara', url: 'r' }
    ]
  });

  assert.deepEqual(options.map((option) => option.key), ['kanto', 'hoenn', 'rara']);
  assert.equal(options[0].label, 'Kanto');
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
