// Instancia real del cliente sobre el plugin HTTP de Tauri, que respeta la
// lista blanca de `capabilities/default.json`.
import { fetch } from '@tauri-apps/plugin-http';
import { createFetchJson, type RequestLike } from './http-client';

export const fetchJson = createFetchJson(fetch as unknown as RequestLike);
