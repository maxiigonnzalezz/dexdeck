<script lang="ts">
  import {
      createCatalogGame,
      createCatalogGameVersion,
      createDataSource,
      deleteCatalogGame,
      deleteCatalogGameVersion,
      getCatalogGameDeletionInfo,
      getVersionSummary,
      linkLibraryGameToCatalog,
      listCatalogGameLinks,
      listCatalogGameVersions,
      listCatalogGames,
      listDataSources,
      listLinkableLibraryGames,
      unlinkLibraryGameFromCatalog,
      updateCatalogGame,
      updateCatalogGameVersion,
      type CatalogGame,
      type CatalogGameDeletionInfo,
      type CatalogGameLink,
      type CatalogGameUpdateInput,
      type CatalogGameType,
      type CatalogGameVersion,
      type CatalogGameVersionInput,
      type DataSource,
      type DataSourceInput,
      type LinkableLibraryGame,
      type VersionSummary
  } from '$lib/encyclopedia';
  import PokedexView from '$lib/components/PokedexView.svelte';
  import { onMount } from 'svelte';
  import { acquireScrollLock } from '$lib/scroll-lock';

  type CategoryFilter = 'all' | CatalogGameType;
  type DetailTab = 'overview' | 'pokedex' | 'world' | 'guides';

  type Props = {
    /** Llamado cuando el usuario abre la ficha de un juego, para registrar en el historial. */
    onGameOpen?: (gameId: number, gameName: string) => void;
    onGameClose?: () => void;
    /** ID del juego a restaurar al navegar hacia atrás/adelante. Null = vista de catálogo. */
    restoreGameId?: number | null;
  };

  let { onGameOpen, onGameClose, restoreGameId = null }: Props = $props();

  let games = $state<CatalogGame[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let search = $state('');
  let categoryFilter = $state<CategoryFilter>('all');
  let pageError = $state('');
  let formError = $state('');
  let showForm = $state(false);
  let editingGameId = $state<number | null>(null);
  let selectedGame = $state<CatalogGame | null>(null);
  let versions = $state<CatalogGameVersion[]>([]);
  let selectedVersionId = $state<number | null>(null);
  let summary = $state<VersionSummary | null>(null);
  let detailTab = $state<DetailTab>('overview');
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);
  let deleteInfo = $state<CatalogGameDeletionInfo | null>(null);
  let deleteError = $state('');
  let showVersionManager = $state(false);
  let versionFormMode = $state<'create' | 'edit'>('create');
  let editingVersionId = $state<number | null>(null);
  let versionError = $state('');
  let versionSaving = $state(false);
  let versionPendingDelete = $state<CatalogGameVersion | null>(null);
  let versionDraft = $state<CatalogGameVersionInput>({
    version_label: '',
    platform: 'unknown',
    release_date: '',
    notes: '',
    is_default: false,
    source_id: null
  });
  let links = $state<CatalogGameLink[]>([]);
  let linkableGames = $state<LinkableLibraryGame[]>([]);
  let showLinkDialog = $state(false);
  let linkGameId = $state<number | null>(null);
  let linkVersionId = $state<number | null>(null);
  let linkError = $state('');
  let linkSaving = $state(false);
  let unlinkingGameId = $state<number | null>(null);
  let sources = $state<DataSource[]>([]);
  let showSourceManager = $state(false);
  let sourceDialogContext = $state<'toolbar' | 'game' | 'version'>('toolbar');
  let sourceError = $state('');
  let sourceSaving = $state(false);
  let sourceFormOpen = $state(false);
  let sourceDraft = $state<DataSourceInput>({
    source_key: '',
    name: '',
    source_type: 'community',
    homepage_url: '',
    license_name: '',
    attribution_text: '',
    terms_url: ''
  });

  let draft = $state({
    name: '',
    slug: '',
    developer: '',
    game_type: 'fangame' as CatalogGameType,
    description: '',
    cover_url: '',
    official_url: '',
    version_label: '1.0',
    platform: 'unknown',
    source_id: null as number | null
  });

  let filteredGames = $derived(
    games.filter((game) => {
      const matchesSearch = `${game.name} ${game.developer} ${game.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesCategory = categoryFilter === 'all' || game.game_type === categoryFilter;
      return matchesSearch && matchesCategory;
    })
  );

  let selectedVersion = $derived(
    versions.find((version) => version.id === selectedVersionId) ?? null
  );

  let selectedLinkableGame = $derived(
    linkableGames.find((game) => game.id === linkGameId) ?? null
  );

  let linkMovesExisting = $derived(
    selectedLinkableGame?.linked_catalog_game_id != null &&
      selectedLinkableGame.linked_catalog_game_id !== selectedGame?.id
  );

  let linkUpdatesExisting = $derived(
    selectedLinkableGame?.linked_catalog_game_id != null &&
      selectedLinkableGame.linked_catalog_game_id === selectedGame?.id
  );

  onMount(() => {
    void refreshCatalog();
  });

  async function refreshCatalog() {
    loading = true;
    pageError = '';
    try {
      games = await listCatalogGames();
      sources = await listDataSources();
    } catch (error) {
      console.error('Error al cargar la enciclopedia:', error);
      pageError = 'No se ha podido cargar el catálogo local. Comprueba la base de datos.';
    } finally {
      loading = false;
    }
  }

  function slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function updateName(value: string) {
    draft.name = value;
    draft.slug = slugify(value);
  }

  function resetDraft() {
    editingGameId = null;
    draft = {
      name: '',
      slug: '',
      developer: '',
      game_type: 'fangame',
      description: '',
      cover_url: '',
      official_url: '',
      version_label: '1.0',
      platform: 'unknown',
      source_id: null
    };
    formError = '';
  }

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    formError = '';

    const isEditing = editingGameId !== null;
    if (!draft.name.trim() || !draft.slug.trim() || (!isEditing && !draft.version_label.trim())) {
      formError = isEditing
        ? 'Completa el nombre y el identificador.'
        : 'Completa el nombre, el identificador y la versión inicial.';
      return;
    }

    saving = true;
    try {
      if (editingGameId !== null) {
        const gameId = editingGameId;
        const input: CatalogGameUpdateInput = {
          name: draft.name,
          slug: draft.slug,
          developer: draft.developer,
          game_type: draft.game_type,
          description: draft.description,
          cover_url: draft.cover_url,
          official_url: draft.official_url,
          source_id: draft.source_id
        };

        await updateCatalogGame(gameId, input);
        await refreshCatalog();
        selectedGame = games.find((game) => game.id === gameId) ?? null;
        showForm = false;
        resetDraft();
      } else {
        const id = await createCatalogGame({ ...draft });
        showForm = false;
        resetDraft();
        await refreshCatalog();
        const created = games.find((game) => game.id === id);
        if (created) await openGame(created);
      }
    } catch (error) {
      console.error('Error al guardar la ficha del catálogo:', error);
      const message = error instanceof Error ? error.message : String(error);
      formError = message.includes('UNIQUE')
        ? 'Ya existe un juego con ese identificador. Prueba con otro.'
        : `No se ha podido guardar la ficha: ${message}`;
    } finally {
      saving = false;
    }
  }

  function openEditForm() {
    if (!selectedGame) return;

    const game = selectedGame;
    const preferredVersion = versions.find((version) => version.is_default === 1) ?? versions[0];
    draft = {
      name: game.name,
      slug: game.slug,
      developer: game.developer,
      game_type: game.game_type,
      description: game.description,
      cover_url: game.cover_url,
      official_url: game.official_url,
      version_label: preferredVersion?.version_label ?? '1.0',
      platform: preferredVersion?.platform ?? 'unknown',
      source_id: game.source_id
    };
    editingGameId = game.id;
    formError = '';
    showForm = true;
  }

  async function openDeleteConfirm() {
    if (!selectedGame) return;

    deleteInfo = null;
    deleteError = '';
    showDeleteConfirm = true;

    try {
      deleteInfo = await getCatalogGameDeletionInfo(selectedGame.id);
    } catch (error) {
      console.error('Error al consultar el contenido de la ficha:', error);
      deleteError = 'No se han podido consultar las versiones y vínculos de esta ficha.';
    }
  }

  async function confirmDeleteGame() {
    if (!selectedGame) return;

    const game = selectedGame;
    deleting = true;
    deleteError = '';

    try {
      await deleteCatalogGame(game.id);
      showDeleteConfirm = false;
      selectedGame = null;
      versions = [];
      selectedVersionId = null;
      summary = null;
      deleteInfo = null;
      await refreshCatalog();
    } catch (error) {
      console.error('Error al eliminar la ficha del catálogo:', error);
      const message = error instanceof Error ? error.message : String(error);
      deleteError = `No se ha podido eliminar la ficha: ${message}`;
    } finally {
      deleting = false;
    }
  }

  async function openGame(game: CatalogGame, pushToHistory = true) {
    selectedGame = game;
    pageError = '';
    detailTab = 'overview';
    showDeleteConfirm = false;
    deleteInfo = null;
    deleteError = '';
    showLinkDialog = false;
    linkGameId = null;
    linkVersionId = null;
    linkError = '';
    links = [];
    versions = [];
    selectedVersionId = null;
    summary = null;

    if (pushToHistory) {
      onGameOpen?.(game.id, game.name);
    }

    try {
      versions = await listCatalogGameVersions(game.id);
      links = await listCatalogGameLinks(game.id);
      selectedVersionId = versions[0]?.id ?? null;
      await refreshVersionSummary();
    } catch (error) {
      console.error('Error al cargar el detalle del juego:', error);
      pageError = 'No se han podido cargar los datos de esta ficha.';
    }
  }

  async function refreshVersionSummary() {
    summary = null;
    if (selectedVersionId === null) return;

    try {
      summary = await getVersionSummary(selectedVersionId);
    } catch (error) {
      console.error('Error al consultar el resumen de la versión:', error);
      pageError = 'No se ha podido consultar el contenido de esta versión.';
    }
  }

  async function changeVersion(value: string) {
    selectedVersionId = Number(value);
    await refreshVersionSummary();
  }

  function refreshSelectedGame() {
    if (!selectedGame) return;

    const gameId = selectedGame.id;
    selectedGame = games.find((game) => game.id === gameId) ?? selectedGame;
  }

  function resetVersionDraft() {
    versionFormMode = 'create';
    editingVersionId = null;
    versionPendingDelete = null;
    versionError = '';
    versionDraft = {
      version_label: '',
      platform: 'unknown',
      release_date: '',
      notes: '',
      is_default: false,
      source_id: null
    };
  }

  function openVersionManager() {
    resetVersionDraft();
    showVersionManager = true;
  }

  function startCreateVersion() {
    resetVersionDraft();
  }

  function startEditVersion(version: CatalogGameVersion) {
    versionFormMode = 'edit';
    editingVersionId = version.id;
    versionPendingDelete = null;
    versionError = '';
    versionDraft = {
      version_label: version.version_label,
      platform: version.platform,
      release_date: version.release_date,
      notes: version.notes,
      is_default: version.is_default === 1,
      source_id: version.source_id
    };
  }

  async function reloadVersions(preferredVersionId?: number) {
    if (!selectedGame) return;

    const targetId = preferredVersionId ?? selectedVersionId;
    versions = await listCatalogGameVersions(selectedGame.id);
    selectedVersionId = versions.some((version) => version.id === targetId)
      ? targetId
      : versions[0]?.id ?? null;
    await refreshVersionSummary();
  }

  async function saveVersion(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedGame) return;

    versionError = '';

    if (!versionDraft.version_label.trim()) {
      versionError = 'Escribe un nombre o número de versión.';
      return;
    }

    versionSaving = true;
    try {
      let preferredVersionId = editingVersionId ?? undefined;

      if (versionFormMode === 'edit' && editingVersionId !== null) {
        await updateCatalogGameVersion(editingVersionId, versionDraft);
      } else {
        preferredVersionId = await createCatalogGameVersion(selectedGame.id, versionDraft);
      }

      await refreshCatalog();
      refreshSelectedGame();
      await reloadVersions(preferredVersionId);
      resetVersionDraft();
    } catch (error) {
      console.error('Error al guardar la versión:', error);
      const message = error instanceof Error ? error.message : String(error);
      versionError = message.includes('UNIQUE')
        ? 'Ya existe una versión con ese nombre y plataforma en esta ficha.'
        : message;
    } finally {
      versionSaving = false;
    }
  }

  async function markDefaultVersion(version: CatalogGameVersion) {
    if (!selectedGame || version.is_default === 1) return;

    versionSaving = true;
    versionError = '';

    try {
      await updateCatalogGameVersion(version.id, {
        version_label: version.version_label,
        platform: version.platform,
        release_date: version.release_date,
        notes: version.notes,
        is_default: true,
        source_id: version.source_id
      });
      await refreshCatalog();
      refreshSelectedGame();
      await reloadVersions(version.id);
    } catch (error) {
      console.error('Error al cambiar la versión predeterminada:', error);
      versionError = error instanceof Error ? error.message : String(error);
    } finally {
      versionSaving = false;
    }
  }

  function requestDeleteVersion(version: CatalogGameVersion) {
    versionError = '';
    versionPendingDelete = version;
  }

  async function confirmDeleteVersion() {
    const version = versionPendingDelete;
    if (!version || !selectedGame) return;

    versionSaving = true;
    versionError = '';

    try {
      await deleteCatalogGameVersion(version.id);
      versionPendingDelete = null;
      if (editingVersionId === version.id) resetVersionDraft();
      await refreshCatalog();
      refreshSelectedGame();
      await reloadVersions();
    } catch (error) {
      console.error('Error al eliminar la versión:', error);
      versionError = error instanceof Error ? error.message : String(error);
    } finally {
      versionSaving = false;
    }
  }

  async function openLinkDialog() {
    if (!selectedGame) return;

    linkError = '';
    linkGameId = null;
    linkVersionId = null;
    linkSaving = false;

    try {
      linkableGames = await listLinkableLibraryGames();
      showLinkDialog = true;
    } catch (error) {
      console.error('Error al cargar la biblioteca para vincular:', error);
      pageError = 'No se ha podido cargar tu biblioteca personal.';
    }
  }

  async function submitLink(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedGame) return;

    const game = selectedLinkableGame;
    if (!game) {
      linkError = 'Elige una entrada de tu biblioteca.';
      return;
    }

    linkSaving = true;
    linkError = '';

    try {
      await linkLibraryGameToCatalog(
        selectedGame.id,
        game.id,
        linkVersionId,
        linkMovesExisting
      );
      links = await listCatalogGameLinks(selectedGame.id);
      linkableGames = await listLinkableLibraryGames();
      showLinkDialog = false;
    } catch (error) {
      console.error('Error al vincular la entrada de la biblioteca:', error);
      linkError = error instanceof Error ? error.message : String(error);
    } finally {
      linkSaving = false;
    }
  }

  async function unlinkGame(link: CatalogGameLink) {
    if (!selectedGame) return;

    unlinkingGameId = link.installed_game_id;
    pageError = '';

    try {
      await unlinkLibraryGameFromCatalog(selectedGame.id, link.installed_game_id);
      links = await listCatalogGameLinks(selectedGame.id);
      linkableGames = await listLinkableLibraryGames();
    } catch (error) {
      console.error('Error al desvincular la entrada de la biblioteca:', error);
      pageError = 'No se ha podido desvincular esta entrada de la biblioteca.';
    } finally {
      unlinkingGameId = null;
    }
  }

  function resetSourceDraft() {
    sourceError = '';
    sourceDraft = {
      source_key: '',
      name: '',
      source_type: 'community',
      homepage_url: '',
      license_name: '',
      attribution_text: '',
      terms_url: ''
    };
  }

  function openSourceManager(context: 'toolbar' | 'game' | 'version') {
    sourceDialogContext = context;
    sourceFormOpen = false;
    resetSourceDraft();
    showSourceManager = true;
  }

  function sourceTypeLabel(type: string): string {
    switch (type) {
      case 'official': return 'Oficial';
      case 'community': return 'Comunidad';
      case 'api': return 'API';
      case 'manual': return 'Manual';
      default: return 'Otra';
    }
  }

  function toggleSourceForm() {
    sourceFormOpen = !sourceFormOpen;
    if (sourceFormOpen) resetSourceDraft();
    else sourceError = '';
  }

  async function saveSource(event: SubmitEvent) {
    event.preventDefault();
    sourceError = '';

    if (!sourceDraft.name.trim()) {
      sourceError = 'La fuente necesita un nombre.';
      return;
    }

    sourceSaving = true;
    try {
      const sourceId = await createDataSource(sourceDraft);
      sources = await listDataSources();

      if (sourceDialogContext === 'game') {
        draft.source_id = sourceId;
      } else if (sourceDialogContext === 'version') {
        versionDraft.source_id = sourceId;
      }

      showSourceManager = false;
      sourceFormOpen = false;
    } catch (error) {
      console.error('Error al guardar la fuente de datos:', error);
      const message = error instanceof Error ? error.message : String(error);
      sourceError = message.includes('UNIQUE')
        ? 'Ya existe una fuente con esa clave interna.'
        : message;
    } finally {
      sourceSaving = false;
    }
  }

  function categoryLabel(type: CatalogGameType): string {
    switch (type) {
      case 'official': return 'Juego oficial';
      case 'fangame': return 'Fangame';
      case 'rom_hack': return 'ROM hack';
      default: return 'Otro';
    }
  }

  function isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  function platformLabel(platform: string): string {
    const labels: Record<string, string> = {
      unknown: 'Sin especificar',
      windows: 'Windows',
      gba: 'Game Boy Advance',
      nds: 'Nintendo DS',
      '3ds': 'Nintendo 3DS',
      switch: 'Nintendo Switch',
      other: 'Otra plataforma'
    };
    return labels[platform] ?? platform.toUpperCase();
  }

  // Bloquear el scroll del fondo cuando cualquier modal de la Enciclopedia esté abierto.
  $effect(() => {
    const isOpen = showForm || showDeleteConfirm || showLinkDialog || showSourceManager || showVersionManager;
    if (!isOpen) return;
    return acquireScrollLock();
  });

  // Restaurar la ficha de un juego cuando el historial de navegación lo indique.
  $effect(() => {
    const id = restoreGameId;
    if (id === null || id === undefined) {
      // El historial retrocedió a la vista de catálogo
      selectedGame = null;
      return;
    }
    // Sólo restaurar si el juego no está ya abierto
    if (selectedGame?.id === id) return;
    const game = games.find((g) => g.id === id);
    if (game) void openGame(game, false);
  });
</script>

<section class="encyclopedia">
  {#if selectedGame}
    <div class="enc-detail-topline">
      <button class="enc-back-button" type="button" onclick={() => { selectedGame = null; pageError = ''; showDeleteConfirm = false; deleteInfo = null; deleteError = ''; showLinkDialog = false; links = []; onGameClose?.(); }}>
        <span aria-hidden="true">←</span> Volver al catálogo
      </button>
      <span class="enc-kicker">FICHA DE JUEGO</span>
    </div>

    <header class="enc-detail-hero">
      {#if isHttpUrl(selectedGame.cover_url)}
        <img class="enc-detail-cover" src={selectedGame.cover_url} alt={`Portada de ${selectedGame.name}`} />
      {:else}
        <div class="enc-detail-cover enc-cover-placeholder" aria-hidden="true">✦</div>
      {/if}
      <div class="enc-detail-copy">
        <span class="enc-category">{categoryLabel(selectedGame.game_type)}</span>
        <h1>{selectedGame.name}</h1>
        <p class="enc-byline">{selectedGame.developer}</p>
        {#if selectedGame.description}
          <p class="enc-description">{selectedGame.description}</p>
        {:else}
          <p class="enc-description enc-muted">Todavía no hay una descripción para este juego.</p>
        {/if}
        <p class="enc-attribution">
          {#if selectedGame.source_name}
            Fuente:
            {#if isHttpUrl(selectedGame.source_homepage ?? '')}
              <a class="enc-attribution-link" href={selectedGame.source_homepage ?? ''} target="_blank" rel="noreferrer">{selectedGame.source_name} ↗</a>
            {:else}
              <span>{selectedGame.source_name}</span>
            {/if}
            {#if selectedGame.source_attribution}<span> · {selectedGame.source_attribution}</span>{/if}
            {#if selectedGame.source_license}<span> · Licencia: {selectedGame.source_license}</span>{/if}
          {:else}
            Entrada manual, sin fuente externa.
          {/if}
        </p>
        {#if isHttpUrl(selectedGame.official_url)}
          <a class="enc-external-link" href={selectedGame.official_url} target="_blank" rel="noreferrer">Web del proyecto ↗</a>
        {/if}
        <div class="enc-hero-actions">
          <button class="enc-secondary-button" type="button" onclick={openEditForm}>Editar ficha</button>
          <button class="enc-danger-button" type="button" onclick={() => void openDeleteConfirm()}>Eliminar ficha</button>
        </div>

        <div class="enc-library-block">
          <div class="enc-library-heading">
            <span class="enc-kicker">BIBLIOTECA</span>
            <button class="enc-link-button" type="button" onclick={() => void openLinkDialog()}>Vincular juego</button>
          </div>
          {#if links.length > 0}
            <ul class="enc-library-list">
              {#each links as link (link.installed_game_id)}
                <li>
                  <span>
                    {link.name}
                    {#if link.version_label || link.version}
                      <small>{link.version_label ?? link.version}</small>
                    {/if}
                  </span>
                  <button
                    class="enc-link-button"
                    type="button"
                    disabled={unlinkingGameId === link.installed_game_id}
                    onclick={() => void unlinkGame(link)}
                  >
                    {unlinkingGameId === link.installed_game_id ? 'Desvinculando…' : 'Desvincular'}
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="enc-library-empty">Esta ficha no está vinculada a ningún juego de tu biblioteca.</p>
          {/if}
        </div>
      </div>
    </header>

    <div class="enc-version-bar">
      <label for="enc-version-select">Versión consultada</label>
      <div class="enc-version-controls">
        <select id="enc-version-select" value={selectedVersionId ?? ''} onchange={(event) => void changeVersion(event.currentTarget.value)}>
          {#each versions as version (version.id)}
            <option value={version.id}>{version.version_label} · {platformLabel(version.platform)}</option>
          {/each}
        </select>
        <button class="enc-secondary-button enc-compact-button" type="button" onclick={openVersionManager}>
          Gestionar versiones
        </button>
      </div>
    </div>

    {#if selectedVersion}
      <div class="enc-version-meta">
        <span>{platformLabel(selectedVersion.platform)}</span>
        {#if selectedVersion.release_date}<span>Lanzamiento: {selectedVersion.release_date}</span>{/if}
        {#if selectedVersion.is_default === 1}<span class="enc-default-badge">Predeterminada</span>{/if}
        {#if selectedVersion.notes}<span>{selectedVersion.notes}</span>{/if}
        {#if selectedVersion.source_name}
          <span>
            Fuente: {selectedVersion.source_name}
            {#if selectedVersion.source_attribution} · {selectedVersion.source_attribution}{/if}
            {#if selectedVersion.source_license} · Licencia: {selectedVersion.source_license}{/if}
          </span>
        {:else}
          <span>Entrada manual</span>
        {/if}
      </div>
    {/if}

    <nav class="enc-tabs" aria-label="Secciones de la ficha">
      <button type="button" class:active={detailTab === 'overview'} onclick={() => detailTab = 'overview'}>Resumen</button>
      <button type="button" class:active={detailTab === 'pokedex'} onclick={() => detailTab = 'pokedex'}>Pokédex</button>
      <button type="button" class:active={detailTab === 'world'} onclick={() => detailTab = 'world'}>Mundo</button>
      <button type="button" class:active={detailTab === 'guides'} onclick={() => detailTab = 'guides'}>Guías</button>
    </nav>

    {#if pageError}
      <div class="enc-alert" role="alert">{pageError}</div>
    {/if}

    {#if detailTab === 'overview'}
      <div class="enc-stat-grid">
        <div class="enc-stat"><span>Pokémon</span><strong>{summary?.pokemon_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Regiones</span><strong>{summary?.region_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Ubicaciones</span><strong>{summary?.location_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Encuentros</span><strong>{summary?.encounter_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Objetos</span><strong>{summary?.item_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Guías publicadas</span><strong>{summary?.guide_count ?? '—'}</strong></div>
      </div>
      <div class="enc-info-panel">
        <span class="enc-info-icon">◇</span>
        <div>
          <h2>La aventura, organizada por versión</h2>
          <p>Esta ficha ya está conectada con la base de datos local. Aquí se reunirán la Pokédex, los encuentros, las ubicaciones, los objetos y las guías de esta versión concreta.</p>
        </div>
      </div>
    {:else if detailTab === 'pokedex'}
      {#if selectedVersion}
        <PokedexView
          gameName={selectedGame.name}
          versionLabel={selectedVersion.version_label}
          versionId={selectedVersion.id}
          onChanged={() => void refreshVersionSummary()}
        />
      {:else}
        <div class="enc-empty-panel">
          <span class="enc-empty-icon">◈</span>
          <h2>Pokédex de {selectedGame.name}</h2>
          <p>Añade una versión a esta ficha para empezar a registrar sus Pokémon.</p>
          <span class="enc-subtle">Cada versión mantiene su propia Pokédex, independiente del resto.</span>
        </div>
      {/if}
    {:else if detailTab === 'world'}
      <div class="enc-stat-grid enc-stat-grid-world">
        <div class="enc-stat"><span>Regiones</span><strong>{summary?.region_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Ubicaciones</span><strong>{summary?.location_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Encuentros</span><strong>{summary?.encounter_count ?? '—'}</strong></div>
        <div class="enc-stat"><span>Mapas</span><strong>{summary?.map_count ?? '—'}</strong></div>
      </div>
      <div class="enc-empty-panel compact">
        <span class="enc-empty-icon">⌖</span>
        <h2>Mapa del mundo</h2>
        <p>Cuando añadamos regiones y ubicaciones, aquí podrás explorar rutas, encuentros y objetos por zona.</p>
      </div>
    {:else}
      <div class="enc-empty-panel">
        <span class="enc-empty-icon">▤</span>
        <h2>Guías y soluciones</h2>
        <p>{summary?.guide_count ? `Hay ${summary.guide_count} guías publicadas para esta versión.` : 'Todavía no hay guías publicadas para esta versión.'}</p>
        <span class="enc-subtle">Las guías se guardarán localmente y estarán disponibles sin conexión.</span>
      </div>
    {/if}

  {:else}
    <header class="enc-page-hero">
      <div>
        <div class="enc-eyebrow"><span></span> CONOCIMIENTO POKÉMON</div>
        <h1>La enciclopedia <em>DexDeck.</em></h1>
        <p>Explora juegos, versiones, Pokédex, regiones y guías desde una única biblioteca de conocimiento.</p>
      </div>
      <div class="enc-hero-orbit" aria-hidden="true"><span>◈</span></div>
    </header>

    <div class="enc-toolbar">
      <div class="enc-search-wrap">
        <span aria-hidden="true">⌕</span>
        <input bind:value={search} type="search" placeholder="Buscar juegos, desarrolladores..." aria-label="Buscar en la enciclopedia" />
      </div>
      <button class="enc-secondary-button" type="button" onclick={() => openSourceManager('toolbar')}>
        Fuentes
      </button>
      <button class="enc-primary-button" type="button" onclick={() => { resetDraft(); showForm = true; }}>
        <span aria-hidden="true">＋</span> Añadir juego
      </button>
    </div>

    <div class="enc-filter-row" aria-label="Filtrar catálogo">
      <button type="button" class:active={categoryFilter === 'all'} onclick={() => categoryFilter = 'all'}>Todos <span>{games.length}</span></button>
      <button type="button" class:active={categoryFilter === 'official'} onclick={() => categoryFilter = 'official'}>Oficiales</button>
      <button type="button" class:active={categoryFilter === 'fangame'} onclick={() => categoryFilter = 'fangame'}>Fangames</button>
      <button type="button" class:active={categoryFilter === 'rom_hack'} onclick={() => categoryFilter = 'rom_hack'}>ROM hacks</button>
      <button type="button" class:active={categoryFilter === 'other'} onclick={() => categoryFilter = 'other'}>Otros</button>
    </div>

    {#if pageError}
      <div class="enc-alert" role="alert">{pageError}</div>
    {/if}

    {#if loading}
      <div class="enc-loading"><span class="enc-spinner"></span> Cargando catálogo local...</div>
    {:else if filteredGames.length > 0}
      <div class="enc-game-grid">
        {#each filteredGames as game (game.id)}
          <button class="enc-game-card" type="button" onclick={() => void openGame(game)}>
            {#if isHttpUrl(game.cover_url)}
              <img class="enc-game-cover" src={game.cover_url} alt="" loading="lazy" />
            {:else}
              <div class="enc-game-cover enc-cover-placeholder" aria-hidden="true">✦</div>
            {/if}
            <div class="enc-card-body">
              <div class="enc-card-topline"><span class="enc-category">{categoryLabel(game.game_type)}</span><span class="enc-card-arrow">↗</span></div>
              <h2>{game.name}</h2>
              <p class="enc-card-developer">{game.developer}</p>
              <div class="enc-card-footer">
                <span>{game.primary_version ?? 'Sin versión'}</span>
                <span>{game.version_count} {game.version_count === 1 ? 'versión' : 'versiones'}</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {:else if games.length === 0}
      <div class="enc-empty-panel enc-first-entry">
        <span class="enc-empty-icon">◈</span>
        <h2>Tu enciclopedia empieza aquí</h2>
        <p>El catálogo está vacío por ahora. Añade una ficha de juego y su primera versión para empezar a organizar su información.</p>
        <button class="enc-primary-button" type="button" onclick={() => { resetDraft(); showForm = true; }}>Añadir el primer juego</button>
      </div>
    {:else}
      <div class="enc-empty-panel compact">
        <span class="enc-empty-icon">⌕</span>
        <h2>No hay resultados</h2>
        <p>Prueba con otro nombre o cambia el filtro seleccionado.</p>
      </div>
    {/if}
  {/if}

  {#if showForm}
    <div class="enc-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget && !saving) showForm = false; }}>
      <dialog open class="enc-modal" aria-modal="true" aria-labelledby="enc-form-title">
        <div class="enc-modal-heading">
          <div>
            <span class="enc-kicker">{editingGameId === null ? 'NUEVA ENTRADA' : 'EDITAR FICHA'}</span>
            <h2 id="enc-form-title">{editingGameId === null ? 'Añadir al catálogo' : 'Editar ficha del catálogo'}</h2>
          </div>
          <button class="enc-close-button" type="button" aria-label="Cerrar" disabled={saving} onclick={() => showForm = false}>×</button>
        </div>
        <p class="enc-modal-intro">
          {editingGameId === null
            ? 'Esta ficha pertenece a la enciclopedia. No instala el juego ni modifica tu biblioteca personal.'
            : 'Modifica los datos generales del juego. Sus versiones y el contenido asociado no cambiarán.'}
        </p>

        <form class="enc-form" onsubmit={handleSave}>
          <label>Nombre del juego <input required maxlength="120" value={draft.name} oninput={(event) => updateName(event.currentTarget.value)} placeholder="Pokémon Rojo Fuego" /></label>
          <label>Identificador interno <input required maxlength="140" bind:value={draft.slug} placeholder="pokemon-rojo-fuego" /><small>Se genera automáticamente a partir del nombre; puedes modificarlo.</small></label>
          <div class="enc-form-row">
            <label>Desarrollador <input maxlength="120" bind:value={draft.developer} placeholder="Nintendo / Game Freak" /></label>
            <label>Tipo <select bind:value={draft.game_type}><option value="official">Oficial</option><option value="fangame">Fangame</option><option value="rom_hack">ROM hack</option><option value="other">Otro</option></select></label>
          </div>
          {#if editingGameId === null}
          <div class="enc-form-row">
            <label>Primera versión <input required maxlength="80" bind:value={draft.version_label} placeholder="1.0" /></label>
            <label>Plataforma <select bind:value={draft.platform}><option value="unknown">Sin especificar</option><option value="windows">Windows</option><option value="gba">Game Boy Advance</option><option value="nds">Nintendo DS</option><option value="3ds">Nintendo 3DS</option><option value="switch">Nintendo Switch</option><option value="other">Otra</option></select></label>
          </div>
          {/if}
          <label>
            Descripción
            <textarea
              rows="3"
              maxlength="1200"
              bind:value={draft.description}
              placeholder="Una breve descripción del juego..."
            ></textarea>
          </label>
          <div class="enc-form-row">
            <label>URL de portada <input type="url" maxlength="1000" bind:value={draft.cover_url} placeholder="https://..." /></label>
            <label>Web oficial <input type="url" maxlength="1000" bind:value={draft.official_url} placeholder="https://..." /></label>
          </div>
          <label>
            Fuente de los datos
            <div class="enc-input-with-action">
              <select bind:value={draft.source_id}>
                <option value={null}>Entrada manual (sin fuente externa)</option>
                {#each sources as source (source.id)}
                  <option value={source.id}>{source.name}</option>
                {/each}
              </select>
              <button class="enc-secondary-button enc-compact-button" type="button" disabled={saving} onclick={() => openSourceManager('game')}>Gestionar</button>
            </div>
            <small>Si no eliges una fuente, la ficha se registra como entrada manual.</small>
          </label>
          {#if formError}<div class="enc-alert" role="alert">{formError}</div>{/if}
          <div class="enc-form-actions">
            <button class="enc-secondary-button" type="button" disabled={saving} onclick={() => showForm = false}>Cancelar</button>
            <button class="enc-primary-button" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editingGameId === null ? 'Crear ficha' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  {/if}

  {#if showDeleteConfirm && selectedGame}
    <div class="enc-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget && !deleting) showDeleteConfirm = false; }}>
      <dialog open class="enc-modal enc-delete-modal" aria-modal="true" aria-labelledby="enc-delete-title">
        <div class="enc-modal-heading">
          <div>
            <span class="enc-kicker">ELIMINAR FICHA</span>
            <h2 id="enc-delete-title">Eliminar «{selectedGame.name}»</h2>
          </div>
          <button class="enc-close-button" type="button" aria-label="Cerrar" disabled={deleting} onclick={() => showDeleteConfirm = false}>×</button>
        </div>
        <p class="enc-modal-intro">
          Esta acción solo afecta al catálogo de la Enciclopedia. Los juegos de tu biblioteca personal no se borran.
        </p>

        {#if deleteInfo}
          <ul class="enc-delete-summary">
            <li>
              Se eliminarán <strong>{deleteInfo.version_count}</strong>
              {deleteInfo.version_count === 1 ? 'versión' : 'versiones'} y todo su contenido asociado.
            </li>
            <li>
              Se desvincularán <strong>{deleteInfo.link_count}</strong>
              {deleteInfo.link_count === 1 ? 'entrada' : 'entradas'} de la biblioteca. Las entradas seguirán existiendo.
            </li>
          </ul>
        {:else if !deleteError}
          <p class="enc-muted">Consultando versiones y vínculos…</p>
        {/if}

        {#if deleteError}<div class="enc-alert" role="alert">{deleteError}</div>{/if}

        <div class="enc-form-actions">
          <button class="enc-secondary-button" type="button" disabled={deleting} onclick={() => showDeleteConfirm = false}>Cancelar</button>
          <button class="enc-danger-button" type="button" disabled={deleting || !deleteInfo} onclick={() => void confirmDeleteGame()}>
            {deleting ? 'Eliminando...' : 'Eliminar ficha del catálogo'}
          </button>
        </div>
      </dialog>
    </div>
  {/if}

  {#if showLinkDialog && selectedGame}
    <div class="enc-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget && !linkSaving) showLinkDialog = false; }}>
      <dialog open class="enc-modal" aria-modal="true" aria-labelledby="enc-link-title">
        <div class="enc-modal-heading">
          <div>
            <span class="enc-kicker">VINCULAR BIBLIOTECA</span>
            <h2 id="enc-link-title">{selectedGame.name}</h2>
          </div>
          <button class="enc-close-button" type="button" aria-label="Cerrar" disabled={linkSaving} onclick={() => showLinkDialog = false}>×</button>
        </div>
        <p class="enc-modal-intro">
          Una entrada de tu biblioteca puede apuntar como mucho a una ficha del catálogo. Vincular no modifica ni mueve los archivos del juego.
        </p>

        {#if linkableGames.length === 0}
          <div class="enc-empty-panel compact">
            <span class="enc-empty-icon">▦</span>
            <h2>Tu biblioteca está vacía</h2>
            <p>Añade un juego desde la sección Biblioteca para poder vincularlo con esta ficha.</p>
          </div>
        {:else}
          <form class="enc-form" onsubmit={submitLink}>
            <label>
              Entrada de la biblioteca
              <select bind:value={linkGameId}>
                <option value={null}>Elige una entrada…</option>
                {#each linkableGames as game (game.id)}
                  <option value={game.id}>
                    {game.name} · {game.version}{#if game.linked_catalog_game_id && game.linked_catalog_game_id !== selectedGame.id} — ya vinculada a {game.linked_catalog_game_name}{/if}
                  </option>
                {/each}
              </select>
            </label>
            <label>
              Versión del catálogo (opcional)
              <select bind:value={linkVersionId}>
                <option value={null}>Solo la ficha, sin versión concreta</option>
                {#each versions as version (version.id)}
                  <option value={version.id}>{version.version_label} · {platformLabel(version.platform)}</option>
                {/each}
              </select>
            </label>

            {#if linkMovesExisting}
              <div class="enc-alert" role="alert">
                «{selectedLinkableGame?.name}» ya está vinculada a «{selectedLinkableGame?.linked_catalog_game_name}».
                Si continúas, el vínculo se moverá a esta ficha.
              </div>
            {/if}

            {#if linkError}<div class="enc-alert" role="alert">{linkError}</div>{/if}

            <div class="enc-form-actions">
              <button class="enc-secondary-button" type="button" disabled={linkSaving} onclick={() => showLinkDialog = false}>Cancelar</button>
              <button class="enc-primary-button" type="submit" disabled={linkSaving || linkGameId === null}>
                {linkSaving
                  ? 'Vinculando...'
                  : linkMovesExisting
                    ? 'Mover vínculo'
                    : linkUpdatesExisting
                      ? 'Actualizar vínculo'
                      : 'Vincular'}
              </button>
            </div>
          </form>
        {/if}
      </dialog>
    </div>
  {/if}

  {#if showVersionManager && selectedGame}
    <div class="enc-modal-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget && !versionSaving) showVersionManager = false; }}>
      <dialog open class="enc-modal enc-version-modal" aria-modal="true" aria-labelledby="enc-versions-title">
        <div class="enc-modal-heading">
          <div>
            <span class="enc-kicker">VERSIONES</span>
            <h2 id="enc-versions-title">{selectedGame.name}</h2>
          </div>
          <button class="enc-close-button" type="button" aria-label="Cerrar" disabled={versionSaving} onclick={() => showVersionManager = false}>×</button>
        </div>
        <p class="enc-modal-intro">
          Cada ficha conserva al menos una versión. La versión predeterminada es la que se consulta primero.
        </p>

        {#if versionError}<div class="enc-alert" role="alert">{versionError}</div>{/if}

        <div class="enc-version-list">
          {#each versions as version (version.id)}
            <div class="enc-version-item" class:is-default={version.is_default === 1}>
              <div class="enc-version-item-copy">
                <div class="enc-version-item-title">
                  <strong>{version.version_label}</strong>
                  <span>{platformLabel(version.platform)}</span>
                  {#if version.is_default === 1}<span class="enc-default-badge">Predeterminada</span>{/if}
                </div>
                {#if version.release_date}<span class="enc-version-date">Lanzamiento: {version.release_date}</span>{/if}
                {#if version.notes}<p>{version.notes}</p>{/if}
              </div>
              <div class="enc-version-actions">
                {#if version.is_default !== 1}
                  <button type="button" disabled={versionSaving} onclick={() => void markDefaultVersion(version)}>Marcar predeterminada</button>
                {/if}
                <button type="button" disabled={versionSaving} onclick={() => startEditVersion(version)}>Editar</button>
                <button class="enc-mini-danger" type="button" disabled={versionSaving || versions.length <= 1} onclick={() => requestDeleteVersion(version)}>Eliminar</button>
              </div>
            </div>
          {/each}
        </div>

        {#if versionPendingDelete}
          <div class="enc-version-confirm" role="alert">
            <p>
              ¿Eliminar la versión <strong>{versionPendingDelete.version_label} · {platformLabel(versionPendingDelete.platform)}</strong>?
              También se borrarán sus datos asociados.
            </p>
            <div class="enc-form-actions">
              <button class="enc-secondary-button" type="button" disabled={versionSaving} onclick={() => versionPendingDelete = null}>Cancelar</button>
              <button class="enc-danger-button" type="button" disabled={versionSaving} onclick={() => void confirmDeleteVersion()}>
                {versionSaving ? 'Eliminando...' : 'Eliminar versión'}
              </button>
            </div>
          </div>
        {/if}

        <form class="enc-form enc-version-form" onsubmit={saveVersion}>
          <div class="enc-form-section-title">
            {versionFormMode === 'edit' ? 'Editar versión' : 'Añadir versión'}
          </div>
          <div class="enc-form-row">
            <label>Versión <input required maxlength="80" bind:value={versionDraft.version_label} placeholder="1.0" /></label>
            <label>Plataforma <select bind:value={versionDraft.platform}><option value="unknown">Sin especificar</option><option value="windows">Windows</option><option value="gba">Game Boy Advance</option><option value="nds">Nintendo DS</option><option value="3ds">Nintendo 3DS</option><option value="switch">Nintendo Switch</option><option value="other">Otra</option></select></label>
          </div>
          <div class="enc-form-row">
            <label>Fecha de lanzamiento <input type="date" bind:value={versionDraft.release_date} /></label>
            <label class="enc-checkbox-label"><input type="checkbox" bind:checked={versionDraft.is_default} disabled={versionFormMode === 'edit' && versions.length <= 1} /> Versión predeterminada</label>
          </div>
          <label>Notas <textarea rows="2" maxlength="1200" bind:value={versionDraft.notes} placeholder="Cambios, edición o detalles de esta versión..."></textarea></label>
          <label>
            Fuente de esta versión
            <div class="enc-input-with-action">
              <select bind:value={versionDraft.source_id}>
                <option value={null}>Entrada manual (sin fuente externa)</option>
                {#each sources as source (source.id)}
                  <option value={source.id}>{source.name}</option>
                {/each}
              </select>
              <button class="enc-secondary-button enc-compact-button" type="button" disabled={versionSaving} onclick={() => openSourceManager('version')}>Gestionar</button>
            </div>
          </label>
          <div class="enc-form-actions">
            {#if versionFormMode === 'edit'}
              <button class="enc-secondary-button" type="button" disabled={versionSaving} onclick={resetVersionDraft}>Cancelar edición</button>
            {/if}
            <button class="enc-primary-button" type="submit" disabled={versionSaving}>
              {versionSaving ? 'Guardando...' : versionFormMode === 'edit' ? 'Guardar versión' : 'Añadir versión'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  {/if}

  {#if showSourceManager}
    <div
      class="enc-modal-backdrop enc-modal-backdrop-top"
      role="presentation"
      onclick={(event) => { if (event.target === event.currentTarget && !sourceSaving) showSourceManager = false; }}
    >
      <dialog open class="enc-modal enc-source-modal" aria-modal="true" aria-labelledby="enc-sources-title">
        <div class="enc-modal-heading">
          <div>
            <span class="enc-kicker">FUENTES DE DATOS</span>
            <h2 id="enc-sources-title">Atribución del contenido</h2>
          </div>
          <button class="enc-close-button" type="button" aria-label="Cerrar" disabled={sourceSaving} onclick={() => showSourceManager = false}>×</button>
        </div>
        <p class="enc-modal-intro">
          Registra de dónde procede cada ficha o versión. Sin fuente asignada, el contenido se considera una entrada manual.
        </p>

        {#if sourceError && !sourceFormOpen}<div class="enc-alert" role="alert">{sourceError}</div>{/if}

        {#if sources.length > 0}
          <ul class="enc-source-list">
            {#each sources as source (source.id)}
              <li class="enc-source-item">
                <div class="enc-source-item-title">
                  <strong>{source.name}</strong>
                  <span class="enc-default-badge">{sourceTypeLabel(source.source_type)}</span>
                </div>
                {#if source.attribution_text}<p>{source.attribution_text}</p>{/if}
                <div class="enc-source-item-meta">
                  {#if isHttpUrl(source.homepage_url)}
                    <a class="enc-attribution-link" href={source.homepage_url} target="_blank" rel="noreferrer">Web de la fuente ↗</a>
                  {/if}
                  {#if source.license_name}<span>Licencia: {source.license_name}</span>{/if}
                  {#if source.terms_url && isHttpUrl(source.terms_url)}
                    <a class="enc-attribution-link" href={source.terms_url} target="_blank" rel="noreferrer">Términos ↗</a>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="enc-muted">Todavía no hay fuentes registradas.</p>
        {/if}

        {#if sourceFormOpen}
          <form class="enc-form enc-source-form" onsubmit={saveSource}>
            <div class="enc-form-section-title">Nueva fuente</div>
            <div class="enc-form-row">
              <label>Nombre <input required maxlength="120" bind:value={sourceDraft.name} placeholder="PokéAPI" /></label>
              <label>
                Tipo
                <select bind:value={sourceDraft.source_type}>
                  <option value="official">Oficial</option>
                  <option value="community">Comunidad</option>
                  <option value="api">API</option>
                  <option value="manual">Manual</option>
                  <option value="other">Otra</option>
                </select>
              </label>
            </div>
            <div class="enc-form-row">
              <label>Clave interna <input maxlength="80" bind:value={sourceDraft.source_key} placeholder="se genera del nombre" /></label>
              <label>Web <input type="url" maxlength="1000" bind:value={sourceDraft.homepage_url} placeholder="https://..." /></label>
            </div>
            <div class="enc-form-row">
              <label>Licencia <input maxlength="160" bind:value={sourceDraft.license_name} placeholder="CC BY-SA 4.0" /></label>
              <label>Términos de uso <input type="url" maxlength="1000" bind:value={sourceDraft.terms_url} placeholder="https://..." /></label>
            </div>
            <label>
              Texto de atribución
              <textarea rows="2" maxlength="600" bind:value={sourceDraft.attribution_text} placeholder="Cómo debe acreditarse esta fuente."></textarea>
            </label>
            {#if sourceError}<div class="enc-alert" role="alert">{sourceError}</div>{/if}
            <div class="enc-form-actions">
              <button class="enc-secondary-button" type="button" disabled={sourceSaving} onclick={toggleSourceForm}>Cancelar</button>
              <button class="enc-primary-button" type="submit" disabled={sourceSaving}>
                {sourceSaving ? 'Guardando...' : 'Guardar fuente'}
              </button>
            </div>
          </form>
        {:else}
          <div class="enc-form-actions">
            <button class="enc-secondary-button" type="button" onclick={toggleSourceForm}>Añadir fuente</button>
            <button class="enc-primary-button" type="button" onclick={() => showSourceManager = false}>Listo</button>
          </div>
        {/if}
      </dialog>
    </div>
  {/if}
</section>

<style>
  .encyclopedia {
    --enc-accent: #71dfc0;
    --enc-panel: rgba(255, 255, 255, 0.045);
    --enc-panel-strong: rgba(255, 255, 255, 0.075);
    --enc-border: rgba(148, 163, 184, 0.17);
    --enc-muted: #94a3b8;
    --enc-input: rgba(8, 15, 29, 0.58);
    color: var(--enc-text, inherit);
    width: 100%;
    min-width: 0;
  }

  :global(.app-shell[data-theme='light']) .encyclopedia {
    --enc-accent: #087f68;
    --enc-panel: rgba(255, 255, 255, 0.86);
    --enc-panel-strong: #ffffff;
    --enc-border: rgba(71, 85, 105, 0.17);
    --enc-muted: #64748b;
    --enc-input: #ffffff;
    --enc-text: #172033;
  }

  :global(.app-shell[data-theme='dark']) .encyclopedia,
  :global(.app-shell[data-theme='glass']) .encyclopedia {
    --enc-text: #e8edf6;
  }

  .enc-page-hero, .enc-detail-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
    padding: clamp(24px, 4vw, 42px);
    border: 1px solid var(--enc-border);
    border-radius: 24px;
    background: radial-gradient(ellipse at 88% 20%, rgba(91, 207, 179, 0.13), transparent 34%), var(--enc-panel);
    overflow: hidden;
  }

  .enc-page-hero h1, .enc-detail-copy h1 {
    margin: 11px 0 9px;
    font-size: clamp(2rem, 4vw, 3.35rem);
    line-height: 1.05;
    letter-spacing: -0.055em;
    font-weight: 760;
  }

  .enc-page-hero h1 em { color: var(--enc-accent); font-style: normal; }
  .enc-page-hero p, .enc-description { max-width: 650px; color: var(--enc-muted); line-height: 1.65; margin: 0; }
  .enc-eyebrow, .enc-kicker { color: var(--enc-accent); font-size: 0.69rem; letter-spacing: 0.16em; font-weight: 750; }
  .enc-eyebrow { display: flex; align-items: center; gap: 9px; }
  .enc-eyebrow span { width: 22px; height: 1px; background: var(--enc-accent); }
  .enc-hero-orbit { flex: 0 0 150px; width: 150px; height: 150px; display: grid; place-items: center; border: 1px solid rgba(113, 223, 192, 0.27); border-radius: 50%; box-shadow: 0 0 0 18px rgba(113, 223, 192, 0.035), 0 0 0 38px rgba(113, 223, 192, 0.025); color: var(--enc-accent); font-size: 4.8rem; }

  .enc-toolbar { display: flex; gap: 14px; align-items: center; margin: 26px 0 16px; }
  .enc-search-wrap { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0 15px; height: 48px; border: 1px solid var(--enc-border); border-radius: 13px; background: var(--enc-panel); color: var(--enc-muted); }
  .enc-search-wrap > span { font-size: 1.4rem; }
  .enc-search-wrap input { width: 100%; min-width: 0; border: 0; outline: 0; color: inherit; background: transparent; font: inherit; }
  .enc-search-wrap input::placeholder { color: var(--enc-muted); }
  .enc-primary-button, .enc-secondary-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 17px; border-radius: 12px; border: 1px solid transparent; font: inherit; font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: transform 140ms ease, opacity 140ms ease, background 140ms ease; }
  .enc-primary-button { color: #08251e; background: var(--enc-accent); }
  .enc-primary-button:hover:not(:disabled), .enc-secondary-button:hover:not(:disabled) { transform: translateY(-1px); }
  .enc-primary-button:disabled, .enc-secondary-button:disabled { opacity: 0.55; cursor: not-allowed; }
  .enc-secondary-button { color: inherit; background: var(--enc-panel-strong); border-color: var(--enc-border); }
  .enc-danger-button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 17px; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 12px; color: #fca5a5; background: rgba(127, 29, 29, 0.16); font: inherit; font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: transform 140ms ease, background 140ms ease, opacity 140ms ease; }
  .enc-danger-button:hover:not(:disabled) { transform: translateY(-1px); background: rgba(127, 29, 29, 0.28); }
  .enc-danger-button:disabled { opacity: 0.55; cursor: not-allowed; }
  .enc-hero-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 14px; }
  .enc-library-block { max-width: 520px; margin-top: 16px; padding: 13px 15px; border: 1px solid var(--enc-border); border-radius: 13px; background: var(--enc-panel); }
  .enc-library-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .enc-library-list { display: flex; flex-direction: column; gap: 7px; margin: 10px 0 0; padding: 0; list-style: none; }
  .enc-library-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 7px; border-top: 1px solid var(--enc-border); font-size: 0.84rem; }
  .enc-library-list li:first-child { padding-top: 0; border-top: 0; }
  .enc-library-list small { margin-left: 6px; color: var(--enc-muted); font-size: 0.76rem; }
  .enc-library-empty { margin: 8px 0 0; color: var(--enc-muted); font-size: 0.8rem; line-height: 1.5; }
  .enc-attribution { margin: 10px 0 0; color: var(--enc-muted); font-size: 0.78rem; line-height: 1.55; }
  .enc-attribution-link { color: var(--enc-accent); text-decoration: none; }
  .enc-attribution-link:hover { text-decoration: underline; }
  .enc-input-with-action { display: flex; align-items: center; gap: 8px; }
  .enc-input-with-action select { flex: 1 1 auto; }
  .enc-input-with-action .enc-compact-button { flex: 0 0 auto; }
  .enc-form label small { color: var(--enc-muted); font-size: 0.72rem; font-weight: 500; }
  .enc-modal-backdrop-top { z-index: 1100; }
  .enc-source-modal { width: min(700px, 100%); }
  .enc-source-list { display: flex; flex-direction: column; gap: 9px; margin: 0 0 18px; padding: 0; list-style: none; }
  .enc-source-item { padding: 12px 14px; border: 1px solid var(--enc-border); border-radius: 12px; background: var(--enc-panel); }
  .enc-source-item-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .enc-source-item p { margin: 6px 0 0; color: var(--enc-muted); font-size: 0.8rem; line-height: 1.5; }
  .enc-source-item-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-top: 6px; color: var(--enc-muted); font-size: 0.76rem; }
  .enc-source-form { padding-top: 18px; border-top: 1px solid var(--enc-border); }
  .enc-link-button { padding: 4px 0; border: 0; color: var(--enc-accent); background: none; font: inherit; font-size: 0.78rem; font-weight: 650; cursor: pointer; }
  .enc-link-button:hover:not(:disabled) { text-decoration: underline; }
  .enc-link-button:disabled { opacity: 0.5; cursor: not-allowed; }

  .enc-filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 21px; }
  .enc-filter-row button, .enc-tabs button { border: 1px solid transparent; border-radius: 999px; padding: 9px 13px; color: var(--enc-muted); background: transparent; font: inherit; font-size: 0.82rem; cursor: pointer; }
  .enc-filter-row button.active, .enc-tabs button.active { color: var(--enc-accent); background: rgba(113, 223, 192, 0.09); border-color: rgba(113, 223, 192, 0.2); }
  .enc-filter-row button span { margin-left: 4px; opacity: 0.7; }
  .enc-game-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 17px; }
  .enc-game-card { min-width: 0; padding: 0; overflow: hidden; text-align: left; color: inherit; border: 1px solid var(--enc-border); border-radius: 17px; background: var(--enc-panel); cursor: pointer; transition: transform 150ms ease, border-color 150ms ease, background 150ms ease; }
  .enc-game-card:hover { transform: translateY(-3px); border-color: rgba(113, 223, 192, 0.42); background: var(--enc-panel-strong); }
  .enc-game-cover { display: block; width: 100%; height: 142px; object-fit: cover; background: linear-gradient(135deg, rgba(113, 223, 192, 0.15), rgba(71, 85, 105, 0.12)); }
  .enc-cover-placeholder { display: grid; place-items: center; color: var(--enc-accent); font-size: 3.1rem; }
  .enc-card-body { padding: 16px; }
  .enc-card-topline, .enc-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
  .enc-category { color: var(--enc-accent); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 750; }
  .enc-card-arrow { color: var(--enc-muted); }
  .enc-card-body h2 { margin: 9px 0 4px; font-size: 1.1rem; letter-spacing: -0.025em; }
  .enc-card-developer { margin: 0 0 18px; color: var(--enc-muted); font-size: 0.82rem; }
  .enc-card-footer { padding-top: 12px; border-top: 1px solid var(--enc-border); color: var(--enc-muted); font-size: 0.75rem; }

  .enc-empty-panel, .enc-info-panel { padding: 30px; border: 1px solid var(--enc-border); border-radius: 18px; background: var(--enc-panel); text-align: center; }
  .enc-empty-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; }
  .enc-empty-panel.compact { min-height: 190px; margin-top: 17px; }
  .enc-empty-icon { color: var(--enc-accent); font-size: 2rem; }
  .enc-empty-panel h2, .enc-info-panel h2 { margin: 12px 0 6px; font-size: 1.15rem; }
  .enc-empty-panel p, .enc-info-panel p { max-width: 590px; margin: 0; color: var(--enc-muted); line-height: 1.6; font-size: 0.9rem; }
  .enc-first-entry .enc-primary-button { margin-top: 19px; }
  .enc-subtle { color: var(--enc-muted); font-size: 0.78rem; margin-top: 12px; }
  .enc-loading { display: flex; align-items: center; justify-content: center; gap: 11px; min-height: 210px; color: var(--enc-muted); }
  .enc-spinner { width: 18px; height: 18px; border: 2px solid var(--enc-border); border-top-color: var(--enc-accent); border-radius: 50%; animation: enc-spin 750ms linear infinite; }
  @keyframes enc-spin { to { transform: rotate(360deg); } }
  .enc-alert { padding: 12px 14px; margin: 14px 0; color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 11px; background: rgba(127, 29, 29, 0.12); font-size: 0.84rem; }

  .enc-detail-topline { display: flex; justify-content: space-between; align-items: center; margin-bottom: 17px; }
  .enc-back-button { padding: 7px 0; border: 0; color: var(--enc-muted); background: none; font: inherit; font-size: 0.86rem; cursor: pointer; }
  .enc-back-button span { margin-right: 5px; }
  .enc-detail-hero { justify-content: flex-start; }
  .enc-detail-cover { width: 152px; height: 190px; flex: 0 0 152px; object-fit: cover; border-radius: 14px; border: 1px solid var(--enc-border); }
  .enc-detail-copy { min-width: 0; }
  .enc-detail-copy h1 { font-size: clamp(1.8rem, 3.5vw, 2.7rem); }
  .enc-byline { margin: 0 0 12px; color: var(--enc-muted); }
  .enc-description { margin-bottom: 11px; }
  .enc-muted { color: var(--enc-muted); }
  .enc-external-link { display: inline-block; margin-top: 10px; color: var(--enc-accent); font-size: 0.83rem; text-decoration: none; }
  .enc-version-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin: 20px 0 12px; color: var(--enc-muted); font-size: 0.82rem; }
  .enc-version-bar select, .enc-form input, .enc-form select, .enc-form textarea { width: 100%; min-width: 0; color: inherit; border: 1px solid var(--enc-border); border-radius: 10px; background: var(--enc-input); font: inherit; outline: none; }
  .enc-version-bar select { width: auto; max-width: 320px; padding: 9px 12px; }
  .enc-version-controls { display: flex; align-items: center; gap: 10px; }
  .enc-compact-button { min-height: 38px; padding: 0 13px; font-size: 0.82rem; }
  .enc-version-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 0 0 12px; color: var(--enc-muted); font-size: 0.78rem; line-height: 1.5; }
  .enc-default-badge { display: inline-flex; align-items: center; padding: 2px 8px; border: 1px solid rgba(113, 223, 192, 0.28); border-radius: 999px; color: var(--enc-accent); background: rgba(113, 223, 192, 0.09); font-size: 0.66rem; font-weight: 750; letter-spacing: 0.04em; text-transform: uppercase; }
  .enc-form input, .enc-form select, .enc-form textarea { padding: 11px 12px; }
  .enc-form textarea { resize: vertical; }
  .enc-form input:focus, .enc-form select:focus, .enc-form textarea:focus, .enc-version-bar select:focus { border-color: var(--enc-accent); }
  .enc-tabs { display: flex; gap: 7px; overflow-x: auto; border-bottom: 1px solid var(--enc-border); padding-bottom: 12px; }
  .enc-tabs button { border-radius: 10px; white-space: nowrap; }
  .enc-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .enc-stat { padding: 17px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--enc-border); border-radius: 13px; background: var(--enc-panel); }
  .enc-stat span { color: var(--enc-muted); font-size: 0.78rem; }
  .enc-stat strong { font-size: 1.7rem; letter-spacing: -0.04em; }
  .enc-info-panel { display: flex; align-items: flex-start; gap: 16px; margin-top: 15px; text-align: left; }
  .enc-info-icon { color: var(--enc-accent); font-size: 1.8rem; }
  .enc-info-panel h2 { margin-top: 0; }
  .enc-stat-grid-world { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  .enc-modal-backdrop { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(3, 8, 18, 0.72); backdrop-filter: blur(9px); }
  .enc-modal { width: min(760px, 100%); max-height: min(90vh, 900px); overflow: auto; padding: 25px; border: 1px solid var(--enc-border); border-radius: 20px; color: var(--enc-text, #e8edf6); background: #111a2b; box-shadow: 0 24px 90px rgba(0, 0, 0, 0.4); }
  :global(.app-shell[data-theme='light']) .enc-modal { color: #172033; background: #ffffff; }
  .enc-modal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; }
  .enc-modal-heading h2 { margin: 6px 0 0; font-size: 1.45rem; }
  .enc-close-button { width: 34px; height: 34px; border: 1px solid var(--enc-border); border-radius: 9px; color: inherit; background: var(--enc-panel); font-size: 1.4rem; cursor: pointer; }
  .enc-modal-intro { margin: 11px 0 20px; color: var(--enc-muted); font-size: 0.85rem; line-height: 1.55; }
  .enc-form { display: flex; flex-direction: column; gap: 14px; }
  .enc-form label { display: flex; flex-direction: column; gap: 7px; min-width: 0; font-size: 0.82rem; font-weight: 650; }
  .enc-form label small { color: var(--enc-muted); font-size: 0.72rem; font-weight: 400; }
  .enc-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
  .enc-form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 5px; }
  .enc-delete-summary { display: flex; flex-direction: column; gap: 9px; margin: 0 0 18px; padding: 15px 18px 15px 32px; border: 1px solid rgba(248, 113, 113, 0.22); border-radius: 12px; background: rgba(127, 29, 29, 0.09); color: var(--enc-muted); font-size: 0.86rem; line-height: 1.55; }
  .enc-delete-summary strong { color: var(--enc-text, inherit); }
  .enc-version-modal { width: min(820px, 100%); }
  .enc-version-list { display: flex; flex-direction: column; gap: 9px; margin-bottom: 20px; }
  .enc-version-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 13px 15px; border: 1px solid var(--enc-border); border-radius: 12px; background: var(--enc-panel); }
  .enc-version-item.is-default { border-color: rgba(113, 223, 192, 0.32); background: rgba(113, 223, 192, 0.055); }
  .enc-version-item-copy { min-width: 0; }
  .enc-version-item-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .enc-version-item-title > span:not(.enc-default-badge) { color: var(--enc-muted); font-size: 0.8rem; }
  .enc-version-date { display: block; margin-top: 5px; color: var(--enc-muted); font-size: 0.76rem; }
  .enc-version-item-copy p { margin: 6px 0 0; color: var(--enc-muted); font-size: 0.8rem; line-height: 1.45; white-space: pre-line; }
  .enc-version-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
  .enc-version-actions button { border: 1px solid var(--enc-border); border-radius: 8px; padding: 6px 9px; color: var(--enc-muted); background: transparent; font: inherit; font-size: 0.74rem; cursor: pointer; }
  .enc-version-actions button:hover:not(:disabled) { color: var(--enc-accent); border-color: rgba(113, 223, 192, 0.28); }
  .enc-version-actions button:disabled { opacity: 0.45; cursor: not-allowed; }
  .enc-version-actions .enc-mini-danger:hover:not(:disabled) { color: #fca5a5; border-color: rgba(248, 113, 113, 0.3); }
  .enc-version-confirm { margin-bottom: 18px; padding: 14px 16px; border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 12px; background: rgba(127, 29, 29, 0.1); }
  .enc-version-confirm p { margin: 0 0 12px; color: var(--enc-muted); font-size: 0.84rem; line-height: 1.5; }
  .enc-version-confirm strong { color: var(--enc-text, inherit); }
  .enc-version-form { padding-top: 18px; border-top: 1px solid var(--enc-border); }
  .enc-form-section-title { color: var(--enc-accent); font-size: 0.7rem; letter-spacing: 0.12em; font-weight: 750; text-transform: uppercase; }
  .enc-form label.enc-checkbox-label { flex-direction: row; align-items: center; gap: 9px; }
  .enc-form label.enc-checkbox-label input { width: auto; }

  @media (max-width: 950px) { .enc-game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 650px) {
    .enc-page-hero, .enc-detail-hero { align-items: flex-start; padding: 22px; }
    .enc-hero-orbit { display: none; }
    .enc-toolbar { align-items: stretch; flex-direction: column; }
    .enc-game-grid { grid-template-columns: 1fr; }
    .enc-game-cover { height: 175px; }
    .enc-detail-hero { flex-direction: column; }
    .enc-detail-cover { width: 100%; height: 180px; flex-basis: auto; }
    .enc-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .enc-stat-grid-world { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .enc-form-row { grid-template-columns: 1fr; }
    .enc-modal { padding: 20px; }
    .enc-version-bar { align-items: flex-start; flex-direction: column; }
    .enc-version-bar select { max-width: 100%; width: 100%; }
    .enc-version-controls { width: 100%; flex-direction: column; align-items: stretch; }
    .enc-version-item { flex-direction: column; }
    .enc-version-actions { justify-content: flex-start; }
  }
</style>
