<script lang="ts">
  import type { ImportPreview } from '$lib/import/pokemon-import';
  import { remainingPreviewRows, safeSpriteSource, spriteFallbackName, visiblePreviewRows } from '$lib/pokedex-preview';

  type Props = {
    preview: ImportPreview;
    mode: 'merge' | 'insert-only';
    applying: boolean;
    gameName: string;
    versionLabel: string;
    applyLabel: string;
    onApply: () => void;
    onCancel: () => void;
  };

  let {
    preview,
    mode = $bindable('merge'),
    applying,
    gameName,
    versionLabel,
    applyLabel,
    onApply,
    onCancel
  }: Props = $props();

  const MAX_VISIBLE_ISSUES = 25;

  let actionable = $derived(preview.counts.insert + preview.counts.update);
  let visibleRows = $derived(visiblePreviewRows(preview.candidates));
  let visibleIssues = $derived(preview.issues.slice(0, MAX_VISIBLE_ISSUES));
  let packMismatch = $derived(
    Boolean(preview.packGame) && preview.packGame?.toLowerCase() !== gameName.toLowerCase()
  );

  let failedSprites = $state<Record<number, boolean>>({});

  function actionLabel(action: 'insert' | 'update' | 'skip') {
    if (action === 'insert') return 'Nueva';
    if (action === 'update') return 'Actualiza';
    return 'Sin cambios';
  }

</script>

{#if packMismatch}
  <div class="pdi-notice">
    El archivo indica «{preview.packGame}», pero se importará en {gameName} · {versionLabel}.
  </div>
{/if}

<div class="pdi-counts">
  <span><strong>{preview.counts.insert}</strong> nuevas</span>
  <span><strong>{preview.counts.update}</strong> actualizan</span>
  <span><strong>{preview.counts.skip}</strong> sin cambios</span>
  <span class="pdi-error-count"><strong>{preview.counts.errors}</strong> errores</span>
</div>

{#if visibleRows.length > 0}
  <div class="pdi-table-wrap">
    <table class="pdi-table">
      <thead>
        <tr>
          <th>Línea</th>
          <th>Sprite</th>
          <th>N.º</th>
          <th>Nombre</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        {#each visibleRows as row (row.line)}
          {@const spriteSrc = safeSpriteSource(row.input)}
          {@const hasFailed = failedSprites[row.line]}
          <tr>
            <td>{row.line}</td>
            <td class="pdi-sprite-cell">
              {#if spriteSrc && !hasFailed}
                <img
                  src={spriteSrc}
                  alt=""
                  class="pdi-sprite-img"
                  loading="lazy"
                  onerror={() => (failedSprites[row.line] = true)}
                />
              {:else}
                <span class="pdi-sprite-placeholder">{spriteFallbackName(row.input.name)}</span>
              {/if}
            </td>
            <td class="pdi-num-cell">#{String(row.input.dex_number).padStart(3, '0')}</td>
            <td class="pdi-name-cell">
              <strong>{row.input.name}</strong>
              {#if row.input.form_name}
                <span class="pdi-form-badge">({row.input.form_name})</span>
              {/if}
            </td>
            <td><span class="pdi-badge pdi-badge-{row.action}">{actionLabel(row.action)}</span></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if remainingPreviewRows(preview.candidates) > 0}
      <p class="pdi-more" data-testid="pdi-more">+{remainingPreviewRows(preview.candidates)} más</p>
    {/if}
  </div>
{/if}

{#if visibleIssues.length > 0}
  <div class="pdi-issues">
    {#each visibleIssues as issue (`${issue.line}-${issue.message}`)}
      <div class="pdi-issue pdi-issue-{issue.severity}">
        <span>Línea {issue.line}</span> {issue.message}
      </div>
    {/each}
    {#if preview.issues.length > MAX_VISIBLE_ISSUES}
      <p class="pdi-more">y {preview.issues.length - MAX_VISIBLE_ISSUES} avisos más…</p>
    {/if}
  </div>
{/if}

<label class="pdi-mode">
  <input type="radio" bind:group={mode} value="merge" />
  Añadir nuevas y actualizar las que coincidan en número y forma
</label>
<label class="pdi-mode">
  <input type="radio" bind:group={mode} value="insert-only" />
  Solo añadir nuevas; no tocar las existentes
</label>

<div class="pdi-actions">
  <button type="button" class="pdi-secondary" onclick={onCancel} disabled={applying}>Cancelar</button>
  <button
    type="button"
    class="pdi-primary"
    onclick={() => onApply()}
    disabled={applying || actionable === 0}
  >
    {applyLabel}
  </button>
</div>

<style>
  .pdi-counts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .pdi-counts span {
    padding: 9px 12px;
    border: 1px solid var(--enc-border);
    border-radius: 10px;
    background: var(--enc-panel);
    color: var(--enc-muted);
    font-size: 0.72rem;
  }

  .pdi-counts strong {
    display: block;
    color: var(--enc-text, inherit);
    font-size: 1.1rem;
  }

  .pdi-counts .pdi-error-count strong {
    color: #fb7185;
  }

  .pdi-table-wrap {
    border: 1px solid var(--enc-border);
    border-radius: 11px;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
  }

  .pdi-table {
    width: 100%;
    min-width: 520px;
    border-collapse: collapse;
    font-size: 0.76rem;
  }

  .pdi-table th {
    padding: 8px 12px;
    background: var(--enc-input);
    color: var(--enc-muted);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-align: left;
    text-transform: uppercase;
  }

  .pdi-table td {
    padding: 8px 12px;
    border-top: 1px solid var(--enc-border);
    vertical-align: middle;
  }

  .pdi-table td:first-child {
    color: var(--enc-muted);
    font-variant-numeric: tabular-nums;
    width: 52px;
  }

  .pdi-sprite-cell {
    width: 44px;
    padding: 4px 8px !important;
    text-align: center;
  }

  .pdi-sprite-img {
    width: 36px;
    height: 36px;
    object-fit: contain;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    display: block;
    margin: 0 auto;
  }

  .pdi-sprite-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin: 0 auto;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--enc-muted);
    font-weight: 700;
    font-size: 0.8rem;
  }

  .pdi-num-cell {
    width: 56px;
    color: var(--enc-muted);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .pdi-name-cell {
    font-size: 0.82rem;
  }

  .pdi-form-badge {
    margin-left: 6px;
    font-size: 0.72rem;
    color: var(--enc-muted);
    font-weight: normal;
  }

  .pdi-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.64rem;
    font-weight: 700;
  }

  .pdi-badge-insert {
    background: rgba(52, 211, 153, 0.16);
    color: #34d399;
  }

  .pdi-badge-update {
    background: rgba(96, 165, 250, 0.16);
    color: #93c5fd;
  }

  .pdi-badge-skip {
    background: rgba(148, 163, 184, 0.16);
    color: var(--enc-muted);
  }

  .pdi-more {
    margin: 6px 12px;
    color: var(--enc-muted);
    font-size: 0.72rem;
  }

  .pdi-issues {
    display: grid;
    gap: 6px;
    max-height: 180px;
    overflow: auto;
  }

  .pdi-issue {
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 0.74rem;
    line-height: 1.5;
  }

  .pdi-issue span {
    font-weight: 700;
    margin-right: 6px;
  }

  .pdi-issue-error {
    background: rgba(244, 63, 94, 0.1);
    color: #fb7185;
  }

  .pdi-issue-warning {
    background: rgba(250, 204, 21, 0.1);
    color: #facc15;
  }

  .pdi-notice {
    padding: 10px 12px;
    border: 1px solid rgba(250, 204, 21, 0.28);
    border-radius: 10px;
    background: rgba(250, 204, 21, 0.08);
    color: #facc15;
    font-size: 0.78rem;
    line-height: 1.55;
  }

  .pdi-mode {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--enc-muted);
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .pdi-mode input {
    margin-top: 2px;
    accent-color: var(--enc-accent);
  }

  .pdi-primary,
  .pdi-secondary {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid transparent;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .pdi-primary {
    border-color: var(--enc-accent);
    background: var(--enc-accent);
    color: #04211a;
  }

  .pdi-secondary {
    border-color: var(--enc-border);
    background: var(--enc-panel);
    color: var(--enc-text, inherit);
  }

  .pdi-primary:disabled,
  .pdi-secondary:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .pdi-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .pdi-counts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  :global(html[data-theme='light']) .pdi-primary {
    color: #fff;
  }
</style>
