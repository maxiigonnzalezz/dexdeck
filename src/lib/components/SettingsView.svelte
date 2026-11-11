<script lang="ts">
  import type { InstallationInfo, SystemInfo, ThemeName } from '$lib/app-types';

  type Props = {
    theme: ThemeName;
    systemInfo: SystemInfo | null;
    installationInfo: InstallationInfo | null;
    uninstalling: boolean;
    onSelectTheme: (theme: ThemeName) => void;
    onUninstall: () => void;
  };

  let { theme, systemInfo, installationInfo, uninstalling, onSelectTheme, onUninstall }: Props =
    $props();
</script>

<section class="subpage-header">
  <div class="eyebrow"><span class="eyebrow-line"></span> A TU GUSTO</div>
  <h1>Los ajustes de <span>tu espacio.</span></h1>
  <p class="intro">Aquí reuniremos las preferencias de DexDeck y la configuración del entorno de juego.</p>
</section>

<div class="settings-panel">
  <div class="setting-row setting-row-theme">
    <div class="setting-icon">◐</div>
    <div class="setting-copy">
      <strong>Tema de la aplicación</strong>
      <p>Elige cómo se ve DexDeck. La preferencia se guardará para la próxima vez.</p>
      <div class="theme-options" role="group" aria-label="Tema de la aplicación">
        <button
          type="button"
          class="theme-option"
          class:active={theme === 'light'}
          aria-pressed={theme === 'light'}
          onclick={() => onSelectTheme('light')}
        >
          <span class="theme-preview theme-preview-light" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="theme-option-label">Claro</span>
          <span class="theme-option-description">Luminoso y limpio</span>
        </button>
        <button
          type="button"
          class="theme-option"
          class:active={theme === 'dark'}
          aria-pressed={theme === 'dark'}
          onclick={() => onSelectTheme('dark')}
        >
          <span class="theme-preview theme-preview-dark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="theme-option-label">Oscuro</span>
          <span class="theme-option-description">Grafito + menta</span>
        </button>
        <button
          type="button"
          class="theme-option"
          class:active={theme === 'glass'}
          aria-pressed={theme === 'glass'}
          onclick={() => onSelectTheme('glass')}
        >
          <span class="theme-preview theme-preview-glass" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="theme-option-label">Liquid Glass</span>
          <span class="theme-option-description">Translúcido</span>
        </button>
      </div>
      {#if theme === 'glass'}
        <p class="theme-hint">Usa el fondo de escritorio como textura; no muestra las ventanas que queden detrás.</p>
      {/if}
    </div>
  </div>
  <div class="setting-row">
    <div class="setting-icon">⌘</div>
    <div class="setting-copy">
      <strong>Plataforma</strong>
      <p>{systemInfo ? `Detectado automáticamente: ${systemInfo.osName} (${systemInfo.architecture}).` : 'Detectando el sistema operativo...'}</p>
    </div>
    <span class="setting-value">{systemInfo?.osName ?? 'Detectando...'}</span>
  </div>
  <div class="setting-row">
    <div class="setting-icon">◇</div>
    <div class="setting-copy">
      <strong>Compatibilidad</strong>
      <p>{#if systemInfo?.os === 'windows'}Los ejecutables .exe se inician de forma nativa.{:else if systemInfo?.os === 'linux'}Wine es necesario para ejecutar juegos de Windows.{:else}La configuración de motores externos se añadirá más adelante.{/if}</p>
    </div>
    <span class="setting-value pending">{#if systemInfo?.os === 'windows'}Nativo{:else if systemInfo?.os === 'linux'}Wine externo{:else}Pendiente{/if}</span>
  </div>
  <div class="setting-row setting-row-danger">
    <div class="setting-icon">⌫</div>
    <div class="setting-copy">
      <strong>Desinstalar DexDeck</strong>
      <p>Quita la aplicación de este equipo y elige qué hacer con sus datos locales.</p>
      {#if installationInfo && !installationInfo.canUninstall}
        <p class="app-update-message">{installationInfo.message}</p>
      {/if}
    </div>
    <button
      type="button"
      class="danger-button"
      disabled={!installationInfo?.canUninstall || uninstalling}
      onclick={onUninstall}
    >Desinstalar</button>
  </div>
</div>
