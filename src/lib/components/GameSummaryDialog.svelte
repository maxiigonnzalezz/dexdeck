<script lang="ts">
  import { tick } from 'svelte';
  import type { Game } from '$lib/db';
  import { isWebUrl } from '$lib/url';
  import { scrollLockDialog } from '$lib/scroll-lock';

  type Props = {
    launchingGameId: number | null;
    onEdit: (game: Game) => void;
    onLaunch: (game: Game) => void;
  };

  let { launchingGameId, onEdit, onLaunch }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state(undefined);
  let game = $state<Game | null>(null);
  let closeButton: HTMLButtonElement | undefined = $state(undefined);

  /** Abre la ficha de consulta de un juego de la biblioteca. */
  export async function open(nextGame: Game) {
    game = nextGame;
    if (dialog && !dialog.open) dialog.showModal();
    await tick();
    closeButton?.focus();
  }

  export function close() {
    dialog?.close();
  }
</script>

<!-- Ficha de consulta -->
<dialog
  bind:this={dialog}
  use:scrollLockDialog
  class="modal detail-modal"
  data-testid="game-detail-dialog"
  aria-modal="true"
  aria-labelledby="detail-title"
  aria-describedby="detail-description"
  onclose={() => (game = null)}
  onclick={(event) => {
    if (event.target === dialog) dialog?.close();
  }}
>
  {#if game}
    <div class="modal-top">
      <div class="modal-icon">◇</div>
      <button bind:this={closeButton} class="modal-close" aria-label="Cerrar ficha" onclick={() => dialog?.close()}>×</button>
    </div>

    <div class="section-kicker">DEXDECK COLLECTION · FICHA DEL JUEGO</div>
    <h2 id="detail-title">{game.name}</h2>
    <p class="modal-description" id="detail-description">
      {game.developer} · Versión {game.version}
    </p>

    {#if game.cover && isWebUrl(game.cover)}
      <img class="detail-cover" src={game.cover} alt={`Portada de ${game.name}`} />
    {/if}

    <div class="detail-badges">
      <span class="game-tag">{game.type}</span>
      <span class="game-tag">{game.status}</span>
      <span class="game-tag">v{game.version}</span>
    </div>

    <section class="detail-section">
      <h3>Descripción</h3>
      <p class="detail-text">
        {game.description || 'Todavía no has añadido una descripción para este juego.'}
      </p>
    </section>

    <section class="detail-section">
      <h3>Enlaces y archivos</h3>

      <div class="detail-field">
        <span>Web oficial</span>
        {#if game.official_url && isWebUrl(game.official_url)}
          <a href={game.official_url} target="_blank" rel="noreferrer">{game.official_url}</a>
        {:else}
          <p>Sin especificar</p>
        {/if}
      </div>

      <div class="detail-field">
        <span>Ruta de instalación</span>
        <p class="path-value">{game.install_path || 'Sin especificar'}</p>
      </div>

      <div class="detail-field">
        <span>Ejecutable</span>
        <p class="path-value">{game.executable_path || 'Sin especificar'}</p>
      </div>
    </section>

    <div class="modal-actions">
      <button type="button" class="secondary-button" onclick={() => dialog?.close()}>Cerrar</button>
      <button type="button" class="secondary-button" onclick={() => onEdit(game!)}>
        Configurar detalles <span>⚙</span>
      </button>
      <button
        type="button"
        class="primary-button"
        disabled={launchingGameId !== null}
        onclick={() => onLaunch(game!)}
      >
        {launchingGameId === game.id ? 'Iniciando…' : 'Jugar'} <span>▶</span>
      </button>
    </div>
  {/if}
</dialog>
