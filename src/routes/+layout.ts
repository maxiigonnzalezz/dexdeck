// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const ssr = false;

// El plugin de WebdriverIO solo se empaqueta en el build de pruebas E2E
// (`VITE_WDIO=1`). En un build normal la condición es constante y Rollup
// elimina la rama junto con el import, así que no llega a producción.
if (import.meta.env.VITE_WDIO === '1') {
  await import('@wdio/tauri-plugin');
}
