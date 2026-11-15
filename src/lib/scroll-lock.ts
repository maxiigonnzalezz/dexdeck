/**
 * Gestor centralizado del bloqueo de scroll para modales y diálogos.
 *
 * Mantiene un contador de referencias de capas activas para soportar diálogos
 * anidados, compensa el ancho de la barra de desplazamiento para evitar saltos
 * horizontales de maquetación y vigila el DOM para restaurar el scroll de forma
 * segura si un componente se desmonta de forma inesperada.
 */

let lockCount = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';
let previousBodyPaddingRight = '';
let bodyHadLockClass = false;
let htmlHadLockClass = false;
let isObserverInitialized = false;

function getScrollbarWidth(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  return window.innerWidth - document.documentElement.clientWidth;
}

/**
 * Adquiere un bloqueo de scroll del fondo.
 * Devuelve una función para liberarlo.
 */
export function acquireScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) {
    const scrollbarWidth = getScrollbarWidth();
    const body = document.body;
    const html = document.documentElement;

    previousBodyOverflow = body.style.overflow;
    previousHtmlOverflow = html.style.overflow;
    previousBodyPaddingRight = body.style.paddingRight;
    bodyHadLockClass = body.classList.contains('scroll-locked');
    htmlHadLockClass = html.classList.contains('scroll-locked');

    if (scrollbarWidth > 0) {
      const originalPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${originalPadding + scrollbarWidth}px`;
    }

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    body.classList.add('scroll-locked');
    html.classList.add('scroll-locked');
  }

  lockCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    releaseOneScrollLock();
  };
}

/**
 * Libera un bloqueo de scroll del fondo.
 */
function releaseOneScrollLock(): void {
  if (typeof document === 'undefined') return;

  if (lockCount > 0) {
    lockCount -= 1;
  }

  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;

    body.style.overflow = previousBodyOverflow;
    html.style.overflow = previousHtmlOverflow;
    body.style.paddingRight = previousBodyPaddingRight;
    body.classList.toggle('scroll-locked', bodyHadLockClass);
    html.classList.toggle('scroll-locked', htmlHadLockClass);
  }
}

/**
 * Comprueba si el scroll está actualmente bloqueado.
 */
export function isScrollLocked(): boolean {
  return lockCount > 0;
}

/**
 * Inicializa un observador global que detecta cuándo hay diálogos nativos o
 * backdrops abiertos en el DOM y sincroniza el bloqueo automáticamente.
 */
export function initScrollLockObserver(): () => void {
  if (typeof document === 'undefined' || isObserverInitialized) {
    return () => {};
  }
  isObserverInitialized = true;

  const activeNativeDialogs = new Map<Element, () => void>();

  function syncLocks() {
    const openDialogs = document.querySelectorAll('dialog[open], .enc-modal-backdrop, [data-scroll-locked]');
    const currentElements = new Set(Array.from(openDialogs));

    // Si hay modales abiertos pero no tenemos locks correspondientes
    for (const el of currentElements) {
      if (!activeNativeDialogs.has(el)) {
        activeNativeDialogs.set(el, acquireScrollLock());
      }
    }

    // Si algún modal se cerró o se eliminó del DOM
    for (const [el, release] of activeNativeDialogs) {
      if (!currentElements.has(el)) {
        activeNativeDialogs.delete(el);
        release();
      }
    }
  }

  const observer = new MutationObserver(() => {
    syncLocks();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'class', 'data-scroll-locked']
  });

  // Escuchar eventos close nativos de <dialog>
  const handleClose = (event: Event) => {
    if (event.target instanceof Element && activeNativeDialogs.has(event.target)) {
      activeNativeDialogs.get(event.target)?.();
      activeNativeDialogs.delete(event.target);
    }
  };

  window.addEventListener('close', handleClose, true);

  // Sincronización inicial por si ya hay un diálogo abierto
  syncLocks();

  return () => {
    observer.disconnect();
    window.removeEventListener('close', handleClose, true);
    for (const release of activeNativeDialogs.values()) release();
    activeNativeDialogs.clear();
    isObserverInitialized = false;
  };
}

/** Sincroniza el bloqueo con el atributo real que showModal()/close() actualizan. */
export function scrollLockDialog(node: HTMLDialogElement) {
  let release: (() => void) | undefined;

  const sync = () => {
    if (node.open && !release) release = acquireScrollLock();
    else if (!node.open && release) {
      release();
      release = undefined;
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(node, { attributes: true, attributeFilter: ['open'] });
  sync();

  return {
    destroy() {
      observer.disconnect();
      release?.();
      release = undefined;
    }
  };
}
