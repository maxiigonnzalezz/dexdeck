// Decisiones de red sin dependencias: se separan del cliente para poder
// probarlas en Node sin cargar el plugin de Tauri.

/** Un 429 o un 5xx merecen otro intento; un 4xx de cliente, no. */
export function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Espera antes del siguiente intento. `Retry-After` manda cuando existe y es
 * un número de segundos; si no, se duplica la espera con un techo de 8 s.
 */
export function retryDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter.trim());
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 30_000);
    }
  }

  return Math.min(800 * 2 ** attempt, 8000);
}
