import { browser } from '@wdio/globals';
import { waitForApp } from './ui.ts';

/**
 * Juego de ejemplo que la app recibe del backend SQLite simulado en modo
 * navegador. Mantener las mismas claves que `Game` en `src/lib/db.ts`.
 */
export type SeedGame = {
  id: number;
  name: string;
  developer: string;
  version: string;
  type: string;
  color: string;
  symbol: string;
  status: string;
  description: string;
  cover: string;
  official_url: string;
  install_path: string;
  executable_path: string;
  is_hidden: number;
};

export const seedGames: SeedGame[] = [
  {
    id: 2,
    name: 'Pokémon Eclipse',
    developer: 'Equipo Eclipse',
    version: '1.2',
    type: 'Fangame',
    color: 'purple',
    symbol: '✦',
    status: 'En biblioteca',
    description: 'Una aventura ambientada en la región de Noctis.',
    cover: '',
    official_url: '',
    install_path: '',
    executable_path: '',
    is_hidden: 0
  },
  {
    id: 1,
    name: 'Pokémon Aurora',
    developer: 'Estudio Aurora',
    version: '0.9',
    type: 'ROM Hack',
    color: 'blue',
    symbol: '◇',
    status: 'Pendiente',
    description: 'Remezcla de una región clásica con nuevos líderes.',
    cover: '',
    official_url: '',
    install_path: '',
    executable_path: '',
    is_hidden: 0
  }
];

type SqlArgs = { query?: string; values?: unknown[] };

/**
 * Script que se ejecuta antes de que arranque la app en cada navegación.
 *
 * Sustituye el backend de Tauri por una SQLite en memoria y datos de sistema
 * fijos. Así los tests de interfaz no necesitan compilar Rust ni arrancar la
 * app nativa. Se ejecuta con `browser.addInitScript`, por lo que también cubre
 * los `invoke()` que la app lanza en `onMount`.
 */
function installMocks(gamesBase64: string): void {
  const w = window as unknown as {
    __wdio_mocks__?: Record<string, (args?: unknown) => unknown>;
    __dexdeckGames__?: SeedGame[];
  };

  // browser.addInitScript serializes the function with btoa, which only
  // accepts Latin-1. The seed data travels as ASCII base64 and is decoded here.
  const bytes = Uint8Array.from(atob(gamesBase64), (char) => char.charCodeAt(0));
  const games = JSON.parse(new TextDecoder().decode(bytes)) as SeedGame[];
  w.__dexdeckGames__ = games.map((game) => ({ ...game }));

  const nextId = () => Math.max(0, ...w.__dexdeckGames__!.map((game) => game.id)) + 1;

  w.__wdio_mocks__ = {
    'plugin:sql|load': () => Promise.resolve('sqlite:dexdeck-test.db'),
    'plugin:sql|select': (raw) => {
      const args = (raw ?? {}) as SqlArgs;
      if (args.query?.includes('is_hidden = 0')) {
        return Promise.resolve(
          [...w.__dexdeckGames__!]
            .filter((game) => game.is_hidden === 0)
            .sort((a, b) => b.id - a.id)
        );
      }
      return Promise.resolve([]);
    },
    'plugin:sql|execute': (raw) => {
      const args = (raw ?? {}) as SqlArgs;
      const query = args.query ?? '';
      const values = (args.values ?? []) as (string | number)[];

      if (/^\s*INSERT/i.test(query)) {
        const [name, developer, version, type, color, symbol, status, description, cover, official_url, install_path, executable_path] = values;
        w.__dexdeckGames__!.push({
          id: nextId(),
          name: String(name ?? ''),
          developer: String(developer ?? ''),
          version: String(version ?? ''),
          type: String(type ?? ''),
          color: String(color ?? ''),
          symbol: String(symbol ?? ''),
          status: String(status ?? ''),
          description: String(description ?? ''),
          cover: String(cover ?? ''),
          official_url: String(official_url ?? ''),
          install_path: String(install_path ?? ''),
          executable_path: String(executable_path ?? ''),
          is_hidden: 0
        });
        // @tauri-apps/plugin-sql espera la tupla [rowsAffected, lastInsertId].
        return Promise.resolve([1, nextId() - 1]);
      }

      if (/SET\s+is_hidden\s*=\s*1/i.test(query)) {
        const id = Number(values[0]);
        const game = w.__dexdeckGames__!.find((item) => item.id === id);
        if (game) game.is_hidden = 1;
        return Promise.resolve([1, null]);
      }

      if (/^\s*UPDATE/i.test(query)) {
        const id = Number(values[values.length - 1]);
        const game = w.__dexdeckGames__!.find((item) => item.id === id);
        if (game) {
          const fields = ['name', 'developer', 'version', 'type', 'color', 'symbol', 'status', 'description', 'cover', 'official_url', 'install_path', 'executable_path'] as const;
          fields.forEach((field, index) => {
            if (index < values.length - 1) game[field] = String(values[index]);
          });
        }
        return Promise.resolve([1, null]);
      }

      return Promise.resolve([1, null]);
    },
    get_system_info: () => Promise.resolve({ os: 'linux', osName: 'Linux', architecture: 'x86_64' }),
    get_installation_info: () =>
      Promise.resolve({
        kind: 'unsupported',
        canUpdate: false,
        canUninstall: false,
        message: 'Instalacion de pruebas en modo navegador.'
      }),
    get_wallpaper_snapshot: () => Promise.resolve(null),
    'plugin:app|version': () => Promise.resolve('0.1.0'),
    'plugin:updater|check': () => Promise.reject('Sin actualizaciones en modo navegador.')
  };
}

/**
 * Arranca la app en Chromium con el backend simulado. `browser.addInitScript`
 * garantiza que los mocks existan antes de `onMount`, y la navegación posterior
 * recarga la página para que la app los use desde el principio.
 */
export async function loadBrowserApp(): Promise<void> {
  const payload = Buffer.from(JSON.stringify(seedGames), 'utf8').toString('base64');
  await browser.addInitScript(installMocks, payload);
  await browser.url(process.env.DEXDECK_DEV_URL ?? 'http://localhost:1420');
  await waitForApp();
}
