import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { TauriCapabilities } from '@wdio/tauri-service';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../..', import.meta.url));
const binary = path.join(root, 'src-tauri/target/debug/dexdeck');

if (!fs.existsSync(binary)) {
  throw new Error(
    `No existe el binario de pruebas E2E: ${binary}\n` +
      'Constrúyelo una vez con: pnpm test:e2e:build'
  );
}

// Aísla SQLite, logs y estado de ventana del DexDeck real del usuario. La app
// hereda estas variables y escribe todo dentro de un directorio temporal.
const dataRoot =
  process.env.DEXDECK_E2E_DATA_HOME ?? path.join(os.tmpdir(), 'dexdeck-e2e', `run-${process.pid}`);
process.env.XDG_DATA_HOME = path.join(dataRoot, 'data');
process.env.XDG_CONFIG_HOME = path.join(dataRoot, 'config');
process.env.XDG_CACHE_HOME = path.join(dataRoot, 'cache');
for (const dir of [process.env.XDG_DATA_HOME, process.env.XDG_CONFIG_HOME, process.env.XDG_CACHE_HOME]) {
  fs.mkdirSync(dir!, { recursive: true });
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [path.join(root, 'tests/wdio/specs/e2e/**/*.e2e.ts')],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: binary
      }
    }
  ] as TauriCapabilities[],
  logLevel: 'warn',
  bail: 0,
  baseUrl: 'tauri://localhost',
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
    require: [require.resolve('tsx/cjs')]
  },
  services: [
    [
      'tauri',
      {
        driverProvider: 'embedded',
        appBinaryPath: binary,
        embeddedPort: 4445
      }
    ]
  ]
};
