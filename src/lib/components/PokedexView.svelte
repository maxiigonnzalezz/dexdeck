<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { tick } from 'svelte';
  import { scrollLockDialog } from '$lib/scroll-lock';
  import PokemonSprite from './PokemonSprite.svelte';
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
    obtain_note: string;
    abilityDetails: Record<string, string>;
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
      obtain_note: '',
      abilityDetails: {},
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
      obtain_note: entry.obtain_note ?? '',
      abilityDetails: { ...entry.ability_details },
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

    const abilityNames = draft.abilitiesText
      .split(',')
      .map((ability) => ability.trim())
      .filter((ability) => ability !== '');
    const abilityDetails = Object.fromEntries(
      Object.entries(draft.abilityDetails).filter(([name]) => abilityNames.includes(name))
    );

    try {
      await saveGamePokemon(
        versionId,
        {
          dex_number: draft.dex_number,
          name: draft.name,
          form_name: draft.form_name,
          type_primary: draft.type_primary,
          type_secondary: draft.type_secondary,
          abilities: abilityNames,
          base_stats: { ...draft.stats },
          dex_entry: draft.dex_entry,
          sprite_url: draft.sprite_url,
          sprite_path: draft.sprite_path,
          is_obtainable: draft.is_obtainable,
          obtain_note: draft.obtain_note,
          ability_details: abilityDetails,
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

  /** Motivo legible de una entrada no obtenible. */
  function obtainReason(entry: GamePokemon): string {
    const note = (entry.obtain_note ?? '').trim();
    if (note) return note;
    return `Sin método de encuentro registrado en ${versionLabel}. Puede ser exclusivo de otra edición, de un evento o necesitar intercambio.`;
  }

  function statTotal(stats: PokemonStats | null): number {
    return stats ? Object.values(stats).reduce((total, value) => total + (Number(value) || 0), 0) : 0;
  }

  function statAverage(stats: PokemonStats | null): number {
    return stats ? Math.round(statTotal(stats) / 6) : 0;
  }

  function statPercent(value: number): number {
    return Math.min(100, Math.round((Math.max(0, Number(value) || 0) / 180) * 100));
  }

  function topStatKey(stats: PokemonStats | null): keyof PokemonStats | '' {
    if (!stats) return '';
    return STAT_FIELDS.reduce<keyof PokemonStats | ''>((best, field) => {
      if (best === '') return field.key;
      return Number(stats[field.key]) > Number(stats[best]) ? field.key : best;
    }, '');
  }

  function abilityEffect(name: string): string {
    return detailPokemon?.ability_details?.[name] ?? '';
  }

  function editFromDetail() {
    const entry = detailPokemon;
    if (!entry) return;
    closeDetail();
    openEdit(entry);
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
            <PokemonSprite url={entry.sprite_url} path={entry.sprite_path} name={entry.name} />
          </div>

          <div class="pdx-ident">
            <span class="pdx-number">{formatNumber(entry.dex_number)}</span>
            {#if entry.national_dex_number}
              <span class="pdx-national" title="Número nacional">
                N.º {String(entry.national_dex_number).padStart(4, '0')}
              </span>
            {/if}
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
            <span class="pdx-flag-slot">
              {#if entry.is_obtainable === 0}
                <button
                  type="button"
                  class="pdx-flag"
                  aria-describedby={`pdx-obtain-${entry.id}`}
                  onclick={(event) => { event.stopPropagation(); void openDetail(entry); }}
                >
                  No obtenible
                  <span class="pdx-flag-tip" role="tooltip" id={`pdx-obtain-${entry.id}`}>
                    {obtainReason(entry)}
                  </span>
                </button>
              {/if}
            </span>
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

      <label class="pdx-field pdx-full">
        Motivo de no obtenibilidad
        <textarea
          bind:value={draft.obtain_note}
          rows="2"
          maxlength="300"
          data-testid="pdx-obtain-note"
          placeholder="Ej. Solo se consigue mediante intercambio con Zafiro."
        ></textarea>
        <small>Aparece al pasar el cursor por «No obtenible» y en la ficha. Déjalo vacío para usar la explicación por defecto.</small>
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
      <header class="pdx-detail-head">
        <div class="pdx-detail-title-block">
          <div class="pdx-kicker">FICHA DE POKÉDEX</div>
          <h2 id="pdx-detail-title">
            {detailPokemon.name}
            {#if detailPokemon.form_name}<span class="pdx-form">{detailPokemon.form_name}</span>{/if}
          </h2>
          <p class="pdx-detail-where">{versionLabel} · {gameName}</p>
        </div>
        <button type="button" class="pdx-close" aria-label="Cerrar ficha" onclick={closeDetail}>×</button>
      </header>

      <div class="pdx-detail-hero">
        <div class="pdx-detail-sprite">
          <PokemonSprite
            url={detailPokemon.sprite_url}
            path={detailPokemon.sprite_path}
            name={detailPokemon.name}
            variant="detail"
          />
          <div class="pdx-detail-numbers">
            <span class="pdx-detail-number">Local {formatNumber(detailPokemon.dex_number)}</span>
            {#if detailPokemon.national_dex_number}
              <span class="pdx-detail-national">
                Nacional N.º {String(detailPokemon.national_dex_number).padStart(4, '0')}
              </span>
            {/if}
          </div>
        </div>

        <div class="pdx-detail-overview">
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
            {#if !detailPokemon.type_primary && !detailPokemon.type_secondary}
              <span class="pdx-muted">Sin tipos registrados</span>
            {/if}
          </div>

          <div class="pdx-detail-status" class:pdx-detail-status-off={detailPokemon.is_obtainable === 0}>
            <span class="pdx-status-dot" aria-hidden="true"></span>
            <div>
              <strong>{detailPokemon.is_obtainable === 0 ? 'No obtenible' : 'Se puede obtener'}</strong>
              <p>
                {detailPokemon.is_obtainable === 0
                  ? obtainReason(detailPokemon)
                  : `Registrado como obtenible en ${versionLabel}.`}
              </p>
            </div>
          </div>

          <dl class="pdx-detail-facts">
            <div class="pdx-fact">
              <dt>Total base</dt>
              <dd>{detailPokemon.base_stats ? statTotal(detailPokemon.base_stats) : '—'}</dd>
            </div>
            <div class="pdx-fact">
              <dt>Media</dt>
              <dd>{detailPokemon.base_stats ? statAverage(detailPokemon.base_stats) : '—'}</dd>
            </div>
            <div class="pdx-fact">
              <dt>Habilidades</dt>
              <dd>{detailPokemon.abilities.length}</dd>
            </div>
            <div class="pdx-fact">
              <dt>Fuente</dt>
              <dd class="pdx-fact-source" title={detailPokemon.source_attribution ?? detailPokemon.source_name ?? 'Entrada manual'}>
                {detailPokemon.source_name ?? 'Manual'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="pdx-detail-body">
        <section class="pdx-detail-panel pdx-detail-stats" aria-labelledby="pdx-stats-title">
          <header class="pdx-panel-head">
            <h3 id="pdx-stats-title">Estadísticas base</h3>
            <span class="pdx-panel-hint">
              {#if detailPokemon.base_stats}
                Total {statTotal(detailPokemon.base_stats)} · Media {statAverage(detailPokemon.base_stats)}
              {:else}
                Sin datos
              {/if}
            </span>
          </header>

          {#if detailPokemon.base_stats}
            <div class="pdx-stat-list">
              {#each STAT_FIELDS as field (field.key)}
                {@const value = Number(detailPokemon.base_stats?.[field.key]) || 0}
                <div class="pdx-stat-row" class:pdx-stat-top={topStatKey(detailPokemon.base_stats) === field.key}>
                  <span class="pdx-stat-name">{field.label}</span>
                  <span class="pdx-stat-track">
                    <span class="pdx-stat-fill" style={`--fill: ${statPercent(value)}%`}></span>
                  </span>
                  <span class="pdx-stat-value">{value}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="pdx-muted">Sin estadísticas registradas. Puedes añadirlas al editar la entrada.</p>
          {/if}
        </section>

        <div class="pdx-detail-aside">
          <section class="pdx-detail-panel pdx-detail-abilities" aria-labelledby="pdx-abilities-title">
          <header class="pdx-panel-head">
            <h3 id="pdx-abilities-title">Habilidades</h3>
            <span class="pdx-panel-hint">
              {detailPokemon.abilities.length} {detailPokemon.abilities.length === 1 ? 'registrada' : 'registradas'}
            </span>
          </header>

          {#if detailPokemon.abilities.length > 0}
            <ul class="pdx-ability-list">
              {#each detailPokemon.abilities as ability}
                <li class="pdx-ability">
                  <span class="pdx-ability-name">{ability}</span>
                  <p class="pdx-ability-text">
                    {abilityEffect(ability) || 'Sin descripción guardada. Vuelve a importar desde PokéAPI para completar el efecto.'}
                  </p>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="pdx-muted">Sin habilidades registradas. Puedes añadirlas al editar la entrada.</p>
          {/if}
          </section>

          <section class="pdx-detail-entry-card" aria-labelledby="pdx-entry-title">
            <h3 id="pdx-entry-title">Entrada de la Pokédex</h3>
            <blockquote class="pdx-detail-entry">
              {detailPokemon.dex_entry || `Sin descripción registrada para ${versionLabel}.`}
            </blockquote>
            {#if detailPokemon.source_license}
              <p class="pdx-detail-license">
                {detailPokemon.source_license}
                {#if detailPokemon.source_url}
                  · <a href={detailPokemon.source_url} target="_blank" rel="noreferrer">Origen</a>
                {/if}
              </p>
            {/if}
          </section>
        </div>
      </div>

      <footer class="pdx-dialog-actions pdx-detail-foot">
        <span class="pdx-detail-foot-note">
          {detailPokemon.source_attribution ?? detailPokemon.source_name ?? 'Entrada manual'}
        </span>
        <div class="pdx-detail-foot-buttons">
          <button type="button" class="pdx-secondary" onclick={closeDetail}>Cerrar</button>
          <button type="button" class="pdx-primary" onclick={editFromDetail}>Editar ficha</button>
        </div>
      </footer>
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
    grid-template-columns: 48px minmax(130px, 1fr) 168px 208px auto;
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
  .pdx-row .pdx-flag,
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

  .pdx-national {
    padding: 1px 6px;
    border: 1px solid var(--enc-border);
    border-radius: 999px;
    color: var(--enc-muted);
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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

  .pdx-flag-slot {
    display: flex;
    align-items: center;
    flex: 0 0 96px;
    min-width: 0;
  }

  .pdx-flag {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 999px;
    background: rgba(244, 63, 94, 0.12);
    color: #fda4af;
    font: inherit;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 130ms ease, border-color 130ms ease;
  }

  .pdx-flag:hover,
  .pdx-flag:focus-visible {
    border-color: rgba(244, 63, 94, 0.5);
    background: rgba(244, 63, 94, 0.2);
  }

  .pdx-flag:focus-visible {
    outline: 2px solid #fb7185;
    outline-offset: 2px;
  }

  .pdx-flag-tip {
    position: absolute;
    z-index: 8;
    top: calc(100% + 9px);
    left: 0;
    width: max-content;
    max-width: 260px;
    padding: 8px 10px;
    border: 1px solid var(--enc-border);
    border-radius: 9px;
    background: #0b1517;
    color: #e8f1ee;
    font-size: 0.68rem;
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 0;
    text-align: left;
    white-space: normal;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-3px);
    transition: opacity 130ms ease, transform 130ms ease, visibility 130ms;
    pointer-events: none;
  }

  .pdx-flag:hover .pdx-flag-tip,
  .pdx-flag:focus-visible .pdx-flag-tip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  :global(html[data-theme='light']) .pdx-flag-tip {
    background: #ffffff;
    color: #16211f;
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
    background: var(--dd-modal-bg);
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
    .pdx-flag-tip {
      left: auto;
      right: 0;
    }

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
  .pdx-dialog-detail {
    width: min(100% - 32px, 940px);
    max-width: 940px;
    padding: 0;
  }

  .pdx-detail {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 24px;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .pdx-detail-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .pdx-detail-title-block {
    min-width: 0;
  }

  .pdx-detail-title-block h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin: 2px 0 0;
    font-size: 1.6rem;
    line-height: 1.15;
  }

  .pdx-detail-where {
    margin: 6px 0 0;
    color: var(--enc-muted);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .pdx-detail-hero {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 18px;
    align-items: stretch;
    min-width: 0;
  }

  .pdx-detail-sprite {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 18px 14px;
    border: 1px solid var(--enc-border);
    border-radius: 16px;
    background:
      radial-gradient(circle at 50% 26%, color-mix(in srgb, var(--enc-accent) 11%, transparent), transparent 64%),
      var(--enc-panel);
    min-width: 0;
  }

  .pdx-detail-numbers {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .pdx-detail-number {
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--enc-text, inherit);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }

  .pdx-detail-national {
    font-size: 0.66rem;
    color: var(--enc-muted);
    font-variant-numeric: tabular-nums;
  }

  .pdx-detail-overview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .pdx-detail-types {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    align-items: center;
  }

  .pdx-detail-status {
    display: flex;
    gap: 11px;
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--enc-accent) 34%, var(--enc-border));
    border-radius: 12px;
    background: color-mix(in srgb, var(--enc-accent) 8%, transparent);
  }

  .pdx-detail-status strong {
    display: block;
    font-size: 0.8rem;
    letter-spacing: 0.01em;
  }

  .pdx-detail-status p {
    margin: 3px 0 0;
    color: var(--enc-muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .pdx-status-dot {
    flex: none;
    width: 8px;
    height: 8px;
    margin-top: 5px;
    border-radius: 50%;
    background: var(--enc-accent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--enc-accent) 18%, transparent);
  }

  .pdx-detail-status-off {
    border-color: rgba(244, 63, 94, 0.35);
    background: rgba(244, 63, 94, 0.08);
  }

  .pdx-detail-status-off .pdx-status-dot {
    background: #fb7185;
    box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.16);
  }

  .pdx-detail-facts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }

  .pdx-fact {
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid var(--enc-border);
    border-radius: 10px;
    background: var(--enc-input);
  }

  .pdx-fact dt {
    color: var(--enc-muted);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .pdx-fact dd {
    margin: 4px 0 0;
    font-size: 0.92rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .pdx-fact-source {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.72rem !important;
  }

  .pdx-detail-body {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    min-width: 0;
  }

  .pdx-detail-aside {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .pdx-detail-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 16px;
    border: 1px solid var(--enc-border);
    border-radius: 14px;
    background: var(--enc-panel);
  }

  .pdx-panel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .pdx-panel-head h3 {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .pdx-panel-hint {
    color: var(--enc-muted);
    font-size: 0.66rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .pdx-stat-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .pdx-stat-row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 34px;
    align-items: center;
    gap: 10px;
  }

  .pdx-stat-name {
    color: var(--enc-muted);
    font-size: 0.72rem;
    font-weight: 600;
  }

  .pdx-stat-track {
    height: 8px;
    border-radius: 999px;
    background: var(--enc-input);
    box-shadow: inset 0 0 0 1px var(--enc-border);
    overflow: hidden;
  }

  .pdx-stat-fill {
    display: block;
    width: var(--fill, 0%);
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, color-mix(in srgb, var(--enc-accent) 55%, #1d4b41), var(--enc-accent));
    transition: width 420ms cubic-bezier(0.2, 0.75, 0.25, 1);
  }

  .pdx-stat-value {
    text-align: right;
    font-size: 0.8rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .pdx-stat-top .pdx-stat-name {
    color: var(--enc-text, inherit);
  }

  .pdx-stat-top .pdx-stat-value {
    color: var(--enc-accent);
  }

  .pdx-ability-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .pdx-ability {
    padding: 10px 12px;
    border: 1px solid var(--enc-border);
    border-radius: 10px;
    background: var(--enc-input);
  }

  .pdx-ability-name {
    display: inline-block;
    color: var(--enc-accent);
    font-size: 0.78rem;
    font-weight: 800;
  }

  .pdx-ability-text {
    margin: 4px 0 0;
    color: var(--enc-muted);
    font-size: 0.74rem;
    line-height: 1.55;
  }

  .pdx-muted {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.78rem;
    line-height: 1.6;
  }

  .pdx-detail-entry-card {
    padding: 16px 18px;
    border: 1px solid var(--enc-border);
    border-radius: 14px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--enc-accent) 7%, transparent), transparent 68%),
      var(--enc-panel);
  }

  .pdx-detail-entry-card h3 {
    margin: 0;
    color: var(--enc-muted);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .pdx-detail-entry {
    margin: 9px 0 0;
    padding-left: 14px;
    border-left: 2px solid color-mix(in srgb, var(--enc-accent) 55%, transparent);
    color: color-mix(in srgb, var(--enc-text, inherit) 84%, transparent);
    font-size: 0.88rem;
    font-style: italic;
    line-height: 1.7;
  }

  .pdx-detail-license {
    margin: 9px 0 0;
    color: var(--enc-muted);
    font-size: 0.66rem;
  }

  .pdx-detail-license a {
    color: var(--enc-accent);
  }

  .pdx-detail-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 0;
    padding-top: 14px;
    border-top: 1px solid var(--enc-border);
    flex-wrap: wrap;
  }

  .pdx-detail-foot-note {
    color: var(--enc-muted);
    font-size: 0.66rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 55%;
  }

  .pdx-detail-foot-buttons {
    display: flex;
    gap: 9px;
  }

  @media (max-width: 860px) {
    .pdx-dialog-detail {
      width: min(100% - 24px, 660px);
      max-height: calc(100dvh - 24px);
    }

    .pdx-detail-hero {
      grid-template-columns: 1fr;
    }

    .pdx-detail-sprite {
      flex-direction: row;
      justify-content: center;
    }

    .pdx-detail-body {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 620px) {
    .pdx-detail {
      padding: 16px;
    }

    .pdx-detail-sprite {
      flex-direction: column;
    }

    .pdx-detail-facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .pdx-detail-foot-note {
      max-width: 100%;
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
  .pdx-row-interactive .pdx-sprite :global(img) {
    transition: transform 220ms cubic-bezier(.2, .75, .25, 1);
  }

  .pdx-row-interactive:hover .pdx-sprite { transform: scale(1.05); }
  .pdx-row-interactive:hover .pdx-sprite :global(img) { transform: scale(1.08) rotate(-3deg); }
  .pdx-row-interactive .pdx-icon-button { transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease; }
  .pdx-row-interactive .pdx-icon-button:hover { transform: translateY(-1px) scale(1.06); }
  .pdx-row-interactive .pdx-icon-button:active { transform: scale(.94); }

  @media (max-width: 760px) {
    .pdx-row-interactive:hover, .pdx-row-interactive:focus-within { transform: translateY(-1px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pdx-row-interactive, .pdx-row-interactive .pdx-sprite,
    .pdx-row-interactive .pdx-sprite :global(img), .pdx-row-interactive .pdx-icon-button {
      animation: none !important; transition: none !important; transform: none !important;
    }
  }
</style>
