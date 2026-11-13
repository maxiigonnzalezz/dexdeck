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
