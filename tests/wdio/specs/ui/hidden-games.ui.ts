import { browser, expect } from '@wdio/globals';
import { loadBrowserApp } from '../../helpers/browser-mocks.ts';
import { selectors } from '../../helpers/selectors.ts';

/**
 * Oculta un juego desde la biblioteca usando el diálogo de opciones.
 * Es el mismo camino que sigue una persona: «Abrir ficha» → «Quitar de biblioteca».
 */
async function hideGameFromLibrary(name: string): Promise<void> {
  await $(selectors.library.openDetailsByName(name)).click();
  const dialog = $(selectors.detail.dialog);
  await dialog.waitForDisplayed();

  await $('//*[@data-testid="game-details-dialog"]//button[normalize-space(.)="Quitar de biblioteca"]').click();
  await $('//*[@data-testid="game-details-dialog"]//button[normalize-space(.)="Quitar de la biblioteca"]').click();
  await dialog.waitForDisplayed({ reverse: true });
}

async function hiddenNames(): Promise<(string | null)[]> {
  const items = await $$(selectors.hidden.items);
  const names: (string | null)[] = [];
  for (const item of items) {
    names.push(await item.getAttribute('data-game-name'));
  }
  return names;
}

describe('DexDeck · juegos ocultos (Chromium)', () => {
  before(async () => {
    await loadBrowserApp();
  });

  it('muestra el estado vacío cuando no hay juegos ocultos', async () => {
    await $(selectors.nav.settings).click();
    await $(selectors.hidden.panel).waitForDisplayed();
    await expect($(selectors.hidden.empty)).toBeDisplayed();
  });

  it('restaura un juego oculto y lo devuelve a la biblioteca', async () => {
    await $(selectors.nav.library).click();
    await hideGameFromLibrary('Pokémon Aurora');

    await expect($(selectors.library.cardByName('Pokémon Aurora'))).not.toBeDisplayed();

    await $(selectors.nav.settings).click();
    await browser.waitUntil(async () => (await hiddenNames()).includes('Pokémon Aurora'), {
      timeoutMsg: 'El juego oculto no apareció en Ajustes'
    });

    await $(selectors.hidden.restore('Pokémon Aurora')).click();
    await expect($(selectors.hidden.status)).toHaveText(
      expect.stringContaining('vuelve a la biblioteca')
    );

    await $(selectors.nav.library).click();
    await expect($(selectors.library.cardByName('Pokémon Aurora'))).toBeDisplayed();
  });

  it('borra un juego oculto definitivamente tras confirmar', async () => {
    await hideGameFromLibrary('Pokémon Aurora');

    await $(selectors.nav.settings).click();
    await browser.waitUntil(async () => (await hiddenNames()).includes('Pokémon Aurora'));

    await $(selectors.hidden.delete('Pokémon Aurora')).click();
    await expect($(selectors.hidden.deleteDialog)).toBeDisplayed();
    await $(selectors.hidden.deleteConfirm).click();

    await browser.waitUntil(async () => !(await hiddenNames()).includes('Pokémon Aurora'), {
      timeoutMsg: 'El juego borrado siguió apareciendo entre los ocultos'
    });
    await expect($(selectors.hidden.status)).toHaveText(
      expect.stringContaining('se ha borrado definitivamente')
    );

    await $(selectors.nav.library).click();
    await expect($(selectors.library.cardByName('Pokémon Aurora'))).not.toBeDisplayed();
  });
});
