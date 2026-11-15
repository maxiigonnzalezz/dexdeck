<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { tick } from 'svelte';
  import { scrollLockDialog } from '$lib/scroll-lock';
  import {
    clearGamePokemon,
    deleteGamePokemon,
    EMPTY_STATS,
    listGamePokemon,
    POKEMON_TYPE_COLORS,
    POKEMON_TYPE_LABELS,
    POKEMON_TYPES,
    saveGamePokemon,
    type GamePokemon,
    type PokemonStats,
    type PokemonType
  } from '$lib/pokedex';
  import { listDataSources, type DataSource } from '$lib/encyclopedia';
  import PokedexImport from '$lib/components/PokedexImport.svelte';
  import PokedexRemote from '$lib/components/PokedexRemote.svelte';
  import { isWebUrl } from '$lib/url';

  type Props = {
    gameName: string;
    versionLabel: string;
    versionId: number;
    onChanged?: () => void;
  };

  let { gameName, versionLabel, versionId, onChanged }: Props = $props();

  type Draft = {
    dex_number: number;
    name: string;
    form_name: string;
    type_primary: PokemonType | '';
    type_secondary: PokemonType | '';
    abilitiesText: string;
    stats: PokemonStats;
    dex_entry: string;
    sprite_url: string;
    sprite_path: string;
    is_obtainable: boolean;
    sourceIdText: string;
  };

  const STAT_FIELDS: ReadonlyArray<{ key: keyof PokemonStats; label: string }> = [
    { key: 'hp', label: 'PS' },
    { key: 'atk', label: 'Ataque' },
    { key: 'def', label: 'Defensa' },
    { key: 'spa', label: 'At. Esp.' },
    { key: 'spd', label: 'Def. Esp.' },
    { key: 'spe', label: 'Velocidad' }
  ];

  let entries = $state<GamePokemon[]>([]);
  let sources = $state<DataSource[]>([]);
  let loading = $state(false);
  let error = $state('');
  let query = $state('');
  let sortBy = $state<'number' | 'name'>('number');
  let formDialog: HTMLDialogElement | undefined = $state(undefined);
  let deleteDialog: HTMLDialogElement | undefined = $state(undefined);
  let editingId = $state<number | null>(null);
  let draft = $state<Draft>(createDraft());
  let saving = $state(false);
  let formError = $state('');
  let pendingDelete = $state<GamePokemon | null>(null);
  let deleting = $state(false);
  let clearing = $state(false);
  let clearCount = $state(0);
  let clearDialog: HTMLDialogElement | undefined = $state(undefined);
  let detailDialog: HTMLDialogElement | undefined = $state(undefined);
  let detailPokemon = $state<GamePokemon | null>(null);

  function createDraft(dexNumber = 1): Draft {
    return {
      dex_number: dexNumber,
      name: '',
      form_name: '',
      type_primary: '',
      type_secondary: '',
      abilitiesText: '',
      stats: { ...EMPTY_STATS },
      dex_entry: '',
      sprite_url: '',
      sprite_path: '',
      is_obtainable: true,
      sourceIdText: ''
    };
  }

  async function load() {
    loading = true;
    error = '';

    try {
      entries = await listGamePokemon(versionId);
    } catch (loadError) {
      console.error('Error al cargar la Pokédex:', loadError);
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      error = `No se ha podido cargar la Pokédex: ${message}`;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    listDataSources()
      .then((rows) => (sources = rows))
      .catch((sourceError) => console.warn('No se pudieron cargar las fuentes:', sourceError));
  });

  $effect(() => {
    // Vuelve a cargar cuando el usuario cambia de versión en la ficha.
    const currentVersion = versionId;
    if (!currentVersion) return;
    untrack(() => void load());
  });

  let filtered = $derived.by(() => {
    const text = query.trim().toLowerCase();
    const matches = text
      ? entries.filter((entry) =>
          `${entry.dex_number} ${entry.name} ${entry.form_name} ${POKEMON_TYPE_LABELS[entry.type_primary as PokemonType] ?? ''} ${POKEMON_TYPE_LABELS[entry.type_secondary as PokemonType] ?? ''}`
            .toLowerCase()
            .includes(text)
        )
      : entries;

    return [...matches].sort((a, b) =>
      sortBy === 'name'
        ? a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        : a.dex_number - b.dex_number || a.form_name.localeCompare(b.form_name, 'es')
    );
  });

  function nextNumber(): number {
    return entries.reduce((max, entry) => Math.max(max, entry.dex_number), 0) + 1;
  }

  function openCreate() {
    editingId = null;
    draft = createDraft(nextNumber());
    formError = '';
    formDialog?.showModal();
  }

  function openEdit(entry: GamePokemon) {
    editingId = entry.id;
    draft = {
      dex_number: entry.dex_number,
      name: entry.name,
      form_name: entry.form_name,
      type_primary: entry.type_primary,
      type_secondary: entry.type_secondary,
      abilitiesText: entry.abilities.join(', '),
      stats: entry.base_stats ? { ...entry.base_stats } : { ...EMPTY_STATS },
      dex_entry: entry.dex_entry,
      sprite_url: entry.sprite_url,
      sprite_path: entry.sprite_path,
      is_obtainable: entry.is_obtainable === 1,
      sourceIdText: entry.source_id === null ? '' : String(entry.source_id)
    };
    formError = '';
    formDialog?.showModal();
  }

  function closeForm() {
    formDialog?.close();
  }

  function updateStat(key: keyof PokemonStats, event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    draft.stats[key] = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  async function save() {
    saving = true;
    formError = '';

    try {
      await saveGamePokemon(
        versionId,
        {
          dex_number: draft.dex_number,
          name: draft.name,
          form_name: draft.form_name,
          type_primary: draft.type_primary,
          type_secondary: draft.type_secondary,
          abilities: draft.abilitiesText.split(','),
          base_stats: { ...draft.stats },
          dex_entry: draft.dex_entry,
          sprite_url: draft.sprite_url,
          sprite_path: draft.sprite_path,
          is_obtainable: draft.is_obtainable,
          source_id: draft.sourceIdText === '' ? null : Number(draft.sourceIdText)
        },
        editingId ?? undefined
      );

      closeForm();
      await load();
      onChanged?.();
    } catch (saveError) {
      console.error('Error al guardar el Pokémon:', saveError);
      formError = saveError instanceof Error ? saveError.message : 'No se ha podido guardar la entrada.';
    } finally {
      saving = false;
    }
  }

  function askDelete(entry: GamePokemon) {
    pendingDelete = entry;
    deleteDialog?.showModal();
  }

  async function remove() {
    if (!pendingDelete) return;

    deleting = true;
    try {
      await deleteGamePokemon(pendingDelete.id);
      deleteDialog?.close();
      pendingDelete = null;
      await load();
      onChanged?.();
    } catch (deleteError) {
      console.error('Error al eliminar el Pokémon:', deleteError);
      error = 'No se ha podido eliminar la entrada.';
    } finally {
      deleting = false;
    }
  }

  function askClearPokedex() {
    clearCount = entries.length;
    clearDialog?.showModal();
  }

  async function openDetail(entry: GamePokemon) {
    detailPokemon = entry;
    await tick();
    detailDialog?.showModal();
  }

  function closeDetail() {
    detailDialog?.close();
    detailPokemon = null;
  }

  async function clearPokedex() {
    clearing = true;
    try {
      const deleted = await clearGamePokemon(versionId);
      clearDialog?.close();
      await load();
      onChanged?.();
      error = `Se han eliminado ${deleted} entrada${deleted === 1 ? '' : 's'} de la Pokédex.`;
    } catch (clearError) {
      console.error('Error al vaciar la Pokédex:', clearError);
      error = clearError instanceof Error ? clearError.message : 'No se ha podido vaciar la Pokédex.';
    } finally {
      clearing = false;
    }
  }

  function typeColor(type: PokemonType | '') {
    return type ? POKEMON_TYPE_COLORS[type] : 'transparent';
  }

  function formatNumber(value: number) {
    return `#${String(value).padStart(4, '0')}`;
  }
</script>

<section class="pdx" aria-label={`Pokédex de ${gameName}, versión ${versionLabel}`}>
  <header class="pdx-header">
    <div>
      <div class="pdx-kicker">POKÉDEX LOCAL</div>
      <h2>{gameName} <span>· {versionLabel}</span></h2>
      <p>Entradas propias de esta versión. Las formas comparten número y se distinguen por su nombre de forma.</p>
    </div>
    <div class="pdx-header-actions">
      <PokedexRemote
        {versionId}
        {gameName}
        {versionLabel}
        {sources}
        onImported={() => { void load(); onChanged?.(); }}
      />
      <PokedexImport
        {versionId}
        {gameName}
        {versionLabel}
        {sources}
        onImported={() => { void load(); onChanged?.(); }}
      />
      <button type="button" class="pdx-primary" onclick={openCreate}>＋ Añadir Pokémon</button>
      {#if entries.length > 0}
        <button type="button" class="pdx-danger" onclick={askClearPokedex} disabled={clearing}>
          {clearing ? 'Vac…' : '🗑 Vaciar Pokédex'}
        </button>
      {/if}
    </div>
  </header>

  <div class="pdx-toolbar">
    <label class="pdx-search">
      <span aria-hidden="true">⌕</span>
      <input
        bind:value={query}
        placeholder="Buscar por nombre, número, forma o tipo..."
        aria-label="Buscar Pokémon"
        onkeydown={(event) => { if (event.key === 'Escape') query = ''; }}
      />
    </label>
    <label class="pdx-sort">
      Ordenar
      <select bind:value={sortBy}>
        <option value="number">Por número</option>
        <option value="name">Por nombre</option>
      </select>
    </label>
    <span class="pdx-count">
      {filtered.length} de {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
    </span>
  </div>

  {#if error}
    <div class="pdx-alert" role="alert">
      {error}
      <button type="button" onclick={() => (error = '')} aria-label="Cerrar aviso">×</button>
    </div>
  {/if}

  {#if loading}
    <div class="pdx-empty"><span class="pdx-spinner"></span> Cargando Pokédex...</div>
  {:else if entries.length === 0}
    <div class="pdx-empty">
      <span class="pdx-empty-icon">◈</span>
      <h3>Esta Pokédex todavía está vacía</h3>
      <p>Añade la primera entrada de {versionLabel} y completa sus datos cuando los tengas.</p>
      <button type="button" class="pdx-primary" onclick={openCreate}>Añadir el primer Pokémon</button>
    </div>
  {:else if filtered.length === 0}
    <div class="pdx-empty">
      <span class="pdx-empty-icon">⌕</span>
      <h3>No encontramos esa entrada</h3>
      <p>Prueba con otro nombre, número o tipo.</p>
      <button type="button" class="pdx-secondary" onclick={() => (query = '')}>Limpiar búsqueda</button>
    </div>
  {:else}
    <div class="pdx-list">
      {#each filtered as entry (entry.id)}
        <article
          class="pdx-row pdx-row-interactive"
          data-testid={`pdx-row-${entry.dex_number}`}
        >
          <button
            type="button"
            class="pdx-row-hitarea"
            aria-label={`Ver ficha de ${entry.name}`}
            onclick={() => void openDetail(entry)}
          ><span class="sr-only">Ver ficha de {entry.name}</span></button>
          <div class="pdx-sprite" aria-hidden="true">
            {#if entry.sprite_url && isWebUrl(entry.sprite_url)}
              <img src={entry.sprite_url} alt="" loading="lazy" />
            {:else if entry.sprite_path}
              <img src={entry.sprite_path} alt="" loading="lazy" />
            {:else}
              <span>{entry.name.slice(0, 2).toUpperCase()}</span>
            {/if}
          </div>

          <div class="pdx-ident">
            <span class="pdx-number">{formatNumber(entry.dex_number)}</span>
            <button
              type="button"
              class="pdx-name-button"
              data-testid={`pdx-name-${entry.dex_number}`}
              aria-label={`Ver detalles de ${entry.name}`}
              onclick={(e) => {
                e.stopPropagation();
                void openDetail(entry);
              }}
            >
              {entry.name}
            </button>
            {#if entry.form_name}<span class="pdx-form">{entry.form_name}</span>{/if}
          </div>

          <div class="pdx-types">
            {#if entry.type_primary}
              <span class="pdx-type" style={`--type-color: ${typeColor(entry.type_primary)}`}>
                {POKEMON_TYPE_LABELS[entry.type_primary]}
              </span>
            {/if}
            {#if entry.type_secondary}
              <span class="pdx-type" style={`--type-color: ${typeColor(entry.type_secondary)}`}>
                {POKEMON_TYPE_LABELS[entry.type_secondary]}
              </span>
            {/if}
          </div>

          <div class="pdx-meta">
            {#if entry.is_obtainable === 0}
              <span class="pdx-flag">No obtenible</span>
            {/if}
            {#if entry.base_stats}
              <span class="pdx-total">BT {Object.values(entry.base_stats).reduce((a, b) => a + b, 0)}</span>
            {/if}
            {#if entry.source_name}
              <span class="pdx-source" title={entry.source_attribution ?? entry.source_name}>{entry.source_name}</span>
            {/if}
          </div>

          <div class="pdx-actions">
              <button type="button" class="pdx-icon-button" aria-label={`Ver detalles de ${entry.name}`} title="Ver detalles" onclick={() => void openDetail(entry)}>👁</button>
            <button type="button" class="pdx-icon-button" aria-label={`Editar ${entry.name}`} title="Editar" onclick={() => openEdit(entry)}>✎</button>
            <button type="button" class="pdx-icon-button pdx-danger" aria-label={`Eliminar ${entry.name}`} title="Eliminar" onclick={() => askDelete(entry)}>🗑</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

<dialog
  bind:this={formDialog}
  use:scrollLockDialog
  class="pdx-dialog"
  aria-labelledby="pdx-form-title"
  onclick={(event) => { if (event.target === formDialog) closeForm(); }}
  onkeydown={(event) => { if (event.key === 'Escape' && !saving) closeForm(); }}
>
  <form onsubmit={(event) => { event.preventDefault(); void save(); }}>
    <header class="pdx-dialog-head">
      <div>
        <div class="pdx-kicker">{editingId === null ? 'NUEVA ENTRADA' : 'EDITAR ENTRADA'}</div>
        <h2 id="pdx-form-title">{editingId === null ? 'Añadir Pokémon' : 'Editar Pokémon'}</h2>
      </div>
      <button type="button" class="pdx-close" aria-label="Cerrar" onclick={closeForm}>×</button>
    </header>

    <div class="pdx-form-grid">
      <label class="pdx-field">
        Número local <span>*</span>
        <input type="number" min="1" max="9999" required bind:value={draft.dex_number} />
      </label>

      <label class="pdx-field">
        Nombre <span>*</span>
        <input bind:value={draft.name} maxlength="80" required placeholder="Ej. Pikachu" />
      </label>

      <label class="pdx-field">
        Forma
        <input bind:value={draft.form_name} maxlength="60" placeholder="Ej. Alola, Mega, Shiny" />
      </label>

      <label class="pdx-field">
        Fuente
        <select bind:value={draft.sourceIdText}>
          <option value="">Entrada manual</option>
          {#each sources as source (source.id)}
            <option value={String(source.id)}>{source.name}</option>
          {/each}
        </select>
      </label>

      <label class="pdx-field">
        Tipo primario
        <select bind:value={draft.type_primary}>
          <option value="">Sin especificar</option>
          {#each POKEMON_TYPES as type (type)}
            <option value={type}>{POKEMON_TYPE_LABELS[type]}</option>
          {/each}
        </select>
      </label>

      <label class="pdx-field">
        Tipo secundario
        <select bind:value={draft.type_secondary}>
          <option value="">Sin especificar</option>
          {#each POKEMON_TYPES as type (type)}
            <option value={type}>{POKEMON_TYPE_LABELS[type]}</option>
          {/each}
        </select>
      </label>

      <label class="pdx-field pdx-full">
        Habilidades
        <input bind:value={draft.abilitiesText} maxlength="200" placeholder="Ej. Elec. Estática, Pararrayos" />
        <small>Separa varias habilidades con comas.</small>
      </label>

      <div class="pdx-full">
        <span class="pdx-field-label">Estadísticas base</span>
        <div class="pdx-stats">
          {#each STAT_FIELDS as field (field.key)}
            <label class="pdx-stat-field">
              {field.label}
              <input
                type="number"
                min="0"
                max="999"
                value={draft.stats[field.key]}
                oninput={(event) => updateStat(field.key, event)}
              />
            </label>
          {/each}
        </div>
        <small>Deja todo a cero si todavía no conoces las estadísticas.</small>
      </div>

      <label class="pdx-field pdx-full">
        Descripción de la Pokédex
        <textarea bind:value={draft.dex_entry} rows="3" maxlength="2000" placeholder="Texto de la entrada en esta versión..."></textarea>
      </label>

      <label class="pdx-field">
        URL del sprite
        <input bind:value={draft.sprite_url} type="url" maxlength="1000" placeholder="https://..." />
      </label>

      <label class="pdx-field">
        Ruta local del sprite
        <input bind:value={draft.sprite_path} maxlength="1000" placeholder="sprites/025.png" />
        <small>Se guarda para importaciones; la vista previa usa la URL.</small>
      </label>

      <label class="pdx-check pdx-full">
        <input type="checkbox" bind:checked={draft.is_obtainable} />
        Se puede obtener en esta versión
      </label>

      {#if formError}
        <div class="pdx-alert pdx-full" role="alert">{formError}</div>
      {/if}
    </div>

    <footer class="pdx-dialog-actions">
      <button type="button" class="pdx-secondary" onclick={closeForm}>Cancelar</button>
      <button type="submit" class="pdx-primary" disabled={saving}>
        {saving ? 'Guardando…' : editingId === null ? 'Añadir entrada' : 'Guardar cambios'}
      </button>
    </footer>
  </form>
</dialog>

<dialog bind:this={deleteDialog} use:scrollLockDialog class="pdx-dialog pdx-dialog-small" aria-labelledby="pdx-delete-title" onclick={(event) => { if (event.target === deleteDialog) deleteDialog?.close(); }}>
  <div class="pdx-delete">
    <div class="pdx-kicker">ELIMINAR ENTRADA</div>
    <h2 id="pdx-delete-title">
      {pendingDelete ? `${pendingDelete.name}${pendingDelete.form_name ? ` · ${pendingDelete.form_name}` : ''}` : 'Pokémon'}
    </h2>
    <p>
      Se eliminará esta entrada y sus encuentros asociados de {versionLabel}. Esta acción no se puede deshacer.
    </p>
    <div class="pdx-dialog-actions">
      <button type="button" class="pdx-secondary" onclick={() => deleteDialog?.close()}>Cancelar</button>
      <button type="button" class="pdx-danger-button" disabled={deleting} onclick={() => void remove()}>
        {deleting ? 'Eliminando…' : 'Eliminar entrada'}
      </button>
    </div>
  </div>
</dialog>

<dialog bind:this={clearDialog} use:scrollLockDialog class="pdx-dialog pdx-dialog-small" aria-labelledby="pdx-clear-title" onclick={(event) => { if (event.target === clearDialog) clearDialog?.close(); }}>
  <div class="pdx-delete">
    <div class="pdx-kicker">VACIAR POKÉDEX</div>
    <h2 id="pdx-clear-title">Vaciar todas las entradas</h2>
    <p>
      Se eliminarán todas las {clearCount} entrada{clearCount === 1 ? '' : 's'} de {versionLabel}
      y sus encuentros asociados. Esta acción no se puede deshacer.
    </p>
    <div class="pdx-dialog-actions">
      <button type="button" class="pdx-secondary" onclick={() => clearDialog?.close()}>Cancelar</button>
      <button type="button" class="pdx-danger-button" disabled={clearing} onclick={clearPokedex}>
        {clearing ? 'Vaciando…' : 'Vaciar Pokédex'}
      </button>
    </div>
  </div>
</dialog>

{#if detailPokemon}
  <dialog bind:this={detailDialog} use:scrollLockDialog class="pdx-dialog pdx-dialog-detail" aria-labelledby="pdx-detail-title" onclose={() => (detailPokemon = null)} onclick={(event) => { if (event.target === detailDialog) closeDetail(); }}>
    <div class="pdx-detail">
      <div class="pdx-kicker">FICHA DE POKÉMON</div>
      <h2 id="pdx-detail-title">
        {detailPokemon.name}
        {#if detailPokemon.form_name}<span class="pdx-form">{detailPokemon.form_name}</span>{/if}
      </h2>
      <button type="button" class="pdx-close" aria-label="Cerrar ficha" onclick={closeDetail}>×</button>

      <div class="pdx-detail-grid">
        <div class="pdx-detail-sprite">
          {#if detailPokemon.sprite_url && isWebUrl(detailPokemon.sprite_url)}
            <img src={detailPokemon.sprite_url} alt={`Sprite de ${detailPokemon.name}`} />
          {:else if detailPokemon.sprite_path}
            <img src={detailPokemon.sprite_path} alt={`Sprite de ${detailPokemon.name}`} />
          {:else}
            <span class="pdx-detail-sprite-placeholder">{detailPokemon.name.slice(0, 2).toUpperCase()}</span>
          {/if}
          <span class="pdx-detail-number">{formatNumber(detailPokemon.dex_number)}</span>
          {#if detailPokemon.national_dex_number}
            <span class="pdx-detail-national">Nacional #{String(detailPokemon.national_dex_number).padStart(4, '0')}</span>
          {/if}
        </div>

        <div class="pdx-detail-info">
          <div class="pdx-detail-types">
            {#if detailPokemon.type_primary}
              <span class="pdx-type" style={`--type-color: ${typeColor(detailPokemon.type_primary)}`}>
                {POKEMON_TYPE_LABELS[detailPokemon.type_primary]}
              </span>
            {/if}
            {#if detailPokemon.type_secondary}
              <span class="pdx-type" style={`--type-color: ${typeColor(detailPokemon.type_secondary)}`}>
                {POKEMON_TYPE_LABELS[detailPokemon.type_secondary]}
              </span>
            {/if}
          </div>

          <div class="pdx-detail-field">
            <span class="pdx-detail-label">Habilidades</span>
            <p class="pdx-detail-value">
              {#if detailPokemon.abilities.length > 0}
                {detailPokemon.abilities.join(', ')}
              {:else}
                Sin habilidades registradas
              {/if}
            </p>
          </div>

          <div class="pdx-detail-field">
            <span class="pdx-detail-label">Entrada de la Pokédex</span>
            <p class="pdx-detail-value pdx-detail-entry">{detailPokemon.dex_entry || 'Sin descripción.'}</p>
          </div>

          {#if detailPokemon.source_name}
            <div class="pdx-detail-field">
              <span class="pdx-detail-label">Fuente</span>
              <p class="pdx-detail-value" title={detailPokemon.source_attribution ?? detailPokemon.source_name}>
                {detailPokemon.source_name}
              </p>
            </div>
          {/if}
        </div>

        <div class="pdx-detail-stats">
          <h3>Estadísticas base</h3>
          <div class="pdx-stat-list">
            {#if detailPokemon.base_stats}
              {#each Object.entries(detailPokemon.base_stats) as [key, value]}
                <div class="pdx-stat-item">
                  <span class="pdx-stat-name">{key.toUpperCase()}</span>
                  <span class="pdx-stat-value">{value}</span>
                </div>
              {/each}
              <div class="pdx-stat-item pdx-stat-total">
                <span class="pdx-stat-name">Total</span>
                <span class="pdx-stat-value">{Object.values(detailPokemon.base_stats).reduce((a, b) => a + b, 0)}</span>
              </div>
            {:else}
              <p class="pdx-detail-value">Sin estadísticas registradas.</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="pdx-dialog-actions">
        <button type="button" class="pdx-secondary" onclick={closeDetail}>Cerrar</button>
      </div>
    </div>
  </dialog>
{/if}

<style>
  .pdx {
    display: grid;
    gap: 14px;
    color: var(--enc-text, inherit);
  }

  .pdx-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    flex-wrap: wrap;
  }

  .pdx-kicker {
    margin-bottom: 5px;
    color: var(--enc-accent);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.16em;
  }

  .pdx-header h2 {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.2;
  }

  .pdx-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pdx-header h2 span {
    color: var(--enc-muted);
    font-weight: 500;
  }

  .pdx-header p {
    margin: 6px 0 0;
    max-width: 620px;
    color: var(--enc-muted);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .pdx-primary,
  .pdx-secondary,
  .pdx-danger-button {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid transparent;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .pdx-primary {
    border-color: var(--enc-accent);
    background: var(--enc-accent);
    color: #04211a;
  }

  .pdx-primary:disabled,
  .pdx-danger-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pdx-secondary {
    border-color: var(--enc-border);
    background: var(--enc-panel);
    color: var(--enc-text, inherit);
  }

  .pdx-danger,
  .pdx-danger-button {
    border-color: rgba(244, 63, 94, 0.35);
    background: rgba(244, 63, 94, 0.16);
    color: #fb7185;
  }

  .pdx-danger:disabled,
  .pdx-danger-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pdx-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pdx-search {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1;
    min-width: 220px;
    min-height: 42px;
    padding: 0 13px;
    border: 1px solid var(--enc-border);
    border-radius: 11px;
    background: var(--enc-input);
    color: var(--enc-muted);
  }

  .pdx-search input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.82rem;
  }

  .pdx-sort {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--enc-muted);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .pdx-sort select {
    min-height: 42px;
    padding: 0 10px;
    border: 1px solid var(--enc-border);
    border-radius: 10px;
    background: var(--enc-input);
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.8rem;
  }

  .pdx-count {
    margin-left: auto;
    color: var(--enc-muted);
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .pdx-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 14px;
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 10px;
    background: rgba(244, 63, 94, 0.1);
    color: #fb7185;
    font-size: 0.8rem;
  }

  .pdx-alert button {
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 1rem;
    cursor: pointer;
  }

  .pdx-empty {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 44px 24px;
    border: 1px dashed var(--enc-border);
    border-radius: 14px;
    background: var(--enc-panel);
    text-align: center;
  }

  .pdx-empty-icon {
    color: var(--enc-accent);
    font-size: 1.7rem;
  }

  .pdx-empty h3 {
    margin: 0;
    font-size: 1.02rem;
  }

  .pdx-empty p {
    margin: 0 0 6px;
    max-width: 420px;
    color: var(--enc-muted);
    font-size: 0.8rem;
    line-height: 1.6;
  }

  .pdx-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--enc-border);
    border-top-color: var(--enc-accent);
    border-radius: 50%;
    animation: pdx-spin 750ms linear infinite;
  }

  @keyframes pdx-spin {
    to { transform: rotate(360deg); }
  }

  .pdx-list {
    display: grid;
    gap: 7px;
  }

  .pdx-row {
    position: relative;
    min-width: 0;
    display: grid;
    grid-template-columns: 48px minmax(130px, 1.5fr) minmax(110px, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border: 1px solid var(--enc-border);
    border-radius: 12px;
    background: var(--enc-panel);
  }

  .pdx-row-hitarea {
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    cursor: pointer;
  }

  .pdx-row-hitarea:focus-visible {
    outline: 2px solid var(--enc-accent);
    outline-offset: 2px;
  }

  .pdx-row > :not(.pdx-row-hitarea) {
    position: relative;
    z-index: 1;
    pointer-events: none;
  }

  .pdx-row .pdx-name-button,
  .pdx-row .pdx-actions,
  .pdx-row .pdx-actions button {
    pointer-events: auto;
  }

  .pdx-row:hover {
    background: var(--enc-panel-strong);
  }

  .pdx-sprite {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--enc-input);
    overflow: hidden;
    color: var(--enc-accent);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .pdx-sprite img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .pdx-ident {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .pdx-number {
    color: var(--enc-muted);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }

  .pdx-name-button {
    font-size: 0.9rem;
  }

  .pdx-form {
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--enc-panel-strong);
    color: var(--enc-muted);
    font-size: 0.65rem;
  }

  .pdx-types {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .pdx-type {
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--type-color);
    color: #fff;
    font-size: 0.63rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  }

  .pdx-meta {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    color: var(--enc-muted);
    font-size: 0.68rem;
  }

  .pdx-flag {
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.16);
  }

  .pdx-total {
    font-variant-numeric: tabular-nums;
  }

  .pdx-source {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pdx-actions {
    display: flex;
    gap: 5px;
  }

  .pdx-icon-button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--enc-border);
    border-radius: 8px;
    background: transparent;
    color: var(--enc-text, inherit);
    font-size: 0.8rem;
    cursor: pointer;
  }

  .pdx-icon-button:hover {
    background: var(--enc-panel-strong);
  }

  .pdx-icon-button.pdx-danger:hover {
    border-color: rgba(244, 63, 94, 0.4);
    color: #fb7185;
  }

  .pdx-dialog {
    width: min(100% - 32px, 720px);
    max-height: calc(100dvh - 32px);
    min-width: 0;
    padding: 0;
    border: 1px solid var(--enc-border);
    border-radius: 16px;
    background: var(--enc-panel-strong);
    color: var(--enc-text, inherit);
    overflow: auto;
  }

  .pdx-dialog::backdrop {
    background: rgba(3, 8, 10, 0.62);
    backdrop-filter: blur(3px);
  }

  .pdx-dialog-small {
    width: min(100% - 32px, 440px);
  }

  .pdx-dialog form,
  .pdx-delete {
    padding: 20px;
  }

  .pdx-dialog-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
  }

  .pdx-dialog-head h2,
  .pdx-delete h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .pdx-delete p {
    margin: 8px 0 0;
    color: var(--enc-muted);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .pdx-close {
    border: 0;
    background: transparent;
    color: var(--enc-muted);
    font-size: 1.3rem;
    cursor: pointer;
  }

  .pdx-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .pdx-full {
    grid-column: 1 / -1;
  }

  .pdx-field {
    display: grid;
    gap: 5px;
    color: var(--enc-muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .pdx-field small,
  .pdx-full > small {
    color: var(--enc-muted);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }

  .pdx-field input,
  .pdx-field select,
  .pdx-field textarea {
    min-height: 38px;
    padding: 0 10px;
    border: 1px solid var(--enc-border);
    border-radius: 9px;
    background: var(--enc-input);
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.82rem;
    letter-spacing: 0;
    text-transform: none;
  }

  .pdx-field textarea {
    padding: 9px 10px;
    resize: vertical;
  }

  .pdx-field > span {
    color: #fb7185;
  }

  .pdx-field-label {
    display: block;
    margin-bottom: 5px;
    color: var(--enc-muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .pdx-stats {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 7px;
  }

  .pdx-stat-field {
    display: grid;
    gap: 4px;
    color: var(--enc-muted);
    font-size: 0.62rem;
    font-weight: 600;
  }

  .pdx-stat-field input {
    min-height: 36px;
    width: 100%;
    padding: 0 7px;
    border: 1px solid var(--enc-border);
    border-radius: 8px;
    background: var(--enc-input);
    color: var(--enc-text, inherit);
    font: inherit;
    font-size: 0.8rem;
    text-align: center;
  }

  .pdx-check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--enc-muted);
    font-size: 0.8rem;
  }

  .pdx-check input {
    accent-color: var(--enc-accent);
  }

  .pdx-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 18px;
    flex-wrap: wrap;
  }

  @media (max-width: 760px) {
    .pdx-row {
      grid-template-columns: 44px minmax(0, 1fr) auto;
      row-gap: 8px;
    }

    .pdx-types,
    .pdx-meta {
      grid-column: 2 / -1;
    }

    .pdx-actions {
      grid-row: 1;
      grid-column: 3;
    }

    .pdx-form-grid {
      grid-template-columns: 1fr;
    }

    .pdx-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .pdx-count {
      margin-left: 0;
    }
  }

  :global(html[data-theme='light']) .pdx-primary {
    color: #fff;
  }

  .pdx-dialog-detail {
    width: min(100% - 32px, 860px);
    max-width: 860px;
    padding: 0;
  }

  .pdx-row-interactive {
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease;
  }

  .pdx-row-interactive:hover {
    border-color: rgba(98, 230, 194, 0.32);
    background: var(--enc-panel);
  }

  .pdx-name-button {
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    font-weight: 700;
    color: var(--enc-text, inherit);
    cursor: pointer;
    text-align: left;
    display: inline;
    outline: none;
    border-radius: 4px;
    transition: color 150ms ease;
  }

  .pdx-name-button:hover,
  .pdx-name-button:focus-visible {
    color: var(--enc-accent);
    text-decoration: underline;
  }

  .pdx-name-button:focus-visible {
    outline: 2px solid var(--enc-accent);
    outline-offset: 2px;
  }

  /* Ficha detallada de Pokémon */
  .pdx-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
  }

  .pdx-detail-grid {
    display: grid;
    grid-template-columns: minmax(170px, 200px) minmax(0, 1fr) minmax(180px, 220px);
    gap: 20px;
    align-items: start;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .pdx-detail-sprite,
  .pdx-detail-info,
  .pdx-detail-stats {
    min-width: 0;
    box-sizing: border-box;
  }

  .pdx-detail-sprite {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--enc-border);
    border-radius: 12px;
    background: var(--enc-panel);
  }

  .pdx-detail-sprite img {
    width: 120px;
    height: 120px;
    object-fit: contain;
    background: var(--enc-input);
    border-radius: 8px;
  }

  .pdx-detail-sprite-placeholder {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--enc-border);
    color: var(--enc-muted);
    font-weight: 700;
    font-size: 1.5rem;
  }

  .pdx-detail-number {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--enc-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .pdx-detail-national {
    font-size: 0.7rem;
    color: var(--enc-muted);
    margin-top: 4px;
  }

  .pdx-detail-info {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .pdx-detail-types {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pdx-detail-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pdx-detail-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--enc-muted);
  }

  .pdx-detail-value {
    margin: 0;
    color: var(--enc-text, inherit);
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .pdx-detail-entry {
    font-style: italic;
    color: color-mix(in srgb, var(--enc-text, inherit) 80%, transparent);
  }

  .pdx-detail-stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--enc-border);
    border-radius: 12px;
    background: var(--enc-panel);
  }

  .pdx-detail-stats h3 {
    margin: 0 0 8px 0;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--enc-muted);
  }

  .pdx-stat-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pdx-stat-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--enc-text, inherit);
  }

  .pdx-stat-item.pdx-stat-total {
    border-top: 1px solid var(--enc-border);
    padding-top: 8px;
    margin-top: 4px;
    font-weight: 700;
    color: var(--enc-accent);
  }

  .pdx-stat-name {
    color: var(--enc-muted);
  }

  @media (max-width: 820px) {
    .pdx-dialog-detail {
      width: min(100% - 24px, 600px);
      max-height: calc(100dvh - 24px);
    }
    .pdx-detail-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .pdx-detail-sprite {
      flex-direction: row;
      justify-content: flex-start;
      gap: 16px;
    }
    .pdx-detail-sprite img {
      width: 96px;
      height: 96px;
    }
  }

  @media (max-width: 500px) {
    .pdx-detail {
      padding: 16px;
    }
    .pdx-detail-sprite {
      flex-direction: column;
      align-items: center;
    }
  }

  /* DEXDECK GAME-INCLUSIVE MOTION */
  .pdx-row-interactive {
    transform-origin: center;
    transition: transform 190ms cubic-bezier(.2, .75, .25, 1), border-color 190ms ease, background-color 190ms ease, box-shadow 190ms ease;
  }

  .pdx-row-interactive:hover,
  .pdx-row-interactive:focus-within {
    z-index: 2;
    transform: translateY(-1px) scale(1.012);
    border-color: color-mix(in srgb, var(--enc-accent) 38%, var(--enc-border));
    box-shadow: 0 8px 22px rgba(0, 0, 0, .13);
  }

  .pdx-row-interactive .pdx-sprite,
  .pdx-row-interactive .pdx-sprite img {
    transition: transform 220ms cubic-bezier(.2, .75, .25, 1);
  }

  .pdx-row-interactive:hover .pdx-sprite { transform: scale(1.05); }
  .pdx-row-interactive:hover .pdx-sprite img { transform: scale(1.08) rotate(-3deg); }
  .pdx-row-interactive .pdx-icon-button { transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease; }
  .pdx-row-interactive .pdx-icon-button:hover { transform: translateY(-1px) scale(1.06); }
  .pdx-row-interactive .pdx-icon-button:active { transform: scale(.94); }

  @media (max-width: 760px) {
    .pdx-row-interactive:hover, .pdx-row-interactive:focus-within { transform: translateY(-1px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pdx-row-interactive, .pdx-row-interactive .pdx-sprite,
    .pdx-row-interactive .pdx-sprite img, .pdx-row-interactive .pdx-icon-button {
      animation: none !important; transition: none !important; transform: none !important;
    }
  }
</style>
