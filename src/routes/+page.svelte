
<script lang="ts">
  type Game = {
    id: number;
    name: string;
    developer: string;
    version: string;
    type: string;
    color: string;
    symbol: string;
    status: string;
  };

  let activeSection = $state('Biblioteca');
  let search = $state('');
  let showAddModal = $state(false);
  let addDialog = $state<HTMLDialogElement | undefined>(undefined);

  $effect(() => {
    const dialog = addDialog;

    if (!dialog) return;

    if (showAddModal && !dialog.open) {
      dialog.showModal();
    } else if (!showAddModal && dialog.open) {
      dialog.close();
    }
  });
  let newName = $state('');
  let newDeveloper = $state('');
  let newVersion = $state('1.0');
  let notice = $state('');

  let games = $state<Game[]>([
    {
      id: 1,
      name: 'Pokémon Añil',
      developer: 'Eric Lostie',
      version: '2.0',
      type: 'Aventura',
      color: 'blue',
      symbol: '✦',
      status: 'En biblioteca'
    },
    {
      id: 2,
      name: 'Pokémon Ópalo',
      developer: 'Eric Lostie',
      version: '1.3',
      type: 'Aventura',
      color: 'purple',
      symbol: '◇',
      status: 'En biblioteca'
    },
    {
      id: 3,
      name: 'Pokémon Iberia',
      developer: 'Eric Lostie',
      version: '2.04',
      type: 'RPG',
      color: 'red',
      symbol: '✧',
      status: 'En biblioteca'
    }
  ]);

  const navigation = [
    { label: 'Biblioteca', icon: '▦' },
    { label: 'Añadir juego', icon: '+' },
    { label: 'Actualizaciones', icon: '↻' },
    { label: 'Ajustes', icon: '⚙' }
  ];

  let filteredGames = $derived(
    games.filter((game) =>
      `${game.name} ${game.developer} ${game.type}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  );

  function navigate(section: string) {
    if (section === 'Añadir juego') {
      showAddModal = true;
      return;
    }

    activeSection = section;
    search = '';
    notice = '';
  }

  function addGame() {
    const name = newName.trim();

    if (!name) {
      notice = 'Escribe el nombre del juego para continuar.';
      return;
    }

    games.unshift({
      id: Date.now(),
      name,
      developer: newDeveloper.trim() || 'Desarrollador desconocido',
      version: newVersion.trim() || 'Sin especificar',
      type: 'Fangame',
      color: ['blue', 'purple', 'red'][games.length % 3],
      symbol: '✦',
      status: 'En biblioteca'
    });

    games = [...games];
    showAddModal = false;
    activeSection = 'Biblioteca';
    search = '';
    newName = '';
    newDeveloper = '';
    newVersion = '1.0';
    notice = 'Juego añadido a la biblioteca.';
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

<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="#inicio" onclick={() => navigate('Biblioteca')}>
      <div class="brand-mark">
        <span class="brand-core"></span>
      </div>
      <div class="brand-copy">
        <span class="brand-name">DexDeck</span>
        <span class="brand-caption">YOUR GAME UNIVERSE</span>
      </div>
    </a>

    <div class="sidebar-label">ESPACIO PERSONAL</div>

    <nav class="navigation" aria-label="Navegación principal">
      {#each navigation as item}
        <button
          class:active={activeSection === item.label}
          class="nav-item"
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
        <div class="runner-name">Wine</div>
        <div class="runner-description">La compatibilidad se comprobará en tu sistema.</div>
        <div class="runner-status">
          <span class="status-indicator"></span>
          <span>Configuración pendiente</span>
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
            <div class="eyebrow"><span class="eyebrow-line"></span> TU PRÓXIMA AVENTURA EMPIEZA AQUÍ</div>
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
              <div class="stat-value">Linux <span>· CachyOS</span></div>
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
            <button class="primary-button" onclick={() => showAddModal = true}>
              <span>＋</span> Añadir juego
            </button>
          </div>

          <div class="filter-row">
            <label class="search-box">
              <span class="search-icon">⌕</span>
              <input
                aria-label="Buscar juegos"
                placeholder="Buscar por nombre o desarrollador..."
                bind:value={search}
              />
              <kbd>⌘ K</kbd>
            </label>
            <div class="filter-label"><span>▤</span> Todos los juegos</div>
          </div>

          {#if filteredGames.length > 0}
            <div class="game-grid">
              {#each filteredGames as game (game.id)}
                <article class="game-card">
                  <div class={`game-art art-${game.color}`}>
                    <div class="art-grid"></div>
                    <div class="art-glow"></div>
                    <div class="art-orbit orbit-a"></div>
                    <div class="art-orbit orbit-b"></div>
                    <div class="art-emblem">{game.symbol}</div>
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
                  </div>

                  <div class="game-info">
                    <div class="game-title-row">
                      <div class="game-title-copy">
                        <h3>{game.name}</h3>
                        <p>{game.developer}</p>
                      </div>
                      <span class="game-menu" title="Información del juego">···</span>
                    </div>
                    <div class="game-meta">
                      <span class="game-tag">{game.type}</span>
                      <span class="game-version">v{game.version}</span>
                    </div>
                    <button
                      class="play-button"
                      onclick={() => notice = `El lanzamiento de ${game.name} estará disponible cuando configuremos sus archivos.`}
                    >
                      <span>▶</span> Preparar para jugar
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <div class="empty-symbol">⌕</div>
              <h3>No encontramos ese juego</h3>
              <p>Prueba con otro nombre o con el desarrollador.</p>
              <button class="secondary-button" onclick={() => search = ''}>
                Limpiar búsqueda
              </button>
            </div>
          {/if}
        </section>

        <div class="tip-banner">
          <div class="tip-symbol">✧</div>
          <div>
            <strong>Tu próxima aventura está a un clic.</strong>
            <p>Añade tus juegos favoritos y empieza a construir tu colección.</p>
          </div>
          <button class="tip-action" onclick={() => showAddModal = true}>Añadir juego <span>→</span></button>
        </div>

      {:else if activeSection === 'Actualizaciones'}
        <section class="subpage-header">
          <div class="eyebrow"><span class="eyebrow-line"></span> SIEMPRE AL DÍA</div>
          <h1>Centro de <span>actualizaciones.</span></h1>
          <p class="intro">Consulta la información de tus fangames y comprueba si hay nuevas versiones.</p>
        </section>

        <div class="placeholder-panel">
          <div class="placeholder-icon">↻</div>
          <h2>Tus juegos, al día.</h2>
          <p>La comprobación de versiones llegará en una siguiente fase. Primero configuraremos las fuentes oficiales de cada juego.</p>
          <button class="secondary-button" onclick={() => navigate('Biblioteca')}>Volver a la biblioteca</button>
        </div>

      {:else if activeSection === 'Ajustes'}
        <section class="subpage-header">
          <div class="eyebrow"><span class="eyebrow-line"></span> A TU GUSTO</div>
          <h1>Los ajustes de <span>tu espacio.</span></h1>
          <p class="intro">Aquí reuniremos las preferencias de DexDeck y la configuración del entorno de juego.</p>
        </section>

        <div class="settings-panel">
          <div class="setting-row">
            <div class="setting-icon">◐</div>
            <div class="setting-copy">
              <strong>Apariencia</strong>
              <p>Interfaz oscura con superficies de cristal.</p>
            </div>
            <span class="setting-value">Dark Glass</span>
          </div>
          <div class="setting-row">
            <div class="setting-icon">⌘</div>
            <div class="setting-copy">
              <strong>Plataforma</strong>
              <p>Diseñado inicialmente para CachyOS.</p>
            </div>
            <span class="setting-value">Linux</span>
          </div>
          <div class="setting-row">
            <div class="setting-icon">◇</div>
            <div class="setting-copy">
              <strong>Compatibilidad</strong>
              <p>La configuración de Wine se añadirá más adelante.</p>
            </div>
            <span class="setting-value pending">Pendiente</span>
          </div>
        </div>

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


{#if showAddModal}
  <dialog
    bind:this={addDialog}
    class="modal"
    aria-labelledby="modal-title"
    onclose={() => (showAddModal = false)}
    onclick={(event) => {
      if (event.target === addDialog) {
        addDialog.close();
      }
    }}
  >
    <div class="modal-top">
      <div class="modal-icon">＋</div>
      <button
        class="modal-close"
        aria-label="Cerrar"
        onclick={() => (showAddModal = false)}
      >×</button>
    </div>

    <div class="section-kicker">AMPLÍA TU COLECCIÓN</div>
    <h2 id="modal-title">Añadir un juego.</h2>
    <p class="modal-description">
      Registra los datos básicos de tu fangame. La selección de archivos llegará más adelante.
    </p>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        addGame();
      }}
    >
      <label class="form-label">
        Nombre del juego <span>*</span>
        <input
          bind:value={newName}
          placeholder="Ej. Pokémon Eclipse"
          required
          maxlength="80"
        />
      </label>

      <label class="form-label">
        Desarrollador
        <input
          bind:value={newDeveloper}
          placeholder="Nombre del creador o equipo"
          maxlength="100"
        />
      </label>

      <label class="form-label">
        Versión
        <input
          bind:value={newVersion}
          placeholder="Ej. 1.0"
          maxlength="30"
        />
      </label>

      {#if notice}
        <p class="form-notice" role="status">{notice}</p>
      {/if}

      <div class="modal-actions">
        <button
          type="button"
          class="secondary-button"
          onclick={() => {
            showAddModal = false;
            notice = '';
          }}
        >Cancelar</button>

        <button type="submit" class="primary-button">
          Añadir a la biblioteca <span>→</span>
        </button>
      </div>
    </form>
  </dialog>
{/if}

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { min-width: 360px; background: #0c1222; }
  :global(body) {
    margin: 0;
    color: #f1f5fc;
    background: #0c1222;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    -webkit-font-smoothing: antialiased;
  }
  :global(button), :global(input) { font: inherit; }
  :global(button) { color: inherit; }
  :global(button:focus-visible), :global(input:focus-visible), :global(a:focus-visible) {
    outline: 2px solid #7dd3fc;
    outline-offset: 3px;
  }

  .app-shell { min-height: 100vh; }
  .sidebar {
    width: 248px;
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    padding: 28px 17px 15px;
    background: linear-gradient(160deg, #121b2e 0%, #101827 50%, #0e1625 100%);
    border-right: 1px solid #ffffff0c;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 9px;
    color: inherit;
    text-decoration: none;
  }
  .brand-mark {
    width: 39px;
    height: 39px;
    border: 1px solid #ffffff35;
    border-radius: 13px;
    background: linear-gradient(145deg, #ffffff24, #ffffff04);
    display: grid;
    place-items: center;
    box-shadow: inset 0 1px #ffffff20, 0 4px 16px #0002;
  }
  .brand-core {
    width: 19px;
    height: 19px;
    position: relative;
    border: 2px solid #f8fafc;
    border-radius: 50%;
    background: linear-gradient(to bottom, #ef4444 0 44%, #f8fafc 44% 56%, #19243a 56% 100%);
  }
  .brand-core::after {
    content: "";
    position: absolute;
    width: 5px;
    height: 5px;
    border: 2px solid #f8fafc;
    background: #19243a;
    border-radius: 50%;
    top: 5px;
    left: 5px;
  }
  .brand-copy, .profile-copy { display: flex; flex-direction: column; gap: 4px; }
  .brand-name { font-size: 19px; font-weight: 750; letter-spacing: -0.8px; }
  .brand-caption { color: #71819d; font-size: 8px; font-weight: 700; letter-spacing: 1.45px; }
  .sidebar-label, .section-kicker {
    color: #7786a0;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: 1.6px;
  }
  .sidebar-label { margin: 45px 10px 14px; }
  .navigation { display: grid; gap: 5px; }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 43px;
    padding: 0 12px;
    color: #9aa8be;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: background 180ms, color 180ms, border-color 180ms;
  }
  .nav-item:hover { color: #f1f5fc; background: #ffffff08; }
  .nav-item.active {
    color: #f8fafc;
    background: linear-gradient(105deg, #ffffff12, #ffffff06);
    border-color: #ffffff0d;
    box-shadow: inset 2px 0 #f87171, inset 0 1px #ffffff08;
  }
  .nav-icon { width: 18px; font-size: 17px; text-align: center; }
  .nav-count {
    margin-left: auto;
    padding: 3px 7px;
    color: #cbd5e1;
    background: #ffffff0c;
    border: 1px solid #ffffff0b;
    border-radius: 6px;
    font-size: 10px;
  }
  .sidebar-bottom { margin-top: auto; }
  .runner-card {
    padding: 15px 13px;
    margin-bottom: 16px;
    border: 1px solid #ffffff10;
    border-radius: 12px;
    background: linear-gradient(145deg, #ffffff09, #ffffff03);
    box-shadow: inset 0 1px #ffffff08;
  }
  .runner-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #8392a9;
    font-size: 8px;
    letter-spacing: 1px;
    font-weight: 750;
  }
  .runner-dot, .status-indicator, .footer-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fbbf24;
  }
  .runner-name { margin-top: 14px; font-size: 15px; font-weight: 650; }
  .runner-description { margin-top: 6px; color: #8190a8; font-size: 10px; line-height: 1.6; }
  .runner-status {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 13px;
    color: #b5c0d1;
    font-size: 9px;
  }
  .profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 4px 3px;
    border-top: 1px solid #ffffff0e;
  }
  .profile-avatar {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 11px;
    background: linear-gradient(145deg, #ef4444, #9f293b);
    color: white;
    font-weight: 800;
    box-shadow: inset 0 1px #ffffff45;
  }
  .profile-name { font-size: 11px; font-weight: 650; }
  .profile-caption { font-size: 10px; color: #8290a7; }
  .profile-menu { margin-left: auto; color: #94a3b8; font-size: 20px; }

  .main-content { min-height: 100vh; margin-left: 248px; }
  .topbar {
    height: 68px;
    padding: 0 42px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #ffffff0b;
    background: #0c1222cc;
  }
  .breadcrumb { display: flex; gap: 10px; align-items: center; color: #75839b; font-size: 9px; font-weight: 750; letter-spacing: 1.2px; }
  .breadcrumb-slash { color: #3e4a61; }
  .breadcrumb-current { color: #cbd5e1; }
  .topbar-right { display: flex; align-items: center; gap: 16px; }
  .local-badge { display: flex; align-items: center; gap: 7px; color: #b4c1d4; font-size: 9px; font-weight: 750; letter-spacing: 1px; }
  .local-badge .status-indicator, .footer-dot { width: 5px; height: 5px; background: #6ee7b7; box-shadow: 0 0 9px #6ee7b74d; }
  .topbar-divider { width: 1px; height: 22px; background: #ffffff15; }
  .icon-button {
    width: 32px; height: 32px; border-radius: 9px;
    border: 1px solid #ffffff12; background: #ffffff05;
    color: #a8b4c8; cursor: pointer;
  }
  .icon-button:hover { background: #ffffff10; color: white; }

  .page-content { max-width: 1430px; padding: 36px 42px 18px; margin: 0 auto; }
  .welcome-row { position: relative; display: flex; justify-content: space-between; align-items: center; min-height: 190px; overflow: hidden; }
  .eyebrow { display: flex; align-items: center; gap: 9px; color: #a3b0c4; font-size: 9px; font-weight: 750; letter-spacing: 1.5px; }
  .eyebrow-line { width: 20px; height: 1px; background: #f87171; box-shadow: 0 0 9px #ef444455; }
  h1 { margin: 18px 0 12px; font-size: clamp(32px, 3.3vw, 47px); line-height: 1.1; letter-spacing: -2px; font-weight: 730; }
  h1 span { color: #9eacc2; font-weight: 500; }
  .intro { max-width: 480px; margin: 0; color: #8998b0; font-size: 12px; line-height: 1.8; }

  .orb-decoration { position: relative; width: 210px; height: 185px; margin-right: 30px; flex-shrink: 0; display: grid; place-items: center; }
  .orb-ring { position: absolute; width: 160px; height: 160px; border: 1px solid #b8d7ff12; border-radius: 50%; }
  .ring-two { width: 190px; height: 190px; border-style: dashed; border-color: #b8d7ff0d; }
  .orb {
    width: 102px; height: 102px; overflow: hidden; position: relative;
    border: 1px solid #ffffff65; border-radius: 50%;
    background: linear-gradient(145deg, #ff7878, #e73e52 46%, #26364e 47%, #101a2d 100%);
    box-shadow: 0 0 50px #ef44441c, inset 0 2px 5px #ffffff55, inset 0 -8px 15px #0004;
  }
  .orb::after { content: ""; position: absolute; inset: 49% 0 auto; height: 5px; background: #dce7f8; box-shadow: 0 0 0 1px #1a263c; }
  .orb-shine { position: absolute; top: 10px; left: 18px; width: 39px; height: 17px; border-radius: 50%; background: #ffffff43; filter: blur(7px); transform: rotate(-35deg); }
  .orb-band { position: absolute; inset: 48% 0 auto; height: 7px; background: #152238; }
  .orb-button { position: absolute; width: 25px; height: 25px; top: calc(50% - 12px); left: calc(50% - 12px); border: 4px solid #f0f5ff; border-radius: 50%; background: #18253b; box-shadow: 0 0 0 2px #101a2d, inset 0 0 0 2px #a6b9d3; }
  .orb-spark { position: absolute; color: #a8d8ff; text-shadow: 0 0 14px #7dd3fc66; }
  .spark-one { top: 17px; right: 28px; font-size: 20px; }
  .spark-two { bottom: 22px; left: 13px; font-size: 27px; }
  .spark-three { bottom: 32px; right: 12px; font-size: 18px; }

  .stats-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; margin: 18px 0 40px; }
  .stat-card {
    display: flex; align-items: center; gap: 13px; min-height: 76px; padding: 15px;
    border: 1px solid #ffffff10; border-radius: 12px;
    background: linear-gradient(125deg, #ffffff09, #ffffff03);
    box-shadow: inset 0 1px #ffffff09, 0 5px 20px #00000008;
  }
  .stat-icon { display: grid; place-items: center; flex-shrink: 0; width: 35px; height: 35px; border-radius: 10px; color: #fca5a5; background: #ef444415; font-size: 17px; }
  .stat-icon.cyan { color: #7dd3fc; background: #7dd3fc12; }
  .stat-icon.yellow { color: #facc15; background: #facc1512; }
  .stat-label { color: #7f8ea5; font-size: 8px; letter-spacing: 1px; font-weight: 750; }
  .stat-value { margin-top: 8px; color: #f1f5fc; font-size: 15px; font-weight: 700; letter-spacing: -.3px; }
  .stat-value span { color: #8291a9; font-size: 10px; font-weight: 450; }

  .library-section { min-width: 0; }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
  .section-heading h2 { margin: 7px 0 0; font-size: 22px; letter-spacing: -.7px; font-weight: 700; }
  .heading-count { display: inline-grid; place-items: center; vertical-align: 3px; min-width: 20px; height: 20px; margin-left: 4px; padding: 0 5px; color: #aab8cd; background: #ffffff0c; border: 1px solid #ffffff0c; border-radius: 6px; font-size: 10px; letter-spacing: 0; }
  .primary-button, .secondary-button {
    min-height: 37px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 0 14px; border-radius: 9px; font-size: 11px; font-weight: 650; cursor: pointer;
    transition: transform 160ms, background 160ms, border-color 160ms;
  }
  .primary-button { color: white; border: 1px solid #ffffff26; background: linear-gradient(130deg, #f05260, #d7354b); box-shadow: inset 0 1px #ffffff38, 0 5px 15px #ef44441b; }
  .primary-button:hover { transform: translateY(-1px); background: linear-gradient(130deg, #ff6573, #e43c54); }
  .primary-button > span { font-size: 17px; }
  .secondary-button { border: 1px solid #ffffff18; background: #ffffff08; color: #d6deeb; }
  .secondary-button:hover { background: #ffffff12; }
  .filter-row { display: flex; align-items: center; gap: 12px; margin: 19px 0 17px; }
  .search-box { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; height: 39px; padding: 0 11px; border: 1px solid #ffffff10; border-radius: 9px; background: #ffffff04; }
  .search-icon { color: #8493aa; font-size: 22px; transform: rotate(-20deg); }
  .search-box input { min-width: 0; width: 100%; color: #e2e8f0; background: transparent; border: 0; outline: none; font-size: 11px; }
  .search-box input::placeholder { color: #65748b; }
  .search-box kbd { flex-shrink: 0; color: #718099; background: #ffffff07; border: 1px solid #ffffff0c; border-radius: 5px; padding: 3px 6px; font-size: 9px; }
  .filter-label { display: flex; align-items: center; gap: 8px; color: #a3b0c3; white-space: nowrap; font-size: 10px; }

  .game-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .game-card { min-width: 0; overflow: hidden; border: 1px solid #ffffff12; border-radius: 13px; background: linear-gradient(145deg, #182236, #121b2c); box-shadow: 0 10px 25px #0000000b, inset 0 1px #ffffff07; transition: transform 180ms, border-color 180ms, box-shadow 180ms; }
  .game-card:hover { transform: translateY(-3px); border-color: #ffffff28; box-shadow: 0 15px 30px #00000020, inset 0 1px #ffffff0b; }
  .game-art { position: relative; isolation: isolate; aspect-ratio: 1.25 / 1; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; border-bottom: 1px solid #ffffff10; }
  .art-blue { background: radial-gradient(ellipse at 70% 43%, #39a8ce50, transparent 34%), linear-gradient(140deg, #173d62, #14243d 60%, #101a30); }
  .art-purple { background: radial-gradient(ellipse at 70% 40%, #a78bfa50, transparent 36%), linear-gradient(145deg, #44346f, #272345 57%, #171a31); }
  .art-red { background: radial-gradient(ellipse at 70% 40%, #fb718550, transparent 34%), linear-gradient(140deg, #743342, #3c2439 58%, #1d1a2d); }
  .art-grid { position: absolute; inset: 0; z-index: -1; opacity: .18; background-image: linear-gradient(#ffffff18 1px, transparent 1px), linear-gradient(90deg, #ffffff18 1px, transparent 1px); background-size: 23px 23px; mask-image: linear-gradient(to bottom, black, transparent); }
  .art-glow { position: absolute; z-index: -1; width: 100px; height: 100px; top: 20%; left: 50%; transform: translateX(-50%); border-radius: 50%; background: #ffffff09; filter: blur(18px); }
  .art-orbit { position: absolute; z-index: -1; left: 50%; top: 48%; width: 125px; height: 43px; border: 1px solid #ffffff28; border-radius: 50%; transform: translate(-50%, -50%) rotate(-30deg); }
  .orbit-b { width: 115px; height: 70px; transform: translate(-50%, -50%) rotate(55deg); border-color: #ffffff17; }
  .art-emblem { position: absolute; top: 47%; left: 50%; transform: translate(-50%, -50%); color: #ffffffd9; font-size: clamp(42px, 5vw, 65px); font-weight: 300; text-shadow: 0 0 35px #ffffff33; }
  .art-topline, .art-bottomline { display: flex; justify-content: space-between; gap: 5px; color: #ffffff9c; font-size: 7px; font-weight: 750; letter-spacing: .8px; }
  .art-title { display: flex; flex-direction: column; gap: 4px; position: relative; z-index: 1; text-shadow: 0 2px 10px #0005; }
  .art-title span { color: #ffffffb0; font-size: 7px; letter-spacing: 1.2px; font-weight: 750; }
  .art-title strong { overflow-wrap: anywhere; font-size: clamp(17px, 1.7vw, 22px); line-height: 1.1; letter-spacing: -.7px; font-weight: 800; }
  .game-info { padding: 13px; }
  .game-title-row { display: flex; align-items: start; justify-content: space-between; gap: 8px; }
  .game-title-copy { min-width: 0; }
  .game-title-copy h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; font-size: 13px; font-weight: 700; letter-spacing: -.2px; }
  .game-title-copy p { margin: 5px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8493aa; font-size: 10px; }
  .game-menu { color: #8291a8; font-size: 19px; line-height: 15px; }
  .game-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
  .game-tag { padding: 4px 7px; color: #b6c7de; background: #ffffff08; border: 1px solid #ffffff0d; border-radius: 5px; font-size: 9px; }
  .game-version { color: #74839a; font-size: 9px; }
  .play-button { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; min-height: 34px; margin-top: 13px; border: 1px solid #ffffff13; border-radius: 8px; color: #e7edf7; background: linear-gradient(110deg, #ffffff0b, #ffffff05); cursor: pointer; font-size: 10px; font-weight: 650; transition: background 160ms, border-color 160ms; }
  .play-button span { color: #fca5a5; font-size: 10px; }
  .play-button:hover { background: #ffffff10; border-color: #ffffff25; }

  .tip-banner { display: flex; align-items: center; gap: 13px; margin-top: 24px; padding: 14px 16px; border: 1px solid #7dd3fc15; border-radius: 11px; background: linear-gradient(105deg, #7dd3fc0a, #ffffff03 65%); }
  .tip-symbol { display: grid; place-items: center; flex-shrink: 0; width: 33px; height: 33px; border-radius: 9px; color: #7dd3fc; background: #7dd3fc12; font-size: 17px; }
  .tip-banner strong { font-size: 11px; font-weight: 650; }
  .tip-banner p { margin: 5px 0 0; color: #8998af; font-size: 10px; }
  .tip-action { display: flex; align-items: center; gap: 9px; margin-left: auto; padding: 8px 0 8px 8px; flex-shrink: 0; border: 0; background: transparent; color: #a9dfff; cursor: pointer; font-size: 10px; }
  .tip-action:hover { color: #e0f2fe; }

  .subpage-header { padding: 18px 0 30px; }
  .placeholder-panel { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 22px; border: 1px solid #ffffff10; border-radius: 15px; background: linear-gradient(145deg, #ffffff08, #ffffff02); }
  .placeholder-icon { display: grid; place-items: center; width: 58px; height: 58px; border: 1px solid #ffffff15; border-radius: 17px; background: #ffffff08; color: #7dd3fc; font-size: 28px; }
  .placeholder-panel h2 { margin: 20px 0 8px; font-size: 20px; letter-spacing: -.6px; }
  .placeholder-panel p { max-width: 430px; margin: 0 0 20px; color: #91a0b6; font-size: 12px; line-height: 1.8; }
  .settings-panel { border: 1px solid #ffffff12; border-radius: 13px; overflow: hidden; background: #ffffff04; }
  .setting-row { display: flex; align-items: center; gap: 14px; padding: 19px; border-bottom: 1px solid #ffffff0c; }
  .setting-row:last-child { border-bottom: 0; }
  .setting-icon { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #ffffff10; border-radius: 10px; background: #ffffff08; color: #9ddfff; font-size: 17px; }
  .setting-copy { flex: 1; }
  .setting-copy strong { font-size: 12px; font-weight: 650; }
  .setting-copy p { margin: 5px 0 0; color: #8695ab; font-size: 10px; }
  .setting-value { padding: 6px 9px; border: 1px solid #ffffff10; border-radius: 7px; color: #c3cfdf; background: #ffffff07; font-size: 10px; }
  .setting-value.pending { color: #fbbf24; border-color: #fbbf241b; background: #fbbf2408; }

  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 15px; border: 1px dashed #ffffff20; border-radius: 12px; text-align: center; }
  .empty-symbol { color: #7dd3fc; font-size: 30px; }
  .empty-state h3 { margin: 13px 0 5px; font-size: 15px; }
  .empty-state p { margin: 0 0 18px; color: #8b9ab0; font-size: 11px; }
  .notice { display: flex; align-items: center; gap: 10px; margin-top: 20px; padding: 12px 14px; border: 1px solid #7dd3fc25; border-radius: 9px; color: #c6d8eb; background: #7dd3fc0b; font-size: 11px; line-height: 1.6; }
  .notice > span { color: #7dd3fc; }
  .notice button { margin-left: auto; padding: 0 5px; border: 0; background: transparent; color: #9aabc0; cursor: pointer; font-size: 18px; }
  .footer { display: flex; justify-content: space-between; gap: 15px; margin-top: 36px; padding: 16px 0 4px; border-top: 1px solid #ffffff0b; color: #8290a7; font-size: 8px; letter-spacing: 1px; font-weight: 700; }
  .footer > span:first-child { display: flex; align-items: center; gap: 8px; }
  .footer-version { color: #59677e; font-size: 8px; font-weight: 500; }

  
  .modal::backdrop {
    background: #050914bb;
    backdrop-filter: blur(12px);
    animation: fade-in 160ms ease-out;
  }

  .modal {
    width: min(100% - 40px, 460px);
    max-height: min(90vh, 720px);
    overflow-y: auto;
    margin: auto;
    padding: 25px;
    border: 1px solid #ffffff22;
    border-radius: 17px;
    color: #f1f5f9;
    background: linear-gradient(145deg, #1c2940f5, #111a2cf7);
    box-shadow: 0 25px 90px #0008, inset 0 1px #ffffff16;
    animation: modal-in 180ms ease-out;
  }

  .modal-icon { display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid #ffffff20; border-radius: 12px; color: #fecaca; background: #ef44441a; font-size: 24px; }
  .modal-close { width: 30px; height: 30px; border: 1px solid #ffffff12; border-radius: 8px; background: #ffffff07; color: #a7b4c8; cursor: pointer; font-size: 20px; }
  .modal h2 { margin: 8px 0; font-size: 26px; letter-spacing: -1px; }
  .modal-description { margin: 0 0 24px; color: #91a0b7; font-size: 11px; line-height: 1.8; }
  .modal form { display: grid; gap: 16px; }
  .form-label { display: grid; gap: 8px; color: #cbd5e1; font-size: 10px; font-weight: 650; }
  .form-label > span { display: inline; color: #fca5a5; }
  .form-label input { width: 100%; min-height: 40px; padding: 0 12px; color: #f1f5f9; border: 1px solid #ffffff16; border-radius: 9px; outline: none; background: #080f1d70; font-size: 11px; }
  .form-label input::placeholder { color: #64748b; }
  .form-label input:focus { border-color: #7dd3fc70; }
  .form-notice { margin: -4px 0 0; color: #fca5a5; font-size: 11px; }
  .modal-actions { display: flex; justify-content: end; flex-wrap: wrap; gap: 9px; margin-top: 6px; padding-top: 17px; border-top: 1px solid #ffffff10; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modal-in { from { opacity: 0; transform: translateY(8px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }

  @media (min-width: 1500px) {
    .page-content { padding-top: 46px; }
    .welcome-row { min-height: 205px; }
    .game-grid { gap: 19px; }
  }
  @media (max-width: 1150px) {
    .sidebar { width: 215px; }
    .main-content { margin-left: 215px; }
    .page-content { padding-right: 26px; padding-left: 26px; }
    .topbar { padding-right: 26px; padding-left: 26px; }
    .orb-decoration { margin-right: 0; transform: scale(.85); }
    .stats-row { gap: 9px; }
    .stat-card { padding: 12px 10px; gap: 9px; }
    .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .art-title strong { font-size: 22px; }
  }
  @media (max-width: 760px) {
    .sidebar { width: 64px; align-items: center; padding: 18px 8px 12px; }
    .brand { padding: 0; }
    .brand-copy, .sidebar-label, .nav-item > span:not(.nav-icon), .runner-card, .profile-copy, .profile-menu { display: none; }
    .navigation { width: 100%; margin-top: 38px; }
    .nav-item { justify-content: center; padding: 0; }
    .nav-icon { font-size: 19px; }
    .profile { justify-content: center; padding: 14px 0 0; }
    .main-content { margin-left: 64px; }
    .topbar { height: 58px; padding: 0 18px; }
    .page-content { padding: 25px 18px 16px; }
    .welcome-row { min-height: 180px; }
    .orb-decoration { position: absolute; right: -60px; opacity: .32; transform: scale(.8); }
    .welcome-row > div:first-child { position: relative; z-index: 1; }
    h1 { font-size: 35px; }
    .stats-row { grid-template-columns: 1fr; margin-bottom: 32px; }
    .stat-card { min-height: 65px; }
    .game-grid { grid-template-columns: 1fr; }
    .game-art { aspect-ratio: 1.8 / 1; }
    .art-title strong { font-size: 25px; }
    .filter-row { align-items: stretch; flex-direction: column; }
    .filter-label { justify-content: end; }
    .tip-banner { align-items: start; flex-wrap: wrap; }
    .tip-action { margin-left: 46px; padding-top: 0; }
    .footer { flex-direction: column; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
  }
</style>
