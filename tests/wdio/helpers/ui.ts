import { browser, expect } from '@wdio/globals';
import { selectors } from './selectors';

export type NewGame = {
  name: string;
  developer?: string;
  description?: string;
};

/** Espera a que la interfaz de DexDeck esté montada y lista. */
export async function waitForApp(timeout = 30_000): Promise<void> {
  const shell = $(selectors.appShell);
  await shell.waitForDisplayed({ timeout });
  await $(selectors.nav.library).waitForDisplayed({ timeout });
}

/** Navega por la barra lateral y espera al cambio de sección. */
export async function openSection(
  section: 'library' | 'encyclopedia' | 'updates' | 'settings'
): Promise<void> {
  await $(selectors.nav[section]).click();
}

/** Abre el diálogo de alta de juego. */
export async function openAddGameDialog(): Promise<void> {
  await $(selectors.library.addButton).click();
  await $(selectors.addGame.form).waitForDisplayed();
}

/** Rellena y guarda un juego. Devuelve el nombre usado. */
export async function addGame(game: NewGame): Promise<string> {
  await openAddGameDialog();

  await $(selectors.addGame.name).setValue(game.name);
  if (game.developer) {
    await $(selectors.addGame.developer).setValue(game.developer);
  }
  if (game.description) {
    await $(selectors.addGame.description).setValue(game.description);
  }

  await $(selectors.addGame.submit).click();
  await $(selectors.addGame.form).waitForDisplayed({ reverse: true });
  return game.name;
}

/** Espera a que exista una tarjeta de juego con ese nombre. */
export async function waitForGameCard(name: string, timeout = 10_000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const cards = await $$(selectors.library.cards);
      for (const card of cards) {
        if ((await card.getAttribute('data-game-name')) === name) return true;
      }
      return false;
    },
    { timeout, timeoutMsg: `No apareció la tarjeta del juego «${name}»` }
  );
}

/** Texto del aviso global (errores y confirmaciones de la app). */
export async function noticeText(): Promise<string> {
  const notice = $(selectors.notice);
  await notice.waitForDisplayed();
  return (await notice.getText()).trim();
}

export async function expectNotice(contains: string): Promise<void> {
  const text = await noticeText();
  expect(text).toContain(contains);
}

export { expect };
