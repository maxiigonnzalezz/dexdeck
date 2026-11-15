/**
 * Utilidades puras para adivinar el nombre, la versión y las rutas de un juego
 * a partir del ejecutable elegido. No tocan estado ni Tauri: se pueden probar
 * de forma aislada.
 */

export function cleanGameNameCandidate(raw: string): string {
  return raw
    .replace(/\.(?:exe|bat|cmd|lnk|app|sh)$/i, '')
    .replace(
      /(?:[-_. ]+(?:win32|win64|windowsnoeditor|linuxshipping|linux|windows|macos|mac|x64|x86|64bit|32bit|shipping|development|debug|release|noeditor|launcher|bootstrapper))+$/gi,
      ''
    )
    .replace(/(?:[-_. ]+v?\d+(?:\.\d+){1,4})$/i, '')
    .replace(/\s*\((?:win32|win64|shipping|launcher|game)\)$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGenericExecutableName(value: string): boolean {
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

/**
 * La carpeta del juego tiene prioridad absoluta sobre el nombre y los metadatos
 * del ejecutable.
 */
export function parseGameFolderLabel(raw: string): { name: string; version: string } {
  const label = raw.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!label) return { name: '', version: '' };

  // Subcarpeta de versión independiente: "v2.0", "Version 1.3" o "2.04".
  const versionOnly = label.match(
    /^(?:(?:version|ver|v)[\s._-]*)?(\d+(?:\.\d+){0,3}(?:[-_. ]?(?:alpha|beta|rc)[-_ .]*\d*)?)$/i
  );
  if (versionOnly) return { name: '', version: versionOnly[1].replace(/\s+/g, '') };

  // Versiones marcadas: "Pokemon Añil v2.0", "Pokemon Opalo (v1.3.0)".
  const marked = label.match(
    /^(.*?)(?:\s*[-–—]\s*|\s+)[(\[]?\s*(?:version|ver|v)\s*\.?\s*(\d+(?:\.\d+){0,3}(?:[-_. ]?(?:alpha|beta|rc)[-_ .]*\d*)?)\s*[)\]]?\s*$/i
  );
  if (marked) {
    const name = marked[1].replace(/[\s._–—-]+$/, '').trim();
    if (name) return { name, version: marked[2].replace(/\s+/g, '') };
  }

  // Versiones sin prefijo, pero con separador: "Pokemon Iberia - 2.04".
  const numeric = label.match(
    /^(.*?)(?:\s*[-–—]\s*|\s+)[(\[]?\s*(\d+\.\d+(?:\.\d+){0,2})\s*[)\]]?\s*$/i
  );
  if (numeric) {
    const name = numeric[1].replace(/[\s._–—-]+$/, '').trim();
    if (name) return { name, version: numeric[2] };
  }

  return { name: label, version: '' };
}

export function inferGameFolderInfoFromExecutable(path: string): { name: string; version: string } {
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

export function getExecutableFallbackName(path: string): string {
  const folderInfo = inferGameFolderInfoFromExecutable(path);
  if (folderInfo.name) return folderInfo.name;

  // Solo recurrir al nombre del ejecutable si la ruta no contiene carpeta de
  // juego reconocible.
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const filename = segments[segments.length - 1] ?? path;
  const candidate = cleanGameNameCandidate(filename);
  return candidate && !isGenericExecutableName(candidate) ? candidate.slice(0, 80) : 'Juego nuevo';
}

export function getInstallRootFromExecutable(path: string): string {
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
