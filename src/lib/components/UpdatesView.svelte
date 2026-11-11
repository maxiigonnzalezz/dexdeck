<script lang="ts">
  import type { InstallationInfo } from '$lib/app-types';
  import { appUpdates } from '$lib/app-updates.svelte';

  type Props = {
    appVersion: string;
    installationInfo: InstallationInfo | null;
    onBack: () => void;
  };

  let { appVersion, installationInfo, onBack }: Props = $props();
</script>

<section class="subpage-header">
  <div class="eyebrow"><span class="eyebrow-line"></span> SIEMPRE AL DÍA</div>
  <h1>Centro de <span>actualizaciones.</span></h1>
  <p class="intro">Mantén DexDeck actualizado y consulta aquí las futuras actualizaciones de tus fangames.</p>
</section>

<div class="settings-panel app-update-panel">
  <div class="setting-row app-update-row">
    <div class="setting-icon">↻</div>
    <div class="setting-copy app-update-copy">
      <strong>Actualización de DexDeck</strong>
      <p>Versión instalada: {appVersion}</p>
      {#if installationInfo}
        <p>{installationInfo.message}</p>
      {/if}
      {#if appUpdates.message}
        <p class="app-update-message" role="status">{appUpdates.message}</p>
      {/if}
      {#if appUpdates.notes && appUpdates.state === 'available'}
        <p class="app-update-notes">{appUpdates.notes}</p>
      {/if}
      {#if appUpdates.state === 'downloading'}
        <div class="app-update-progress" aria-label="Progreso de descarga">
          <span style={`width: ${appUpdates.progress}%`}></span>
        </div>
        {#if appUpdates.progress > 0}
          <p>{appUpdates.progress}% descargado</p>
        {/if}
      {/if}
    </div>
    <button
      type="button"
      class="primary-button app-update-button"
      disabled={!installationInfo || (!installationInfo.canUpdate && installationInfo.kind !== 'deb') || ['checking', 'downloading', 'installing'].includes(appUpdates.state)}
      onclick={() => appUpdates.handleAction(installationInfo, appVersion)}
    >
      {#if appUpdates.state === 'checking'}Comprobando…{:else if appUpdates.state === 'downloading'}Descargando…{:else if appUpdates.state === 'installing'}Instalando…{:else if appUpdates.state === 'available'}Actualizar ahora{:else}Actualizar{/if}
    </button>
  </div>
</div>

<section class="library-section fangame-updates-section">
  <div class="section-heading">
    <div>
      <div class="section-kicker">TU COLECCIÓN</div>
      <h2>Actualizaciones de fangames</h2>
    </div>
  </div>
  <div class="placeholder-panel">
    <div class="placeholder-icon">◇</div>
    <h2>Tus juegos, al día.</h2>
    <p>La comprobación de versiones de fangames llegará más adelante. Primero configuraremos las fuentes oficiales de cada proyecto.</p>
    <button class="secondary-button" onclick={onBack}>Volver a la biblioteca</button>
  </div>
</section>
