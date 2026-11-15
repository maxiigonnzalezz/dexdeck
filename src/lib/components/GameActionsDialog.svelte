<script lang="ts">
  import { tick } from 'svelte';
  import type { Game } from '$lib/db';
  import { scrollLockDialog } from '$lib/scroll-lock';

  type Props = {
    onPrepare: (game: Game) => void;
    onRemove: (game: Game) => Promise<boolean>;
  };

  let { onPrepare, onRemove }: Props = $props();

  let dialog: HTMLDialogElement | undefined = $state(undefined);
  let game = $state<Game | null>(null);
  let showRemoveConfirm = $state(false);
  let removing = $state(false);
  let closeButton: HTMLButtonElement | undefined = $state(undefined);

  /** Abre la ficha ampliada de un juego de la biblioteca. */
  export async function open(nextGame: Game) {
    showRemoveConfirm = false;
    game = nextGame;
    if (dialog && !dialog.open) dialog.showModal();
    await tick();
    closeButton?.focus();
  }

  export function close() {
    dialog?.close();
  }

  async function handleRemove() {
    if (!game || removing) return;
    removing = true;
    try {
      const removed = await onRemove(game);
      if (removed) dialog?.close();
    } finally {
      removing = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  use:scrollLockDialog
  class="modal game-details-modal"
  data-testid="game-details-dialog"
  aria-modal="true"
  aria-labelledby="game-modal-title"
  aria-describedby="game-modal-description"
  onclose={() => {
    game = null;
    showRemoveConfirm = false;
  }}
  onclick={(event) => {
    if (event.target === dialog) dialog?.close();
  }}
>
  {#if game}
    {#if showRemoveConfirm}
      <div class="remove-confirm-content">
        <div class="modal-top">
          <div class="modal-icon remove-icon">!</div>
          <button class="modal-close" aria-label="Volver a la ficha" onclick={() => (showRemoveConfirm = false)}>×</button>
        </div>
        <div class="section-kicker">CONFIRMAR ACCIÓN</div>
        <h2 id="game-modal-title">¿Quitar {game.name}?</h2>
        <p class="modal-description" id="game-modal-description">
          Se eliminará de tu biblioteca de DexDeck. Esta acción no borra los archivos del juego de tu disco.
        </p>
        <div class="modal-actions">
          <button type="button" class="secondary-button" disabled={removing} onclick={() => (showRemoveConfirm = false)}>Cancelar</button>
          <button type="button" class="danger-button" disabled={removing} onclick={() => void handleRemove()}>Quitar de la biblioteca</button>
        </div>
      </div>
    {:else}
      <div class={`game-details-hero art-${game.color}`}>
        <div class="art-grid"></div>
        <div class="art-glow"></div>
        <div class="art-orbit orbit-a"></div>
        <div class="art-orbit orbit-b"></div>
        <div class="art-emblem">{game.symbol}</div>
        <button bind:this={closeButton} class="modal-close details-close" aria-label="Cerrar ficha" onclick={() => dialog?.close()}>×</button>
        <div class="details-hero-copy">
          <span>DEXDECK COLLECTION</span>
          <h2 id="game-modal-title">{game.name}</h2>
          <p>{game.developer}</p>
        </div>
      </div>
      <div class="game-details-body">
        <div class="section-kicker">DETALLES DEL JUEGO</div>
        <div class="details-meta-grid">
          <div class="details-meta-item"><span>Tipo</span><strong>{game.type}</strong></div>
          <div class="details-meta-item"><span>Versión</span><strong>{game.version}</strong></div>
          <div class="details-meta-item"><span>Estado</span><strong>{game.status}</strong></div>
        </div>
        <p class="details-note" id="game-modal-description">DexDeck todavía no gestiona los archivos instalados. Desde aquí puedes preparar el lanzamiento (cuando esté configurado) o quitar esta entrada de la biblioteca sin borrar el juego del disco.</p>
        <div class="game-details-actions">
          <button type="button" class="primary-button" onclick={() => onPrepare(game!)}><span>▶</span> Preparar para jugar</button>
          <button type="button" class="secondary-button" onclick={() => (showRemoveConfirm = true)}>Quitar de biblioteca</button>
        </div>
      </div>
    {/if}
  {/if}
</dialog>
