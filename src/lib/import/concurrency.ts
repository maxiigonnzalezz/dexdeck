/**
 * Ejecuta `worker` sobre cada elemento con un máximo de tareas simultáneas y
 * devuelve los resultados en el orden original. Si la señal se aborta, las
 * tareas que aún no han empezado se quedan en `undefined` sin lanzar.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<Array<R | undefined>> {
  const results: Array<R | undefined> = new Array(items.length).fill(undefined);
  const workers = Math.max(1, Math.min(limit, items.length));
  let next = 0;

  const run = async () => {
    while (!signal?.aborted) {
      const index = next;
      next += 1;

      if (index >= items.length) return;
      if (signal?.aborted) return;

      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workers }, run));

  return results;
}
