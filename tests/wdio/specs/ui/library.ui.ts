import { browser, expect } from '@wdio/globals';
import { loadBrowserApp } from '../../helpers/browser-mocks.ts';
import { selectors } from '../../helpers/selectors.ts';
import { addGame, openAddGameDialog, waitForGameCard } from '../../helpers/ui.ts';

async function cardsCount(): Promise<number> {
  return (await $$(selectors.library.cards)).length;
}

describe('DexDeck · biblioteca (Chromium)', () => {
  before(async () => {
    await loadBrowserApp();
  });

  it('filtra por nombre y muestra el estado vacío de búsqueda', async () => {
    await $(selectors.library.search).setValue('Eclipse');
    await browser.waitUntil(async () => (await cardsCount()) === 1, {
      timeoutMsg: 'El filtro no redujo la biblioteca a un juego'
    });

    await $(selectors.library.search).setValue('NoExiste');
    await browser.waitUntil(async () => (await cardsCount()) === 0);
    await expect($(selectors.library.empty)).toBeDisplayed();
    await expect($(selectors.library.empty)).toHaveText(expect.stringContaining('No encontramos ese juego'));

    await $(selectors.library.clearSearch).click();
    await browser.waitUntil(async () => (await cardsCount()) === 2);
  });

  it('valida el nombre obligatorio antes de guardar', async () => {
    await openAddGameDialog();
    await $(selectors.addGame.name).setValue('   ');
    await $(selectors.addGame.submit).click();

    await expect($(selectors.addGame.error)).toHaveText(
      expect.stringContaining('Escribe el nombre del juego')
    );
    await $(selectors.addGame.close).click();
    await $(selectors.addGame.form).waitForDisplayed({ reverse: true });
  });

  it('añade un juego con el backend simulado y lo muestra en la biblioteca', async () => {
    const name = `UI Nueva ${Date.now()}`;
    await addGame({ name, developer: 'Pruebas de interfaz' });
    await waitForGameCard(name);

    await expect($(selectors.notice)).toHaveText(
      expect.stringContaining('Juego añadido a la biblioteca')
    );
    expect(await cardsCount()).toBe(3);
  });
});
