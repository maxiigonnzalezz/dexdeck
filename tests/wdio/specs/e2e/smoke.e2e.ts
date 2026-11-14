import { expect } from '@wdio/globals';
import { addGame, waitForApp, waitForGameCard } from '../../helpers/ui.ts';
import { selectors } from '../../helpers/selectors.ts';

describe('DexDeck · humo E2E (Tauri + SQLite real)', () => {
  before(async () => {
    await waitForApp();
  });

  it('arranca con la ventana y la navegación visibles', async () => {
    await expect($(selectors.appShell)).toBeDisplayed();
    await expect($(selectors.nav.library)).toBeDisplayed();
    await expect($(selectors.library.addButton)).toBeDisplayed();
  });

  it('añade un juego y lo persiste en SQLite sin recargar la app', async () => {
    const name = `E2E Humo ${Date.now()}`;
    await addGame({ name, developer: 'Pruebas automáticas', description: 'Creado por WebdriverIO' });

    await waitForGameCard(name);
    const notice = $(selectors.notice);
    await notice.waitForDisplayed();
    await expect(notice).toHaveText(expect.stringContaining('Juego añadido a la biblioteca'));
  });

  it('abre la ficha del juego y la cierra con el botón Cerrar', async () => {
    const cards = await $$(selectors.library.cards);
    expect(cards.length).toBeGreaterThan(0);

    const name = await cards[0].getAttribute('data-game-name');
    await $(selectors.library.openDetailsByName(name!)).click();

    const dialog = $(selectors.detail.dialog);
    await dialog.waitForDisplayed();
    await expect(dialog).toHaveText(expect.stringContaining(name!));

    // Nota: `browser.keys(['\uE00C'])` no dispara el `cancel` nativo del
    // <dialog> en WebKitGTK con el driver embebido; el cierre se comprueba por
    // la ruta accesible que también usa el usuario.
    await $(selectors.detail.close).click();
    await dialog.waitForDisplayed({ reverse: true });
  });

  it('detecta el error de validación al guardar un nombre vacío', async () => {
    await $(selectors.library.addButton).click();
    await $(selectors.addGame.form).waitForDisplayed();

    await $(selectors.addGame.name).setValue('   ');
    await $(selectors.addGame.submit).click();

    const error = $(selectors.addGame.error);
    await error.waitForDisplayed();
    await expect(error).toHaveText(expect.stringContaining('Escribe el nombre del juego'));

    await $(selectors.addGame.close).click();
    await $(selectors.addGame.form).waitForDisplayed({ reverse: true });
  });
});
