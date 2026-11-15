[🇪🇸 Español](README.md) · [🇬🇧 English](README.en.md)

---

<div align="center">

# ◈ DexDeck

### Tu universo Pokémon. Un solo lugar.

**Una biblioteca, una enciclopedia y un centro de juego para descubrir, organizar y disfrutar fangames y ROM hacks de Pokémon.**

![Status](https://img.shields.io/badge/estado-desarrollo_activo-62e6c2?style=for-the-badge&labelColor=172126)
![Version](https://img.shields.io/badge/versión-0.1.0-8b9aa5?style=for-the-badge&labelColor=172126)
![Stack](https://img.shields.io/badge/Tauri_2-Svelte_5-Rust-8b9aa5?style=for-the-badge&labelColor=172126)

*De los clásicos oficiales a los proyectos creados por la comunidad: todo el universo Pokémon, conectado.*

</div>

---

<!-- DEXDECK-DOWNLOADS:START -->
## ⬇️ Descargas

Descarga la última versión estable de DexDeck. Los enlaces se actualizan automáticamente cuando se publica una nueva versión en GitHub Releases.

| Sistema | Formato | Descarga |
|---|---|---|
| Linux x64 | AppImage | [Descargar](https://github.com/maxiigonnzalezz/dexdeck/releases/latest/download/DexDeck-Linux-x64.AppImage) |
| Linux x64 (Debian, Ubuntu y derivadas) | `.deb` | [Descargar](https://github.com/maxiigonnzalezz/dexdeck/releases/latest/download/DexDeck-Linux-x64.deb) |
| Windows x64 | Instalador `.exe` (NSIS) | [Descargar](https://github.com/maxiigonnzalezz/dexdeck/releases/latest/download/DexDeck-Windows-x64-Setup.exe) |

[Ver todas las versiones y sus notas de publicación](https://github.com/maxiigonnzalezz/dexdeck/releases).

**AppImage:** después de descargarlo, puede ser necesario permitir su ejecución:

```bash
chmod +x DexDeck-Linux-x64.AppImage
./DexDeck-Linux-x64.AppImage
```

<!-- DEXDECK-DOWNLOADS:END -->

## ✨ La idea

DexDeck nace para convertirse en el espacio de referencia de quienes disfrutan explorando el universo de los videojuegos Pokémon.

No quiere ser solamente un lanzador de ejecutables ni una wiki más. La visión es reunir en una misma aplicación:

- **Una biblioteca personal** para organizar juegos, instalaciones y lanzamientos.
- **Una enciclopedia** con información detallada de juegos oficiales, fangames y ROM hacks.
- **Una Pokédex por juego y versión**, capaz de incluir Pokémon originales y Fakémon.
- **Un atlas del mundo** con regiones, rutas, ubicaciones, encuentros y objetos.
- **Una colección de guías** para consultar recorridos, misiones, secretos y soluciones.
- **Un sistema de ejecución universal** que conecte cada juego con el emulador o herramienta adecuada.

El objetivo es que DexDeck permita descubrir un juego, conocerlo a fondo, preparar su instalación, jugarlo y consultar toda su información desde un mismo sitio.

> **La filosofía del proyecto:** local-first, modular y ampliable. La información importante debe poder conservarse en el dispositivo y consultarse sin depender continuamente de Internet.

---

## 🧭 Estado del proyecto

DexDeck continúa en desarrollo activo (`0.1.0`). La aplicación de escritorio, la biblioteca personal y el catálogo de la Enciclopedia ya tienen una base funcional. La Pokédex por juego y versión permite gestionar entradas, importar archivos y recolectar información de PokéAPI con vista previa.

| Área | Estado | Situación actual |
|---|---|---|
| Aplicación de escritorio | ✅ Implementada | Tauri 2 + Svelte 5 + TypeScript + Rust |
| Biblioteca personal | ✅ Funcional | Gestión de fichas, búsqueda, configuración y lanzamiento de `.exe` mediante Wine |
| Detección de metadatos | ✅ Implementada | Carpetas y metadatos PE de ejecutables Windows |
| Temas y experiencia visual | ✅ Implementados | Claro, oscuro y Liquid Glass; transiciones y estados hover |
| Enciclopedia: catálogo | ✅ Funcional | Catálogo independiente, filtros, búsqueda, alta, edición y borrado |
| Versiones de juegos | ✅ Funcional | Varias versiones por ficha, edición, selección y versión predeterminada |
| Fuentes y atribución | ✅ Implementadas | Fuentes registradas y atribución en los datos importados |
| Pokédex por versión | ✅ Funcional | Búsqueda, ordenación, detalles, alta, edición y borrado |
| Importación local | ✅ Funcional | CSV/JSON, validación, detección de duplicados y vista previa |
| Recolección desde PokéAPI | ✅ Funcional | Datos localizados, progreso, cancelación, vista previa y atribución |
| Pokédex regional | ✅ Funcional | Diez regiones: Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar, Hisui y Paldea |
| Diferencias entre ediciones | ✅ Primera versión | Selector de juego por región, Pokédex regional más exclusivos y marcas de disponibilidad |
| Navegación y diálogos | ✅ Mejorados | Historial atrás/adelante y bloqueo centralizado del scroll de diálogos |
| Microanimaciones de Pokédex | ✅ Implementadas | Realce suave de filas, sprites y controles; respeta movimiento reducido |
| Regiones, ubicaciones y encuentros | 🧱 Base de datos preparada | Interfaz y contenido funcional pendientes |
| Mapas y guías | 🧱 Base de datos preparada | Editor, visor y contenido pendientes |
| Caché y sincronización offline | 🚧 Planeadas | No implementadas todavía |
| Lanzadores de ROM y emuladores | 🚧 Planeados | Adaptadores pendientes |

**Leyenda:** ✅ implementado · 🧱 cimientos integrados · 🚧 pendiente.

### Comprobaciones antes de publicar

El script de publicación ejecuta `pnpm check`, `pnpm test:import`, `pnpm build`, `pnpm test:ui`, `cargo check` y `git diff --check`. Los resultados concretos se muestran en la terminal para evitar dejar cifras de pruebas obsoletas en la documentación.

---

## 🎮 Funcionalidades implementadas

### 1. Biblioteca personal

La biblioteca permite mantener una colección de juegos instalada o pendiente de configurar.

- Añadir y editar fichas.
- Guardar nombre, desarrollador, versión, tipo, estado, descripción, portada, web oficial y rutas.
- Buscar por nombre, desarrollador y descripción.
- Consultar la ficha de cada juego.
- Mostrar tarjetas con portada o arte generado mediante CSS.
- Indicar si el juego tiene un ejecutable configurado.
- Lanzar ejecutables `.exe` mediante Wine.
- Ocultar una entrada de la biblioteca sin borrar los archivos del juego.

**Comportamiento de eliminación:** actualmente, quitar un juego de la biblioteca lo oculta (columna `is_hidden` en SQLite); no elimina la fila ni los archivos del disco. Todavía falta una pantalla para restaurar o borrar definitivamente los juegos ocultos.

### 2. Detección automática de información

Al seleccionar un ejecutable, DexDeck intenta completar información de la ficha para reducir el trabajo manual.

- Prioriza el nombre y la versión detectados en las carpetas del juego.
- Reconoce nombres de carpeta con versiones como `Pokémon Añil v2.0` o `Pokémon Ópalo (v1.3.0)`.
- Ignora carpetas técnicas habituales como `Binaries`, `Win64`, `WindowsNoEditor`, `Release` o `Game` cuando busca la carpeta descriptiva.
- Consulta metadatos PE del ejecutable cuando están disponibles.
- Puede obtener nombre, versión, empresa y descripción desde los metadatos del `.exe`.
- Calcula una posible carpeta raíz de instalación.
- Respeta los campos que se hayan editado manualmente.

La detección es una ayuda, no una garantía: el usuario siempre puede revisar y corregir los valores antes de guardar.

### 3. Temas y experiencia visual

La aplicación dispone de tres apariencias:

- **Claro:** superficies luminosas y acentos verdes.
- **Oscuro:** grafito con acentos menta.
- **Liquid Glass:** superficies translúcidas, desenfoque y reflejos perlados inspirados en interfaces de cristal líquido.

También se han añadido transiciones, animaciones de entrada, estados hover, indicadores de configuración, diseño adaptable y respeto por la preferencia de movimiento reducido del sistema.

Liquid Glass sigue en refinamiento visual. La transparencia y el desenfoque reales dependen del WebView de Tauri, de la composición de ventanas y del compositor del sistema operativo.

### 4. Enciclopedia: catálogo y contenido por versión

La Enciclopedia está separada de la biblioteca personal. Un juego puede estar documentado en el catálogo aunque no esté instalado en el equipo.

Incluye:

- Catálogo independiente con filtros por juegos oficiales, fangames y ROM hacks.
- Búsqueda y gestión de fichas: alta, edición y borrado con confirmación.
- Varias versiones por juego, con plataforma, notas y versión predeterminada.
- Fuentes de datos, licencias y atribución.
- Vínculos opcionales entre una ficha del catálogo y una instalación de la biblioteca.
- Resumen de datos asociados a cada versión.
- Pestañas de Resumen, Pokédex, Mundo y Guías. Mundo y Guías aún tienen trabajo funcional pendiente.

#### Pokédex por juego y versión

Cada versión dispone de una Pokédex independiente. Se pueden crear, editar y eliminar entradas, buscar por número o nombre, ordenar los resultados y consultar una ficha detallada. Las entradas admiten formas, tipos, habilidades, estadísticas base, descripciones, sprites, número nacional, procedencia y marca de disponibilidad.

La Pokédex acepta importación local CSV/JSON y recolección desde PokéAPI. Ambos flujos muestran una vista previa antes de guardar cambios y permiten revisar entradas nuevas, actualizaciones, duplicados y errores.

#### Pokédex regional y ediciones

El selector de PokéAPI ofrece exactamente diez regiones: Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar, Hisui y Paldea. Las tres Pokédex de Kalos se combinan en una sola opción.

Después de elegir una región, se puede escoger una edición compatible. La recolección combina la Pokédex regional completa con los Pokémon exclusivos de la edición seleccionada, evita duplicados y conserva las especies regionales aunque no sean obtenibles en esa edición. Estas entradas se pueden marcar como «No obtenible». Los exclusivos adicionales se incorporan sin sustituir la lista regional.

La cobertura de exclusividades se gestiona por especie; las diferencias que afectan únicamente a formas o variantes especiales pueden necesitar ampliaciones futuras.

#### Navegación y experiencia de uso

La navegación de la Enciclopedia mantiene historial atrás/adelante y admite controles de teclado y botones laterales del ratón. El bloqueo del scroll de los diálogos se centraliza para evitar que el fondo se desplace mientras hay una ventana modal abierta.

La Pokédex incorpora microanimaciones discretas: realce y expansión suave de las filas al pasar el cursor, movimiento sutil de los sprites y transiciones en controles y diálogos. Se respeta `prefers-reduced-motion`.

## 🏗️ Arquitectura y tecnologías

DexDeck utiliza una arquitectura de escritorio con interfaz web, acceso nativo mediante Tauri y persistencia local con SQLite.

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Interfaz | Svelte 5 + SvelteKit | Pantallas, navegación, fichas y estados |
| Lenguaje de interfaz | TypeScript | Tipos, validaciones y lógica de presentación |
| Escritorio | Tauri 2 | Ventana nativa, plugins y comunicación con Rust |
| Backend nativo | Rust | Lanzamiento y funciones del sistema |
| Persistencia | SQLite | Biblioteca, catálogo y datos de la enciclopedia |
| Gestor de paquetes | pnpm | Dependencias y scripts del proyecto |
| Entorno JavaScript | Node.js | Herramientas de desarrollo y compilación |

### Separación de dominios

La aplicación distingue dos conceptos que no deben mezclarse:

**Biblioteca personal** — lo que el usuario tiene añadido, instalado o quiere jugar.

**Catálogo de la Enciclopedia** — la información general de los juegos, sus versiones y todo el contenido asociado.

Una relación opcional conecta ambas partes cuando una entrada de la biblioteca corresponde a un juego del catálogo. Esto evita duplicar fichas y permite que una misma entrada de catálogo sea compartida por distintas instalaciones locales en el futuro.

### Estructura relevante

```text
src/
├── routes/
│   └── +page.svelte                 # Aplicación principal y navegación
└── lib/
    ├── db.ts                        # Acceso a la biblioteca personal
    ├── encyclopedia.ts              # Consultas y operaciones del catálogo
    └── components/
        └── Encyclopedia.svelte      # Interfaz de la Enciclopedia

src-tauri/
└── src/
    ├── lib.rs                       # Configuración nativa y migraciones
    └── migrations/
        └── 0008_pokedex_foundation.sql
                                      # Base de datos de la Enciclopedia
```

La estructura puede evolucionar a medida que se separen componentes y servicios. La prioridad es hacerlo de forma incremental, sin reescribir innecesariamente las partes que ya funcionan.

---

## 🗄️ Modelo de datos de la Enciclopedia

La migración 8 introduce una base de datos aditiva para el catálogo y el contenido específico de cada versión. Está diseñada para no modificar ni eliminar las entradas de la tabla `games` existente. La migración 11 añade las garantías de integridad de las versiones: una sola predeterminada por ficha, al menos una versión y promoción automática al borrar la predeterminada.

| Tabla | Propósito |
|---|---|
| `data_sources` | Fuentes, licencias y atribución de los datos |
| `catalog_games` | Identidad y ficha general de cada juego |
| `game_versions` | Versiones y plataformas de un juego |
| `installed_game_catalog_links` | Relación opcional con la biblioteca personal |
| `pokemon_species` | Identidad de especies Pokémon conocidas |
| `game_pokemon` | Pokédex, formas y datos de Pokémon por versión |
| `regions` | Regiones de cada versión |
| `locations` | Ciudades, rutas, cuevas y otras ubicaciones |
| `encounters` | Pokémon disponibles en cada ubicación |
| `game_items` | Objetos disponibles en cada versión |
| `item_locations` | Lugares donde se consiguen los objetos |
| `guides` | Guías y soluciones asociadas a una versión |
| `map_assets` | Mapas e imágenes vinculados al mundo del juego |
| `sync_state` | Registro del estado de sincronización de recursos |

El modelo contempla contenido personalizado: una entrada de `game_pokemon` puede existir sin asociarse a una especie canónica, lo que permite representar Fakémon y criaturas exclusivas.

Las tablas y restricciones preparan el terreno, pero no implementan automáticamente importadores, sincronización, pantallas de edición ni contenido. Esas piezas se construirán por fases.

---

## 🗺️ Hoja de ruta

La hoja de ruta está ordenada por dependencias. Primero se consolida el modelo y después se construyen las funciones que consumen esos datos.

### Fase 1 — Estabilización y calidad

- [ ] Validar la instalación de Liquid Glass v2 en el proyecto real.
- [ ] Ejecutar `pnpm check` después de los cambios visuales.
- [x] Revisar las migraciones desde una base existente y desde una instalación limpia.
- [ ] Añadir pruebas automatizadas para consultas y operaciones críticas.
- [ ] Revisar los diálogos, navegación por teclado y accesibilidad.
- [ ] Empezar a extraer componentes de `+page.svelte` sin alterar su comportamiento.

**Criterio de finalización:** las funciones existentes siguen trabajando y los cambios se pueden comprobar y revertir con seguridad.

### Fase 2 — Catálogo completo y versiones

- [x] Editar fichas del catálogo.
- [x] Eliminar fichas con confirmación y reglas claras de integridad.
- [x] Añadir, editar y seleccionar varias versiones.
- [x] Guardar fechas, notas y plataformas por versión.
- [x] Gestionar fuentes y atribución de información.
- [x] Relacionar entradas del catálogo con juegos de la biblioteca.
- [x] Permitir deshacer o corregir relaciones equivocadas.

**Criterio de finalización:** el catálogo puede gestionarse sin tocar la biblioteca personal y cada juego admite varias versiones independientes.

### Fase 3 — Pokédex por juego y versión

- [x] Listado con búsqueda, ordenación y contador de entradas.
- [x] Entradas por versión con número local y número nacional.
- [x] Sprites, nombres, tipos y formas.
- [x] Habilidades, estadísticas base y descripciones.
- [x] Alta, edición, borrado y marca de Pokémon obtenible.
- [x] Importación CSV/JSON con validación, vista previa y detección de duplicados.
- [x] Recolección desde PokéAPI con progreso, cancelación, localización y atribución.
- [x] Selector de las diez regiones principales y combinación de las tres zonas de Kalos.
- [x] Selector de edición dependiente de la región.
- [x] Unión de la Pokédex regional con los exclusivos de la edición, sin duplicados y conservando las entradas regionales.
- [ ] Evoluciones y métodos de evolución.
- [ ] Movimientos y métodos de aprendizaje.
- [ ] Cobertura completa de exclusividades de formas y variantes.
- [ ] Editor y herramientas específicas para grandes Pokédex de Fakémon.

**Criterio de finalización:** cada versión puede tener una Pokédex completa, independiente de otras versiones del mismo juego.

### Fase 4 — Mundo, regiones y mapas

- [ ] Crear y editar regiones.
- [ ] Crear ciudades, rutas, edificios, cuevas y mazmorras.
- [ ] Establecer relaciones entre ubicaciones.
- [ ] Asociar mapas generales, regionales y locales.
- [ ] Navegar desde un mapa a una ubicación.
- [ ] Asociar entrenadores, eventos y puntos de interés.
- [ ] Guardar recursos localmente para consultarlos sin conexión.

**Criterio de finalización:** el mundo de un juego se puede recorrer desde su región hasta sus ubicaciones concretas.

### Fase 5 — Encuentros y objetos

- [ ] Registrar encuentros por ubicación y método.
- [ ] Añadir niveles y probabilidades cuando la fuente los proporcione.
- [ ] Distinguir encuentros por hora, clima, evento u otras condiciones.
- [ ] Registrar objetos, MT y recompensas.
- [ ] Indicar cómo y dónde obtener cada objeto.
- [ ] Relacionar Pokémon, objetos y ubicaciones en ambas direcciones.

**Criterio de finalización:** al consultar una ruta se pueden conocer sus Pokémon y objetos, y cada Pokémon permite consultar dónde aparece.

### Fase 6 — Guías y soluciones

- [ ] Editor de guías en Markdown.
- [ ] Guía principal de la aventura.
- [ ] Gimnasios, entrenadores y eventos importantes.
- [ ] Misiones secundarias y secretos.
- [ ] Guías de captura, crianza y evolución.
- [ ] Relacionar guías con regiones, rutas, objetos y Pokémon.
- [ ] Publicar, ordenar y filtrar guías.
- [ ] Consultar guías sin conexión.

**Criterio de finalización:** cada versión puede tener una wiki navegable y útil durante la partida.

### Fase 7 — Fuentes, importación y sincronización

- [x] Registro de fuentes, atribución y licencias.
- [x] Importación desde CSV y JSON.
- [x] Validación, vista previa, detección de duplicados y modo de solo inserción.
- [x] Recolección directa desde PokéAPI para Pokédex regionales y ediciones compatibles.
- [x] Conservación de `source_url`, clave de especie y número nacional en los registros importados.
- [ ] Integración de fuentes comunitarias adicionales para contenido específico de fangames.
- [ ] Caché local de datos e imágenes.
- [ ] Sincronización incremental cuando exista conexión.
- [ ] Resolución de conflictos y errores de sincronización.
- [ ] Herramientas para exportar y respaldar contenido propio.

**Criterio de finalización:** DexDeck puede actualizar datos de forma controlada y seguir siendo útil sin Internet.

### Fase 8 — Lanzador universal y herramientas

El sistema de lanzamiento evolucionará hacia adaptadores independientes. Cada adaptador detectará los formatos que admite, comprobará las dependencias y preparará los argumentos de ejecución.

| Formato / sistema | Adaptador previsto | Estado |
|---|---|---|
| `.exe` | Wine | ✅ Implementado para el flujo actual |
| `.gba` | mGBA | 🚧 Pendiente |
| `.nds` | melonDS | 🚧 Pendiente |
| `.3ds` / `.cci` | Azahar | 🚧 Pendiente |
| `.cia` | Flujo compatible con la instalación del emulador | 🧭 Por diseñar |
| `.ips` / `.bps` / `.ups` | Herramienta de aplicación de parches | 🚧 Pendiente |

También se prevé:

- Detectar emuladores instalados.
- Configurar rutas y argumentos por sistema.
- Elegir el emulador por juego.
- Comprobar dependencias y mostrar errores comprensibles.
- Asociar ROM hacks parcheados a sus juegos de origen.
- Gestionar perfiles de ejecución y opciones específicas cuando sea viable.

**Criterio de finalización:** el usuario selecciona un juego y DexDeck prepara el motor adecuado sin tener que gestionar manualmente cada comando.

### Fase 9 — Actualizaciones, ajustes y distribución

- [x] Centro de actualizaciones real.
- [ ] Consulta de fuentes oficiales de cada proyecto.
- [ ] Comparación entre versiones instaladas y publicadas.
- [ ] Historial de cambios y enlaces a las fuentes.
- [ ] Ajustes avanzados de emuladores y almacenamiento.
- [ ] Gestión de caché y recursos offline.
- [ ] Copias de seguridad y restauración.
- [ ] Importación y exportación de biblioteca y catálogo.
- [ ] Empaquetado, instalación y actualización de DexDeck.
- [ ] Pruebas finales en Linux y Windows.

---

## 🧪 Desarrollo y comprobaciones

### Requisitos principales

- Node.js.
- pnpm.
- Rust y Cargo.
- Dependencias de desarrollo de Tauri 2 para el sistema operativo.
- WebView y herramientas nativas necesarias para compilar la aplicación.

### Preparar el proyecto

Desde la raíz del repositorio:

```bash
pnpm install
pnpm check
```

`pnpm check` ejecuta la sincronización de SvelteKit y `svelte-check` con la configuración TypeScript del proyecto. Es una comprobación estática; no sustituye las pruebas de base de datos, la compilación nativa ni las pruebas manuales de la interfaz.

Para iniciar o compilar la aplicación, consulta los scripts disponibles en `package.json` y usa el flujo de Tauri configurado en el proyecto.

### Reglas de desarrollo

1. **Cambios pequeños y revisables.** Evitar reescrituras masivas cuando basta con un componente o servicio nuevo.
2. **No romper lo que funciona.** Biblioteca, lanzador, temas y Enciclopedia deben conservar sus responsabilidades.
3. **Migraciones aditivas.** No borrar ni transformar datos existentes sin un plan de migración y una copia de seguridad.
4. **Pruebas después de cada fase.** Ejecutar `pnpm check` y las pruebas pertinentes antes de dar una tarea por terminada.
5. **Sin trabajo destructivo silencioso.** Cualquier limpieza de base de datos, archivos o entradas debe ser explícita y reversible cuando sea posible.
6. **Datos trazables.** Guardar el origen y la atribución de los datos externos siempre que corresponda.
7. **Offline-first.** La conexión mejora y actualiza el contenido, pero no debe ser un requisito permanente para consultar lo ya descargado.

---

## 📚 Fuentes de datos y respeto al contenido

DexDeck podrá combinar datos de APIs, fuentes oficiales, documentación comunitaria e información introducida manualmente. Cada fuente deberá revisarse antes de integrarla, especialmente en lo relativo a licencia, atribución, límites de uso y condiciones de redistribución.

PokéAPI puede servir como fuente para parte de los datos de juegos oficiales, pero no cubre por sí sola el contenido particular de los fangames y ROM hacks. Los datos personalizados necesitarán herramientas de edición e importación propias.

### Importación CSV/JSON

La Pokédex de cada versión acepta archivos `.csv` y `.json` desde el botón **Importar CSV/JSON**. Antes de escribir nada se muestra un resumen con las filas nuevas, las que se actualizarían, las que no cambian y los errores, y se puede elegir entre añadir y actualizar o solo añadir. Nada se borra nunca.

Columnas admitidas (en español o inglés, sin distinguir mayúsculas ni acentos):

| Columna | Contenido |
|---|---|
| `numero` | Número local de la Pokédex, obligatorio |
| `nombre` | Nombre del Pokémon, obligatorio |
| `forma` | Forma o variante; dos formas pueden compartir número |
| `tipo_primario`, `tipo_secundario` | Tipo en inglés (`electric`) o en español (`Eléctrico`) |
| `habilidades` | Varias habilidades separadas por `\|` |
| `ps`, `ataque`, `defensa`, `atq_esp`, `def_esp`, `velocidad` | Estadísticas base; si faltan se avisa y se guardan como 0 |
| `descripcion` | Texto de la Pokédex |
| `sprite_url`, `sprite_path` | URL web y ruta local del sprite |
| `obtenible` | `si`/`no`, `true`/`false` o `1`/`0` |
| `fuente` | `source_key` o nombre de una fuente registrada |
| `source_url` | URL exacta del recurso del que salió la fila |
| `species_key` | Clave canónica de la especie, por ejemplo `pokeapi:pikachu` |
| `national_dex_number` | Número nacional de la especie, entre 1 y 9999 |

El JSON admite una lista de Pokémon o un paquete con la clave `pokemon`, tipos como `types: ["grass", "poison"]` y estadísticas agrupadas en `stats` o `base_stats`. Cada fila se clasifica como nueva, actualizada o sin cambios comparando número y forma contra lo que ya existe.

### Recolección desde PokéAPI

El botón **Recolectar de PokéAPI** permite recopilar datos para la Pokédex de una versión. Antes de guardar nada, DexDeck presenta una vista previa con las entradas nuevas, actualizaciones, elementos sin cambios y posibles errores.

- El selector muestra diez regiones: Kanto, Johto, Hoenn, Sinnoh, Teselia, Kalos, Alola, Galar, Hisui y Paldea.
- Kalos combina sus Pokédex Central, Costera y Montañosa en una única selección.
- Un segundo selector ofrece las ediciones compatibles con la región elegida.
- La importación combina la Pokédex regional completa con los Pokémon exclusivos de la edición seleccionada.
- Las especies regionales se conservan aunque no sean obtenibles en esa edición; se pueden señalar como «No obtenible».
- Los exclusivos adicionales se añaden sin duplicar especies ya presentes en la lista regional.
- Se descargan nombres, tipos, habilidades, estadísticas base, descripción y URL del artwork oficial. Las imágenes no se descargan: se guarda su dirección.
- Los textos se priorizan en español y usan inglés como alternativa cuando no hay traducción.
- Se muestra el progreso y se puede cancelar la descarga; una cancelación no aplica cambios.
- Se conserva la procedencia mediante la fuente, `source_url`, la clave de especie y el número nacional.
- La última selección regional se recuerda por versión para facilitar futuras recolecciones.

La cobertura de exclusividades se gestiona por especie; las diferencias limitadas a formas o variantes especiales pueden ampliarse en futuras versiones.

DexDeck no debe distribuir ROMs comerciales, BIOS, firmware ni archivos protegidos de terceros. El usuario debe aportar sus propios archivos y cumplir la legislación aplicable. La aplicación es un proyecto de fans independiente y no está afiliada, respaldada ni patrocinada por Nintendo, The Pokémon Company o Game Freak.

---

## 🔐 Filosofía de datos

- La biblioteca personal pertenece al usuario.
- El catálogo general y las instalaciones locales son entidades distintas.
- Los datos deben poder exportarse y respaldarse.
- Las fuentes externas deben quedar identificadas.
- Las funciones online deben tener una alternativa local cuando sea razonable.
- Las rutas y los ejecutables deben validarse antes de iniciar procesos.
- Las operaciones de borrado o migración deben estar protegidas y documentadas.

---

## 💡 Ideas para el futuro

Estas ideas no forman parte del alcance implementado; son posibilidades que encajan con la visión del proyecto:

- Perfiles de entrenador y varias bibliotecas.
- Seguimiento del progreso de cada partida.
- Listas de deseos y juegos pendientes.
- Comparador de versiones y cambios entre ediciones.
- Seguimiento de colecciones, equipos y Pokémon favoritos.
- Notas personales vinculadas a rutas, Pokémon y guías.
- Importación de datos desde herramientas compatibles.
- Sistema de extensiones o paquetes comunitarios para ampliar fichas.
- Sincronización opcional entre dispositivos.

---

## 🗓️ Registro de progreso

### 15 de noviembre de 2026 — Pokédex regional, ediciones y experiencia de uso

- ✅ Selector limitado a diez regiones principales; las tres listas de Kalos se consolidan en una sola opción.
- ✅ Selector de edición dependiente de la región, con sugerencia basada en el nombre del juego y su versión.
- ✅ Recolección inclusiva: Pokédex regional completa más especies exclusivas de la edición, sin duplicados.
- ✅ Las especies regionales se conservan y se pueden marcar como no obtenibles en una edición concreta.
- ✅ Mejoras de vista previa y del flujo de recolección para revisar los datos antes de guardarlos.
- ✅ Microanimaciones de la Pokédex, realce de filas y sprites, transiciones sutiles y respeto por movimiento reducido.
- ✅ Historial de navegación atrás/adelante y bloqueo centralizado del scroll en diálogos.
- ✅ Cobertura automatizada ampliada para importación, navegación e interfaz de la Pokédex.


Este apartado se actualizará conforme se implementen y verifiquen nuevas funciones. Se registrarán por separado los cambios terminados, los que están en curso y las validaciones pendientes.

### 13 de noviembre de 2026 — Recolección desde PokéAPI

- ✅ Migración 13: fuentes semilla `pokeapi`, `fandom` y `bulbapedia`, columna `source_url` en `game_pokemon` y Pokédex remota recordada por versión.
- ✅ Plugin HTTP de Tauri con lista blanca limitada a `pokeapi.co`, `*.fandom.com` y `bulbapedia.bulbagarden.net`.
- ✅ Adaptador `src/lib/import/pokeapi.ts`: especies, formas, tipos, habilidades, estadísticas base, descripción y artwork; textos en español con aviso cuando se usa el inglés.
- ✅ Diálogo **Recolectar de PokéAPI** con sugerencia de Pokédex, límite opcional, progreso, cancelación y la misma vista previa que la importación de archivos.
- ✅ Cada fila importada guarda fuente, `source_url`, `species_key` y número nacional, y la atribución queda visible en el diálogo.
- 🧪 Comprobado en la app real: Kanto con límite 15 importó 15 entradas con sprites y etiqueta «PokéAPI»; la segunda descarga dio 15 sin cambios y el botón de importar quedó deshabilitado.
- 🧪 Cancelación real: con Kanto completo en curso, «Cancelar descarga» mostró «Descarga cancelada; no se ha guardado nada», la vista previa no apareció y la base siguió con 15 filas. Escape no cierra el diálogo mientras descarga.
- 🧪 `pnpm check` (0 errores, 0 avisos), `pnpm build`, `cargo test` (8 pruebas) y `pnpm test:import` (20 pruebas) correctos.

### 11 de noviembre de 2026 — Importación CSV/JSON de la Pokédex

- ✅ Lector CSV propio (RFC 4180) con BOM, comillas escapadas, saltos de línea y detección de coma o punto y coma.
- ✅ Vista previa antes de aplicar: filas nuevas, actualizaciones, sin cambios y errores, con avisos por línea.
- ✅ Dos modos de aplicación: añadir y actualizar, o solo añadir; nunca se borra nada.
- ✅ Avisos de columnas desalineadas, estadísticas incompletas, tipos desconocidos, sprites inválidos y fuentes no registradas.
- ✅ Paquetes JSON con `pokemon`, `types`, `stats`/`base_stats` y metadatos de juego y versión.
- ✅ Lectura de archivos con un comando propio (`read_import_file`), limitada a 20 MB y solo UTF-8.
- 🧪 Comprobado en la app real: CSV con tres entradas, reimportación idempotente (3 sin cambios) y paquete JSON con una nueva, una actualización y una sin cambios.
- 🧪 `pnpm check` (0 errores, 0 avisos), `pnpm build` y `cargo test` (8 pruebas) correctos.

### 11 de noviembre de 2026 — Arranque de la Fase 3: Pokédex por versión

- ✅ Migración 12: `UNIQUE (game_version_id, dex_number, form_name)` para admitir varias formas con el mismo número local; encuentros y triggers conservados.
- ✅ Capa de datos `src/lib/pokedex.ts` con listado, alta, edición y borrado por versión, validación de fuente y mensajes de error propios.
- ✅ Vista `PokedexView.svelte` integrada en la pestaña Pokédex: búsqueda, orden por número o nombre, estado vacío, aviso de error y contador.
- ✅ Diálogo de alta y edición con número local, nombre, forma, tipos, habilidades, estadísticas base, descripción, sprite y marca de obtenible.
- ✅ Borrado con confirmación que actualiza el contador del Resumen.
- 🧪 Comprobado en la app real: migración aplicada sobre la base existente, dos formas del número 25, edición, borrado y recuento actualizado; copia previa guardada como `dexdeck-pre-fase3`.
- 🧪 `pnpm check` (0 errores, 0 avisos), `pnpm build` y `cargo test` (8 pruebas) correctos.

### 11 de noviembre de 2026 — Fase 2 del catálogo

- ✅ Edición de fichas del catálogo sin tocar las versiones ni la biblioteca.
- ✅ Borrado de fichas con confirmación, recuento de versiones y vínculos, y conservación de `games`.
- ✅ Gestión de versiones: alta, edición, borrado y versión predeterminada única por ficha.
- ✅ Migración 11 con índice de unicidad, protección de la última versión y promoción automática de la predeterminada.
- ✅ Registro de fuentes de datos y atribución visible en fichas y versiones; `source_id` nulo equivale a entrada manual.
- ✅ Vinculación y desvinculación de entradas de la biblioteca, con versión opcional y confirmación al mover un vínculo existente.
- 🧪 Migraciones comprobadas desde una base limpia y desde una base existente; `pnpm check`, `pnpm build` y `cargo test` (8 pruebas) correctos.

### 30 de octubre de 2026 — Base de DexDeck y Enciclopedia

- ✅ Biblioteca personal con gestión de fichas, búsqueda y lanzamiento de `.exe` mediante Wine.
- ✅ Detección de nombre, versión y metadatos de ejecutables Windows.
- ✅ Temas claro, oscuro y primera versión de Liquid Glass.
- ✅ Integración de la sección Enciclopedia.
- ✅ Catálogo local separado de la biblioteca personal.
- ✅ Alta de fichas de catálogo con primera versión.
- ✅ Selector de versiones y resumen de estadísticas por versión.
- ✅ Migración 8 con las tablas fundamentales de la Enciclopedia, relaciones, restricciones e índices.
- ✅ Reparación de advertencias y errores de marcado de `Encyclopedia.svelte`; comprobación comunicada de `0 errors and 0 warnings`.
- 🧪 Liquid Glass v2 — Pearl Droplets preparado y aceptado visualmente; pendiente confirmar `pnpm check` después de su instalación en el proyecto.

---

## 📄 Licencia

DexDeck se distribuye bajo licencia [MIT](LICENSE). Puedes usarlo, modificarlo y redistribuirlo conservando el aviso de copyright.

---

<div align="center">

**DexDeck — Tu universo Pokémon, conectado.**

*Hecho para entrenadores, con cariño.*

</div>
