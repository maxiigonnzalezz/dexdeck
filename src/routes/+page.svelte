<script lang="ts">
  import '../app.css';
  import Encyclopedia from '$lib/components/Encyclopedia.svelte';
  import UpdatesView from '$lib/components/UpdatesView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import type {
    ExecutableMetadata,
    InstallationInfo,
    SystemInfo,
    ThemeName
  } from '$lib/app-types';
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
  import { open } from '@tauri-apps/plugin-dialog';
  import { attachConsole, info } from '@tauri-apps/plugin-log';
  import { onMount } from 'svelte';

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

  // DEXDECK MULTIPLATFORM UI v1
  let newType = $state('Fangame');
  let newStatus = $state('En biblioteca');
  let newColor = $state('blue');
  let newSymbol = $state('✦');

  let notice = $state('');
  let formError = $state('');
  let saving = $state(false);
  let games = $state<Game[]>([]);

  let theme = $state<ThemeName>('dark');
  let launchingGameId = $state<number | null>(null);
  let systemInfo = $state<SystemInfo | null>(null);

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
    return () => {
      detachLogConsole?.();
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
        <UpdatesView
          {appVersion}
          {installationInfo}
          onBack={() => navigate('Biblioteca')}
        />
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


<dialog
  bind:this={uninstallDialog}
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
