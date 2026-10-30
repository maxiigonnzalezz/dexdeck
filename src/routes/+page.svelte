<script lang="ts">
  import {
      insertGame,
      listGames,
      updateGame,
      type Game,
      type GameInput,
      hideGame,
      importHiddenGames,
  } from '$lib/db';
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import Encyclopedia from '$lib/components/Encyclopedia.svelte';

  let activeSection = $state('Biblioteca');
  let search = $state('');
  let addDialog: HTMLDialogElement | undefined = $state(undefined);
  let detailDialog: HTMLDialogElement | undefined = $state(undefined);
  let selectedGame = $state<Game | null>(null);
  let gameDialog = $state<HTMLDialogElement | undefined>(undefined);
  let showRemoveConfirm = $state(false);
  let editingGameId = $state<number | null>(null);

  let newName = $state('');
  let nameManuallyEdited = $state(false);
  let newDeveloper = $state('');
  let newVersion = $state('Sin especificar');
  let versionManuallyEdited = $state(false);
  let newDescription = $state('');
  let newCover = $state('');
  let newOfficialUrl = $state('');
  let newInstallPath = $state('');
  let installPathManuallyEdited = $state(false);
  let newExecutablePath = $state('');
  let executableInfo = $state('');

  type ExecutableMetadata = {
    name: string;
    version: string | null;
    companyName: string | null;
    description: string | null;
  };

  // DEXDECK MULTIPLATFORM UI v1
  type SystemInfo = {
    os: string;
    osName: string;
    architecture: string;
  };
  let newType = $state('Fangame');
  let newStatus = $state('En biblioteca');
  let newColor = $state('blue');
  let newSymbol = $state('✦');

  let notice = $state('');
  let formError = $state('');
  let saving = $state(false);
  let games = $state<Game[]>([]);

  type ThemeName = 'light' | 'dark' | 'glass';
  let theme = $state<ThemeName>('dark');
  let launchingGameId = $state<number | null>(null);
  let systemInfo = $state<SystemInfo | null>(null);

  const navigation = [
    { label: 'Biblioteca', icon: '▦' },
    { label: 'Enciclopedia', icon: '◇' },
    { label: 'Añadir juego', icon: '+' },
    { label: 'Actualizaciones', icon: '↻' },
    { label: 'Ajustes', icon: '⚙' }
  ];

  onMount(() => {
    const savedTheme = window.localStorage.getItem('dexdeck-theme');
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'glass') {
      theme = savedTheme;
    }
    applyTheme(theme, false);
    void loadGames();
    void loadSystemInfo();
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

  let filteredGames = $derived(
    games.filter((game) =>
      `${game.name} ${game.developer} ${game.type} ${game.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  );

  function navigate(section: string) {
    if (section === 'Añadir juego') {
      openAddModal();
      return;
    }

    activeSection = section;
    search = '';
    notice = '';
  }

  function resetForm() {
    editingGameId = null;
    newName = '';
    nameManuallyEdited = false;
    newDeveloper = '';
    newVersion = 'Sin especificar';
    versionManuallyEdited = false;
    newDescription = '';
    newCover = '';
    newOfficialUrl = '';
    newInstallPath = '';
    installPathManuallyEdited = false;
    newExecutablePath = '';
    executableInfo = '';
    newType = 'Fangame';
    newStatus = 'En biblioteca';
    newColor = ['blue', 'purple', 'red'][games.length % 3];
    newSymbol = '✦';
    formError = '';
  }

  function openAddModal() {
    resetForm();

    if (addDialog && !addDialog.open) {
      addDialog.showModal();
    }
  }

  function openDetails(game: Game) {
    selectedGame = game;

    if (detailDialog && !detailDialog.open) {
      detailDialog.showModal();
    }
  }

  function editGame(game: Game) {
    detailDialog?.close();
    resetForm();

    editingGameId = game.id;
    newName = game.name;
    newDeveloper = game.developer;
    newVersion = game.version;
    newDescription = game.description ?? '';
    newCover = game.cover ?? '';
    newOfficialUrl = game.official_url ?? '';
    newInstallPath = game.install_path ?? '';
    newExecutablePath = game.executable_path ?? '';
    newType = game.type;
    newStatus = game.status;
    newColor = game.color;
    newSymbol = game.symbol;

    if (addDialog && !addDialog.open) {
      addDialog.showModal();
    }
  }

  async function chooseInstallPath() {
    try {
      const selection = await open({
        directory: true,
        multiple: false,
        title: 'Selecciona la carpeta de instalación'
      });

      if (typeof selection === 'string') {
        newInstallPath = selection;
        installPathManuallyEdited = true;
        formError = '';
      }
    } catch (error) {
      console.error('Error al seleccionar la carpeta de instalación:', error);
      formError = 'No se pudo abrir el selector de carpetas. Revisa los permisos de Tauri.';
    }
  }

  // DEXDECK AUTOFILL AND CONFIGURATION V6
  function cleanGameNameCandidate(raw: string): string {
    return raw
      .replace(/\.(?:exe|bat|cmd|lnk|app|sh)$/i, '')
      .replace(/(?:[-_. ]+(?:win32|win64|windowsnoeditor|linuxshipping|linux|windows|macos|mac|x64|x86|64bit|32bit|shipping|development|debug|release|noeditor|launcher|bootstrapper))+$/ig, '')
      .replace(/(?:[-_. ]+v?\d+(?:\.\d+){1,4})$/i, '')
      .replace(/\s*\((?:win32|win64|shipping|launcher|game)\)$/i, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[._]+/g, ' ')
      .replace(/-+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isGenericExecutableName(value: string): boolean {
    const normalized = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const genericNames = new Set([
      'game', 'gameexe', 'launcher', 'start', 'startgame', 'play', 'run', 'launch',
      'rpgrt', 'nw', 'nwjs', 'unreal', 'ue4game', 'ue5game', 'shipping', 'client',
      'application', 'app', 'setup', 'install', 'installer', 'bootstrap', 'bootstrapper',
      'windowsnoeditor', 'win64', 'win32', 'gamewin64shipping', 'gamewin64', 'gamewin32',
      'gamelauncher', 'pokemonessentials', 'rpgmaker', 'rpgmakerxp',
      'rpgmakerxpace', 'rpgmakervx', 'rpgmakervxace', 'rpgmakermz',
      'rpgmakerxpgame', 'gameproject', 'unrealproject', 'gameengine', 'windowsapplication'
    ]);
    return genericNames.has(normalized);
  }

  // DEXDECK FOLDER-BASED NAME AND VERSION V8
  // La carpeta del juego tiene prioridad absoluta sobre el nombre/metadatos del EXE.
  function parseGameFolderLabel(raw: string): { name: string; version: string } {
    const label = raw.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!label) return { name: '', version: '' };

    // Subcarpeta de versión independiente: "v2.0", "Version 1.3" o "2.04".
    const versionOnly = label.match(/^(?:(?:version|ver|v)[\s._-]*)?(\d+(?:\.\d+){0,3}(?:[-_. ]?(?:alpha|beta|rc)[-_ .]*\d*)?)$/i);
    if (versionOnly) return { name: '', version: versionOnly[1].replace(/\s+/g, '') };

    // Versiones marcadas: "Pokemon Añil v2.0", "Pokemon Opalo (v1.3.0)".
    const marked = label.match(/^(.*?)(?:\s*[-–—]\s*|\s+)[(\[]?\s*(?:version|ver|v)\s*\.?\s*(\d+(?:\.\d+){0,3}(?:[-_. ]?(?:alpha|beta|rc)[-_ .]*\d*)?)\s*[)\]]?\s*$/i);
    if (marked) {
      const name = marked[1].replace(/[\s._–—-]+$/, '').trim();
      if (name) return { name, version: marked[2].replace(/\s+/g, '') };
    }

    // Versiones sin prefijo, pero con separador: "Pokemon Iberia - 2.04".
    const numeric = label.match(/^(.*?)(?:\s*[-–—]\s*|\s+)[(\[]?\s*(\d+\.\d+(?:\.\d+){0,2})\s*[)\]]?\s*$/i);
    if (numeric) {
      const name = numeric[1].replace(/[\s._–—-]+$/, '').trim();
      if (name) return { name, version: numeric[2] };
    }

    return { name: label, version: '' };
  }

  function inferGameFolderInfoFromExecutable(path: string): { name: string; version: string } {
    const segments = path.trim().replace(/\\/g, '/').split('/').filter(Boolean);
    if (segments.length) segments.pop(); // descartar nombre del .exe

    const ignoredFolders = new Set([
      'game', 'games', 'juegos', 'fangames', 'roms', 'downloads', 'download',
      'desktop', 'escritorio', 'documents', 'documentos', 'projects', 'proyectos',
      'home', 'users', 'user', 'mnt', 'media', 'data', 'app', 'apps', 'program files',
      'program files (x86)', 'windows', 'appdata', 'applications', 'steamapps', 'common',
      'binaries', 'binary', 'bin', 'win64', 'win32', 'x64', 'x86', 'windowsnoeditor',
      'linux', 'linuxshipping', 'macos', 'mac', 'contents', 'resources', 'www', 'wwwroot',
      'rpg_rt', 'release', 'debug', 'dist', 'build', 'builds', 'shipping', 'development',
      'engine', 'ue4', 'ue5', 'client', 'runtime', 'launcher', 'launchers', 'bootstrap',
      'bootstrapper', 'portable', 'redist', 'repository', 'repos', 'repositorios', 'opt'
    ]);
    const boundaries = new Set([
      'home', 'users', 'user', 'juegos', 'games', 'fangames', 'downloads', 'download',
      'desktop', 'escritorio', 'documents', 'documentos', 'projects', 'proyectos',
      'steamapps', 'common', 'program files', 'program files (x86)', 'mnt', 'media',
      'repos', 'repositorios', 'repository', 'onedrive', 'opt'
    ]);
    let nestedVersion = '';

    for (let i = segments.length - 1; i >= 0; i--) {
      const rawFolder = segments[i].trim();
      const normalized = rawFolder.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase();
      if (boundaries.has(normalized)) break;
      if (ignoredFolders.has(normalized)) continue;

      const parsed = parseGameFolderLabel(rawFolder);
      if (!parsed.name && parsed.version) {
        if (!nestedVersion) nestedVersion = parsed.version;
        continue;
      }
      if (!parsed.name) continue;

      const cleaned = cleanGameNameCandidate(parsed.name).slice(0, 80);
      if (!cleaned || isGenericExecutableName(cleaned)) continue;
      return { name: cleaned, version: parsed.version || nestedVersion };
    }

    return { name: '', version: nestedVersion };
  }

  function getExecutableFallbackName(path: string): string {
    const folderInfo = inferGameFolderInfoFromExecutable(path);
    if (folderInfo.name) return folderInfo.name;

    // Solo recurrir al nombre del ejecutable si la ruta no contiene carpeta de juego reconocible.
    const normalized = path.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    const filename = segments[segments.length - 1] ?? path;
    const candidate = cleanGameNameCandidate(filename);
    return candidate && !isGenericExecutableName(candidate) ? candidate.slice(0, 80) : 'Juego nuevo';
  }

  function getInstallRootFromExecutable(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.length > 1) segments.pop();

    const executableFolders = new Set([
      'bin', 'binaries', 'win32', 'win64', 'x86', 'x64', 'www',
      'windowsnoeditor', 'linux', 'macos', 'mac', 'contents', 'resources',
      'game', 'release', 'debug', 'shipping'
    ]);
    while (segments.length > 1 && executableFolders.has(segments[segments.length - 1].toLowerCase())) {
      segments.pop();
    }

    const root = segments.join('/');
    return root || (normalized.startsWith('/') ? '/' : '.');
  }

  function autofillExecutableFields(path: string) {
    const executablePath = path.trim();
    if (!executablePath) return;
    const folderInfo = inferGameFolderInfoFromExecutable(executablePath);

    if (!installPathManuallyEdited || !newInstallPath.trim()) {
      newInstallPath = getInstallRootFromExecutable(executablePath);
      installPathManuallyEdited = false;
    }
    if (!nameManuallyEdited || !newName.trim()) {
      newName = folderInfo.name || getExecutableFallbackName(executablePath);
      nameManuallyEdited = false;
    }
    if (folderInfo.version && (!versionManuallyEdited || !newVersion.trim())) {
      newVersion = folderInfo.version;
      versionManuallyEdited = false;
    }

    executableInfo = folderInfo.name
      ? `Nombre detectado desde la carpeta: ${folderInfo.name}${folderInfo.version ? ` · versión ${folderInfo.version}` : ''}.`
      : 'No se ha encontrado una carpeta de juego reconocible; se usa el nombre del ejecutable como alternativa.';
  }

  async function chooseExecutablePath() {
    try {
      const selection = await open({
        multiple: false,
        title: 'Selecciona el ejecutable del juego'
      });

      if (typeof selection !== 'string') return;
      const folderInfo = inferGameFolderInfoFromExecutable(selection);
      const shouldAutoFillName = !nameManuallyEdited || !newName.trim();
      const shouldAutoFillVersion = !versionManuallyEdited || !newVersion.trim();
      newExecutablePath = selection;

      if (shouldAutoFillName) {
        newName = folderInfo.name || getExecutableFallbackName(selection);
        nameManuallyEdited = false;
      }
      if (shouldAutoFillVersion && folderInfo.version) {
        newVersion = folderInfo.version;
        versionManuallyEdited = false;
      }
      if (!newVersion.trim()) newVersion = 'Sin especificar';
      if (!installPathManuallyEdited || !newInstallPath.trim()) {
        newInstallPath = getInstallRootFromExecutable(selection);
        installPathManuallyEdited = false;
      }
      executableInfo = folderInfo.name
        ? `Detectado desde la carpeta: ${folderInfo.name}${folderInfo.version ? ` · versión ${folderInfo.version}` : ''}. La carpeta tiene prioridad sobre los metadatos del ejecutable.`
        : 'Buscando metadatos del ejecutable; si no contiene un nombre útil, se usará el nombre del archivo.';
      formError = '';

      try {
        const metadata = await invoke<ExecutableMetadata>('inspect_game_executable', {
          executablePath: selection
        });
        // Ignorar metadatos tardíos de un EXE que ya no está seleccionado.
        if (newExecutablePath.trim() !== selection) return;

        const metadataName = metadata.name?.trim() ? cleanGameNameCandidate(metadata.name) : '';
        if (shouldAutoFillName && !folderInfo.name && !nameManuallyEdited && metadataName && !isGenericExecutableName(metadataName)) {
          newName = metadataName.slice(0, 80);
          nameManuallyEdited = false;
        }
        // Nunca dejar que la versión PE sobrescriba la que figura en la carpeta del juego.
        if (shouldAutoFillVersion && !folderInfo.version && !versionManuallyEdited && metadata.version?.trim()) {
          newVersion = metadata.version.trim().slice(0, 30);
        }
        if (metadata.companyName?.trim() && !newDeveloper.trim()) {
          newDeveloper = metadata.companyName.trim().slice(0, 100);
        }
        if (metadata.description?.trim() && !newDescription.trim()) {
          newDescription = metadata.description.trim().slice(0, 3000);
        }

        if (folderInfo.name) {
          executableInfo = `Nombre${folderInfo.version ? ' y versión' : ''} obtenidos de la carpeta: ${folderInfo.name}${folderInfo.version ? ` · ${folderInfo.version}` : ''}. Los metadatos internos no los sobrescriben.`;
        } else if (metadata.version?.trim()) {
          executableInfo = `Metadatos del ejecutable detectados: ${newName} · versión ${newVersion}.`;
        } else {
          executableInfo = 'No se pudo detectar una versión en la carpeta ni en los metadatos. Puedes introducirla manualmente.';
        }
      } catch (metadataError) {
        if (newExecutablePath.trim() !== selection) return;
        console.warn('No se pudieron leer los metadatos del ejecutable:', metadataError);
        executableInfo = folderInfo.name
          ? `Nombre${folderInfo.version ? ' y versión' : ''} detectados desde la carpeta: ${folderInfo.name}${folderInfo.version ? ` · ${folderInfo.version}` : ''}. No se pudieron leer otros metadatos.`
          : 'Se ha usado la ruta del ejecutable como alternativa; no se pudieron leer los metadatos internos.';
      }
    } catch (error) {
      console.error('Error al seleccionar el ejecutable:', error);
      formError = 'No se pudo abrir el selector de archivos. Revisa los permisos de Tauri.';
    }
  }

  function playOrConfigure(game: Game) {
    if (!game.executable_path?.trim()) {
      editGame(game);
      formError = 'Este juego todavía no tiene ejecutable. Selecciona el archivo para activar el botón Jugar.';
      return;
    }

    void launchGame(game);
  }

  async function saveGame() {
    const name = newName.trim();

    if (!name) {
      formError = 'Escribe el nombre del juego para continuar.';
      return;
    }

    if (saving) return;

    const game: GameInput = {
      name,
      developer: newDeveloper.trim() || 'Desarrollador desconocido',
      version: newVersion.trim() || 'Sin especificar',
      type: newType.trim() || 'Fangame',
      color: newColor,
      symbol: newSymbol.trim() || '✦',
      status: newStatus,
      description: newDescription.trim(),
      cover: newCover.trim(),
      official_url: newOfficialUrl.trim(),
      install_path: newInstallPath.trim(),
      executable_path: newExecutablePath.trim()
    };

    saving = true;
    formError = '';

    try {
      if (editingGameId !== null) {
        await updateGame(editingGameId, game);
        notice = 'Ficha actualizada correctamente.';
      } else {
        await insertGame(game);
        notice = 'Juego añadido a la biblioteca.';
      }

      await loadGames();

      addDialog?.close();
      activeSection = 'Biblioteca';
      search = '';
      resetForm();
    } catch (error) {
      console.error('Error al guardar la ficha:', error);
      formError = 'No se pudo guardar la ficha. Revisa la consola para ver el error.';
    } finally {
      saving = false;
    }
  }

  async function launchGame(game: Game) {
    const executablePath = game.executable_path?.trim();

    if (!executablePath) {
      detailDialog?.close();
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
      detailDialog?.close();
      notice = `Se ha solicitado el inicio de ${game.name}.`;
    } catch (error) {
      detailDialog?.close();
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

  function isWebUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }


  // Un diálogo nativo abierto con showModal bloquea el fondo y mantiene el foco dentro de la ficha.
  $effect(() => {
    const dialog = gameDialog;
    if (!dialog) return;

    if (selectedGame && !dialog.open) {
      dialog.showModal();
    } else if (!selectedGame && dialog.open) {
      dialog.close();
    }
  });

  // Bloquea el scroll de la página y restaura tanto los estilos como la posición al cerrar.
  $effect(() => {
    if (!selectedGame) return;

    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    const scrollY = window.scrollY;

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  });

  function openGameDetails(game: Game) {
    showRemoveConfirm = false;
    selectedGame = game;
  }

  function closeGameDetails() {
    if (gameDialog?.open) gameDialog.close();
    selectedGame = null;
    showRemoveConfirm = false;
  }
async function removeSelectedGame() {
  const gameToRemove = selectedGame;
  if (!gameToRemove) return;

  try {
    // Guardar el cambio directamente en SQLite.
    await hideGame(gameToRemove.id);

    games = games.filter((game) => game.id !== gameToRemove.id);
    selectedGame = null;
    showRemoveConfirm = false;
    gameDialog?.close();

    notice = `${gameToRemove.name} se ha quitado de la biblioteca.`;
  } catch (error) {
    console.error('No se pudo quitar el juego de la biblioteca:', error);
    notice = 'No se pudo guardar el cambio. Inténtalo de nuevo.';
  }
}
  function prepareSelectedGame() {
    if (!selectedGame) return;

    const gameName = selectedGame.name;
    closeGameDetails();
    notice = `El lanzamiento de ${gameName} estará disponible cuando configuremos sus archivos.`;
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

<div class="app-shell" data-theme={theme}>
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
        <section class="welcome-row">
          <div>
            <div class="eyebrow">
              <span class="eyebrow-line"></span>
              TU PRÓXIMA AVENTURA EMPIEZA AQUÍ
            </div>
            <h1>Tu universo,<br /><span>a tu manera.</span></h1>
            <p class="intro">
              Todos tus fangames Pokémon, organizados en un mismo lugar.
            </p>
          </div>

          <div class="orb-decoration" aria-hidden="true">
            <div class="orb-ring ring-one"></div>
            <div class="orb-ring ring-two"></div>
            <div class="orb">
              <div class="orb-shine"></div>
              <div class="orb-band"></div>
              <div class="orb-button"></div>
            </div>
            <span class="orb-spark spark-one">✦</span>
            <span class="orb-spark spark-two">·</span>
            <span class="orb-spark spark-three">✧</span>
          </div>
        </section>

        <section class="stats-row" aria-label="Resumen de la biblioteca">
          <div class="stat-card">
            <div class="stat-icon">▦</div>
            <div>
              <div class="stat-label">EN TU BIBLIOTECA</div>
              <div class="stat-value">{games.length} <span>juegos</span></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon cyan">◈</div>
            <div>
              <div class="stat-label">PLATAFORMA</div>
              <div class="stat-value">{systemInfo?.osName ?? 'Detectando...'} <span>· {systemInfo?.architecture ?? '...'}</span></div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon yellow">✧</div>
            <div>
              <div class="stat-label">TU COLECCIÓN</div>
              <div class="stat-value">En expansión</div>
            </div>
          </div>
        </section>

        <section class="library-section">
          <div class="section-heading">
            <div>
              <div class="section-kicker">TU COLECCIÓN</div>
              <h2>Biblioteca <span class="heading-count">{games.length}</span></h2>
            </div>
            <button class="primary-button" onclick={openAddModal}>
              <span>＋</span> Añadir juego
            </button>
          </div>

          <div class="filter-row">
            <label class="search-box">
              <span class="search-icon">⌕</span>
              <input
                aria-label="Buscar juegos"
                placeholder="Buscar por nombre, desarrollador o descripción..."
                bind:value={search}
                title="Pulsa Escape para limpiar la búsqueda"
                onkeydown={(event) => { if (event.key === 'Escape') search = ''; }}
              />
            </label>
            <div class="filter-label">
              <span>▤</span>
              {filteredGames.length} {filteredGames.length === 1 ? 'juego' : 'juegos'}
              {search ? 'encontrados' : 'en la biblioteca'}
            </div>
          </div>

          {#if filteredGames.length > 0}
            <div class="game-grid">
              {#each filteredGames as game (game.id)}
                <article class="game-card">
                  <button
                    class={`game-art art-${game.color}`}
                    aria-label={`Ver ficha de ${game.name}`}
                    onclick={() => openDetails(game)}
                  >
                    {#if game.cover && isWebUrl(game.cover)}
                      <img class="cover-image" src={game.cover} alt={`Portada de ${game.name}`} />
                      <div class="cover-shade"></div>
                    {:else}
                      <div class="art-grid"></div>
                      <div class="art-glow"></div>
                      <div class="art-orbit orbit-a"></div>
                      <div class="art-orbit orbit-b"></div>
                      <div class="art-emblem">{game.symbol}</div>
                    {/if}

                    <div class="art-topline">
                      <span>DEXDECK COLLECTION</span>
                      <span>#{String(game.id).slice(-3)}</span>
                    </div>
                    <div class="art-title">
                      <span>POKÉMON FAN GAME</span>
                      <strong>{game.name}</strong>
                    </div>
                    <div class="art-bottomline">
                      <span>UNOFFICIAL ADVENTURE</span>
                      <span>VER. {game.version}</span>
                    </div>
                  </button>

                  <div class="game-info">
                    <div class="game-title-row">
                      <div class="game-title-copy">
                        <h3>{game.name}</h3>
                        <p>{game.developer}</p>
                      </div>
                      <button
                        class="game-menu"
                        type="button"
                        aria-label={`Abrir ficha de ${game.name}`}
                        title="Opciones del juego"
                        onclick={() => openGameDetails(game)}
                      >···</button>
                    </div>
                    <div class="game-meta">
                      <span class="game-tag">{game.type}</span>
                      <span class="game-version">v{game.version}</span>
                    </div>
                    <div class="game-readiness" class:ready={Boolean(game.executable_path?.trim())}>
                      <span class="readiness-dot"></span>
                      {game.executable_path?.trim() ? 'Listo para jugar' : 'Falta configurar el ejecutable'}
                    </div>
                    <button
                      class={game.executable_path?.trim() ? 'play-button play-button-ready' : 'play-button play-button-configure'}
                      disabled={launchingGameId !== null}
                      title={game.executable_path?.trim() ? `Iniciar ${game.name}` : `Configurar ${game.name} para poder jugar`}
                      aria-label={launchingGameId === game.id ? `Iniciando ${game.name}` : game.executable_path?.trim() ? `Jugar a ${game.name}` : `Configurar ${game.name}`}
                      onclick={() => playOrConfigure(game)}
                    >
                      <span>{launchingGameId === game.id ? '◌' : game.executable_path?.trim() ? '▶' : '⚙'}</span>
                      {launchingGameId === game.id ? 'Iniciando…' : game.executable_path?.trim() ? 'Jugar' : 'Configurar juego'}
                    </button>
                    {#if game.executable_path?.trim()}
                      <button
                        type="button"
                        class="secondary-button game-configure-button"
                        title={`Configurar los detalles de ${game.name}`}
                        aria-label={`Configurar los detalles de ${game.name}`}
                        onclick={() => editGame(game)}
                      >
                        <span aria-hidden="true">⚙</span> Configurar detalles
                      </button>
                    {/if}
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <div class="empty-symbol">⌕</div>
              <h3>{games.length === 0 ? 'Tu biblioteca está esperando aventuras' : 'No encontramos ese juego'}</h3>
              <p>
                {games.length === 0
                  ? 'Añade tu primer fangame y completa su ficha.'
                  : 'Prueba con otro nombre o con el desarrollador.'}
              </p>
              {#if games.length === 0}
                <button class="primary-button" onclick={openAddModal}>＋ Añadir juego</button>
              {:else}
                <button class="secondary-button" onclick={() => search = ''}>Limpiar búsqueda</button>
              {/if}
            </div>
          {/if}
        </section>

        <div class="tip-banner">
          <div class="tip-symbol">✧</div>
          <div>
            <strong>Tu próxima aventura está a un clic.</strong>
            <p>Completa las fichas para tener organizados todos los datos de tus juegos.</p>
          </div>
          <button class="tip-action" onclick={openAddModal}>Añadir juego <span>→</span></button>
        </div>

      {:else if activeSection === 'Enciclopedia'}
        <Encyclopedia />

      {:else if activeSection === 'Actualizaciones'}
        <section class="subpage-header">
          <div class="eyebrow"><span class="eyebrow-line"></span> SIEMPRE AL DÍA</div>
          <h1>Centro de <span>actualizaciones.</span></h1>
          <p class="intro">Consulta la información de tus fangames y comprueba si hay nuevas versiones.</p>
        </section>

        <div class="placeholder-panel">
          <div class="placeholder-icon">↻</div>
          <h2>Tus juegos, al día.</h2>
          <p>La comprobación de versiones llegará en una siguiente fase. Primero configuraremos las fuentes oficiales de cada juego.</p>
          <button class="secondary-button" onclick={() => navigate('Biblioteca')}>Volver a la biblioteca</button>
        </div>

      {:else if activeSection === 'Ajustes'}
        <section class="subpage-header">
          <div class="eyebrow"><span class="eyebrow-line"></span> A TU GUSTO</div>
          <h1>Los ajustes de <span>tu espacio.</span></h1>
          <p class="intro">Aquí reuniremos las preferencias de DexDeck y la configuración del entorno de juego.</p>
        </section>

        <div class="settings-panel">
          <div class="setting-row setting-row-theme">
            <div class="setting-icon">◐</div>
            <div class="setting-copy">
              <strong>Tema de la aplicación</strong>
              <p>Elige cómo se ve DexDeck. La preferencia se guardará para la próxima vez.</p>
              <div class="theme-options" role="group" aria-label="Tema de la aplicación">
                <button
                  type="button"
                  class="theme-option"
                  class:active={theme === 'light'}
                  aria-pressed={theme === 'light'}
                  onclick={() => selectTheme('light')}
                >
                  <span class="theme-preview theme-preview-light" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span class="theme-option-label">Claro</span>
                  <span class="theme-option-description">Luminoso y limpio</span>
                </button>
                <button
                  type="button"
                  class="theme-option"
                  class:active={theme === 'dark'}
                  aria-pressed={theme === 'dark'}
                  onclick={() => selectTheme('dark')}
                >
                  <span class="theme-preview theme-preview-dark" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span class="theme-option-label">Oscuro</span>
                  <span class="theme-option-description">Grafito + menta</span>
                </button>
                <button
                  type="button"
                  class="theme-option"
                  class:active={theme === 'glass'}
                  aria-pressed={theme === 'glass'}
                  onclick={() => selectTheme('glass')}
                >
                  <span class="theme-preview theme-preview-glass" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span class="theme-option-label">Liquid Glass</span>
                  <span class="theme-option-description">Translúcido</span>
                </button>
              </div>
              {#if theme === 'glass'}
                <p class="theme-hint">La transparencia real depende de Tauri y de que tu compositor permita el efecto.</p>
              {/if}
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-icon">⌘</div>
            <div class="setting-copy">
              <strong>Plataforma</strong>
              <p>{systemInfo ? `Detectado automáticamente: ${systemInfo.osName} (${systemInfo.architecture}).` : 'Detectando el sistema operativo...'}</p>
            </div>
            <span class="setting-value">{systemInfo?.osName ?? 'Detectando...'}</span>
          </div>
          <div class="setting-row">
            <div class="setting-icon">◇</div>
            <div class="setting-copy">
              <strong>Compatibilidad</strong>
              <p>{#if systemInfo?.os === 'windows'}Los ejecutables .exe se inician de forma nativa.{:else if systemInfo?.os === 'linux'}Wine es necesario para ejecutar juegos de Windows.{:else}La configuración de motores externos se añadirá más adelante.{/if}</p>
            </div>
            <span class="setting-value pending">{#if systemInfo?.os === 'windows'}Nativo{:else if systemInfo?.os === 'linux'}Wine externo{:else}Pendiente{/if}</span>
          </div>
        </div>
      {/if}

      {#if notice}
        <div class="notice" role="status">
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

<!-- Modal para añadir y editar fichas -->
<dialog
  bind:this={addDialog}
  class="modal"
  aria-labelledby="modal-title"
  onclick={(event) => {
    if (event.target === addDialog) addDialog?.close();
  }}
>
  <div class="modal-top">
    <div class="modal-icon">{editingGameId !== null ? '✎' : '＋'}</div>
    <button class="modal-close" aria-label="Cerrar" onclick={() => addDialog?.close()}>×</button>
  </div>

  <div class="section-kicker">{editingGameId !== null ? 'ACTUALIZA LA INFORMACIÓN' : 'AMPLÍA TU COLECCIÓN'}</div>
  <h2 id="modal-title">{editingGameId !== null ? 'Editar ficha.' : 'Añadir un juego.'}</h2>
  <p class="modal-description">
    Guarda la información de tu fangame. Puedes completar los datos técnicos más adelante.
  </p>

  <form onsubmit={(event) => { event.preventDefault(); void saveGame(); }}>
    <div class="form-grid">
      <label class="form-label full-width">
        Nombre del juego <span>*</span>
        <input bind:value={newName} placeholder="Ej. Pokémon Eclipse" required maxlength="80" oninput={() => (nameManuallyEdited = true)} />
      </label>

      <label class="form-label">
        Desarrollador
        <input bind:value={newDeveloper} placeholder="Creador o equipo" maxlength="100" />
      </label>

      <label class="form-label">
        Versión
        <input bind:value={newVersion} placeholder="Ej. 1.0" maxlength="30" oninput={() => (versionManuallyEdited = true)} />
      </label>

      <label class="form-label">
        Tipo de juego
        <select bind:value={newType}>
          <option value="Fangame">Fangame</option>
          <option value="ROM Hack">ROM Hack</option>
          <option value="RPG">RPG</option>
          <option value="Aventura">Aventura</option>
          <option value="Otro">Otro</option>
        </select>
      </label>

      <label class="form-label">
        Estado
        <select bind:value={newStatus}>
          <option value="En biblioteca">En biblioteca</option>
          <option value="Instalado">Instalado</option>
          <option value="En progreso">En progreso</option>
          <option value="Completado">Completado</option>
          <option value="Pendiente">Pendiente</option>
        </select>
      </label>

      <label class="form-label full-width">
        Descripción
        <textarea bind:value={newDescription} placeholder="Historia, características, región, generación..." rows="4" maxlength="3000"></textarea>
      </label>

      <label class="form-label full-width">
        URL de la portada
        <input bind:value={newCover} type="url" placeholder="https://ejemplo.com/portada.png" maxlength="1000" />
        <span class="field-help">Por ahora, la portada debe ser una imagen accesible mediante una URL HTTP o HTTPS.</span>
      </label>

      <label class="form-label full-width">
        Web oficial o página del proyecto
        <input bind:value={newOfficialUrl} type="url" placeholder="https://..." maxlength="1000" />
      </label>

      <div class="form-label full-width">
        <label for="executable-path">Ruta del ejecutable</label>
        <div class="path-input-row">
          <input id="executable-path" bind:value={newExecutablePath} placeholder={systemInfo?.os === 'windows' ? 'C:\\Juegos\\NombreDelJuego\\Game.exe' : '/home/usuario/Juegos/NombreDelJuego/Game.exe'} maxlength="1000" onchange={() => autofillExecutableFields(newExecutablePath)} />
          <button type="button" class="path-button" onclick={() => void chooseExecutablePath()}>Elegir archivo</button>
        </div>
        <span class="field-help">Al elegir un ejecutable, DexDeck intenta detectar el nombre y la versión de los archivos Windows (.exe), y calcula la carpeta raíz desde su ruta. Los campos siguen siendo editables.</span>
        {#if executableInfo}
          <span class="field-help executable-info" role="status">{executableInfo}</span>
        {/if}
      </div>

      <div class="form-label full-width">
        <label for="install-path">Ruta de instalación</label>
        <div class="path-input-row">
          <input id="install-path" bind:value={newInstallPath} placeholder={systemInfo?.os === 'windows' ? 'C:\\Juegos\\NombreDelJuego' : '/home/usuario/Juegos/NombreDelJuego'} maxlength="1000" oninput={() => (installPathManuallyEdited = true)} />
          <button type="button" class="path-button" onclick={() => void chooseInstallPath()}>Elegir carpeta</button>
        </div>
        <span class="field-help">Selecciona la carpeta donde se encuentran los archivos del juego. También puedes escribir la ruta manualmente.</span>
      </div>

      <label class="form-label">
        Color de la tarjeta
        <select bind:value={newColor}>
          <option value="blue">Azul</option>
          <option value="purple">Morado</option>
          <option value="red">Rojo</option>
        </select>
      </label>

      <label class="form-label">
        Símbolo
        <select bind:value={newSymbol}>
          <option value="✦">✦ Estrella</option>
          <option value="◇">◇ Diamante</option>
          <option value="✧">✧ Destello</option>
          <option value="◈">◈ Cristal</option>
          <option value="★">★ Estrella sólida</option>
        </select>
      </label>
    </div>

    {#if formError}
      <p class="form-notice" role="alert">{formError}</p>
    {/if}

    <div class="modal-actions">
      <button type="button" class="secondary-button" onclick={() => addDialog?.close()}>Cancelar</button>
      <button type="submit" class="primary-button" disabled={saving}>
        {saving ? 'Guardando…' : editingGameId !== null ? 'Guardar cambios' : 'Añadir a la biblioteca'}
        <span>→</span>
      </button>
    </div>
  </form>
</dialog>

<!-- Ficha de consulta -->
<dialog
  bind:this={detailDialog}
  class="modal detail-modal"
  aria-labelledby="detail-title"
  onclick={(event) => {
    if (event.target === detailDialog) detailDialog?.close();
  }}
>
  {#if selectedGame}
    <div class="modal-top">
      <div class="modal-icon">◇</div>
      <button class="modal-close" aria-label="Cerrar ficha" onclick={() => detailDialog?.close()}>×</button>
    </div>

    <div class="section-kicker">DEXDECK COLLECTION · FICHA DEL JUEGO</div>
    <h2 id="detail-title">{selectedGame.name}</h2>
    <p class="modal-description">
      {selectedGame.developer} · Versión {selectedGame.version}
    </p>

    {#if selectedGame.cover && isWebUrl(selectedGame.cover)}
      <img class="detail-cover" src={selectedGame.cover} alt={`Portada de ${selectedGame.name}`} />
    {/if}

    <div class="detail-badges">
      <span class="game-tag">{selectedGame.type}</span>
      <span class="game-tag">{selectedGame.status}</span>
      <span class="game-tag">v{selectedGame.version}</span>
    </div>

    <section class="detail-section">
      <h3>Descripción</h3>
      <p class="detail-text">
        {selectedGame.description || 'Todavía no has añadido una descripción para este juego.'}
      </p>
    </section>

    <section class="detail-section">
      <h3>Enlaces y archivos</h3>

      <div class="detail-field">
        <span>Web oficial</span>
        {#if selectedGame.official_url && isWebUrl(selectedGame.official_url)}
          <a href={selectedGame.official_url} target="_blank" rel="noreferrer">{selectedGame.official_url}</a>
        {:else}
          <p>Sin especificar</p>
        {/if}
      </div>

      <div class="detail-field">
        <span>Ruta de instalación</span>
        <p class="path-value">{selectedGame.install_path || 'Sin especificar'}</p>
      </div>

      <div class="detail-field">
        <span>Ejecutable</span>
        <p class="path-value">{selectedGame.executable_path || 'Sin especificar'}</p>
      </div>
    </section>

    <div class="modal-actions">
      <button type="button" class="secondary-button" onclick={() => detailDialog?.close()}>Cerrar</button>
      <button type="button" class="secondary-button" onclick={() => editGame(selectedGame!)}>
        Configurar detalles <span>⚙</span>
      </button>
      <button
        type="button"
        class="primary-button"
        disabled={launchingGameId !== null}
        onclick={() => void launchGame(selectedGame!)}
      >
        {launchingGameId === selectedGame.id ? 'Iniciando…' : 'Jugar'} <span>▶</span>
      </button>
    </div>
  {/if}
</dialog>

{#if selectedGame}
  <dialog
    bind:this={gameDialog}
    class="modal game-details-modal"
    aria-labelledby="game-modal-title"
    onclose={() => {
      selectedGame = null;
      showRemoveConfirm = false;
    }}
    onclick={(event) => {
      if (event.target === gameDialog) gameDialog?.close();
    }}
  >
    {#if selectedGame}
      {#if showRemoveConfirm}
        <div class="remove-confirm-content">
          <div class="modal-top">
            <div class="modal-icon remove-icon">!</div>
            <button class="modal-close" aria-label="Volver a la ficha" onclick={() => showRemoveConfirm = false}>×</button>
          </div>
          <div class="section-kicker">CONFIRMAR ACCIÓN</div>
          <h2 id="game-modal-title">¿Quitar {selectedGame.name}?</h2>
          <p class="modal-description">
            Se eliminará de tu biblioteca de DexDeck. Esta acción no borra los archivos del juego de tu disco.
          </p>
          <div class="modal-actions">
            <button type="button" class="secondary-button" onclick={() => showRemoveConfirm = false}>Cancelar</button>
            <button type="button" class="danger-button" onclick={removeSelectedGame}>Quitar de la biblioteca</button>
          </div>
        </div>
      {:else}
        <div class={`game-details-hero art-${selectedGame.color}`}>
          <div class="art-grid"></div>
          <div class="art-glow"></div>
          <div class="art-orbit orbit-a"></div>
          <div class="art-orbit orbit-b"></div>
          <div class="art-emblem">{selectedGame.symbol}</div>
          <button class="modal-close details-close" aria-label="Cerrar ficha" onclick={closeGameDetails}>×</button>
          <div class="details-hero-copy">
            <span>DEXDECK COLLECTION</span>
            <h2 id="game-modal-title">{selectedGame.name}</h2>
            <p>{selectedGame.developer}</p>
          </div>
        </div>
        <div class="game-details-body">
          <div class="section-kicker">DETALLES DEL JUEGO</div>
          <div class="details-meta-grid">
            <div class="details-meta-item"><span>Tipo</span><strong>{selectedGame.type}</strong></div>
            <div class="details-meta-item"><span>Versión</span><strong>{selectedGame.version}</strong></div>
            <div class="details-meta-item"><span>Estado</span><strong>{selectedGame.status}</strong></div>
          </div>
          <p class="details-note">DexDeck todavía no gestiona los archivos instalados. Desde aquí puedes preparar el lanzamiento (cuando esté configurado) o quitar esta entrada de la biblioteca sin borrar el juego del disco.</p>
          <div class="game-details-actions">
            <button type="button" class="primary-button" onclick={prepareSelectedGame}><span>▶</span> Preparar para jugar</button>
            <button type="button" class="secondary-button" onclick={() => showRemoveConfirm = true}>Quitar de biblioteca</button>
          </div>
        </div>
      {/if}
    {/if}
  </dialog>
{/if}


<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { min-width: 360px; background: #0c1222; }
  :global(body) {
    margin: 0; color: #f1f5fc; background: #0c1222;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px; -webkit-font-smoothing: antialiased;
  }
  :global(button), :global(input), :global(textarea), :global(select) { font: inherit; }
  :global(button) { color: inherit; }
  :global(button:focus-visible), :global(input:focus-visible), :global(textarea:focus-visible), :global(select:focus-visible), :global(a:focus-visible) {
    outline: 2px solid #7dd3fc; outline-offset: 3px;
  }
  :global(textarea), :global(select) { color-scheme: dark; }

  .app-shell { min-height: 100vh; }
  .sidebar {
    width: 248px; position: fixed; inset: 0 auto 0 0; z-index: 5;
    display: flex; flex-direction: column; padding: 28px 17px 15px;
    background: linear-gradient(160deg, #121b2e 0%, #101827 50%, #0e1625 100%);
    border-right: 1px solid #ffffff0c;
  }
  .brand { display: flex; align-items: center; gap: 12px; padding: 0 9px; color: inherit; text-decoration: none; }
  .brand-mark { width: 39px; height: 39px; border: 1px solid #ffffff35; border-radius: 13px; background: linear-gradient(145deg, #ffffff24, #ffffff04); display: grid; place-items: center; box-shadow: inset 0 1px #ffffff20, 0 4px 16px #0002; }
  .brand-core { width: 19px; height: 19px; position: relative; border: 2px solid #f8fafc; border-radius: 50%; background: linear-gradient(to bottom, #ef4444 0 44%, #f8fafc 44% 56%, #19243a 56% 100%); }
  .brand-core::after { content: ""; position: absolute; width: 5px; height: 5px; border: 2px solid #f8fafc; background: #19243a; border-radius: 50%; top: 5px; left: 5px; }
  .brand-copy, .profile-copy { display: flex; flex-direction: column; gap: 4px; }
  .brand-name { font-size: 19px; font-weight: 750; letter-spacing: -.8px; }
  .brand-caption { color: #71819d; font-size: 8px; font-weight: 700; letter-spacing: 1.45px; }
  .sidebar-label, .section-kicker { color: #7786a0; font-size: 9px; font-weight: 750; letter-spacing: 1.6px; }
  .sidebar-label { margin: 45px 10px 14px; }
  .navigation { display: grid; gap: 5px; }
  .nav-item { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 43px; padding: 0 12px; color: #9aa8be; background: transparent; border: 1px solid transparent; border-radius: 10px; text-align: left; cursor: pointer; transition: background 180ms, color 180ms, border-color 180ms; }
  .nav-item:hover { color: #f1f5fc; background: #ffffff08; }
  .nav-item.active { color: #f8fafc; background: linear-gradient(105deg, #ffffff12, #ffffff06); border-color: #ffffff0d; box-shadow: inset 2px 0 #f87171, inset 0 1px #ffffff08; }
  .nav-icon { width: 18px; font-size: 17px; text-align: center; }
  .nav-count { margin-left: auto; padding: 3px 7px; color: #cbd5e1; background: #ffffff0c; border: 1px solid #ffffff0b; border-radius: 6px; font-size: 10px; }
  .sidebar-bottom { margin-top: auto; }
  .runner-card { padding: 15px 13px; margin-bottom: 16px; border: 1px solid #ffffff10; border-radius: 12px; background: linear-gradient(145deg, #ffffff09, #ffffff03); box-shadow: inset 0 1px #ffffff08; }
  .runner-heading { display: flex; align-items: center; gap: 7px; color: #8392a9; font-size: 8px; letter-spacing: 1px; font-weight: 750; }
  .runner-dot, .status-indicator, .footer-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #fbbf24; }
  .runner-name { margin-top: 14px; font-size: 15px; font-weight: 650; }
  .runner-description { margin-top: 6px; color: #8190a8; font-size: 10px; line-height: 1.6; }
  .runner-status { display: flex; align-items: center; gap: 7px; margin-top: 13px; color: #b5c0d1; font-size: 9px; }
  .profile { display: flex; align-items: center; gap: 10px; padding: 13px 4px 3px; border-top: 1px solid #ffffff0e; }
  .profile-avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 11px; background: linear-gradient(145deg, #ef4444, #9f293b); color: white; font-weight: 800; box-shadow: inset 0 1px #ffffff45; }
  .profile-name { font-size: 11px; font-weight: 650; }
  .profile-caption { font-size: 10px; color: #8290a7; }
  .profile-menu { margin-left: auto; color: #94a3b8; font-size: 20px; }

  .main-content { min-height: 100vh; margin-left: 248px; }
  .topbar { height: 68px; padding: 0 42px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ffffff0b; background: #0c1222cc; }
  .breadcrumb { display: flex; gap: 10px; align-items: center; color: #75839b; font-size: 9px; font-weight: 750; letter-spacing: 1.2px; }
  .breadcrumb-slash { color: #3e4a61; }
  .breadcrumb-current { color: #cbd5e1; }
  .topbar-right { display: flex; align-items: center; gap: 16px; }
  .local-badge { display: flex; align-items: center; gap: 7px; color: #b4c1d4; font-size: 9px; font-weight: 750; letter-spacing: 1px; }
  .local-badge .status-indicator, .footer-dot { width: 5px; height: 5px; background: #6ee7b7; box-shadow: 0 0 9px #6ee7b74d; }
  .topbar-divider { width: 1px; height: 22px; background: #ffffff15; }
  .icon-button { width: 32px; height: 32px; border-radius: 9px; border: 1px solid #ffffff12; background: #ffffff05; color: #a8b4c8; cursor: pointer; }
  .icon-button:hover { background: #ffffff10; color: white; }

  .page-content { max-width: 1430px; padding: 36px 42px 18px; margin: 0 auto; }
  .welcome-row { position: relative; display: flex; justify-content: space-between; align-items: center; min-height: 190px; overflow: hidden; }
  .eyebrow { display: flex; align-items: center; gap: 9px; color: #a3b0c4; font-size: 9px; font-weight: 750; letter-spacing: 1.5px; }
  .eyebrow-line { width: 20px; height: 1px; background: #f87171; box-shadow: 0 0 9px #ef444455; }
  h1 { margin: 18px 0 12px; font-size: clamp(32px, 3.3vw, 47px); line-height: 1.1; letter-spacing: -2px; font-weight: 730; }
  h1 span { color: #9eacc2; font-weight: 500; }
  .intro { max-width: 480px; margin: 0; color: #8998b0; font-size: 12px; line-height: 1.8; }

  .orb-decoration { position: relative; width: 210px; height: 185px; margin-right: 30px; flex-shrink: 0; display: grid; place-items: center; }
  .orb-ring { position: absolute; width: 160px; height: 160px; border: 1px solid #b8d7ff12; border-radius: 50%; }
  .ring-two { width: 190px; height: 190px; border-style: dashed; border-color: #b8d7ff0d; }
  .orb { width: 102px; height: 102px; overflow: hidden; position: relative; border: 1px solid #ffffff65; border-radius: 50%; background: linear-gradient(145deg, #ff7878, #e73e52 46%, #26364e 47%, #101a2d 100%); box-shadow: 0 0 50px #ef44441c, inset 0 2px 5px #ffffff55, inset 0 -8px 15px #0004; }
  .orb::after { content: ""; position: absolute; inset: 49% 0 auto; height: 5px; background: #dce7f8; box-shadow: 0 0 0 1px #1a263c; }
  .orb-shine { position: absolute; top: 10px; left: 18px; width: 39px; height: 17px; border-radius: 50%; background: #ffffff43; filter: blur(7px); transform: rotate(-35deg); }
  .orb-band { position: absolute; inset: 48% 0 auto; height: 7px; background: #152238; }
  .orb-button { position: absolute; width: 25px; height: 25px; top: calc(50% - 12px); left: calc(50% - 12px); border: 4px solid #f0f5ff; border-radius: 50%; background: #18253b; box-shadow: 0 0 0 2px #101a2d, inset 0 0 0 2px #a6b9d3; }
  .orb-spark { position: absolute; color: #a8d8ff; text-shadow: 0 0 14px #7dd3fc66; }
  .spark-one { top: 17px; right: 28px; font-size: 20px; }
  .spark-two { bottom: 22px; left: 13px; font-size: 27px; }
  .spark-three { bottom: 32px; right: 12px; font-size: 18px; }

  .stats-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; margin: 18px 0 40px; }
  .stat-card { display: flex; align-items: center; gap: 13px; min-height: 76px; padding: 15px; border: 1px solid #ffffff10; border-radius: 12px; background: linear-gradient(125deg, #ffffff09, #ffffff03); box-shadow: inset 0 1px #ffffff09, 0 5px 20px #00000008; }
  .stat-icon { display: grid; place-items: center; flex-shrink: 0; width: 35px; height: 35px; border-radius: 10px; color: #fca5a5; background: #ef444415; font-size: 17px; }
  .stat-icon.cyan { color: #7dd3fc; background: #7dd3fc12; }
  .stat-icon.yellow { color: #facc15; background: #facc1512; }
  .stat-label { color: #7f8ea5; font-size: 8px; letter-spacing: 1px; font-weight: 750; }
  .stat-value { margin-top: 8px; color: #f1f5fc; font-size: 15px; font-weight: 700; letter-spacing: -.3px; }
  .stat-value span { color: #8291a9; font-size: 10px; font-weight: 450; }

  .library-section { min-width: 0; }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
  .section-heading h2 { margin: 7px 0 0; font-size: 22px; letter-spacing: -.7px; font-weight: 700; }
  .heading-count { display: inline-grid; place-items: center; vertical-align: 3px; min-width: 20px; height: 20px; margin-left: 4px; padding: 0 5px; color: #aab8cd; background: #ffffff0c; border: 1px solid #ffffff0c; border-radius: 6px; font-size: 10px; letter-spacing: 0; }
  .primary-button, .secondary-button { min-height: 37px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; border-radius: 9px; font-size: 11px; font-weight: 650; cursor: pointer; transition: transform 160ms, background 160ms, border-color 160ms; }
  .primary-button { color: white; border: 1px solid #ffffff26; background: linear-gradient(130deg, #f05260, #d7354b); box-shadow: inset 0 1px #ffffff38, 0 5px 15px #ef44441b; }
  .primary-button:hover:not(:disabled) { transform: translateY(-1px); background: linear-gradient(130deg, #ff6573, #e43c54); }
  .primary-button:disabled { opacity: .6; cursor: wait; }
  .primary-button > span { font-size: 17px; }
  .secondary-button { border: 1px solid #ffffff18; background: #ffffff08; color: #d6deeb; }
  .secondary-button:hover { background: #ffffff12; }
  .filter-row { display: flex; align-items: center; gap: 12px; margin: 19px 0 17px; }
  .search-box { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; height: 39px; padding: 0 11px; border: 1px solid #ffffff10; border-radius: 9px; background: #ffffff04; }
  .search-icon { color: #8493aa; font-size: 22px; transform: rotate(-20deg); }
  .search-box input { min-width: 0; width: 100%; color: #e2e8f0; background: transparent; border: 0; outline: none; font-size: 11px; }
  .search-box input::placeholder { color: #65748b; }
  .filter-label { display: flex; align-items: center; gap: 8px; color: #a3b0c3; white-space: nowrap; font-size: 10px; }

  .game-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .game-card { min-width: 0; overflow: hidden; border: 1px solid #ffffff12; border-radius: 13px; background: linear-gradient(145deg, #182236, #121b2c); box-shadow: 0 10px 25px #0000000b, inset 0 1px #ffffff07; transition: transform 180ms, border-color 180ms, box-shadow 180ms; }
  .game-card:hover { transform: translateY(-3px); border-color: #ffffff28; box-shadow: 0 15px 30px #00000020, inset 0 1px #ffffff0b; }
  .game-art { position: relative; isolation: isolate; width: 100%; aspect-ratio: 1.25 / 1; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; border: 0; border-bottom: 1px solid #ffffff10; text-align: left; cursor: pointer; }
  .art-blue { background: radial-gradient(ellipse at 70% 43%, #39a8ce50, transparent 34%), linear-gradient(140deg, #173d62, #14243d 60%, #101a30); }
  .art-purple { background: radial-gradient(ellipse at 70% 40%, #a78bfa50, transparent 36%), linear-gradient(145deg, #44346f, #272345 57%, #171a31); }
  .art-red { background: radial-gradient(ellipse at 70% 40%, #fb718550, transparent 34%), linear-gradient(140deg, #743342, #3c2439 58%, #1d1a2d); }
  .art-grid { position: absolute; inset: 0; z-index: -1; opacity: .18; background-image: linear-gradient(#ffffff18 1px, transparent 1px), linear-gradient(90deg, #ffffff18 1px, transparent 1px); background-size: 23px 23px; mask-image: linear-gradient(to bottom, black, transparent); }
  .art-glow { position: absolute; z-index: -1; width: 100px; height: 100px; top: 20%; left: 50%; transform: translateX(-50%); border-radius: 50%; background: #ffffff09; filter: blur(18px); }
  .art-orbit { position: absolute; z-index: -1; left: 50%; top: 48%; width: 125px; height: 43px; border: 1px solid #ffffff28; border-radius: 50%; transform: translate(-50%, -50%) rotate(-30deg); }
  .orbit-b { width: 115px; height: 70px; transform: translate(-50%, -50%) rotate(55deg); border-color: #ffffff17; }
  .art-emblem { position: absolute; top: 47%; left: 50%; transform: translate(-50%, -50%); color: #ffffffd9; font-size: clamp(42px, 5vw, 65px); font-weight: 300; text-shadow: 0 0 35px #ffffff33; }
  .art-topline, .art-bottomline { position: relative; z-index: 2; display: flex; justify-content: space-between; gap: 5px; color: #ffffffb0; font-size: 7px; font-weight: 750; letter-spacing: .8px; }
  .art-title { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 4px; text-shadow: 0 2px 10px #0008; }
  .art-title span { color: #ffffffc7; font-size: 7px; letter-spacing: 1.2px; font-weight: 750; }
  .art-title strong { overflow-wrap: anywhere; font-size: clamp(17px, 1.7vw, 22px); line-height: 1.1; letter-spacing: -.7px; font-weight: 800; }
  .cover-image { position: absolute; z-index: -2; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cover-shade { position: absolute; z-index: -1; inset: 0; background: linear-gradient(180deg, #080f1d30, #080f1d08 40%, #080f1de8); }
  .game-info { padding: 13px; }
  .game-title-row { display: flex; align-items: start; justify-content: space-between; gap: 8px; }
  .game-title-copy { min-width: 0; }
  .game-title-copy h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; font-size: 13px; font-weight: 700; letter-spacing: -.2px; }
  .game-title-copy p { margin: 5px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8493aa; font-size: 10px; }
  .game-menu { flex-shrink: 0; border: 0; background: transparent; color: #8291a8; font-size: 19px; line-height: 15px; cursor: pointer; }
  .game-menu:hover { color: white; }
  .game-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
  .game-tag { padding: 4px 7px; color: #b6c7de; background: #ffffff08; border: 1px solid #ffffff0d; border-radius: 5px; font-size: 9px; }
  .game-version { color: #74839a; font-size: 9px; }
  .play-button { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 34px; margin-top: 13px; border: 1px solid #ffffff13; border-radius: 8px; color: #e7edf7; background: linear-gradient(110deg, #ffffff0b, #ffffff05); cursor: pointer; font-size: 10px; font-weight: 650; transition: background 160ms, border-color 160ms; }
  .play-button span { color: #fca5a5; font-size: 10px; }
  .play-button:hover { background: #ffffff10; border-color: #ffffff25; }

  .tip-banner { display: flex; align-items: center; gap: 13px; margin-top: 24px; padding: 14px 16px; border: 1px solid #7dd3fc15; border-radius: 11px; background: linear-gradient(105deg, #7dd3fc0a, #ffffff03 65%); }
  .tip-symbol { display: grid; place-items: center; flex-shrink: 0; width: 33px; height: 33px; border-radius: 9px; color: #7dd3fc; background: #7dd3fc12; font-size: 17px; }
  .tip-banner strong { font-size: 11px; font-weight: 650; }
  .tip-banner p { margin: 5px 0 0; color: #8998af; font-size: 10px; }
  .tip-action { display: flex; align-items: center; gap: 9px; margin-left: auto; padding: 8px 0 8px 8px; flex-shrink: 0; border: 0; background: transparent; color: #a9dfff; cursor: pointer; font-size: 10px; }
  .tip-action:hover { color: #e0f2fe; }

  .subpage-header { padding: 18px 0 30px; }
  .placeholder-panel { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 22px; border: 1px solid #ffffff10; border-radius: 15px; background: linear-gradient(145deg, #ffffff08, #ffffff02); }
  .placeholder-icon { display: grid; place-items: center; width: 58px; height: 58px; border: 1px solid #ffffff15; border-radius: 17px; background: #ffffff08; color: #7dd3fc; font-size: 28px; }
  .placeholder-panel h2 { margin: 20px 0 8px; font-size: 20px; letter-spacing: -.6px; }
  .placeholder-panel p { max-width: 430px; margin: 0 0 20px; color: #91a0b6; font-size: 12px; line-height: 1.8; }
  .settings-panel { border: 1px solid #ffffff12; border-radius: 13px; overflow: hidden; background: #ffffff04; }
  .setting-row { display: flex; align-items: center; gap: 14px; padding: 19px; border-bottom: 1px solid #ffffff0c; }
  .setting-row:last-child { border-bottom: 0; }
  .setting-icon { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #ffffff10; border-radius: 10px; background: #ffffff08; color: #9ddfff; font-size: 17px; }
  .setting-copy { flex: 1; }
  .setting-copy strong { font-size: 12px; font-weight: 650; }
  .setting-copy p { margin: 5px 0 0; color: #8695ab; font-size: 10px; }
  .setting-value { padding: 6px 9px; border: 1px solid #ffffff10; border-radius: 7px; color: #c3cfdf; background: #ffffff07; font-size: 10px; }
  .setting-value.pending { color: #fbbf24; border-color: #fbbf241b; background: #fbbf2408; }

  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 15px; border: 1px dashed #ffffff20; border-radius: 12px; text-align: center; }
  .empty-symbol { color: #7dd3fc; font-size: 30px; }
  .empty-state h3 { margin: 13px 0 5px; font-size: 15px; }
  .empty-state p { margin: 0 0 18px; color: #8b9ab0; font-size: 11px; }

  .notice { display: flex; align-items: center; gap: 10px; margin-top: 20px; padding: 12px 14px; border: 1px solid #7dd3fc25; border-radius: 9px; color: #c6d8eb; background: #7dd3fc0b; font-size: 11px; line-height: 1.6; }
  .notice > span { color: #7dd3fc; }
  .notice button { margin-left: auto; padding: 0 5px; border: 0; background: transparent; color: #9aabc0; cursor: pointer; font-size: 18px; }
  .footer { display: flex; justify-content: space-between; gap: 15px; margin-top: 36px; padding: 16px 0 4px; border-top: 1px solid #ffffff0b; color: #8290a7; font-size: 8px; letter-spacing: 1px; font-weight: 700; }
  .footer > span:first-child { display: flex; align-items: center; gap: 8px; }
  .footer-version { color: #59677e; font-size: 8px; font-weight: 500; }

  .modal::backdrop { background: #050914bb; backdrop-filter: blur(12px); animation: fade-in 160ms ease-out; }
  .modal { width: min(100% - 40px, 560px); max-height: min(90vh, 820px); overflow-y: auto; margin: auto; padding: 25px; border: 1px solid #ffffff22; border-radius: 17px; color: #f1f5f9; background: linear-gradient(145deg, #1c2940f5, #111a2cf7); box-shadow: 0 25px 90px #0008, inset 0 1px #ffffff16; animation: modal-in 180ms ease-out; }
  .modal-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .modal-icon { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid #ffffff20; border-radius: 12px; color: #fecaca; background: #ef44441a; font-size: 24px; }
  .modal-close { width: 30px; height: 30px; border: 1px solid #ffffff12; border-radius: 8px; background: #ffffff07; color: #a7b4c8; cursor: pointer; font-size: 20px; }
  .modal-close:hover { color: white; background: #ffffff12; }
  .modal h2 { margin: 8px 0; font-size: 26px; letter-spacing: -1px; overflow-wrap: anywhere; }
  .modal-description { margin: 0 0 24px; color: #91a0b7; font-size: 11px; line-height: 1.8; }
  .modal form { display: grid; gap: 16px; }
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; }
  .form-label { display: grid; align-content: start; gap: 8px; min-width: 0; color: #cbd5e1; font-size: 10px; font-weight: 650; }
  .form-label > span { display: inline; color: #fca5a5; }
  .full-width { grid-column: 1 / -1; }
  .form-label input, .form-label textarea, .form-label select { width: 100%; min-width: 0; min-height: 40px; padding: 10px 12px; color: #f1f5f9; border: 1px solid #ffffff16; border-radius: 9px; outline: none; background: #080f1d70; font-size: 11px; }
  .form-label textarea { min-height: 90px; resize: vertical; line-height: 1.6; }
  .form-label input::placeholder, .form-label textarea::placeholder { color: #64748b; }
  .form-label input:focus, .form-label textarea:focus, .form-label select:focus { border-color: #7dd3fc70; }
  .field-help { color: #8190a8 !important; font-size: 9px; font-weight: 400; line-height: 1.5; }
  .path-input-row { display: flex; align-items: stretch; gap: 8px; min-width: 0; }
  .path-input-row input { flex: 1; width: 100%; min-width: 0; }
  .path-button { flex-shrink: 0; min-height: 40px; padding: 0 12px; border: 1px solid #ffffff1c; border-radius: 9px; color: #dbeafe; background: #7dd3fc12; font-size: 10px; font-weight: 650; cursor: pointer; transition: background 160ms, border-color 160ms; }
  .path-button:hover { background: #7dd3fc20; border-color: #7dd3fc45; }
  .form-notice { margin: 0; color: #fca5a5; font-size: 11px; line-height: 1.6; }
  .modal-actions { display: flex; justify-content: end; flex-wrap: wrap; gap: 9px; margin-top: 6px; padding-top: 17px; border-top: 1px solid #ffffff10; }
  .detail-modal { width: min(100% - 40px, 600px); }
  .detail-cover { display: block; width: 100%; max-height: 240px; object-fit: cover; border: 1px solid #ffffff16; border-radius: 12px; margin: 0 0 17px; }
  .detail-badges { display: flex; flex-wrap: wrap; gap: 7px; margin: 0 0 23px; }
  .detail-section { padding: 17px 0; border-top: 1px solid #ffffff10; }
  .detail-section h3 { margin: 0 0 12px; font-size: 12px; font-weight: 700; }
  .detail-text { margin: 0; color: #aab7ca; font-size: 11px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
  .detail-field { display: grid; gap: 6px; margin-top: 13px; }
  .detail-field > span { color: #8392aa; font-size: 9px; text-transform: uppercase; letter-spacing: .8px; }
  .detail-field p, .detail-field a { margin: 0; color: #d3deec; font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
  .detail-field a { color: #7dd3fc; text-decoration: none; }
  .detail-field a:hover { text-decoration: underline; }
  .path-value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modal-in { from { opacity: 0; transform: translateY(8px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }

  @media (min-width: 1500px) {
    .page-content { padding-top: 46px; }
    .welcome-row { min-height: 205px; }
    .game-grid { gap: 19px; }
  }
  @media (max-width: 1150px) {
    .sidebar { width: 215px; }
    .main-content { margin-left: 215px; }
    .page-content { padding-right: 26px; padding-left: 26px; }
    .topbar { padding-right: 26px; padding-left: 26px; }
    .orb-decoration { margin-right: 0; transform: scale(.85); }
    .stats-row { gap: 9px; }
    .stat-card { padding: 12px 10px; gap: 9px; }
    .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .art-title strong { font-size: 22px; }
  }
  @media (max-width: 760px) {
    .sidebar { width: 64px; align-items: center; padding: 18px 8px 12px; }
    .brand { padding: 0; }
    .brand-copy, .sidebar-label, .nav-item > span:not(.nav-icon), .runner-card, .profile-copy, .profile-menu { display: none; }
    .navigation { width: 100%; margin-top: 38px; }
    .nav-item { justify-content: center; padding: 0; }
    .nav-icon { font-size: 19px; }
    .profile { justify-content: center; padding: 14px 0 0; }
    .main-content { margin-left: 64px; }
    .topbar { height: 58px; padding: 0 18px; }
    .page-content { padding: 25px 18px 16px; }
    .welcome-row { min-height: 180px; }
    .orb-decoration { position: absolute; right: -60px; opacity: .32; transform: scale(.8); }
    .welcome-row > div:first-child { position: relative; z-index: 1; }
    h1 { font-size: 35px; }
    .stats-row { grid-template-columns: 1fr; margin-bottom: 32px; }
    .stat-card { min-height: 65px; }
    .game-grid { grid-template-columns: 1fr; }
    .game-art { aspect-ratio: 1.8 / 1; }
    .art-title strong { font-size: 25px; }
    .filter-row { align-items: stretch; flex-direction: column; }
    .filter-label { justify-content: end; }
    .tip-banner { align-items: start; flex-wrap: wrap; }
    .tip-action { margin-left: 46px; padding-top: 0; }
    .footer { flex-direction: column; }
    .form-grid { grid-template-columns: 1fr; }
    .full-width { grid-column: auto; }
    .path-input-row { flex-direction: column; }
    .path-input-row .path-button { width: 100%; }
    .modal { padding: 20px; }
  }
  /* Quick launch and executable setup feedback */
  .game-readiness {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    color: var(--dd-muted, #A4B2B8);
    font-size: 9px;
    line-height: 1.35;
  }
  .readiness-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: #D9A45B;
    box-shadow: 0 0 0 3px #D9A45B18;
  }
  .game-readiness.ready .readiness-dot {
    background: var(--dd-accent, #62E6C2);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--dd-accent, #62E6C2) 16%, transparent);
  }
  .play-button.play-button-ready {
    color: #10231E;
    background: var(--dd-accent, #62E6C2);
    border-color: color-mix(in srgb, var(--dd-accent, #62E6C2) 72%, white);
    box-shadow: 0 5px 14px color-mix(in srgb, var(--dd-accent, #62E6C2) 13%, transparent);
  }
  .play-button.play-button-ready span { color: #10231E; }
  .play-button.play-button-ready:hover:not(:disabled) {
    filter: brightness(1.06);
    border-color: var(--dd-accent, #62E6C2);
  }
  .play-button.play-button-configure { color: var(--dd-text, #F0F4F5); }
  .play-button:disabled { opacity: .65; cursor: progress; transform: none; }
  .executable-info {
    display: block;
    margin-top: 8px;
    padding: 9px 10px;
    border: 1px solid color-mix(in srgb, var(--dd-accent, #62E6C2) 20%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--dd-accent, #62E6C2) 6%, transparent);
    color: var(--dd-text, #F0F4F5);
    line-height: 1.5;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
  }


  /* ================================================================
     DEXDECK THEMES — Claro / Oscuro / Liquid Glass
     The palette is controlled through data-theme on <html> and app-shell.
     ================================================================ */
  :global(html) {
    --dd-app-bg: #121619;
    --dd-sidebar-bg: #171e22;
    --dd-surface: #1c2328;
    --dd-surface-raised: #29343b;
    --dd-card-bg: #1c2328;
    --dd-header-bg: rgba(18, 22, 25, 0.96);
    --dd-text: #f0f4f5;
    --dd-muted: #a4b2b8;
    --dd-border: rgba(164, 178, 184, 0.15);
    --dd-accent: #62e6c2;
    --dd-accent-hover: #82efd3;
    --dd-accent-text: #10231e;
    --dd-control-bg: rgba(8, 14, 15, 0.48);
    --dd-soft: rgba(255, 255, 255, 0.045);
    --dd-blur: none;
    --dd-modal-bg: linear-gradient(145deg, #202a2f, #151c20);
    min-width: 360px;
    background: transparent;
    color-scheme: dark;
  }

  :global(html[data-theme='light']) {
    --dd-app-bg: #e9efec;
    --dd-sidebar-bg: #f6f9f7;
    --dd-surface: #ffffff;
    --dd-surface-raised: #e0e9e4;
    --dd-card-bg: #fbfdfc;
    --dd-header-bg: rgba(246, 249, 247, 0.97);
    --dd-text: #24352e;
    --dd-muted: #5d7168;
    --dd-border: rgba(36, 64, 51, 0.16);
    --dd-accent: #286b5a;
    --dd-accent-hover: #1e594a;
    --dd-accent-text: #ffffff;
    --dd-control-bg: #ffffff;
    --dd-soft: rgba(35, 58, 47, 0.045);
    --dd-blur: none;
    --dd-modal-bg: linear-gradient(145deg, #ffffff, #edf3ef);
    color-scheme: light;
  }

  :global(html[data-theme='glass']) {
  /* Neutral charcoal base: no purple/blue colour wash. */
  --dd-app-bg: rgba(10, 14, 17, 0.46);
  --dd-sidebar-bg: rgba(22, 28, 31, 0.70);
  --dd-surface: rgba(232, 239, 236, 0.075);
  --dd-surface-raised: rgba(241, 247, 244, 0.13);
  --dd-card-bg: rgba(22, 29, 32, 0.52);
  --dd-header-bg: rgba(17, 23, 26, 0.66);

  --dd-text: #f3f7f5;
  --dd-muted: #c2ceca;
  --dd-border: rgba(239, 247, 243, 0.19);
  --dd-accent: #a6e7d5;
  --dd-accent-hover: #c0f2e5;
  --dd-accent-text: #10231e;
  --dd-control-bg: rgba(12, 18, 20, 0.48);
  --dd-soft: rgba(237, 245, 241, 0.075);

  --dd-blur: blur(26px) saturate(138%);
  --dd-modal-bg: linear-gradient(
    145deg,
    rgba(48, 58, 58, 0.88),
    rgba(20, 27, 29, 0.92)
  );
  color-scheme: dark;
}

  :global(body) {
    margin: 0;
    background: transparent !important;
    color: var(--dd-text);
  }

  :global(textarea), :global(select), :global(input) {
    color-scheme: inherit;
  }

  .app-shell {
    min-height: 100vh;
    background: var(--dd-app-bg) !important;
    color: var(--dd-text);
    transition: background-color 180ms ease, color 180ms ease;
  }

  .sidebar {
    background: var(--dd-sidebar-bg) !important;
    border-color: var(--dd-border) !important;
    backdrop-filter: var(--dd-blur);
    -webkit-backdrop-filter: var(--dd-blur);
  }

  .topbar {
    background: var(--dd-header-bg) !important;
    border-color: var(--dd-border) !important;
    backdrop-filter: var(--dd-blur);
    -webkit-backdrop-filter: var(--dd-blur);
  }

  .app-shell .brand-name,
  .app-shell h1,
  .app-shell h2,
  .app-shell h3,
  .app-shell .stat-value,
  .app-shell .game-title-copy h3,
  .app-shell .profile-name,
  .app-shell .setting-copy strong,
  .modal h2 {
    color: var(--dd-text);
  }

  .app-shell .brand-caption,
  .app-shell .sidebar-label,
  .app-shell .section-kicker,
  .app-shell .eyebrow,
  .app-shell .intro,
  .app-shell .breadcrumb,
  .app-shell .breadcrumb-current,
  .app-shell .stat-label,
  .app-shell .stat-value span,
  .app-shell .setting-copy p,
  .app-shell .profile-caption,
  .app-shell .runner-description,
  .app-shell .detail-text,
  .app-shell .game-version,
  .app-shell .game-title-copy p {
    color: var(--dd-muted);
  }

  .app-shell .nav-item { color: var(--dd-muted); }
  .app-shell .nav-item:hover { color: var(--dd-text); background: var(--dd-soft); }
  .app-shell .nav-item.active {
    color: var(--dd-text);
    background: var(--dd-soft);
    border-color: var(--dd-border);
    box-shadow: inset 2px 0 var(--dd-accent);
  }

  .app-shell .nav-count,
  .app-shell .heading-count,
  .app-shell .game-tag,
  .app-shell .setting-value {
    color: var(--dd-muted);
    background: var(--dd-soft);
    border-color: var(--dd-border);
  }

  .app-shell .runner-card,
  .app-shell .stat-card,
  .app-shell .game-card,
  .app-shell .search-box,
  .app-shell .settings-panel,
  .app-shell .setting-row,
  .app-shell .placeholder-panel,
  .app-shell .tip-banner,
  .app-shell .empty-state,
  .app-shell .notice {
    border-color: var(--dd-border);
    backdrop-filter: var(--dd-blur);
    -webkit-backdrop-filter: var(--dd-blur);
  }

  .app-shell .runner-card,
  .app-shell .stat-card,
  .app-shell .settings-panel,
  .app-shell .setting-row,
  .app-shell .placeholder-panel,
  .app-shell .empty-state {
    background: var(--dd-surface);
  }

  .app-shell .game-card { background: var(--dd-card-bg) !important; }
  .app-shell .search-box { background: var(--dd-control-bg); }
  .app-shell .search-box input { color: var(--dd-text); }
  .app-shell .search-box input::placeholder { color: var(--dd-muted); }
  .app-shell .game-info { color: var(--dd-text); }
  .app-shell .game-menu { color: var(--dd-muted); }
  .app-shell .game-menu:hover { color: var(--dd-text); }
  .app-shell .play-button,
  .app-shell .secondary-button,
  .app-shell .icon-button {
    color: var(--dd-text);
    background: var(--dd-soft);
    border-color: var(--dd-border);
  }
  .app-shell .play-button:hover,
  .app-shell .secondary-button:hover,
  .app-shell .icon-button:hover { background: var(--dd-surface-raised); }

  .app-shell .primary-button {
    color: var(--dd-accent-text) !important;
    border-color: transparent;
    background: var(--dd-accent) !important;
    box-shadow: 0 5px 16px rgba(0, 0, 0, 0.13);
  }
  .app-shell .primary-button:hover:not(:disabled) { background: var(--dd-accent-hover) !important; }
  .app-shell .primary-button > span { color: inherit; }
  .app-shell .nav-item.active { border-color: var(--dd-border); }
  .app-shell .setting-icon,
  .app-shell .stat-icon,
  .app-shell .tip-symbol,
  .app-shell .placeholder-icon {
    color: var(--dd-accent);
    background: color-mix(in srgb, var(--dd-accent) 12%, transparent);
    border-color: var(--dd-border);
  }
  .app-shell .eyebrow-line,
  .app-shell .footer-dot,
  .app-shell .local-badge .status-indicator {
    background: var(--dd-accent);
    box-shadow: 0 0 9px color-mix(in srgb, var(--dd-accent) 28%, transparent);
  }
  .app-shell .tip-banner { background: color-mix(in srgb, var(--dd-accent) 5%, var(--dd-surface)); }
  .app-shell .tip-action { color: var(--dd-accent); }
  .app-shell .notice {
    color: var(--dd-text);
    background: color-mix(in srgb, var(--dd-accent) 8%, var(--dd-surface));
  }
  .app-shell .notice > span { color: var(--dd-accent); }
  .app-shell .play-button span { color: var(--dd-accent); }
  .app-shell .footer { border-color: var(--dd-border); color: var(--dd-muted); }
  .app-shell .footer-version { color: var(--dd-muted); }

  .app-shell .theme-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }
  .app-shell .setting-row-theme { align-items: flex-start; }
  .app-shell .setting-row-theme .setting-copy { min-width: 0; }
  .app-shell .theme-option {
    display: grid;
    gap: 7px;
    min-width: 0;
    padding: 10px;
    text-align: left;
    border: 1px solid var(--dd-border);
    border-radius: 11px;
    color: var(--dd-text);
    background: var(--dd-soft);
    cursor: pointer;
    transition: border-color 160ms, background 160ms, transform 160ms;
  }
  .app-shell .theme-option:hover { transform: translateY(-1px); background: var(--dd-surface-raised); }
  .app-shell .theme-option.active { border-color: var(--dd-accent); box-shadow: inset 0 0 0 1px var(--dd-accent); }
  .app-shell .theme-preview {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    height: 48px;
    padding: 6px;
    border: 1px solid var(--dd-border);
    border-radius: 7px;
    overflow: hidden;
  }
  .app-shell .theme-preview i { display: block; height: 34px; border-radius: 4px; flex: 1; }
  .app-shell .theme-preview-light { background: #e9efec; }
  .app-shell .theme-preview-light i { background: #ffffff; border: 1px solid #d4dfd9; }
  .app-shell .theme-preview-light i:first-child { background: #286b5a; }
  .app-shell .theme-preview-dark { background: #121619; }
  .app-shell .theme-preview-dark i { background: #1c2328; border: 1px solid #29343b; }
  .app-shell .theme-preview-dark i:first-child { background: #62e6c2; }
  .app-shell .theme-preview-glass { background: linear-gradient(135deg, #5f9185, #233b38 48%, #acc9c0); }
  .app-shell .theme-preview-glass i { background: rgba(15, 29, 27, 0.64); border: 1px solid rgba(255,255,255,.38); }
  .app-shell .theme-option-label { font-size: 11px; font-weight: 750; }
  .app-shell .theme-option-description { color: var(--dd-muted); font-size: 9px; line-height: 1.45; }
  .app-shell .theme-hint { margin-top: 12px !important; font-size: 10px !important; line-height: 1.6; }

  .modal {
    color: var(--dd-text) !important;
    background: var(--dd-modal-bg) !important;
    border-color: var(--dd-border) !important;
    backdrop-filter: var(--dd-blur);
    -webkit-backdrop-filter: var(--dd-blur);
  }
  .modal h2, .modal .detail-section h3 { color: var(--dd-text); }
  .modal .modal-description,
  .modal .detail-text,
  .modal .detail-field > span { color: var(--dd-muted); }
  .modal .detail-field p, .modal .detail-field a { color: var(--dd-text); }
  .modal .detail-field a { color: var(--dd-accent); }
  .modal .modal-actions { border-color: var(--dd-border); }
  .modal .form-label { color: var(--dd-text); }
  .modal .form-label input,
  .modal .form-label textarea,
  .modal .form-label select {
    color: var(--dd-text);
    background: var(--dd-control-bg);
    border-color: var(--dd-border);
  }
  .modal .form-label input::placeholder,
  .modal .form-label textarea::placeholder { color: var(--dd-muted); }
  .modal .path-button { color: var(--dd-text); background: var(--dd-soft); border-color: var(--dd-border); }
  .modal .path-button:hover { background: var(--dd-surface-raised); }
  .modal .modal-close { color: var(--dd-text); background: var(--dd-soft); border-color: var(--dd-border); }
  .modal::backdrop { background: rgba(0, 0, 0, 0.46); }

  :global(html[data-theme='light']) .modal::backdrop { background: rgba(20, 35, 28, 0.28); }
  :global(html[data-theme='light']) .modal .modal-icon { color: var(--dd-accent); }
  :global(html[data-theme='light']) .modal .form-notice { color: #a32136; }
  :global(html[data-theme='light']) .app-shell .stat-icon.yellow { color: #8b6212; }

  @media (max-width: 760px) {
    .app-shell .theme-options { grid-template-columns: 1fr; }
    .app-shell .theme-option { grid-template-columns: 76px minmax(0, 1fr); align-items: center; column-gap: 10px; }
    .app-shell .theme-preview { grid-row: span 2; height: 42px; }
    .app-shell .theme-preview i { height: 28px; }
    .app-shell .theme-option-label, .app-shell .theme-option-description { grid-column: 2; }
  }



  /* ================================================================
     DEXDECK MOTION & UX POLISH
     UI-only enhancements: no changes to launch logic, themes, Tauri,
     transparency, or persistence.
     ================================================================ */
  :global(html) { scroll-behavior: smooth; }

  .app-shell {
    animation: dd-shell-enter 360ms cubic-bezier(.2,.75,.25,1) both;
  }

  .page-content > .welcome-row,
  .page-content > .subpage-header,
  .page-content > .stats-row,
  .page-content > .library-section,
  .page-content > .placeholder-panel,
  .page-content > .settings-panel,
  .page-content > .tip-banner,
  .page-content > .notice {
    animation: dd-section-enter 420ms cubic-bezier(.2,.75,.25,1) both;
  }
  .page-content > .welcome-row { animation-delay: 25ms; }
  .page-content > .subpage-header { animation-delay: 25ms; }
  .page-content > .stats-row { animation-delay: 75ms; }
  .page-content > .library-section { animation-delay: 115ms; }
  .page-content > .placeholder-panel,
  .page-content > .settings-panel { animation-delay: 90ms; }
  .page-content > .tip-banner { animation-delay: 170ms; }
  .page-content > .notice { animation-delay: 40ms; }

  .nav-item {
    position: relative;
    isolation: isolate;
    transition: background 180ms ease, color 180ms ease, border-color 180ms ease, translate 180ms ease;
  }
  .nav-item:hover { translate: 2px 0; }
  .nav-item .nav-icon { transition: scale 180ms ease, color 180ms ease; }
  .nav-item:hover .nav-icon { scale: 1.08; }
  .nav-item.active .nav-icon { color: var(--dd-accent, #62e6c2); }

  .brand-mark, .profile-avatar, .setting-icon, .stat-icon, .placeholder-icon {
    transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
  }
  .brand:hover .brand-mark { transform: rotate(-5deg) translateY(-1px); box-shadow: inset 0 1px #ffffff20, 0 8px 22px #0003; }
  .setting-row { transition: background-color 200ms ease, border-color 200ms ease; }
  .setting-row:hover { background: color-mix(in srgb, var(--dd-accent, #62e6c2) 3%, transparent); }

  .stat-card {
    transition: transform 220ms cubic-bezier(.2,.75,.25,1), box-shadow 220ms ease, border-color 220ms ease;
  }
  .stat-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--dd-accent, #62e6c2) 28%, var(--dd-border, #ffffff16)); box-shadow: 0 12px 28px #00000012, inset 0 1px #ffffff0b; }
  .stat-card:hover .stat-icon { transform: scale(1.06); }

  .game-card {
    animation: dd-card-enter 440ms cubic-bezier(.2,.75,.25,1) both;
    transition: transform 220ms cubic-bezier(.2,.75,.25,1), border-color 220ms ease, box-shadow 220ms ease, background-color 220ms ease;
    will-change: transform;
  }
  .game-card:nth-child(1) { animation-delay: 40ms; }
  .game-card:nth-child(2) { animation-delay: 75ms; }
  .game-card:nth-child(3) { animation-delay: 110ms; }
  .game-card:nth-child(4) { animation-delay: 145ms; }
  .game-card:nth-child(5) { animation-delay: 180ms; }
  .game-card:nth-child(6) { animation-delay: 215ms; }
  .game-card:nth-child(n+7) { animation-delay: 245ms; }
  .game-card:focus-within { border-color: color-mix(in srgb, var(--dd-accent, #62e6c2) 48%, var(--dd-border, #ffffff18)); }
  .game-art { overflow: hidden; }
  .game-art .cover-image { transition: transform 600ms cubic-bezier(.2,.75,.25,1), filter 600ms ease; }
  .game-card:hover .cover-image { transform: scale(1.045); filter: saturate(1.06); }
  .game-card:hover .art-orbit { opacity: .9; }
  .art-orbit { transition: opacity 240ms ease; }
  .game-title-copy h3 { transition: color 180ms ease; }
  .game-card:hover .game-title-copy h3 { color: var(--dd-accent, #62e6c2); }
  .game-menu { opacity: .72; transition: opacity 180ms ease, color 180ms ease, background 180ms ease, transform 180ms ease; }
  .game-title-row:hover .game-menu, .game-menu:focus-visible { opacity: 1; }
  .game-menu:hover { transform: scale(1.08); }

  .primary-button, .secondary-button, .play-button, .path-button, .icon-button, .theme-option, .modal-close, .tip-action {
    transition: transform 170ms cubic-bezier(.2,.75,.25,1), color 170ms ease, background-color 170ms ease, border-color 170ms ease, box-shadow 170ms ease;
  }
  .primary-button:active:not(:disabled), .secondary-button:active, .play-button:active, .path-button:active, .icon-button:active, .theme-option:active, .modal-close:active { transform: scale(.975); }
  .play-button:hover { transform: translateY(-1px); }
  .play-button span { transition: transform 180ms ease, color 180ms ease; }
  .play-button:hover span { transform: translateX(2px); }
  .primary-button:focus-visible, .secondary-button:focus-visible, .play-button:focus-visible, .theme-option:focus-visible, .modal-close:focus-visible, .game-menu:focus-visible, .icon-button:focus-visible, .nav-item:focus-visible {
    outline: 2px solid var(--dd-accent, #62e6c2);
    outline-offset: 3px;
  }

  .search-box {
    transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
  }
  .search-box:focus-within {
    border-color: color-mix(in srgb, var(--dd-accent, #62e6c2) 58%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--dd-accent, #62e6c2) 9%, transparent);
  }
  .filter-label { transition: color 180ms ease; }
  .search-box:focus-within + .filter-label { color: var(--dd-text, #f0f4f5); }

  .empty-state, .placeholder-panel, .settings-panel, .runner-card, .tip-banner, .notice {
    transition: border-color 220ms ease, box-shadow 220ms ease, background-color 220ms ease;
  }
  .notice { animation: dd-section-enter 280ms cubic-bezier(.2,.75,.25,1) both; }
  .notice button { border-radius: 6px; transition: background-color 150ms ease, color 150ms ease; }
  .notice button:hover { background: var(--dd-soft, #ffffff10); color: var(--dd-text, #fff); }

  .orb { animation: dd-orb-float 6s ease-in-out infinite; }
  .ring-one { animation: dd-ring-turn 30s linear infinite; }
  .ring-two { animation: dd-ring-turn 42s linear infinite reverse; }
  .orb-spark { animation: dd-spark 3.8s ease-in-out infinite; }
  .spark-two { animation-delay: -1.2s; }
  .spark-three { animation-delay: -2.4s; }

  .modal { animation: dd-modal-enter 220ms cubic-bezier(.2,.8,.2,1) both; }
  .modal-close:hover { transform: rotate(90deg); }
  .modal .form-label input, .modal .form-label textarea, .modal .form-label select {
    transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
  }
  .modal .form-label input:focus, .modal .form-label textarea:focus, .modal .form-label select:focus {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--dd-accent, #62e6c2) 10%, transparent);
  }
  .detail-cover { transition: transform 350ms ease, border-color 220ms ease; }
  .detail-cover:hover { transform: scale(1.008); border-color: color-mix(in srgb, var(--dd-accent, #62e6c2) 30%, var(--dd-border, #ffffff18)); }

  @keyframes dd-shell-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes dd-section-enter {
    from { opacity: 0; translate: 0 9px; }
    to { opacity: 1; translate: 0 0; }
  }
  @keyframes dd-card-enter {
    from { opacity: 0; translate: 0 13px; }
    to { opacity: 1; translate: 0 0; }
  }
  @keyframes dd-modal-enter {
    from { opacity: 0; translate: 0 10px; scale: .985; }
    to { opacity: 1; translate: 0 0; scale: 1; }
  }
  @keyframes dd-orb-float {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -5px; }
  }
  @keyframes dd-ring-turn { to { rotate: 1turn; } }
  @keyframes dd-spark {
    0%, 100% { opacity: .65; translate: 0 0; }
    50% { opacity: 1; translate: 0 -5px; }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html) { scroll-behavior: auto !important; }
    .app-shell, .page-content > *, .game-card, .orb, .orb-ring, .orb-spark, .modal {
      animation: none !important;
    }
    *, *::before, *::after {
      transition-duration: .01ms !important;
      scroll-behavior: auto !important;
    }
  }



  /* DEXDECK UI IMPROVEMENTS v4 */
  .primary-button, .secondary-button, .play-button, .nav-item, .icon-button,
  .tip-action, .modal-close, .game-menu, .danger-button {
    transition: transform 180ms cubic-bezier(.2,.75,.25,1), filter 180ms ease,
      box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, color 180ms ease;
  }
  .secondary-button:hover, .danger-button:hover, .play-button:hover { transform: translateY(-2px); filter: brightness(1.1); }
  .nav-item:hover { transform: translateX(3px); }
  .icon-button:hover { transform: rotate(8deg) scale(1.06); }
  .primary-button:active, .secondary-button:active, .play-button:active, .nav-item:active { transform: scale(.98); }
  .brand-name, h1, .section-heading h2, .subpage-header h1, .game-title-copy h3,
  .art-title strong, .tip-banner strong {
    animation: dexdeck-text-rise 520ms cubic-bezier(.2,.75,.25,1) both;
  }
  .game-title-copy h3, .art-title strong { transition: color 200ms ease, letter-spacing 200ms ease, text-shadow 200ms ease; }
  .game-card:hover .game-title-copy h3 { color: #fff; text-shadow: 0 0 15px #f8717129; }
  .game-card:hover .art-title strong { letter-spacing: -.35px; text-shadow: 0 2px 14px #0008, 0 0 16px #ffffff20; }
  .art-emblem { transition: transform 260ms cubic-bezier(.2,.75,.25,1), text-shadow 260ms ease; }
  .game-card:hover .art-emblem { transform: translate(-50%, -50%) scale(1.12) rotate(-5deg); text-shadow: 0 0 38px #ffffff70; }
  @keyframes dexdeck-text-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }

  .game-details-modal {
    width: min(calc(100% - 32px), 680px);
    max-width: 680px;
    max-height: min(88vh, 760px);
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
    border-radius: 19px;
  }
  .game-details-modal::backdrop { background: #050914c9; backdrop-filter: blur(13px); }
  .game-details-modal .modal-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .game-details-hero { position: relative; isolation: isolate; min-height: 240px; padding: 24px; display: flex; flex-direction: column; justify-content: end; overflow: hidden; border-bottom: 1px solid #ffffff14; }
  .game-details-hero .art-grid { z-index: -1; }
  .game-details-hero .art-glow { width: 220px; height: 220px; top: 0; left: 68%; opacity: 1; }
  .game-details-hero .art-orbit { width: 240px; height: 90px; left: 70%; top: 40%; }
  .game-details-hero .orbit-b { width: 190px; height: 130px; }
  .game-details-hero .art-emblem { top: 42%; left: 70%; font-size: 110px; opacity: .58; }
  .details-close { position: absolute; top: 16px; right: 16px; z-index: 3; background: #07101ecc; backdrop-filter: blur(8px); }
  .details-hero-copy { position: relative; z-index: 2; text-shadow: 0 2px 15px #0008; }
  .details-hero-copy > span { color: #ffffffb7; font-size: 9px; font-weight: 750; letter-spacing: 1.5px; }
  .details-hero-copy h2 { max-width: 90%; margin: 10px 0 5px; overflow-wrap: anywhere; font-size: clamp(25px, 4vw, 36px); line-height: 1.1; letter-spacing: -1.2px; }
  .details-hero-copy p { margin: 0; color: #ffffffb7; font-size: 12px; }
  .game-details-body { padding: 24px; }
  .details-meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 15px; }
  .details-meta-item { min-width: 0; padding: 13px; border: 1px solid #ffffff12; border-radius: 10px; background: #ffffff06; }
  .details-meta-item span, .details-meta-item strong { display: block; overflow-wrap: anywhere; }
  .details-meta-item span { margin-bottom: 7px; color: #8291a9; font-size: 10px; }
  .details-meta-item strong { color: #e6edf8; font-size: 12px; }
  .details-note { margin: 17px 0 0; color: #9aa9bf; font-size: 11px; line-height: 1.8; }
  .game-details-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px solid #ffffff10; }
  .game-details-actions .primary-button { flex: 1; min-width: 180px; }
  .game-details-actions .secondary-button { min-height: 37px; }
  .remove-confirm-content { padding: 25px; }
  .remove-icon { color: #fecaca; background: #ef444422; }
  .danger-button { min-height: 37px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border: 1px solid #fb71854d; border-radius: 9px; background: linear-gradient(130deg, #ef4444, #be123c); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; }
  .game-menu { flex: 0 0 30px; display: inline-grid; place-items: center; width: 30px; height: 28px; padding: 0; border: 1px solid transparent; border-radius: 7px; background: transparent; color: #8291a8; font-size: 19px; line-height: 1; cursor: pointer; }
  .game-menu:hover { color: #fff; background: #ffffff10; border-color: #ffffff19; transform: translateY(-1px); }
  .game-menu:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }
  .game-details-modal .modal-description { margin-bottom: 20px; }
  @media (max-width: 520px) {
    .game-details-hero { min-height: 205px; padding: 19px; }
    .game-details-body, .remove-confirm-content { padding: 19px; }
    .details-meta-grid { grid-template-columns: 1fr; }
    .details-meta-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .details-meta-item span { margin: 0; }
    .game-details-actions { flex-direction: column; }
    .game-details-actions .primary-button { min-width: 0; }
  }



  /* DEXDECK AUTOFILL AND CONFIGURATION V6 CSS */
  .game-configure-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    margin-top: 8px;
    padding: 0 12px;
    font-size: 10px;
    transition: transform 180ms ease, filter 180ms ease, border-color 180ms ease;
  }
  .game-configure-button:hover { transform: translateY(-1px); filter: brightness(1.08); }
  .game-configure-button:active { transform: scale(.99); }

  /* DEXDECK LIQUID GLASS REFINEMENT v2 — PEARL DROPLETS */

/* The full window acts as a frosted, neutral veil over the desktop. */
.app-shell[data-theme='glass'] {
  position: relative;
  isolation: isolate;
  background: var(--dd-app-bg) !important;
  backdrop-filter: blur(30px) saturate(142%);
  -webkit-backdrop-filter: blur(30px) saturate(142%);
}

/* A faint pearly light falloff, like light passing through thick glass. */
.app-shell[data-theme='glass']::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 12% 0%, rgba(255, 255, 255, 0.105), transparent 38%),
    radial-gradient(ellipse at 88% 100%, rgba(218, 235, 229, 0.055), transparent 42%);
}

/* Larger surfaces: smoky pearl glass, with a soft inner highlight. */
.app-shell[data-theme='glass'] .runner-card,
.app-shell[data-theme='glass'] .stat-card,
.app-shell[data-theme='glass'] .game-card,
.app-shell[data-theme='glass'] .search-box,
.app-shell[data-theme='glass'] .settings-panel,
.app-shell[data-theme='glass'] .setting-row,
.app-shell[data-theme='glass'] .placeholder-panel,
.app-shell[data-theme='glass'] .tip-banner,
.app-shell[data-theme='glass'] .empty-state,
.app-shell[data-theme='glass'] .notice {
  border-color: rgba(238, 247, 243, 0.20);
  background: linear-gradient(
    145deg,
    rgba(235, 243, 239, 0.105),
    rgba(172, 188, 182, 0.045) 46%,
    rgba(12, 19, 21, 0.34)
  );
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.17),
    inset 0 -1px rgba(0, 0, 0, 0.12),
    0 10px 28px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(22px) saturate(142%);
  -webkit-backdrop-filter: blur(22px) saturate(142%);
}

.app-shell[data-theme='glass'] .game-card {
  background: linear-gradient(
    145deg,
    rgba(225, 235, 231, 0.12),
    rgba(125, 143, 137, 0.045) 48%,
    rgba(10, 16, 18, 0.42)
  ) !important;
}

/* Frosted controls: neutral white-silver, not coloured glass. */
.app-shell[data-theme='glass'] .secondary-button,
.app-shell[data-theme='glass'] .icon-button,
.app-shell[data-theme='glass'] .modal-close,
.app-shell[data-theme='glass'] .game-menu,
.app-shell[data-theme='glass'] .path-button,
.app-shell[data-theme='glass'] .theme-option {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: #f0f5f2;
  background: linear-gradient(
    145deg,
    rgba(250, 255, 252, 0.17),
    rgba(203, 216, 210, 0.075) 52%,
    rgba(20, 28, 29, 0.16)
  );
  border: 1px solid rgba(246, 252, 249, 0.25);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.26),
    inset 0 -1px rgba(0, 0, 0, 0.09),
    0 6px 18px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(20px) saturate(145%);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
}

/* Small specular spots create the rounded, liquid-droplet highlight. */
.app-shell[data-theme='glass'] .secondary-button::before,
.app-shell[data-theme='glass'] .icon-button::before,
.app-shell[data-theme='glass'] .primary-button::before,
.app-shell[data-theme='glass'] .play-button::before,
.app-shell[data-theme='glass'] .theme-option::before,
.app-shell[data-theme='glass'] .enc-primary-button::before,
.app-shell[data-theme='glass'] .enc-secondary-button::before {
  content: "";
  position: absolute;
  top: -11px;
  left: 12%;
  width: 43%;
  height: 24px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(ellipse, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.07) 48%, transparent 76%);
  filter: blur(5px);
  opacity: 0.9;
}

.app-shell[data-theme='glass'] .primary-button,
.app-shell[data-theme='glass'] .play-button.play-button-ready {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: #f3fbf7 !important;
  background: linear-gradient(
    145deg,
    rgba(231, 246, 239, 0.26),
    rgba(157, 190, 177, 0.13) 55%,
    rgba(23, 43, 37, 0.27)
  ) !important;
  border: 1px solid rgba(235, 255, 246, 0.34);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.32),
    inset 0 -1px rgba(0, 0, 0, 0.10),
    0 7px 22px rgba(0, 0, 0, 0.17);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}

.app-shell[data-theme='glass'] .primary-button:hover:not(:disabled),
.app-shell[data-theme='glass'] .secondary-button:hover,
.app-shell[data-theme='glass'] .icon-button:hover,
.app-shell[data-theme='glass'] .play-button:hover:not(:disabled),
.app-shell[data-theme='glass'] .theme-option:hover {
  filter: brightness(1.13);
  border-color: rgba(255, 255, 255, 0.43);
}

.app-shell[data-theme='glass'] .danger-button {
  background: linear-gradient(145deg, rgba(231, 105, 112, 0.62), rgba(118, 38, 49, 0.48));
  border-color: rgba(255, 220, 220, 0.28);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.23), 0 6px 18px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* Navigation: subtle translucent pills and a restrained mint active state. */
.app-shell[data-theme='glass'] .nav-item {
  border-color: transparent;
}
.app-shell[data-theme='glass'] .nav-item:hover {
  background: linear-gradient(110deg, rgba(255,255,255,0.105), rgba(220,232,226,0.035));
  border-color: rgba(255,255,255,0.10);
}
.app-shell[data-theme='glass'] .nav-item.active {
  background: linear-gradient(110deg, rgba(222, 242, 234, 0.16), rgba(255,255,255,0.045));
  border-color: rgba(239, 250, 245, 0.20);
  box-shadow:
    inset 3px 0 rgba(166, 231, 213, 0.90),
    inset 0 1px rgba(255,255,255,0.18),
    0 5px 18px rgba(0,0,0,0.10);
}
.app-shell[data-theme='glass'] .nav-item.active .nav-icon {
  color: #c6f1e3;
}

.app-shell[data-theme='glass'] .search-box:focus-within {
  border-color: rgba(226, 246, 237, 0.43);
  box-shadow: 0 0 0 3px rgba(226, 246, 237, 0.085), inset 0 1px rgba(255,255,255,0.16);
}

/* Encyclopedia uses the same pearl-grey glass material. */
:global(.app-shell[data-theme='glass'] .encyclopedia) {
  --enc-panel: rgba(229, 239, 234, 0.085);
  --enc-panel-strong: rgba(238, 246, 242, 0.14);
  --enc-border: rgba(239, 247, 243, 0.20);
  --enc-muted: #c2ceca;
  --enc-input: rgba(12, 18, 20, 0.50);
}

:global(.app-shell[data-theme='glass'] .enc-game-card),
:global(.app-shell[data-theme='glass'] .enc-stat),
:global(.app-shell[data-theme='glass'] .enc-empty-panel),
:global(.app-shell[data-theme='glass'] .enc-info-panel),
:global(.app-shell[data-theme='glass'] .enc-search-wrap) {
  border-color: rgba(239, 247, 243, 0.20);
  background: linear-gradient(145deg, rgba(237,245,241,0.12), rgba(15,23,24,0.30));
  box-shadow: inset 0 1px rgba(255,255,255,0.16), 0 8px 24px rgba(0,0,0,0.10);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
}

:global(.app-shell[data-theme='glass'] .enc-primary-button),
:global(.app-shell[data-theme='glass'] .enc-secondary-button),
:global(.app-shell[data-theme='glass'] .enc-close-button) {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: #f0f7f3 !important;
  background: linear-gradient(145deg, rgba(244,250,247,0.19), rgba(161,182,173,0.08) 58%, rgba(17,29,27,0.22)) !important;
  border: 1px solid rgba(245,252,248,0.28);
  box-shadow: inset 0 1px rgba(255,255,255,0.25), 0 6px 18px rgba(0,0,0,0.13);
  backdrop-filter: blur(20px) saturate(145%);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
}

:global(.app-shell[data-theme='glass'] .enc-tabs button.active),
:global(.app-shell[data-theme='glass'] .enc-filter-row button.active) {
  background: rgba(220, 242, 232, 0.15);
  border-color: rgba(230, 249, 240, 0.30);
  box-shadow: inset 0 1px rgba(255,255,255,0.17);
}

:global(.app-shell[data-theme='glass'] .enc-modal) {
  color: #f0f6f2;
  background: linear-gradient(145deg, rgba(55,65,63,0.91), rgba(20,27,28,0.94));
  border-color: rgba(239,247,243,0.25);
  box-shadow: inset 0 1px rgba(255,255,255,0.19), 0 24px 80px rgba(0,0,0,0.42);
  backdrop-filter: blur(30px) saturate(140%);
  -webkit-backdrop-filter: blur(30px) saturate(140%);
}

@media (prefers-reduced-transparency: reduce) {
  .app-shell[data-theme='glass'] {
    --dd-app-bg: #171e20;
    --dd-sidebar-bg: #202829;
    --dd-surface: #293231;
    --dd-card-bg: #232c2c;
    --dd-header-bg: #1d2526;
    --dd-blur: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}



  .app-shell .exit-button {
    margin-top: 12px;
    color: #e58b91;
    border-color: rgba(229, 139, 145, 0.18);
  }
  .app-shell .exit-button:hover {
    color: #fff;
    background: rgba(190, 48, 65, 0.16);
    border-color: rgba(229, 139, 145, 0.38);
  }
</style>
