# Pruebas de DexDeck con WebdriverIO

Tres niveles, del más rápido al más real:

| Comando | Qué prueba | Backend | Duración típica |
| --- | --- | --- | --- |
| `pnpm test:ui` | Componentes, navegación, formularios y mocks de comandos Tauri | Chromium + SQLite simulada | ~5 s |
| `pnpm test:e2e` | Flujos completos contra el binario real | Tauri + WebKitGTK + SQLite real | ~3 s (tras compilar) |
| `pnpm test:e2e:build` | Compila el binario de pruebas con `--features wdio` | Rust | ~25 s incremental |

## Requisitos

- Node, pnpm y el proyecto instalado.
- Chromium y `chromedriver` de la **misma versión** en el sistema (`/usr/bin/chromium`, `/usr/bin/chromedriver`).
- Para E2E: toolchain de Rust y el binario generado con `pnpm test:e2e:build`.

Se puede cambiar la ruta del navegador con `CHROME_BIN`, la del driver con
`CHROMEDRIVER_PATH` y la URL del servidor con `DEXDECK_DEV_URL`.

## Modo interfaz (rápido)

`wdio.browser.conf.ts` arranca `pnpm dev` (o reutiliza uno ya activo), abre
Chromium en modo headless y sustituye el backend de Tauri por mocks.

`helpers/browser-mocks.ts` inyecta antes de que arranque la app:

- una SQLite en memoria para `plugin:sql|load/select/execute`,
- `get_system_info`, `get_installation_info`, `get_wallpaper_snapshot`,
  `plugin:app|version` y `plugin:updater|check`.

Los datos viajan en base64 porque `browser.addInitScript` serializa con `btoa`
y falla con acentos. Es un detalle del harness, no de la app.

## Modo E2E (app real)

`wdio.tauri.conf.ts` usa el provider `embedded` de `@wdio/tauri-service` y el
plugin `tauri-plugin-wdio-webdriver`, así que no hace falta `WebKitWebDriver`
del sistema.

- El binario se genera con `pnpm test:e2e:build` (feature Cargo `wdio`,
  configuración `src-tauri/tauri.e2e.conf.json` y `VITE_WDIO=1`).
- Si cambias el frontend o Rust, vuelve a compilar: los assets van embebidos.
- Los datos de la app se aíslan en `/tmp/dexdeck-e2e/run-<pid>` mediante
  `XDG_DATA_HOME`, `XDG_CONFIG_HOME` y `XDG_CACHE_HOME`. La SQLite queda en
  `config/com.dexdeck.launcher/dexdeck.db`.
- El plugin de frontend `@wdio/tauri-plugin` solo se empaqueta con
  `VITE_WDIO=1`; en un build normal Rollup elimina esa rama.

## Estructura

```
tests/wdio/
  tsconfig.json              # tipos de Mocha/Node/WDIO para los specs
  wdio.browser.conf.ts       # Chromium + mocks
  wdio.tauri.conf.ts         # app real
  helpers/
    selectors.ts             # selectores centralizados (data-testid primero)
    ui.ts                    # acciones reutilizables, sin sleeps
    browser-mocks.ts         # backend simulado para modo interfaz
  specs/
    ui/*.ui.ts               # pruebas rápidas
    e2e/*.e2e.ts             # pruebas contra Tauri
```

Al añadir una pantalla, añade `data-testid` estables y su selector en
`helpers/selectors.ts`. Evita CSS ligado a clases visuales.

## Tipos

Los specs usan un `tsconfig.json` propio (`tests/wdio/tsconfig.json`) con los
tipos de Mocha, Node y WebdriverIO, y `allowImportingTsExtensions`. El
`tsconfig.json` de SvelteKit excluye `tests/wdio/**` para no mezclar ambos
mundos. `pnpm check` valida la app y los specs; `pnpm check:tests` valida solo
los specs.

## Ejecución selectiva

```bash
# Un archivo
pnpm test:ui --spec tests/wdio/specs/ui/library.ui.ts
pnpm test:e2e --spec tests/wdio/specs/e2e/smoke.e2e.ts

# Por nombre de test (Mocha)
pnpm test:e2e --grep "valida el nombre"
```

## Reglas de velocidad

- Nada de `sleep`: `waitForDisplayed`, `waitForExist` o `browser.waitUntil`.
- Reutiliza helpers y una sola sesión por spec.
- No recargues la app entre tests salvo que el test lo necesite.
- El modo interfaz es el bucle normal de desarrollo; el E2E se reserva para
  integración y regresiones.

## Limitaciones conocidas

- `browser.keys(['\uE00C'])` no dispara el `cancel` nativo de `<dialog>` en
  WebKitGTK con el driver embebido. Los tests cierran con el botón accesible.
- La tarjeta de biblioteca abre dos `<dialog>` superpuestos (ficha heredada y
  ficha nueva); los tests usan el botón `···` (`Abrir ficha de ...`), que abre
  solo el diálogo actual. Es un defecto de la app, no del harness.
- En modo navegador, los `invoke()` anteriores a la inyección se cubren con
  `browser.addInitScript`; si añades otro comando en `onMount`, añade su mock
  en `browser-mocks.ts`.

## Control visual de escritorio

Cuando WDIO no alcanza (canvas, diálogos nativos del sistema, otra app, estado
real de la pantalla), usa el MCP `computer-use-linux` ya registrado en
OpenCode. No sustituye a WDIO: es el último recurso.

```bash
computer-use-linux doctor            # readiness Wayland/niri
computer-use-linux windows           # ventanas del compositor
computer-use-linux screenshot        # metadatos de una captura
```

En Niri funciona con `niri msg`, AT-SPI, `wtype`, `ydotool`/`uinput` y captura
vía portal/GNOME Shell. No requiere X11.
