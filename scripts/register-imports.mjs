// Resolutor de imports para las pruebas en Node. SvelteKit usa el alias `$lib`
// y TypeScript permite imports sin extensión; Node no hace ninguna de las dos
// cosas por sí solo, así que se las enseñamos aquí sin añadir dependencias.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const libRoot = fileURLToPath(new URL('../src/lib/', import.meta.url));

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;

    if (specifier.startsWith('$lib/')) {
      base = resolve(libRoot, specifier.slice(5));
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      base = fileURLToPath(new URL(specifier, context.parentURL));
    }

    if (base && !existsSync(base)) {
      for (const candidate of [`${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`]) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }

    return nextResolve(specifier, context);
  }
});
