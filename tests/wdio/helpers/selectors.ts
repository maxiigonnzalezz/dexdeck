/**
 * Selectores centralizados de DexDeck.
 *
 * Se apoyan en `data-testid` estables y, cuando el texto forma parte del
 * contrato visible de la interfaz, en roles/etiquetas accesibles. Cambiar una
 * pantalla no debería obligar a tocar cada prueba.
 */
export const selectors = {
  appShell: '[data-testid="app-shell"]',

  nav: {
    library: '[data-testid="nav-biblioteca"]',
    encyclopedia: '[data-testid="nav-enciclopedia"]',
    addGame: '[data-testid="nav-anadir-juego"]',
    updates: '[data-testid="nav-actualizaciones"]',
    settings: '[data-testid="nav-ajustes"]',
    exit: 'button[aria-label="Salir de DexDeck"]',
    liveRegion: '[aria-live="polite"]'
  },

  library: {
    addButton: '[data-testid="add-game-button"]',
    search: '[data-testid="search-games"]',
    cards: '[data-testid="game-card"]',
    empty: '[data-testid="empty-library"]',
    clearSearch: '[data-testid="empty-library"] button',
    openCardDetailsByName: (name: string) => `button[aria-label="Ver ficha de ${name}"]`,
    cardByName: (name: string) =>
      `[data-testid="game-card"][data-game-name="${name.replaceAll('"', '\\"')}"]`,
    openDetailsByName: (name: string) => `button[aria-label="Abrir ficha de ${name}"]`,
    playByName: (name: string) =>
      `button[aria-label="Jugar a ${name}"], button[aria-label="Configurar ${name}"]`
  },

  addGame: {
    form: '[data-testid="add-game-form"]',
    name: '[data-testid="game-name-input"]',
    developer: '[data-testid="game-developer-input"]',
    description: '[data-testid="game-description-input"]',
    submit: '[data-testid="save-game-button"]',
    error: '[data-testid="form-error"]',
    cancel: '//dialog[@open]//button[contains(normalize-space(.), "Cancelar")]',
    close: 'dialog[open] button[aria-label="Cerrar"]'
  },

  detail: {
    dialog: '[data-testid="game-details-dialog"]',
    close: '[data-testid="game-details-dialog"] button[aria-label="Cerrar ficha"]',
    libraryDialog: '[data-testid="game-detail-dialog"]',
    libraryClose: '[data-testid="game-detail-dialog"] button[aria-label="Cerrar ficha"]'
  },

  pokedex: {
    detailButton: (name: string) => `button[aria-label="Ver detalles de ${name}"]`,
    clearButton: '.pdx-header-actions > .pdx-danger',
    clearDialog: '[aria-labelledby="pdx-clear-title"]',
    clearConfirm: '[aria-labelledby="pdx-clear-title"] .pdx-danger-button',
    detailDialog: '[aria-labelledby="pdx-detail-title"]',
    detailClose: '[aria-label="Cerrar ficha"]'
  },

  encyclopedia: {
    gameCard: '.enc-game-card',
    gameBack: '.enc-back-button',
    pokedexTab: '.enc-tabs button:nth-child(2)',
    versionSelect: '#enc-version-select'
  },

  notice: '[data-testid="notice"]',
  hidden: {
    panel: '[data-testid="hidden-games-panel"]',
    items: '[data-testid="hidden-game"]',
    empty: '[data-testid="hidden-empty"]',
    status: '[data-testid="hidden-status"]',
    error: '[data-testid="hidden-error"]',
    restore: (name: string) =>
      `[data-testid="hidden-game"][data-game-name="${name.replaceAll('"', '\\"')}"] [data-testid="hidden-restore"]`,
    delete: (name: string) =>
      `[data-testid="hidden-game"][data-game-name="${name.replaceAll('"', '\\"')}"] [data-testid="hidden-delete"]`,
    deleteDialog: '[data-testid="hidden-delete-dialog"]',
    deleteConfirm: '[data-testid="hidden-delete-confirm"]'
  },
  settings: {
    heading: 'h1',
    themeGroup: '[role="group"][aria-label="Tema de la aplicación"]',
    theme: (label: string) =>
      `//*[@aria-label="Tema de la aplicación"]//button[contains(normalize-space(.), "${label}")]`
  }
} as const;
