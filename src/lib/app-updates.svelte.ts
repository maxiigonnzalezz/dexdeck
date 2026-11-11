import type { AppUpdateState, InstallationInfo } from './app-types';
import { openUrl } from '@tauri-apps/plugin-opener';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';

// El estado vive fuera del componente para no perder una comprobación o una
// descarga en curso al cambiar de sección. Svelte lo comparte con la vista.
class AppUpdates {
  state = $state<AppUpdateState>('idle');
  message = $state('');
  version = $state('');
  notes = $state('');
  progress = $state(0);
  #pending: Update | null = null;

  async check(installationInfo: InstallationInfo | null, appVersion: string) {
    if (!installationInfo) return;

    if (installationInfo.kind === 'deb') {
      this.state = 'manual';
      this.message = 'Los paquetes DEB se actualizan descargando la nueva versión e instalándola con el gestor de paquetes.';
      try {
        await openUrl('https://github.com/maxiigonnzalezz/dexdeck/releases/latest');
      } catch (error) {
        console.error('No se pudo abrir la página de descargas:', error);
        this.message = 'No se pudo abrir la página de descargas. Puedes acceder a ella desde GitHub Releases.';
      }
      return;
    }

    if (!installationInfo.canUpdate) {
      this.state = 'error';
      this.message = installationInfo.message || 'Esta instalación no admite actualizaciones automáticas.';
      return;
    }

    this.state = 'checking';
    this.message = 'Comprobando si hay una versión nueva…';
    this.progress = 0;

    try {
      if (this.#pending) {
        await this.#pending.close();
        this.#pending = null;
      }

      const update = await check();
      if (!update) {
        this.state = 'current';
        this.message = `Ya tienes la versión más reciente (${appVersion}).`;
        this.version = '';
        this.notes = '';
        return;
      }

      this.#pending = update;
      this.version = update.version;
      this.notes = update.body ?? '';
      this.state = 'available';
      this.message = `Hay una actualización disponible: ${update.version}. Pulsa «Actualizar» para instalarla.`;
    } catch (error) {
      console.error('Error al comprobar actualizaciones:', error);
      this.state = 'error';
      this.message = 'No se han podido comprobar las actualizaciones. Comprueba tu conexión e inténtalo de nuevo.';
    }
  }

  async install() {
    if (!this.#pending || this.state !== 'available') return;

    this.state = 'downloading';
    this.message = `Descargando DexDeck ${this.version}…`;
    this.progress = 0;
    let downloaded = 0;
    let contentLength = 0;

    try {
      await this.#pending.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0;
          downloaded = 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            this.progress = Math.min(100, Math.round((downloaded / contentLength) * 100));
          }
        } else if (event.event === 'Finished') {
          this.progress = 100;
          this.state = 'installing';
          this.message = 'Descarga completada. Instalando la actualización…';
        }
      });

      this.#pending = null;
      this.state = 'installing';
      this.message = 'Actualización instalada. Reiniciando DexDeck…';
      await relaunch();
    } catch (error) {
      console.error('No se pudo instalar la actualización:', error);
      this.state = 'error';
      this.message = 'La actualización no se ha podido instalar. Tu instalación actual se ha conservado.';
    }
  }

  handleAction(installationInfo: InstallationInfo | null, appVersion: string) {
    if (this.state === 'available') {
      void this.install();
    } else {
      void this.check(installationInfo, appVersion);
    }
  }
}

export const appUpdates = new AppUpdates();
