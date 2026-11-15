/**
 * Gestor extensible del historial de navegación para DexDeck.
 *
 * Registra tanto las secciones principales como las vistas internas navegables,
 * preservando los parámetros necesarios para restaurar el estado. Soporta navegación
 * bidireccional (atrás / adelante) con los botones laterales del ratón (botones 3 y 4)
 * y atajos de teclado (Alt+Flecha Izquierda / Derecha).
 */

export type SectionId = 'Biblioteca' | 'Enciclopedia' | 'Actualizaciones' | 'Ajustes';

export type NavigationLocation = {
  section: SectionId;
  subView?: string;
  params?: Record<string, string | number>;
  announcement?: string;
};

export class NavigationManager {
  history = $state<NavigationLocation[]>([{ section: 'Biblioteca', announcement: 'Sección Biblioteca' }]);
  currentIndex = $state(0);
  announcement = $state('Sección Biblioteca');

  get current(): NavigationLocation {
    return this.history[this.currentIndex] ?? { section: 'Biblioteca' };
  }

  get canBack(): boolean {
    return this.currentIndex > 0;
  }

  get canForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  push(location: NavigationLocation): void {
    const current = this.current;
    if (this.isEqual(current, location)) {
      return;
    }

    // Al navegar a una nueva vista mientras existe historial futuro, este debe truncarse
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(location);
    this.currentIndex = this.history.length - 1;
    this.announcement = location.announcement ?? this.computeAnnouncement(location);
  }

  replace(location: NavigationLocation): void {
    this.history = this.history.map((entry, index) => index === this.currentIndex ? location : entry);
    this.announcement = location.announcement ?? this.computeAnnouncement(location);
  }

  back(): NavigationLocation | null {
    if (!this.canBack) return null;
    this.currentIndex -= 1;
    const loc = this.current;
    this.announcement = loc.announcement ?? this.computeAnnouncement(loc);
    return loc;
  }

  forward(): NavigationLocation | null {
    if (!this.canForward) return null;
    this.currentIndex += 1;
    const loc = this.current;
    this.announcement = loc.announcement ?? this.computeAnnouncement(loc);
    return loc;
  }

  private isEqual(a: NavigationLocation, b: NavigationLocation): boolean {
    if (a.section !== b.section) return false;
    if (a.subView !== b.subView) return false;
    const aParams = a.params ?? {};
    const bParams = b.params ?? {};
    const aKeys = Object.keys(aParams);
    const bKeys = Object.keys(bParams);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => aParams[key] === bParams[key]) &&
      (a.announcement ?? '') === (b.announcement ?? '');
  }

  computeAnnouncement(loc: NavigationLocation): string {
    if (loc.announcement) return loc.announcement;
    if (loc.section === 'Enciclopedia' && loc.subView === 'game' && loc.params?.gameName) {
      return `Enciclopedia: ${loc.params.gameName}`;
    }
    return `Sección ${loc.section}`;
  }
}
