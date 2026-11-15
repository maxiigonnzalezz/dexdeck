<script lang="ts">
  import { isWebUrl } from '$lib/url';

  type Props = {
    /** URL remota del sprite (tiene prioridad si es http/https). */
    url?: string;
    /** Ruta local guardada por las importaciones. */
    path?: string;
    name: string;
    variant?: 'row' | 'detail';
  };

  let { url = '', path = '', name = '', variant = 'row' }: Props = $props();

  // Si una imagen falla, se recuerda qué origen falló para no reintentarlo en
  // cada render y mostrar el marcador de posición en su lugar.
  let failedSrc = $state('');

  let candidate = $derived(url && isWebUrl(url) ? url : path);
  let src = $derived(candidate && candidate !== failedSrc ? candidate : '');
  let initials = $derived(name.trim().slice(0, 2).toUpperCase() || '?');
</script>

{#if src}
  <img
    class={variant === 'detail' ? 'sprite-detail' : 'sprite-row'}
    {src}
    alt={variant === 'detail' ? `Sprite de ${name}` : ''}
    loading="lazy"
    onerror={() => (failedSrc = candidate)}
  />
{:else if variant === 'detail'}
  <span class="placeholder-detail" data-testid="pokedex-sprite-placeholder">{initials}</span>
{:else}
  <span data-testid="pokedex-row-sprite-placeholder">{initials}</span>
{/if}

<style>
  img {
    display: block;
  }

  .sprite-row {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .sprite-detail {
    width: 128px;
    height: 128px;
    object-fit: contain;
    border-radius: 12px;
    background: var(--enc-input);
    box-shadow: inset 0 0 0 1px var(--enc-border);
  }

  .placeholder-detail {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 112px;
    height: 112px;
    border: 1px dashed var(--enc-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--enc-border) 55%, transparent);
    color: var(--enc-muted);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  @media (max-width: 820px) {
    .sprite-detail {
      width: 104px;
      height: 104px;
    }

    .placeholder-detail {
      width: 92px;
      height: 92px;
      font-size: 1.6rem;
    }
  }
</style>
