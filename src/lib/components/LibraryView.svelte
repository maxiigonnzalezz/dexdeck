<script lang="ts">
  import type { SystemInfo } from '$lib/app-types';
  import type { Game } from '$lib/db';
  import { isWebUrl } from '$lib/url';

  type Props = {
    games: Game[];
    systemInfo: SystemInfo | null;
    launchingGameId: number | null;
    search?: string;
    onAdd: () => void;
    onDetails: (game: Game) => void;
    onOpenGameDetails: (game: Game) => void;
    onPlayOrConfigure: (game: Game) => void;
    onEdit: (game: Game) => void;
  };

  let {
    games,
    systemInfo,
    launchingGameId,
    search = $bindable(''),
    onAdd,
    onDetails,
    onOpenGameDetails,
    onPlayOrConfigure,
    onEdit
  }: Props = $props();

  let filteredGames = $derived(
    games.filter((game) =>
      `${game.name} ${game.developer} ${game.type} ${game.description}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  );
</script>

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
    <button class="primary-button" data-testid="add-game-button" onclick={onAdd}>
      <span>＋</span> Añadir juego
    </button>
  </div>

  <div class="filter-row">
    <label class="search-box">
      <span class="search-icon">⌕</span>
      <input
        aria-label="Buscar juegos"
        data-testid="search-games"
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
        <article class="game-card" data-testid="game-card" data-game-name={game.name}>
          <button
            class={`game-art art-${game.color}`}
            aria-label={`Ver ficha de ${game.name}`}
            onclick={() => onDetails(game)}
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
                onclick={() => onOpenGameDetails(game)}
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
              onclick={() => onPlayOrConfigure(game)}
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
                onclick={() => onEdit(game)}
              >
                <span aria-hidden="true">⚙</span> Configurar detalles
              </button>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-state" data-testid="empty-library">
      <div class="empty-symbol">⌕</div>
      <h3>{games.length === 0 ? 'Tu biblioteca está esperando aventuras' : 'No encontramos ese juego'}</h3>
      <p>
        {games.length === 0
          ? 'Añade tu primer fangame y completa su ficha.'
          : 'Prueba con otro nombre o con el desarrollador.'}
      </p>
      {#if games.length === 0}
        <button class="primary-button" onclick={onAdd}>＋ Añadir juego</button>
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
  <button class="tip-action" onclick={onAdd}>Añadir juego <span>→</span></button>
</div>
