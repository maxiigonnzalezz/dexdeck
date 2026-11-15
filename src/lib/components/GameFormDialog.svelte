<script lang="ts">
  import { tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import type { ExecutableMetadata, SystemInfo } from '$lib/app-types';
  import type { Game, GameInput } from '$lib/db';
  import {
    cleanGameNameCandidate,
    getExecutableFallbackName,
    getInstallRootFromExecutable,
    inferGameFolderInfoFromExecutable,
    isGenericExecutableName
  } from '$lib/game-autofill';
  import { scrollLockDialog } from '$lib/scroll-lock';

  type Props = {
    systemInfo: SystemInfo | null;
    /** Posición del juego en la biblioteca, para alternar el color por defecto. */
    colorSeed?: number;
    onSubmit: (input: GameInput, editingGameId: number | null) => Promise<boolean>;
  };

  let { systemInfo, colorSeed = 0, onSubmit }: Props = $props();

  const CARD_COLORS = ['blue', 'purple', 'red'];

  let dialog: HTMLDialogElement | undefined = $state(undefined);
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
  let newType = $state('Fangame');
  let newStatus = $state('En biblioteca');
  let newColor = $state(CARD_COLORS[0]);
  let newSymbol = $state('✦');

  let formError = $state('');
  let saving = $state(false);
  let nameInput: HTMLInputElement | undefined = $state(undefined);

  async function showModal() {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    await tick();
    // El nombre es el único campo obligatorio: el foco entra ahí.
    nameInput?.focus();
    nameInput?.select();
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
    newColor = CARD_COLORS[colorSeed % CARD_COLORS.length];
    newSymbol = '✦';
    formError = '';
  }

  /** Abre el formulario vacío para dar de alta un juego nuevo. */
  export function openAdd() {
    resetForm();
    void showModal();
  }

  /** Abre el formulario con los datos de un juego existente. */
  export function openEdit(game: Game) {
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

    void showModal();
  }

  export function close() {
    dialog?.close();
  }

  /** Muestra un aviso dentro del formulario (por ejemplo, tras abrirlo desde una ficha). */
  export function setError(message: string) {
    formError = message;
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
        if (
          shouldAutoFillName &&
          !folderInfo.name &&
          !nameManuallyEdited &&
          metadataName &&
          !isGenericExecutableName(metadataName)
        ) {
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

  async function handleSubmit() {
    const name = newName.trim();

    if (!name) {
      formError = 'Escribe el nombre del juego para continuar.';
      return;
    }

    if (saving) return;

    const input: GameInput = {
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
      const saved = await onSubmit(input, editingGameId);
      if (saved) close();
    } catch (error) {
      console.error('Error al guardar la ficha:', error);
      formError = 'No se pudo guardar la ficha. Revisa la consola para ver el error.';
    } finally {
      saving = false;
    }
  }
</script>

<!-- Modal para añadir y editar fichas -->
<dialog
  bind:this={dialog}
  use:scrollLockDialog
  class="modal"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  onclick={(event) => {
    if (event.target === dialog) dialog?.close();
  }}
>
  <div class="modal-top">
    <div class="modal-icon">{editingGameId !== null ? '✎' : '＋'}</div>
    <button class="modal-close" aria-label="Cerrar" onclick={() => dialog?.close()}>×</button>
  </div>

  <div class="section-kicker">{editingGameId !== null ? 'ACTUALIZA LA INFORMACIÓN' : 'AMPLÍA TU COLECCIÓN'}</div>
  <h2 id="modal-title">{editingGameId !== null ? 'Editar ficha.' : 'Añadir un juego.'}</h2>
  <p class="modal-description" id="modal-description">
    Guarda la información de tu fangame. Puedes completar los datos técnicos más adelante.
  </p>

  <form
    data-testid="add-game-form"
    onsubmit={(event) => {
      event.preventDefault();
      void handleSubmit();
    }}
  >
    <div class="form-grid">
      <label class="form-label full-width">
        Nombre del juego <span>*</span>
        <input
          bind:this={nameInput}
          bind:value={newName}
          data-testid="game-name-input"
          placeholder="Ej. Pokémon Eclipse"
          required
          maxlength="80"
          oninput={() => (nameManuallyEdited = true)}
        />
      </label>

      <label class="form-label">
        Desarrollador
        <input
          bind:value={newDeveloper}
          data-testid="game-developer-input"
          placeholder="Creador o equipo"
          maxlength="100"
        />
      </label>

      <label class="form-label">
        Versión
        <input
          bind:value={newVersion}
          placeholder="Ej. 1.0"
          maxlength="30"
          oninput={() => (versionManuallyEdited = true)}
        />
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
        <textarea
          bind:value={newDescription}
          data-testid="game-description-input"
          placeholder="Historia, características, región, generación..."
          rows="4"
          maxlength="3000"
        ></textarea>
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
          <input
            id="executable-path"
            bind:value={newExecutablePath}
            placeholder={systemInfo?.os === 'windows'
              ? 'C:\\Juegos\\NombreDelJuego\\Game.exe'
              : '/home/usuario/Juegos/NombreDelJuego/Game.exe'}
            maxlength="1000"
            onchange={() => autofillExecutableFields(newExecutablePath)}
          />
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
          <input
            id="install-path"
            bind:value={newInstallPath}
            placeholder={systemInfo?.os === 'windows'
              ? 'C:\\Juegos\\NombreDelJuego'
              : '/home/usuario/Juegos/NombreDelJuego'}
            maxlength="1000"
            oninput={() => (installPathManuallyEdited = true)}
          />
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
      <p class="form-notice" role="alert" data-testid="form-error">{formError}</p>
    {/if}

    <div class="modal-actions">
      <button type="button" class="secondary-button" onclick={() => dialog?.close()}>Cancelar</button>
      <button type="submit" class="primary-button" data-testid="save-game-button" disabled={saving}>
        {saving ? 'Guardando…' : editingGameId !== null ? 'Guardar cambios' : 'Añadir a la biblioteca'}
        <span>→</span>
      </button>
    </div>
  </form>
</dialog>
