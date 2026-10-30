# DexDeck — actualización de temas

## Contenido

- `src/routes/+page.svelte`: selector de temas Claro, Oscuro y Liquid Glass; preferencia persistente; estilos para las tres apariencias. También incluye el botón de lanzamiento en la ficha porque la copia fuente usada para preparar el archivo no lo contenía.
- `src-tauri/tauri.conf.json`: habilita `transparent: true` en la ventana.

## Instalación segura

1. Cierra DexDeck y el proceso `pnpm tauri dev`.
2. Desde la raíz del proyecto, crea una copia de seguridad de `src/routes/+page.svelte` y `src-tauri/tauri.conf.json`.
3. Copia los dos archivos de este paquete a sus rutas correspondientes, reemplazando los existentes. No reemplaces otros archivos.
4. Ejecuta `pnpm check`. Si pasa, ejecuta `cargo check --manifest-path src-tauri/Cargo.toml`.
5. Inicia la aplicación con `pnpm tauri dev`. El cambio de configuración de transparencia requiere reiniciar la aplicación.

## Notas

- El tema elegido se guarda en `localStorage` como `dexdeck-theme`.
- El modo Claro usa una variante verde oscuro del acento para mantener contraste. Oscuro usa Grafito + menta (#121619 / #1C2328 / #29343B / #62E6C2).
- Liquid Glass necesita transparencia soportada por Tauri/WebKitGTK y un compositor que respete el canal alfa. El desenfoque puede depender de las reglas de Hyprland; si ves una ventana sólida, primero hay que comprobar el soporte en tu entorno.
- No se modifica la base de datos SQLite ni las migraciones.
