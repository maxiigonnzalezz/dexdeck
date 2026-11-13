import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay, shouldRetry } from '$lib/import/http-policy';
import { mapWithConcurrency } from '$lib/import/concurrency';

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
