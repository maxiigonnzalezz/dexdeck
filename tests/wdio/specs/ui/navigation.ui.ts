import { browser, expect } from '@wdio/globals';
import { loadBrowserApp } from '../../helpers/browser-mocks.ts';
import { selectors } from '../../helpers/selectors.ts';

describe('DexDeck · interfaz (Chromium)', () => {
  before(async () => {
    await loadBrowserApp();
  });

  it('muestra la biblioteca sembrada por el backend simulado', async () => {
    await expect($(selectors.appShell)).toBeDisplayed();
    expect(await $$(selectors.library.cards)).toHaveLength(2);
    await expect($(selectors.library.cards)).toBeDisplayed();
    await expect($(selectors.notice)).not.toBeDisplayed();
  });

  it('navega entre enciclopedia, ajustes y biblioteca sin recargar', async () => {
    await $(selectors.nav.encyclopedia).click();
    await expect($('h1=La enciclopedia DexDeck.')).toBeDisplayed();

    await $(selectors.nav.settings).click();
    await expect($(selectors.settings.heading)).toBeDisplayed();
    await expect($(selectors.settings.heading)).toHaveText(expect.stringContaining('Los ajustes'));

    await $(selectors.nav.library).click();
    await expect($(selectors.library.search)).toBeDisplayed();
    expect(await $$(selectors.library.cards)).toHaveLength(2);
  });

  it('aplica el tema claro desde ajustes', async () => {
    await $(selectors.nav.settings).click();
    await $(selectors.settings.theme('Claro')).click();

    await expect($(selectors.notice)).toHaveText(expect.stringContaining('Tema Claro aplicado'));
    const theme = await browser.execute(() => document.documentElement.dataset.theme);
    expect(theme).toBe('light');
  });
});
