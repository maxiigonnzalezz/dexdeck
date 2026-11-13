// Cliente HTTP con timeout y reintentos. Recibe la función de petición por
// parámetro para poder probarlo en Node sin cargar el plugin de Tauri.
import { retryDelay, shouldRetry } from './http-policy';

export type RequestLike = (
  input: string,
  init?: { signal?: AbortSignal; connectTimeout?: number }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const FAILURE_MESSAGE =
  'No se ha podido consultar PokéAPI. Comprueba la conexión e inténtalo de nuevo.';

function cancelled(): Error {
  return new Error('Descarga cancelada.');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return signal?.aborted ? Promise.reject(cancelled()) : Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(cancelled());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Envuelve una petición con timeout por intento y hasta tres intentos en
 * errores de red, 429 y 5xx. La señal externa cancela de inmediato.
 */
export function createFetchJson(request: RequestLike, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (signal?.aborted) throw cancelled();

      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: Awaited<ReturnType<RequestLike>>;

      try {
        response = await request(url, { signal: controller.signal, connectTimeout: timeoutMs });
      } catch {
        if (signal?.aborted) throw cancelled();
        if (attempt === MAX_ATTEMPTS - 1) throw new Error(FAILURE_MESSAGE);
        await sleep(retryDelay(attempt, null), signal);
        continue;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }

      if (!response.ok) {
        if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS - 1) {
          throw new Error(FAILURE_MESSAGE);
        }

        await sleep(retryDelay(attempt, response.headers.get('retry-after')), signal);
        continue;
      }

      try {
        return await response.json();
      } catch {
        if (attempt === MAX_ATTEMPTS - 1) throw new Error(FAILURE_MESSAGE);
        await sleep(retryDelay(attempt, null), signal);
      }
    }

    throw new Error(FAILURE_MESSAGE);
  };
}
