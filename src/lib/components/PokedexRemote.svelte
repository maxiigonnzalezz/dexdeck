<script lang="ts">
  import type { DataSource } from '$lib/encyclopedia';
  import { getVersionRemotePokedex, setVersionRemotePokedex } from '$lib/encyclopedia';
  import { listGamePokemon } from '$lib/pokedex';
  import {
    applyImport,
    buildPreview,
    type ImportApplyResult,
    type ImportIssue,
    type ImportPreview
  } from '$lib/import/pokemon-import';
  import { collectPokedex, parsePokedexOptions, suggestPokedexKey } from '$lib/import/pokeapi';
  import { fetchJson } from '$lib/import/http';
  import PokedexImportPreview from './PokedexImportPreview.svelte';

  type Props = {
    versionId: number;
    gameName: string;
    versionLabel: string;
    sources: DataSource[];
    onImported: () => void;
  };

  let { versionId, gameName, versionLabel, sources, onImported }: Props = $props();

  const API = 'https://pokeapi.co/api/v2';
  const MAX_FAILURES = 25;

  let dialog: HTMLDialogElement | undefined = $state(undefined);
  let options = $state<Array<{ key: string; label: string }>>([]);
  let pokedexKey = $state('');
  let maxEntries = $state<number | undefined>(undefined);
  let loadingOptions = $state(false);
  let downloading = $state(false);
  let applying = $state(false);
  let progress = $state({ done: 0, total: 0, current: '' });
  let preview = $state<ImportPreview | null>(null);
  let result = $state<ImportApplyResult | null>(null);
  let error = $state('');
  let cancelledNotice = $state(false);
  let mode = $state<'merge' | 'insert-only'>('merge');
  let controller: AbortController | undefined;

  let percent = $derived(progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0);
  let actionable = $derived(preview ? preview.counts.insert + preview.counts.update : 0);
  let applyLabel = $derived(
    applying ? 'Importando…' : `Importar ${actionable} ${actionable === 1 ? 'entrada' : 'entradas'}`
  );
  let pokeapiSource = $derived(sources.find((source) => source.source_key === 'pokeapi'));

  function openDialog() {
    error = '';
    result = null;
    preview = null;
    cancelledNotice = false;
    progress = { done: 0, total: 0, current: '' };
    maxEntries = undefined;
    mode = 'merge';
    dialog?.showModal();
    void loadOptions();
  }

  function closeDialog() {
    if (downloading || applying) return;
    dialog?.close();
  }

  async function loadOptions() {
    loadingOptions = true;
    error = '';

    try {
      const [payload, stored] = await Promise.all([
        fetchJson(`${API}/pokedex?limit=100`),
        getVersionRemotePokedex(versionId).catch(() => '')
      ]);

      options = parsePokedexOptions(payload);
      const known = (key: string) => options.some((option) => option.key === key);

      if (stored !== '' && known(stored)) {
        pokedexKey = stored;
      } else {
        const suggestion = suggestPokedexKey(gameName, versionLabel);
        pokedexKey = suggestion !== '' && known(suggestion) ? suggestion : (options[0]?.key ?? '');
      }
    } catch (loadError) {
      console.error('Error al cargar las Pokédex de PokéAPI:', loadError);
      error = 'No se ha podido cargar la lista de Pokédex. Comprueba la conexión e inténtalo de nuevo.';
    } finally {
      loadingOptions = false;
    }
  }

  function mergeIssues(built: ImportPreview, issues: ImportIssue[]): ImportPreview {
    if (issues.length === 0) return built;

    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;

    return {
      ...built,
      issues: [...issues, ...built.issues],
      counts: {
        ...built.counts,
        errors: built.counts.errors + errors,
        warnings: built.counts.warnings + warnings
      }
    };
  }

  async function download() {
    if (downloading || pokedexKey === '') return;

    error = '';
    result = null;
    preview = null;
    cancelledNotice = false;
    progress = { done: 0, total: 0, current: '' };
    downloading = true;
    controller = new AbortController();
    const signal = controller.signal;

    try {
      const limit = maxEntries !== undefined && maxEntries > 0 ? Math.floor(maxEntries) : 0;
      const outcome = await collectPokedex({
        pokedexKey,
        maxEntries: limit,
        fetchJson: (url) => fetchJson(url, signal),
        onProgress: (next) => {
          progress = next;
        },
        signal
      });

      if (outcome.cancelled || signal.aborted) {
        cancelledNotice = true;
        return;
      }

      const existing = await listGamePokemon(versionId);
      const built = buildPreview(
        outcome.records,
        'pokeapi',
        sources,
        existing,
        gameName,
        versionLabel
      );

      preview = mergeIssues(built, outcome.issues);
      await setVersionRemotePokedex(versionId, pokedexKey);
    } catch (downloadError) {
      if (signal.aborted) {
        cancelledNotice = true;
        return;
      }

      console.error('Error al recolectar la Pokédex desde PokéAPI:', downloadError);
      error =
        downloadError instanceof Error
          ? downloadError.message
          : 'No se ha podido recolectar la Pokédex.';
    } finally {
      downloading = false;
      controller = undefined;
    }
  }

  function cancelDownload() {
    controller?.abort();
  }

  async function applyPreview() {
    if (!preview) return;

    applying = true;
    error = '';

    try {
      result = await applyImport(versionId, preview, mode);
      onImported();
    } catch (applyError) {
      console.error('Error al aplicar la recolección:', applyError);
      error =
        applyError instanceof Error ? applyError.message : 'No se ha podido aplicar la importación.';
    } finally {
      applying = false;
    }
  }

  function resetPreview() {
    preview = null;
    cancelledNotice = false;
  }
</script>

<button type="button" class="pdr-trigger" onclick={openDialog}>Recolectar de PokéAPI</button>

<dialog
  bind:this={dialog}
  class="pdr-dialog"
  aria-labelledby="pdr-title"
  onclick={(event) => { if (event.target === dialog) closeDialog(); }}
  onkeydown={(event) => { if (event.key === 'Escape') closeDialog(); }}
  oncancel={(event) => { if (downloading || applying) event.preventDefault(); }}
>
  <div class="pdr-body">
    <header class="pdr-head">
      <div>
        <div class="pdr-kicker">RECOLECCIÓN REMOTA</div>
        <h2 id="pdr-title">Pokédex de {versionLabel}</h2>
        <p>
          Se descargan nombres, tipos, habilidades, estadísticas y descripciones desde PokéAPI.
          Nada se guarda hasta que confirmes la vista previa.
        </p>
      </div>
      <button type="button" class="pdr-close" aria-label="Cerrar" onclick={closeDialog} disabled={downloading}>
        ×
      </button>
    </header>

    {#if result}
      <div class="pdr-result">
        <div class="pdr-kicker">RECOLECCIÓN COMPLETADA</div>
        <p>
          {result.imported} {result.imported === 1 ? 'entrada nueva' : 'entradas nuevas'},
          {result.updated} {result.updated === 1 ? 'actualizada' : 'actualizadas'} y
          {result.skipped} sin cambios.
        </p>
        {#if result.failures.length > 0}
          <div class="pdr-alert" role="alert">
            {result.failures.length} {result.failures.length === 1 ? 'fila no se pudo importar' : 'filas no se pudieron importar'}:
            <ul>
              {#each result.failures.slice(0, MAX_FAILURES) as failure (failure.line)}
                <li>Línea {failure.line} · {failure.label}: {failure.message}</li>
              {/each}
            </ul>
          </div>
        {/if}
        <div class="pdr-actions">
          <button type="button" class="pdr-secondary" onclick={closeDialog}>Cerrar</button>
        </div>
      </div>
    {:else}
      {#if !preview}
        <div class="pdr-form">
          <label>
            Pokédex
            <select bind:value={pokedexKey} disabled={loadingOptions || downloading}>
              {#if loadingOptions}
                <option value="">Cargando Pokédex…</option>
              {:else if options.length === 0}
                <option value="">Sin opciones disponibles</option>
              {/if}
              {#each options as option (option.key)}
                <option value={option.key}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            Límite de entradas
            <input
              type="number"
              min="0"
              placeholder="Todas"
              bind:value={maxEntries}
              disabled={downloading}
            />
          </label>
        </div>
        <p class="pdr-hint">
          Déjalo vacío o en 0 para descargar la Pokédex completa. Las descripciones se toman en
          español y, si no hay, en inglés; la vista previa avisa cuando se usa el inglés.
        </p>
      {/if}

      {#if downloading}
        <div class="pdr-progress" role="status">
          <div class="pdr-bar"><span style="width: {percent}%"></span></div>
          <p>
            {progress.done} de {progress.total || '…'}
            {#if progress.current}· {progress.current}{/if}
          </p>
        </div>
      {/if}

      {#if error}
        <div class="pdr-alert" role="alert">{error}</div>
      {/if}

      {#if cancelledNotice}
        <div class="pdr-notice">Descarga cancelada; no se ha guardado nada.</div>
      {/if}

      {#if preview}
        <PokedexImportPreview
          {preview}
          bind:mode
          {applying}
          {gameName}
          {versionLabel}
          {applyLabel}
          onApply={() => void applyPreview()}
          onCancel={resetPreview}
        />
        <p class="pdr-attribution">
          {pokeapiSource?.attribution_text ?? 'Datos servidos por PokéAPI'}.
          {#if pokeapiSource?.license_name}{pokeapiSource.license_name}.{/if}
          Pokémon © Nintendo, Creatures Inc. y GAME FREAK inc.
        </p>
      {:else}
        <div class="pdr-actions">
          <button type="button" class="pdr-secondary" onclick={closeDialog} disabled={downloading}>
            Cancelar
          </button>
          {#if downloading}
            <button type="button" class="pdr-danger" onclick={cancelDownload}>Cancelar descarga</button>
          {:else}
            <button
              type="button"
              class="pdr-primary"
              onclick={() => void download()}
              disabled={loadingOptions || pokedexKey === ''}
            >
              Descargar
            </button>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</dialog>

<style>
  .pdr-trigger {
    min-height: 38px;
    padding: 0 16px;
    border: 1px solid var(--enc-border);
    border-radius: 10px;
    background: var(--enc-panel);
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .pdr-trigger:hover {
    background: var(--enc-panel-strong);
  }

  .pdr-dialog {
    width: min(100% - 32px, 760px);
    max-height: calc(100vh - 48px);
    padding: 0;
    border: 1px solid var(--enc-border);
    border-radius: 16px;
    background: var(--enc-panel-strong);
    color: var(--enc-text, inherit);
    overflow: auto;
  }

  .pdr-dialog::backdrop {
    background: rgba(3, 8, 10, 0.62);
    backdrop-filter: blur(3px);
  }

  .pdr-body {
    display: grid;
    gap: 14px;
    padding: 20px;
  }

  .pdr-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .pdr-kicker {
    margin-bottom: 5px;
    color: var(--enc-accent);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  .pdr-head h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .pdr-head p {
    margin: 6px 0 0;
    max-width: 560px;
    color: var(--enc-muted);
    font-size: 0.78rem;
    line-height: 1.55;
  }

  .pdr-close {
    border: 0;
    background: transparent;
    color: var(--enc-muted);
    font-size: 1.3rem;
    cursor: pointer;
  }

  .pdr-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 160px;
    gap: 12px;
  }

  .pdr-form label {
    display: grid;
    gap: 6px;
    color: var(--enc-muted);
    font-size: 0.74rem;
    font-weight: 600;
  }

  .pdr-form select,
  .pdr-form input {
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid var(--enc-border);
    border-radius: 9px;
    background: var(--enc-input);
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.8rem;
  }

  .pdr-hint,
  .pdr-attribution {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.72rem;
    line-height: 1.55;
  }

  .pdr-progress {
    display: grid;
    gap: 7px;
  }

  .pdr-progress p {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.74rem;
  }

  .pdr-bar {
    height: 6px;
    border-radius: 999px;
    background: var(--enc-input);
    overflow: hidden;
  }

  .pdr-bar span {
    display: block;
    height: 100%;
    background: var(--enc-accent);
    transition: width 160ms ease;
  }

  .pdr-alert,
  .pdr-notice {
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 0.78rem;
    line-height: 1.55;
  }

  .pdr-alert {
    border: 1px solid rgba(244, 63, 94, 0.3);
    background: rgba(244, 63, 94, 0.1);
    color: #fb7185;
  }

  .pdr-alert ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }

  .pdr-notice {
    border: 1px solid rgba(250, 204, 21, 0.28);
    background: rgba(250, 204, 21, 0.08);
    color: #facc15;
  }

  .pdr-result {
    display: grid;
    gap: 10px;
  }

  .pdr-result p {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.82rem;
  }

  .pdr-primary,
  .pdr-secondary,
  .pdr-danger {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid transparent;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .pdr-primary {
    border-color: var(--enc-accent);
    background: var(--enc-accent);
    color: #04211a;
  }

  .pdr-secondary {
    border-color: var(--enc-border);
    background: var(--enc-panel);
    color: var(--enc-text, inherit);
  }

  .pdr-danger {
    border-color: rgba(244, 63, 94, 0.5);
    background: rgba(244, 63, 94, 0.12);
    color: #fb7185;
  }

  .pdr-primary:disabled,
  .pdr-secondary:disabled,
  .pdr-danger:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pdr-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .pdr-form {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  :global(html[data-theme='light']) .pdr-primary {
    color: #fff;
  }
</style>
