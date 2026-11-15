<script lang="ts">
  import '../app.css';
  import Encyclopedia from '$lib/components/Encyclopedia.svelte';
  import UpdatesView from '$lib/components/UpdatesView.svelte';
  import LibraryView from '$lib/components/LibraryView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import GameFormDialog from '$lib/components/GameFormDialog.svelte';
  import GameSummaryDialog from '$lib/components/GameSummaryDialog.svelte';
  import GameActionsDialog from '$lib/components/GameActionsDialog.svelte';
  import type { InstallationInfo, SystemInfo, ThemeName } from '$lib/app-types';
  import {
      hideGame,
      importHiddenGames,
      insertGame,
      listGames,
      updateGame,
      type Game,
      type GameInput,
  } from '$lib/db';
  import { getVersion } from '@tauri-apps/api/app';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { attachConsole, info } from '@tauri-apps/plugin-log';
  import { onMount } from 'svelte';
  import { scrollLockDialog } from '$lib/scroll-lock';
  import { NavigationManager } from '$lib/navigation.svelte';

  type FormDialogApi = {
    openAdd: () => void;
    openEdit: (game: Game) => void;
    setError: (message: string) => void;
    close: () => void;
  };
  type GameDialogApi = {
    open: (game: Game) => void;
    close: () => void;
  };

  // ---- Gestión del historial de navegación ----
  const navManager = new NavigationManager();

  let activeSection = $derived(navManager.current.section);
  let search = $state('');
  let formDialog = $state<FormDialogApi | undefined>(undefined);
  let summaryDialog = $state<GameDialogApi | undefined>(undefined);
  let actionsDialog = $state<GameDialogApi | undefined>(undefined);

  // ID del juego de Enciclopedia a restaurar al navegar con historial
  let encyclopediaRestoreGameId = $derived(
    navManager.current.section === 'Enciclopedia' && navManager.current.subView === 'game'
      ? Number(navManager.current.params?.gameId)
      : null
  );

  let notice = $state('');
  let games = $state<Game[]>([]);

  let theme = $state<ThemeName>('dark');
  let launchingGameId = $state<number | null>(null);
  let systemInfo = $state<SystemInfo | null>(null);

  function navigateBack() {
    if (navManager.back()) {
      search = '';
      notice = '';
    }
  }

  function navigateForward() {
    if (navManager.forward()) {
      search = '';
      notice = '';
    }
  }

  function isTextEntry(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (
      target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) ||
      Boolean(target.closest('dialog'))
    );
  }

  let mouseListener: (() => void) | undefined;

  function setupMouseNavigation() {
    const handler = (event: MouseEvent) => {
      // Solo botones laterales del ratón: 3 = atrás, 4 = adelante
      if (event.button !== 3 && event.button !== 4) return;

      // No interferir con elementos interactivos
      if (isTextEntry(event.target)) return;

      if (event.button === 3) {
        event.preventDefault();
        navigateBack();
      } else if (event.button === 4) {
        event.preventDefault();
        navigateForward();
      }
    };

    const keyHandler = (event: KeyboardEvent) => {
      if (!event.altKey || isTextEntry(event.target)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateBack();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateForward();
      }
    };

    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    mouseListener = () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', keyHandler);
    };
  }

  let appVersion = $state('0.1.0');
  let installationInfo = $state<InstallationInfo | null>(null);
  let uninstallDialog: HTMLDialogElement | undefined = $state(undefined);
  let uninstallChoice = $state<'keep' | 'delete'>('keep');
  let uninstalling = $state(false);
  let wallpaperSnapshotInFlight = false;
  let wallpaperSnapshotWarningShown = false;
  let detachLogConsole: (() => void) | undefined;

  const navigation = [
    { label: 'Biblioteca', icon: '▦' },
    { label: 'Enciclopedia', icon: '◇' },
    { label: 'Añadir juego', icon: '+' },
    { label: 'Actualizaciones', icon: '↻' },
    { label: 'Ajustes', icon: '⚙' }
  ];

  onMount(() => {
    void attachConsole()
      .then((detach) => {
        detachLogConsole = detach;
        void info('Interfaz de DexDeck iniciada');
      })
      .catch((error) => {
        console.error('No se pudo conectar el sistema de logs:', error);
      });
    const savedTheme = window.localStorage.getItem('dexdeck-theme');
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'glass') {
      theme = savedTheme;
    }
    applyTheme(theme, false);
    void loadGames();
    void loadSystemInfo();
    void loadMaintenanceInfo();
    setupMouseNavigation();
    return () => {
      detachLogConsole?.();
      mouseListener?.();
    };
  });

  function applyTheme(nextTheme: ThemeName, persist = true) {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;

    if (persist) {
      try {
        window.localStorage.setItem('dexdeck-theme', nextTheme);
      } catch (error) {
        console.warn('No se pudo guardar la preferencia de tema:', error);
      }
    }

    if (nextTheme === 'glass') {
      void loadWallpaperSnapshot();
    } else {
      document.documentElement.style.removeProperty('--dd-wallpaper-image');
    }
  }


  // Wallpaper-backed Liquid Glass. The native command returns a single still
  // image made from the wallpaper source, never a screenshot of the desktop or
  // the windows behind DexDeck. Animated wallpapers are captured as one frame
  // and stay still, so the background does not repaint continuously.

  async function loadWallpaperSnapshot() {
    if (theme !== 'glass' || wallpaperSnapshotInFlight) return;
    wallpaperSnapshotInFlight = true;
    try {
      const imageData = await invoke<string | null>('get_wallpaper_snapshot');
      // The user may have changed the theme while the snapshot was loading.
      if (theme !== 'glass') return;
      if (imageData) {
        document.documentElement.style.setProperty(
          '--dd-wallpaper-image',
          `url("${imageData}")`
        );
      } else {
        document.documentElement.style.removeProperty('--dd-wallpaper-image');
      }
    } catch (error) {
      if (!wallpaperSnapshotWarningShown) {
        console.warn('No se pudo obtener el fondo de escritorio para Liquid Glass:', error);
        wallpaperSnapshotWarningShown = true;
      }
    } finally {
      wallpaperSnapshotInFlight = false;
    }
  }


  function selectTheme(nextTheme: ThemeName) {
    applyTheme(nextTheme);
    const themeLabel = nextTheme === 'light' ? 'Claro' : nextTheme === 'dark' ? 'Oscuro' : 'Liquid Glass';
    notice = `Tema ${themeLabel} aplicado.`;
  }
  // Los IDs excluidos se guardan de forma persistente en el WebView de Tauri.
  // No borra los archivos del juego ni las filas de la base de datos.
  const REMOVED_GAME_IDS_KEY = 'dexdeck-removed-game-ids';

  function getRemovedGameIds(): Set<string> {
    try {
      const raw = window.localStorage.getItem(REMOVED_GAME_IDS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set(parsed.filter((id): id is string | number =>
        typeof id === 'string' || typeof id === 'number'
      ).map(String));
    } catch (error) {
      console.warn('No se pudo leer la lista de juegos quitados:', error);
      return new Set<string>();
    }
  }


  async function exitApp() {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error('No se pudo cerrar DexDeck:', error);
      notice = 'No se pudo cerrar DexDeck. Inténtalo de nuevo.';
    }
  }

  async function loadSystemInfo() {
    try {
      systemInfo = await invoke<SystemInfo>('get_system_info');
    } catch (error) {
      console.warn('No se pudo detectar el sistema operativo:', error);
      systemInfo = { os: 'unknown', osName: 'Desconocido', architecture: 'Desconocida' };
    }
  }

  async function loadMaintenanceInfo() {
    try {
      appVersion = await getVersion();
    } catch (error) {
      console.warn('No se pudo leer la versión de DexDeck:', error);
    }

    try {
      installationInfo = await invoke<InstallationInfo>('get_installation_info');
    } catch (error) {
      console.warn('No se pudo detectar el tipo de instalación:', error);
      installationInfo = {
        kind: 'unsupported',
        canUpdate: false,
        canUninstall: false,
        message: 'No se ha podido identificar cómo está instalada DexDeck.'
      };
    }
  }

  function openUninstallDialog() {
    uninstallChoice = 'keep';
    uninstallDialog?.showModal();
  }

  async function confirmUninstall() {
    if (!installationInfo?.canUninstall || uninstalling) return;
    uninstalling = true;

    try {
      await invoke('start_uninstall', { deleteData: uninstallChoice === 'delete' });
    } catch (error) {
      console.error('No se pudo iniciar la desinstalación:', error);
      uninstalling = false;
      notice = typeof error === 'string'
        ? error
        : 'No se ha podido iniciar la desinstalación. No se han eliminado tus datos.';
      uninstallDialog?.close();
    }
  }

  async function loadGames() {
    try {
      // Migrar a SQLite los IDs ocultos que quedaron en el almacenamiento antiguo.
      const removedIds = getRemovedGameIds();

      if (removedIds.size > 0) {
        await importHiddenGames([...removedIds]);
      }

      // No borrar el valor antiguo hasta que la importación a SQLite haya terminado.
      window.localStorage.removeItem(REMOVED_GAME_IDS_KEY);

      // SQLite es la única fuente de verdad para la biblioteca.
      games = await listGames();
    } catch (error) {
      console.error('Error al cargar la biblioteca:', error);
      notice = 'No se pudo cargar la biblioteca. Comprueba la base de datos.';
    }
  }


  function navigate(section: string) {
    if (section === 'Añadir juego') {
      openAddModal();
      return;
    }

    search = '';
    notice = '';
    if (['Biblioteca', 'Enciclopedia', 'Actualizaciones', 'Ajustes'].includes(section)) {
      navManager.push({
        section: section as 'Biblioteca' | 'Enciclopedia' | 'Actualizaciones' | 'Ajustes',
        announcement: `Sección ${section}`
      });
    }
  }

  function openAddModal() {
    formDialog?.openAdd();
  }

  function openDetails(game: Game) {
    summaryDialog?.open(game);
  }

  function editGame(game: Game) {
    summaryDialog?.close();
    actionsDialog?.close();
    formDialog?.openEdit(game);
  }

  function playOrConfigure(game: Game) {
    if (!game.executable_path?.trim()) {
      editGame(game);
      formDialog?.setError('Este juego todavía no tiene ejecutable. Selecciona el archivo para activar el botón Jugar.');
      return;
    }

    void launchGame(game);
  }

  async function saveGame(input: GameInput, editingGameId: number | null): Promise<boolean> {
    try {
      if (editingGameId !== null) {
        await updateGame(editingGameId, input);
        notice = 'Ficha actualizada correctamente.';
      } else {
        await insertGame(input);
        notice = 'Juego añadido a la biblioteca.';
      }

      await loadGames();

      navManager.push({ section: 'Biblioteca', announcement: 'Sección Biblioteca' });
      search = '';
      return true;
    } catch (error) {
      console.error('Error al guardar la ficha:', error);
      return false;
    }
  }

  async function launchGame(game: Game) {
    const executablePath = game.executable_path?.trim();

    if (!executablePath) {
      summaryDialog?.close();
      actionsDialog?.close();
      notice = 'Selecciona primero el ejecutable en Editar ficha.';
      return;
    }

    if (launchingGameId !== null) return;

    launchingGameId = game.id;
    notice = '';

    try {
      await invoke('launch_game', {
        executablePath,
        installPath: game.install_path?.trim() ?? ''
      });
      summaryDialog?.close();
      notice = `Se ha solicitado el inicio de ${game.name}.`;
    } catch (error) {
      summaryDialog?.close();
      console.error('Error al iniciar el juego:', error);
      notice = typeof error === 'string'
        ? error
        : systemInfo?.os === 'linux'
          ? `No se pudo iniciar ${game.name}. Comprueba el ejecutable y que Wine esté instalado.`
          : `No se pudo iniciar ${game.name}. Comprueba la ruta y la compatibilidad del archivo.`;
    } finally {
      launchingGameId = null;
    }
  }



  function openGameDetails(game: Game) {
    actionsDialog?.open(game);
  }

  function closeGameDetails() {
    actionsDialog?.close();
  }

  async function removeSelectedGame(game: Game): Promise<boolean> {
    try {
      // Guardar el cambio directamente en SQLite.
      await hideGame(game.id);

      games = games.filter((entry) => entry.id !== game.id);
      notice = `${game.name} se ha quitado de la biblioteca.`;
      return true;
    } catch (error) {
      console.error('No se pudo quitar el juego de la biblioteca:', error);
      notice = 'No se pudo guardar el cambio. Inténtalo de nuevo.';
      return false;
    }
  }

  function prepareSelectedGame(game: Game) {
    closeGameDetails();
    notice = `El lanzamiento de ${game.name} estará disponible cuando configuremos sus archivos.`;
  }

  // Exponer funciones de navegación para pruebas de interfaz (WDIO)
  if (import.meta.env.VITE_WDIO === '1') {
    (window as unknown as { __dexdeck_navigateBack?: () => void; __dexdeck_navigateForward?: () => void }).__dexdeck_navigateBack = navigateBack;
    (window as unknown as { __dexdeck_navigateBack?: () => void; __dexdeck_navigateForward?: () => void }).__dexdeck_navigateForward = navigateForward;
  }

</script>

<svelte:head>
  <title>DexDeck — Tu universo Pokémon</title>
  <meta
    name="description"
    content="Tu biblioteca personal de fangames Pokémon, reunida en un solo lugar."
  />
  <meta name="theme-color" content="#0c1222" />
</svelte:head>

<div class="app-shell" data-theme={theme} data-testid="app-shell">
  <div aria-live="polite" aria-atomic="true" class="sr-only">{navManager.announcement}</div>
  <aside class="sidebar">
    <a class="brand" href="#inicio" onclick={() => navigate('Biblioteca')}>
      <div class="brand-mark"><span class="brand-core"></span></div>
      <div class="brand-copy">
        <span class="brand-name">DexDeck</span>
        <span class="brand-caption">YOUR GAME UNIVERSE</span>
      </div>
    </a>

    <div class="sidebar-label">ESPACIO PERSONAL</div>

    <nav class="navigation" aria-label="Navegación principal">
      {#each navigation as item}
        <button
          type="button"
          class:active={activeSection === item.label}
          class="nav-item"
          aria-current={activeSection === item.label ? 'page' : undefined}
          data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-').replaceAll('ñ', 'n')}`}
          onclick={() => navigate(item.label)}
        >
          <span class="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
          {#if item.label === 'Biblioteca'}
            <span class="nav-count">{games.length}</span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="sidebar-bottom">
      <div class="runner-card">
        <div class="runner-heading">
          <span class="runner-dot"></span>
          <span>ENTORNO DE JUEGO</span>
        </div>
        <div class="runner-name">
          {#if systemInfo?.os === 'windows'}Windows nativo{:else if systemInfo?.os === 'linux'}Wine{:else if systemInfo?.os === 'macos'}macOS{:else}Detectando...{/if}
        </div>
        <div class="runner-description">
          {#if systemInfo?.os === 'windows'}Los ejecutables .exe se inician directamente.{:else if systemInfo?.os === 'linux'}Wine permite ejecutar juegos de Windows; debe estar instalado.{:else if systemInfo?.os === 'macos'}La compatibilidad con juegos de Windows está pendiente.{:else}La compatibilidad se comprobará en tu sistema.{/if}
        </div>
        <div class="runner-status">
          <span class="status-indicator"></span>
          <span>{#if systemInfo?.os === 'windows'}Lanzamiento nativo{:else if systemInfo?.os === 'linux'}Wine necesario para .exe{:else}Compatibilidad pendiente{/if}</span>
        </div>
      </div>

      <div class="profile">
        <div class="profile-avatar">D</div>
        <div class="profile-copy">
          <span class="profile-name">Entrenador</span>
          <span class="profile-caption">Biblioteca local</span>
        </div>
        <span class="profile-menu">···</span>
      </div>
    </div>
    <button
      type="button"
      class="nav-item exit-button"
      title="Cerrar DexDeck"
      aria-label="Salir de DexDeck"
      onclick={exitApp}
    >
      <span class="nav-icon" aria-hidden="true">⇥</span>
      <span>Salir</span>
    </button>
  </aside>

  <main class="main-content">
    <header class="topbar">
      <div class="breadcrumb">
        <span>DEXDECK</span>
        <span class="breadcrumb-slash">/</span>
        <span class="breadcrumb-current">{activeSection.toUpperCase()}</span>
      </div>

      <div class="topbar-right">
        <span class="local-badge">
          <span class="status-indicator"></span>
          LOCAL
        </span>
        <div class="topbar-divider"></div>
        <button
          class="icon-button"
          aria-label="Abrir ajustes"
          title="Ajustes"
          onclick={() => navigate('Ajustes')}
        >⚙</button>
      </div>
    </header>

    <div class="page-content">
      {#if activeSection === 'Biblioteca'}
        <LibraryView
          {games}
          {systemInfo}
          {launchingGameId}
          bind:search
          onAdd={openAddModal}
          onDetails={openDetails}
          onOpenGameDetails={openGameDetails}
          onPlayOrConfigure={playOrConfigure}
          onEdit={editGame}
        />
      {:else if activeSection === 'Enciclopedia'}
        <Encyclopedia
          onGameOpen={(gameId, gameName) => navManager.push({
            section: 'Enciclopedia',
            subView: 'game',
            params: { gameId, gameName },
            announcement: `Enciclopedia: ${gameName}`
          })}
          onGameClose={() => {
            if (navManager.current.section === 'Enciclopedia' && navManager.current.subView === 'game') {
              navigateBack();
            }
          }}
          restoreGameId={encyclopediaRestoreGameId}
        />
      {:else if activeSection === 'Actualizaciones'}
        <UpdatesView
          {appVersion}
          {installationInfo}
          onBack={() => navigate('Biblioteca')}
        />
      {:else if activeSection === 'Ajustes'}
        <SettingsView
          {theme}
          {systemInfo}
          {installationInfo}
          {uninstalling}
          onSelectTheme={selectTheme}
          onUninstall={openUninstallDialog}
          onLibraryChanged={() => void loadGames()}
        />
      {/if}

      {#if notice}
        <div class="notice" role="status" data-testid="notice">
          <span>✧</span> {notice}
          <button aria-label="Cerrar aviso" onclick={() => notice = ''}>×</button>
        </div>
      {/if}

      <footer class="footer">
        <span><span class="footer-dot"></span> DEXDECK <span class="footer-version">v0.1.0 · EARLY ACCESS</span></span>
        <span>HECHO PARA ENTRENADORES, CON CARIÑO.</span>
      </footer>
    </div>
  </main>
</div>

<GameFormDialog
  bind:this={formDialog}
  {systemInfo}
  colorSeed={games.length}
  onSubmit={saveGame}
/>

<GameSummaryDialog
  bind:this={summaryDialog}
  {launchingGameId}
  onEdit={editGame}
  onLaunch={launchGame}
/>

<GameActionsDialog
  bind:this={actionsDialog}
  onPrepare={prepareSelectedGame}
  onRemove={removeSelectedGame}
/>

<dialog
  bind:this={uninstallDialog}
  use:scrollLockDialog
  class="modal uninstall-modal"
  aria-labelledby="uninstall-title"
  onclick={(event) => {
    if (event.target === uninstallDialog && !uninstalling) uninstallDialog?.close();
  }}
>
  <div class="modal-top">
    <div class="modal-icon remove-icon">!</div>
    <button class="modal-close" aria-label="Cerrar" disabled={uninstalling} onclick={() => uninstallDialog?.close()}>×</button>
  </div>
  <div class="section-kicker">GESTIÓN DE LA APLICACIÓN</div>
  <h2 id="uninstall-title">Desinstalar DexDeck.</h2>
  <p class="modal-description">Elige qué hacer con los datos locales antes de quitar el programa. Los archivos de tus fangames en otras carpetas nunca se borrarán.</p>

  <label class="uninstall-option">
    <input type="radio" name="uninstall-choice" value="keep" bind:group={uninstallChoice} disabled={uninstalling} />
    <span>
      <strong>Conservar mis datos</strong>
      <small>Quita DexDeck, pero conserva la biblioteca, la base de datos, las preferencias y la configuración local.</small>
    </span>
  </label>
  <label class="uninstall-option uninstall-option-danger">
    <input type="radio" name="uninstall-choice" value="delete" bind:group={uninstallChoice} disabled={uninstalling} />
    <span>
      <strong>Eliminar todos mis datos</strong>
      <small>Quita DexDeck y elimina también su base de datos, preferencias, almacenamiento local y caché. Es irreversible.</small>
    </span>
  </label>

  {#if uninstallChoice === 'delete'}
    <p class="uninstall-warning" role="alert">Se borrarán los datos propios de DexDeck de este usuario. Esta acción no se puede deshacer.</p>
  {/if}

  <div class="modal-actions">
    <button type="button" class="secondary-button" disabled={uninstalling} onclick={() => uninstallDialog?.close()}>Cancelar</button>
    <button type="button" class="danger-button" disabled={uninstalling} onclick={() => void confirmUninstall()}>
      {uninstalling ? 'Preparando…' : uninstallChoice === 'delete' ? 'Eliminar datos y desinstalar' : 'Conservar datos y desinstalar'}
    </button>
  </div>
</dialog>
