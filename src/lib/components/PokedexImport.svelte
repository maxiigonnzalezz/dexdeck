<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import type { DataSource } from '$lib/encyclopedia';
  import { listGamePokemon } from '$lib/pokedex';
  import {
    applyImport,
    parsePokemonFile,
    type ImportPreview,
    type ImportApplyResult
  } from '$lib/import/pokemon-import';
  import PokedexImportPreview from './PokedexImportPreview.svelte';

  type Props = {
    versionId: number;
    gameName: string;
    versionLabel: string;
    sources: DataSource[];
    onImported: () => void;
  };

  let { versionId, gameName, versionLabel, sources, onImported }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state(undefined);
  let fileName = $state('');
  let preview = $state<ImportPreview | null>(null);
  let result = $state<ImportApplyResult | null>(null);
  let parsing = $state(false);
  let applying = $state(false);
  let error = $state('');
  let mode = $state<'merge' | 'insert-only'>('merge');

  const MAX_VISIBLE_ISSUES = 25;

  function openDialog() {
    error = '';
    result = null;
    preview = null;
    fileName = '';
    mode = 'merge';
    dialog?.showModal();
  }

  function closeDialog() {
    if (applying) return;
    dialog?.close();
  }

  async function chooseFile() {
    error = '';
    result = null;
    preview = null;

    let selection: string | string[] | null;

    try {
      selection = await open({
        multiple: false,
        directory: false,
        title: 'Selecciona un archivo CSV o JSON',
        filters: [{ name: 'Datos de importación', extensions: ['csv', 'json'] }]
      });
    } catch (pickError) {
      console.error('Error al abrir el diálogo de archivos:', pickError);
      error = 'No se ha podido abrir el selector de archivos.';
      return;
    }

    if (typeof selection !== 'string' || selection === '') return;

    parsing = true;

    try {
      const text = await invoke<string>('read_import_file', { path: selection });
      const existing = await listGamePokemon(versionId);
      const name = selection.split(/[\\/]/).pop() ?? selection;
      preview = parsePokemonFile(text, name, sources, existing);
      fileName = name;

      if (preview.candidates.length === 0 && preview.counts.errors === 0) {
        error = 'El archivo no contiene entradas que se puedan importar.';
      }
    } catch (parseError) {
      console.error('Error al leer el archivo de importación:', parseError);
      error = parseError instanceof Error ? parseError.message : String(parseError);
    } finally {
      parsing = false;
    }
  }

  async function runImport() {
    if (!preview) return;

    applying = true;
    error = '';

    try {
      result = await applyImport(versionId, preview, mode);
      onImported();
    } catch (importError) {
      console.error('Error al aplicar la importación:', importError);
      error = importError instanceof Error ? importError.message : 'No se ha podido aplicar la importación.';
    } finally {
      applying = false;
    }
  }

  let actionable = $derived(preview ? preview.counts.insert + preview.counts.update : 0);
  let applyLabel = $derived(
    applying ? 'Importando…' : `Importar ${actionable} ${actionable === 1 ? 'entrada' : 'entradas'}`
  );
</script>

<button type="button" class="pdi-trigger" onclick={openDialog}>Importar CSV/JSON</button>

<dialog
  bind:this={dialog}
  class="pdi-dialog"
  aria-labelledby="pdi-title"
  onclick={(event) => { if (event.target === dialog) closeDialog(); }}
  onkeydown={(event) => { if (event.key === 'Escape') closeDialog(); }}
>
  <div class="pdi-body">
    <header class="pdi-head">
      <div>
        <div class="pdi-kicker">IMPORTAR DATOS</div>
        <h2 id="pdi-title">Pokédex de {versionLabel}</h2>
        <p>Se aplicará sobre {gameName}. Nada se borra: las entradas existentes solo se actualizan si lo permites.</p>
      </div>
      <button type="button" class="pdi-close" aria-label="Cerrar" onclick={closeDialog}>×</button>
    </header>

    {#if result}
      <div class="pdi-result">
        <div class="pdi-kicker">IMPORTACIÓN COMPLETADA</div>
        <p>
          {result.imported} {result.imported === 1 ? 'entrada nueva' : 'entradas nuevas'},
          {result.updated} {result.updated === 1 ? 'actualizada' : 'actualizadas'} y
          {result.skipped} sin cambios.
        </p>
        {#if result.failures.length > 0}
          <div class="pdi-alert" role="alert">
            {result.failures.length} {result.failures.length === 1 ? 'fila no se pudo importar' : 'filas no se pudieron importar'}:
            <ul>
              {#each result.failures.slice(0, MAX_VISIBLE_ISSUES) as failure (failure.line)}
                <li>Línea {failure.line} · {failure.label}: {failure.message}</li>
              {/each}
            </ul>
          </div>
        {/if}
        <div class="pdi-actions">
          <button type="button" class="pdi-secondary" onclick={closeDialog}>Cerrar</button>
        </div>
      </div>
    {:else}
      <div class="pdi-pick">
        <button type="button" class="pdi-secondary" onclick={() => void chooseFile()} disabled={parsing}>
          {parsing ? 'Leyendo…' : 'Elegir archivo…'}
        </button>
        <span class="pdi-file">{fileName || 'Ningún archivo seleccionado'}</span>
      </div>

      <details class="pdi-help">
        <summary>Formato admitido</summary>
        <p>
          CSV con cabecera o JSON. Columnas en español o inglés: <code>numero</code>, <code>nombre</code>,
          <code>forma</code>, <code>tipo_primario</code>, <code>tipo_secundario</code>,
          <code>habilidades</code> (separadas por <code>|</code>), <code>ps</code>, <code>ataque</code>,
          <code>defensa</code>, <code>atq_esp</code>, <code>def_esp</code>, <code>velocidad</code>,
          <code>descripcion</code>, <code>sprite_url</code>, <code>sprite_path</code>,
          <code>obtenible</code> y <code>fuente</code>.
        </p>
        <pre>numero,nombre,forma,tipo_primario,habilidades,ps
25,Pikachu,,electric,Electrostática|Pararrayos,35</pre>
        <p>El JSON admite una lista de Pokémon o un paquete con la clave <code>pokemon</code>.</p>
      </details>

      {#if error}
        <div class="pdi-alert" role="alert">{error}</div>
      {/if}

      {#if preview}
        <PokedexImportPreview
          {preview}
          bind:mode
          {applying}
          {gameName}
          {versionLabel}
          {applyLabel}
          onApply={() => void runImport()}
          onCancel={closeDialog}
        />
      {/if}
    {/if}
  </div>
</dialog>

<style>
  .pdi-trigger {
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

  .pdi-trigger:hover {
    background: var(--enc-panel-strong);
  }

  .pdi-dialog {
    width: min(100% - 32px, 760px);
    max-height: calc(100vh - 48px);
    padding: 0;
    border: 1px solid var(--enc-border);
    border-radius: 16px;
    background: var(--enc-panel-strong);
    color: var(--enc-text, inherit);
    overflow: auto;
  }

  .pdi-dialog::backdrop {
    background: rgba(3, 8, 10, 0.62);
    backdrop-filter: blur(3px);
  }

  .pdi-body {
    display: grid;
    gap: 14px;
    padding: 20px;
  }

  .pdi-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .pdi-kicker {
    margin-bottom: 5px;
    color: var(--enc-accent);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  .pdi-head h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .pdi-head p {
    margin: 6px 0 0;
    max-width: 560px;
    color: var(--enc-muted);
    font-size: 0.78rem;
    line-height: 1.55;
  }

  .pdi-close {
    border: 0;
    background: transparent;
    color: var(--enc-muted);
    font-size: 1.3rem;
    cursor: pointer;
  }

  .pdi-pick {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 12px;
    border: 1px dashed var(--enc-border);
    border-radius: 12px;
  }

  .pdi-file {
    color: var(--enc-muted);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .pdi-help {
    color: var(--enc-muted);
    font-size: 0.76rem;
    line-height: 1.6;
  }

  .pdi-help summary {
    color: var(--enc-text, inherit);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  .pdi-help pre {
    margin: 8px 0;
    padding: 10px;
    border-radius: 9px;
    background: var(--enc-input);
    color: var(--enc-text, inherit);
    font-size: 0.72rem;
    overflow-x: auto;
  }

  .pdi-help code {
    color: var(--enc-accent);
  }

  .pdi-alert {
    border: 1px solid rgba(244, 63, 94, 0.3);
    background: rgba(244, 63, 94, 0.1);
    color: #fb7185;
  }

  .pdi-alert ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }

  .pdi-result {
    display: grid;
    gap: 10px;
  }

  .pdi-result p {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.82rem;
  }

  .pdi-secondary {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid var(--enc-border);
    background: var(--enc-panel);
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .pdi-secondary:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pdi-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }
</style>
