<script lang="ts">
  import {
      createCatalogGame,
      getVersionSummary,
      listCatalogGameVersions,
      listCatalogGames,
      type CatalogGame,
      type CatalogGameType,
      type CatalogGameVersion,
      type VersionSummary
  } from '$lib/encyclopedia';
  import { onMount } from 'svelte';

  type CategoryFilter = 'all' | CatalogGameType;
  type DetailTab = 'overview' | 'pokedex' | 'world' | 'guides';

  let games = $state<CatalogGame[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let search = $state('');
  let categoryFilter = $state<CategoryFilter>('all');
  let pageError = $state('');
  let formError = $state('');
  let showForm = $state(false);
  let selectedGame = $state<CatalogGame | null>(null);
  let versions = $state<CatalogGameVersion[]>([]);
  let selectedVersionId = $state<number | null>(null);
  let summary = $state<VersionSummary | null>(null);
  let detailTab = $state<DetailTab>('overview');

  let draft = $state({
    name: '',
    slug: '',
    developer: '',
    game_type: 'fangame' as CatalogGameType,
    description: '',
    cover_url: '',
    official_url: '',
    version_label: '1.0',
    platform: 'unknown'
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

  onMount(() => {
    void refreshCatalog();
  });

  async function refreshCatalog() {
    loading = true;
    pageError = '';
    try {
      games = await listCatalogGames();
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
    draft = {
      name: '',
      slug: '',
      developer: '',
      game_type: 'fangame',
      description: '',
      cover_url: '',
      official_url: '',
      version_label: '1.0',
      platform: 'unknown'
    };
    formError = '';
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    formError = '';

    if (!draft.name.trim() || !draft.slug.trim() || !draft.version_label.trim()) {
      formError = 'Completa el nombre, el identificador y la versión inicial.';
      return;
    }

    saving = true;
    try {
      const id = await createCatalogGame({ ...draft });
      showForm = false;
      resetDraft();
      await refreshCatalog();
      const created = games.find((game) => game.id === id);
      if (created) await openGame(created);
    } catch (error) {
      console.error('Error al crear la ficha del catálogo:', error);
      const message = error instanceof Error ? error.message : String(error);
      formError = message.includes('UNIQUE')
        ? 'Ya existe un juego con ese identificador. Prueba con otro.'
        : `No se ha podido guardar la ficha: ${message}`;
    } finally {
      saving = false;
    }
  }

  async function openGame(game: CatalogGame) {
    selectedGame = game;
    pageError = '';
    detailTab = 'overview';
    versions = [];
    selectedVersionId = null;
    summary = null;

    try {
      versions = await listCatalogGameVersions(game.id);
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
</script>

<section class="encyclopedia">
  {#if selectedGame}
    <div class="enc-detail-topline">
      <button class="enc-back-button" type="button" onclick={() => { selectedGame = null; pageError = ''; }}>
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
        {#if isHttpUrl(selectedGame.official_url)}
          <a class="enc-external-link" href={selectedGame.official_url} target="_blank" rel="noreferrer">Web del proyecto ↗</a>
        {/if}
      </div>
    </header>

    <div class="enc-version-bar">
      <label for="enc-version-select">Versión consultada</label>
      <select id="enc-version-select" value={selectedVersionId ?? ''} onchange={(event) => void changeVersion(event.currentTarget.value)}>
        {#each versions as version (version.id)}
          <option value={version.id}>{version.version_label} · {platformLabel(version.platform)}</option>
        {/each}
      </select>
    </div>

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
      <div class="enc-empty-panel">
        <span class="enc-empty-icon">◈</span>
        <h2>Pokédex de {selectedGame.name}</h2>
        <p>{summary?.pokemon_count ? `Hay ${summary.pokemon_count} entradas registradas en esta versión.` : 'Todavía no hay Pokémon registrados para esta versión.'}</p>
        <span class="enc-subtle">La importación y edición de entradas será el siguiente bloque de desarrollo.</span>
      </div>
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
          <div><span class="enc-kicker">NUEVA ENTRADA</span><h2 id="enc-form-title">Añadir al catálogo</h2></div>
          <button class="enc-close-button" type="button" aria-label="Cerrar" disabled={saving} onclick={() => showForm = false}>×</button>
        </div>
        <p class="enc-modal-intro">Esta ficha pertenece a la enciclopedia. No instala el juego ni modifica tu biblioteca personal.</p>

        <form class="enc-form" onsubmit={handleCreate}>
          <label>Nombre del juego <input required maxlength="120" value={draft.name} oninput={(event) => updateName(event.currentTarget.value)} placeholder="Pokémon Rojo Fuego" /></label>
          <label>Identificador interno <input required maxlength="140" bind:value={draft.slug} placeholder="pokemon-rojo-fuego" /><small>Se genera automáticamente a partir del nombre; puedes modificarlo.</small></label>
          <div class="enc-form-row">
            <label>Desarrollador <input maxlength="120" bind:value={draft.developer} placeholder="Nintendo / Game Freak" /></label>
            <label>Tipo <select bind:value={draft.game_type}><option value="official">Oficial</option><option value="fangame">Fangame</option><option value="rom_hack">ROM hack</option><option value="other">Otro</option></select></label>
          </div>
          <div class="enc-form-row">
            <label>Primera versión <input required maxlength="80" bind:value={draft.version_label} placeholder="1.0" /></label>
            <label>Plataforma <select bind:value={draft.platform}><option value="unknown">Sin especificar</option><option value="windows">Windows</option><option value="gba">Game Boy Advance</option><option value="nds">Nintendo DS</option><option value="3ds">Nintendo 3DS</option><option value="switch">Nintendo Switch</option><option value="other">Otra</option></select></label>
          </div>
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
          {#if formError}<div class="enc-alert" role="alert">{formError}</div>{/if}
          <div class="enc-form-actions">
            <button class="enc-secondary-button" type="button" disabled={saving} onclick={() => showForm = false}>Cancelar</button>
            <button class="enc-primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear ficha'}</button>
          </div>
        </form>
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
  }
</style>
