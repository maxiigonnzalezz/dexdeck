<script lang="ts">
  import { onMount } from 'svelte';
  import {
    deleteGamePermanently,
    listHiddenGames,
    restoreGame,
    type Game
  } from '$lib/db';
  import { scrollLockDialog } from '$lib/scroll-lock';

  type Props = {
    /** Se llama cuando un juego vuelve a la biblioteca o se borra del todo. */
    onChanged?: () => void;
  };

  let { onChanged }: Props = $props();

  let games = $state<Game[]>([]);
  let loading = $state(true);
  let error = $state('');
  let status = $state('');
  let busyId = $state<number | null>(null);
  let pendingDelete = $state<Game | null>(null);
  let confirmDialog: HTMLDialogElement | undefined = $state(undefined);

  async function load() {
    loading = true;
    error = '';
    try {
      games = await listHiddenGames();
    } catch (loadError) {
      console.error('No se pudieron cargar los juegos ocultos:', loadError);
      error = 'No se pudieron cargar los juegos ocultos. Comprueba la base de datos.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  async function restore(game: Game) {
    if (busyId !== null) return;
    busyId = game.id;
    status = '';
    error = '';

    try {
      await restoreGame(game.id);
      games = games.filter((entry) => entry.id !== game.id);
      status = `${game.name} vuelve a la biblioteca.`;
      onChanged?.();
    } catch (restoreError) {
      console.error('No se pudo restaurar el juego:', restoreError);
      error = `No se pudo restaurar ${game.name}. Inténtalo de nuevo.`;
    } finally {
      busyId = null;
    }
  }

  function askDelete(game: Game) {
    pendingDelete = game;
    error = '';
    status = '';
    if (confirmDialog && !confirmDialog.open) confirmDialog.showModal();
  }

  async function confirmDelete() {
    const game = pendingDelete;
    if (!game || busyId !== null) return;

    busyId = game.id;

    try {
      await deleteGamePermanently(game.id);
      games = games.filter((entry) => entry.id !== game.id);
      status = `${game.name} se ha borrado definitivamente.`;
      confirmDialog?.close();
      onChanged?.();
    } catch (deleteError) {
      console.error('No se pudo borrar el juego:', deleteError);
      error = `No se pudo borrar ${game.name}. Inténtalo de nuevo.`;
      confirmDialog?.close();
    } finally {
      busyId = null;
    }
  }
</script>

<section class="hidden-games" data-testid="hidden-games-panel" aria-labelledby="hidden-games-title">
  <header class="hidden-header">
    <div>
      <div class="eyebrow"><span class="eyebrow-line"></span> BIBLIOTECA</div>
      <h2 id="hidden-games-title">Juegos ocultos</h2>
      <p>
        Quitar un juego de la biblioteca solo lo oculta. Recupéralo aquí o bórralo del todo
        (también sus versiones y su Pokédex).
      </p>
    </div>
    <span class="hidden-count" aria-label={`${games.length} juegos ocultos`}>{games.length}</span>
  </header>

  {#if status}
    <p class="hidden-status" role="status" data-testid="hidden-status">{status}</p>
  {/if}

  {#if error}
    <p class="hidden-error" role="alert" data-testid="hidden-error">{error}</p>
  {/if}

  {#if loading}
    <p class="hidden-empty">Cargando juegos ocultos…</p>
  {:else if games.length === 0}
    <p class="hidden-empty" data-testid="hidden-empty">
      No hay juegos ocultos. Todo lo que quites de la biblioteca aparecerá aquí.
    </p>
  {:else}
    <ul class="hidden-list">
      {#each games as game (game.id)}
        <li class="hidden-item" data-testid="hidden-game" data-game-name={game.name}>
          <div class="hidden-copy">
            <strong>{game.name}</strong>
            <span>{game.developer} · v{game.version} · {game.type}</span>
          </div>
          <div class="hidden-actions">
            <button
              type="button"
              class="secondary-button"
              data-testid="hidden-restore"
              disabled={busyId !== null}
              onclick={() => void restore(game)}
            >Restaurar</button>
            <button
              type="button"
              class="danger-button"
              data-testid="hidden-delete"
              disabled={busyId !== null}
              onclick={() => askDelete(game)}
            >Borrar</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<dialog
  bind:this={confirmDialog}
  use:scrollLockDialog
  class="modal"
  aria-labelledby="hidden-delete-title"
  data-testid="hidden-delete-dialog"
  onclose={() => (pendingDelete = null)}
  onclick={(event) => {
    if (event.target === confirmDialog) confirmDialog?.close();
  }}
>
  {#if pendingDelete}
    <div class="modal-top">
      <div class="modal-icon remove-icon">!</div>
      <button class="modal-close" aria-label="Cerrar" onclick={() => confirmDialog?.close()}>×</button>
    </div>
    <div class="section-kicker">ACCIÓN IRREVERSIBLE</div>
    <h2 id="hidden-delete-title">¿Borrar {pendingDelete.name} para siempre?</h2>
    <p class="modal-description">
      Se eliminará el juego de la base de datos junto con sus versiones y las entradas de su
      Pokédex. Los archivos del juego en tu disco no se tocan. Esta acción no se puede deshacer.
    </p>
    <div class="modal-actions">
      <button type="button" class="secondary-button" onclick={() => confirmDialog?.close()}>Cancelar</button>
      <button
        type="button"
        class="danger-button"
        data-testid="hidden-delete-confirm"
        disabled={busyId !== null}
        onclick={() => void confirmDelete()}
      >Borrar definitivamente</button>
    </div>
  {/if}
</dialog>

<style>
  .hidden-games {
    margin-top: 18px;
    padding: 19px;
    border: 1px solid #ffffff12;
    border-radius: 13px;
    background: #ffffff04;
    color: var(--dd-text, #f1f5f9);
  }

  .hidden-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .hidden-header h2 {
    margin: 6px 0 4px;
    font-size: 17px;
    letter-spacing: -0.4px;
  }

  .hidden-header p {
    margin: 0;
    max-width: 62ch;
    color: var(--dd-muted, #8695ab);
    font-size: 10px;
    line-height: 1.7;
  }

  .hidden-count {
    padding: 6px 10px;
    border: 1px solid var(--dd-border, #ffffff10);
    border-radius: 7px;
    color: var(--dd-muted, #c3cfdf);
    background: var(--dd-soft, #ffffff07);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .hidden-status,
  .hidden-error,
  .hidden-empty {
    margin: 14px 0 0;
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 10px;
    line-height: 1.6;
  }

  .hidden-status {
    border: 1px solid color-mix(in srgb, var(--dd-accent, #62e6c2) 35%, transparent);
    background: color-mix(in srgb, var(--dd-accent, #62e6c2) 10%, transparent);
    color: var(--dd-text, #f1f5f9);
  }

  .hidden-error {
    border: 1px solid #ef444455;
    background: #ef444414;
    color: #fecaca;
  }

  .hidden-empty {
    border: 1px dashed var(--dd-border, #ffffff14);
    color: var(--dd-muted, #8695ab);
  }

  .hidden-list {
    display: grid;
    gap: 8px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
  }

  .hidden-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--dd-border, #ffffff10);
    border-radius: 10px;
    background: var(--dd-soft, #ffffff05);
  }

  .hidden-copy {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .hidden-copy strong {
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .hidden-copy span {
    color: var(--dd-muted, #8695ab);
    font-size: 10px;
    overflow-wrap: anywhere;
  }

  .hidden-actions {
    display: flex;
    gap: 8px;
  }
</style>
