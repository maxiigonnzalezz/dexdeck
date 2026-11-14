import { browser, expect } from '@wdio/globals';
import { loadBrowserApp } from '../../helpers/browser-mocks.ts';

describe('DexDeck · mocks de comandos Tauri (Chromium)', () => {
  before(async () => {
    await loadBrowserApp();
  });

  it('registra, ejecuta y restaura un mock del servicio', async () => {
    const mock = await browser.tauri.mock('get_system_info');
    await mock.mockResolvedValue({
      os: 'windows',
      osName: 'Windows de prueba',
      architecture: 'x86_64'
    });

    const result = await browser.execute(() =>
      (window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> };
      }).__TAURI_INTERNALS__.invoke('get_system_info')
    );

    await mock.update();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      os: 'windows',
      osName: 'Windows de prueba',
      architecture: 'x86_64'
    });

    await mock.mockRestore();
    let message = '';
    try {
      await browser.execute(() =>
        (window as unknown as {
          __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<unknown> };
        }).__TAURI_INTERNALS__.invoke('get_system_info')
      );
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('unmocked Tauri command');
  });
});
