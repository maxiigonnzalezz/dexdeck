import { browser, expect } from '@wdio/globals';
import { loadBrowserApp } from '../../helpers/browser-mocks.ts';
import { selectors } from '../../helpers/selectors.ts';

describe('DexDeck · mejoras de Pokédex y navegación (Chromium)', () => {
  before(async () => {
    await loadBrowserApp();
  });

  it('anuncia el cambio de sección mediante región ARIA live al navegar atrás/adelante', async () => {
    // Navegar a Enciclopedia para construir historial: ['Biblioteca', 'Enciclopedia']
    await $(selectors.nav.encyclopedia).click();
    await expect($('h1=La enciclopedia DexDeck.')).toBeDisplayed();

    // Simular clic del botón lateral atrás (button 3) en el cuerpo de la página.
    // Esto activa el listener real de mousedown en window y Svelte gestiona la reactividad.
    await browser.execute(() => {
      const event = new MouseEvent('mousedown', {
        button: 3,
        bubbles: true,
        cancelable: true,
        view: window
      });
      document.body.dispatchEvent(event);
    });

    // La región ARIA live debe anunciarse al navegar atrás
    await browser.waitUntil(async () => {
      const text = await browser.execute(() => {
        const el = document.querySelector('[aria-live="polite"]');
        return el ? el.textContent : null;
      });
      return text === 'Sección Biblioteca';
    }, { timeoutMsg: 'La región ARIA live no anunció el cambio a Biblioteca' });

    // Simular clic del botón lateral adelante (button 4)
    await browser.execute(() => {
      const event = new MouseEvent('mousedown', {
        button: 4,
        bubbles: true,
        cancelable: true,
        view: window
      });
      document.body.dispatchEvent(event);
    });

    await browser.waitUntil(async () => {
      const text = await browser.execute(() => {
        const el = document.querySelector('[aria-live="polite"]');
        return el ? el.textContent : null;
      });
      return text === 'Sección Enciclopedia';
    }, { timeoutMsg: 'La región ARIA live no anunció el cambio a Enciclopedia' });

    await $(selectors.encyclopedia.gameCard).click();
    await expect($('h1=Pokémon de prueba')).toBeDisplayed();
    await browser.execute(() => document.body.dispatchEvent(new MouseEvent('mousedown', {
      button: 3, bubbles: true, cancelable: true, view: window
    })));
    await expect($('h1=La enciclopedia DexDeck.')).toBeDisplayed();
    await browser.execute(() => document.body.dispatchEvent(new MouseEvent('mousedown', {
      button: 4, bubbles: true, cancelable: true, view: window
    })));
    await expect($('h1=Pokémon de prueba')).toBeDisplayed();
    await browser.execute(() => document.body.dispatchEvent(new MouseEvent('mousedown', {
      button: 3, bubbles: true, cancelable: true, view: window
    })));
    await expect($('h1=La enciclopedia DexDeck.')).toBeDisplayed();
    await browser.execute(() => document.body.dispatchEvent(new MouseEvent('mousedown', {
      button: 4, bubbles: true, cancelable: true, view: window
    })));
    await expect($('h1=Pokémon de prueba')).toBeDisplayed();
  });

  it('limpia búsqueda y avisos al navegar hacia atrás con el sidebar', async () => {
    await $(selectors.nav.settings).click();
    await expect($(selectors.settings.heading)).toBeDisplayed();

    // Escribir una búsqueda en la biblioteca, luego volver a biblioteca
    await $(selectors.nav.library).click();
    await $(selectors.library.search).setValue('prueba');
    await expect($(selectors.library.search)).toHaveValue('prueba');

    // Ir a enciclopedia y volver: búsqueda debe limpiarse
    await $(selectors.nav.encyclopedia).click();
    await $(selectors.nav.library).click();
    await expect($(selectors.library.search)).toHaveValue('');
  });

  it('bloquea y restaura el scroll al cerrar un diálogo con Escape', async () => {
    const before = await browser.execute(() => ({
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
      padding: document.body.style.paddingRight
    }));
    await $(selectors.nav.addGame).click();
    await expect($(selectors.addGame.form)).toBeDisplayed();
    await browser.waitUntil(() => browser.execute(() =>
      document.body.style.overflow === 'hidden' && document.documentElement.style.overflow === 'hidden'
    ));
    await browser.execute(() => document.querySelector<HTMLDialogElement>('.detail-modal')?.showModal());
    await browser.waitUntil(() => browser.execute(() => document.querySelector('.detail-modal')?.hasAttribute('open') ?? false));
    await browser.execute(() => document.querySelector<HTMLDialogElement>('.modal:not(.detail-modal)')?.close());
    await browser.waitUntil(() => browser.execute(() =>
      document.body.style.overflow === 'hidden' && document.documentElement.style.overflow === 'hidden'
    ));
    await browser.execute(() => document.querySelector<HTMLDialogElement>('.detail-modal')?.close());
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow !== 'hidden'));

    await $(selectors.nav.addGame).click();
    await expect($(selectors.addGame.form)).toBeDisplayed();
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow === 'hidden'));
    await browser.keys('Escape');
    await browser.waitUntil(() => browser.execute(() =>
      document.body.style.overflow !== 'hidden' && document.documentElement.style.overflow !== 'hidden'
    ));
    const after = await browser.execute(() => ({
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
      padding: document.body.style.paddingRight
    }));
    expect(after).toEqual(before);
  });

  it('cierra y vuelve a abrir la ficha de biblioteca sin abrir otro diálogo', async () => {
    await $(selectors.nav.library).click();
    await $(selectors.library.openCardDetailsByName('Pokémon Eclipse')).click();
    await expect($(selectors.detail.libraryDialog)).toBeDisplayed();
    await expect($(selectors.detail.dialog)).not.toBeDisplayed();
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow === 'hidden'));
    await browser.keys('Escape');
    await browser.waitUntil(() => browser.execute(() => !document.querySelector('[data-testid="game-detail-dialog"]')?.hasAttribute('open')));
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow !== 'hidden'));

    await $(selectors.library.openCardDetailsByName('Pokémon Eclipse')).click();
    await expect($(selectors.detail.libraryDialog)).toBeDisplayed();
    await $(selectors.detail.libraryClose).click();
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow !== 'hidden'));
  });

  it('abre detalles desde la fila y conserva editar, eliminar y vaciar independientes', async () => {
    await $(selectors.nav.encyclopedia).click();
    await $(selectors.encyclopedia.gameCard).click();
    await $(selectors.encyclopedia.pokedexTab).click();
    const row = $('[data-testid="pdx-row-25"]');
    await expect(row).toBeDisplayed();

    const viewport = await browser.getWindowSize();
    await browser.setWindowSize(420, 700);
    await row.$('.pdx-row-hitarea').click();
    await expect($(selectors.pokedex.detailDialog)).toBeDisplayed();
    await expect($(selectors.pokedex.detailDialog)).toHaveText(expect.stringContaining('Pikachu'));
    await expect($('.pdx-detail-sprite-placeholder')).toBeDisplayed();
    const detailWidth = await browser.execute(() => document.querySelector('[aria-labelledby="pdx-detail-title"]')?.getBoundingClientRect().width ?? 0);
    expect(detailWidth).toBeLessThanOrEqual(420);
    await browser.keys('Escape');
    await browser.waitUntil(() => browser.execute(() => !document.querySelector('[aria-labelledby="pdx-detail-title"]')?.hasAttribute('open')));
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow !== 'hidden'));

    await $('button[data-testid="pdx-name-25"]').click();
    await expect($(selectors.pokedex.detailDialog)).toBeDisplayed();
    await $(selectors.pokedex.detailClose).click();
    await browser.waitUntil(() => browser.execute(() => document.body.style.overflow !== 'hidden'));

    await $('button[aria-label="Ver detalles de Pikachu"]').click();
    await expect($(selectors.pokedex.detailDialog)).toBeDisplayed();
    await browser.execute(() => document.querySelector('[aria-labelledby="pdx-detail-title"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await browser.waitUntil(() => browser.execute(() => !document.querySelector('[aria-labelledby="pdx-detail-title"]')?.hasAttribute('open')));
    await browser.setWindowSize(viewport.width, viewport.height);

    await $('button[aria-label="Editar Pikachu"]').click();
    await expect($('[aria-labelledby="pdx-form-title"]')).toBeDisplayed();
    await expect($(selectors.pokedex.detailDialog)).not.toBeDisplayed();
    await $('[aria-labelledby="pdx-form-title"] button[aria-label="Cerrar"]').click();
    await $('button[aria-label="Eliminar Pikachu"]').click();
    await expect($('[aria-labelledby="pdx-delete-title"]')).toBeDisplayed();
    await expect($(selectors.pokedex.detailDialog)).not.toBeDisplayed();
    await $('//dialog[@aria-labelledby="pdx-delete-title"]//button[normalize-space(.)="Cancelar"]').click();

    await $(selectors.pokedex.clearButton).scrollIntoView({ block: 'center' });
    await $(selectors.pokedex.clearButton).click();
    await expect($(selectors.pokedex.clearDialog)).toHaveText(expect.stringContaining('Se eliminarán todas las 2 entradas de 1.0'));
    await $('//dialog[@aria-labelledby="pdx-clear-title"]//button[normalize-space(.)="Cancelar"]').click();
    const beforeClear = await browser.execute(() => (window as unknown as { __dexdeckDbState__: { pokemon: Array<{ game_version_id: number }> } }).__dexdeckDbState__.pokemon.map((row) => row.game_version_id));
    expect(beforeClear).toEqual([101, 101, 102]);

    await $(selectors.pokedex.clearButton).scrollIntoView({ block: 'center' });
    await $(selectors.pokedex.clearButton).click();
    await $(selectors.pokedex.clearConfirm).click();
    await browser.waitUntil(() => browser.execute(() =>
      (window as unknown as { __dexdeckDbState__: { pokemon: Array<{ game_version_id: number }> } }).__dexdeckDbState__.pokemon.length === 1
    ));
    const remaining = await browser.execute(() => {
      const state = (window as unknown as { __dexdeckDbState__: { pokemon: Array<{ id: number; game_version_id: number }>; encounters: Array<{ game_pokemon_id: number }> } }).__dexdeckDbState__;
      return { pokemon: state.pokemon, encounters: state.encounters };
    });
    expect(remaining.pokemon.map((row) => row.game_version_id)).toEqual([102]);
    expect(remaining.encounters.map((row) => row.game_pokemon_id)).toEqual([2001]);
  });
});
