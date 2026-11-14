import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../..', import.meta.url));
const devServerUrl = process.env.DEXDECK_DEV_URL ?? 'http://localhost:1420';

/**
 * Pruebas rápidas de interfaz en Chromium.
 *
 * No compilan Rust ni arrancan Tauri: el servicio intercepta
 * `window.__TAURI_INTERNALS__.invoke` y los specs inyectan una SQLite en
 * memoria antes de que arranque la app. Sirven para iterar en componentes,
 * navegación, formularios y validaciones en segundos.
 */
export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [path.join(root, 'tests/wdio/specs/ui/**/*.ui.ts')],
  exclude: [],
  maxInstances: 2,
  capabilities: [
    {
      browserName: 'tauri',
      'wdio:tauriServiceOptions': {
        mode: 'browser',
        devServerUrl
      },
      'goog:chromeOptions': {
        binary: process.env.CHROME_BIN ?? '/usr/bin/chromium',
        args: ['--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1280,900']
      },
      // Usa el chromedriver del sistema (misma versión que Chromium) en vez de
      // descargar uno nuevo en cada arranque.
      'wdio:chromedriverOptions': {
        binary: process.env.CHROMEDRIVER_PATH ?? '/usr/bin/chromedriver'
      }
    }
  ],
  logLevel: 'warn',
  // El servicio intenta recuperar el foco de ventana en cada comando aunque en
  // modo browser no exista una ventana Tauri; sus avisos solo añaden ruido.
  logLevels: {
    'tauri-service': 'error'
  },
  bail: 0,
  baseUrl: devServerUrl,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60_000,
    require: [require.resolve('tsx/cjs')]
  },
  services: [
    [
      'tauri',
      {
        mode: 'browser',
        devServerUrl,
        devServer: {
          command: 'pnpm dev',
          cwd: root,
          timeoutMs: 60_000,
          reuseExistingServer: true
        }
      }
    ]
  ]
};
