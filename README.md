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

DexDeck se encuentra en una fase temprana de desarrollo (`0.1.0`). La biblioteca personal ya dispone de funciones reales de gestión y lanzamiento de ejecutables Windows mediante Wine. La Enciclopedia tiene integrada su primera estructura de catálogo y base de datos; sus apartados de Pokédex, mundo y guías todavía necesitan implementación funcional.

| Área | Estado | Situación actual |
|---|---|---|
| Aplicación de escritorio | ✅ Base implementada | Tauri 2 + Svelte 5 |
| Biblioteca personal | ✅ Funcional | Añadir, editar, buscar, consultar y ocultar entradas |
| Lanzamiento `.exe` | ✅ Implementado | Inicio mediante Wine |
| Detección de metadatos | ✅ Implementada | Carpetas y metadatos PE de ejecutables Windows |
| Temas claro y oscuro | ✅ Implementados | Preferencia persistente |
| Liquid Glass | 🧪 En evolución | Diseño v2 perlado preparado; validar instalación y compilación final |
| Enciclopedia: catálogo | 🧱 Primera versión | Listado, filtros, búsqueda y creación de fichas |
| Versiones de juegos | 🧱 Primera versión | Alta inicial y selector de versiones |
| Pokédex por versión | 🗺️ Estructura preparada | Tablas y pantalla inicial; falta gestionar e importar datos |
| Regiones y ubicaciones | 🗺️ Estructura preparada | Modelo de datos; falta interfaz y contenido |
| Encuentros y objetos | 🗺️ Estructura preparada | Modelo de datos; falta interfaz y contenido |
| Mapas y guías | 🗺️ Estructura preparada | Modelo de datos; falta editor y visor funcional |
| Sincronización y caché offline | 🚧 Planeado | Aún no implementado |
| Lanzadores de ROM y emuladores | 🚧 Planeado | Adaptadores pendientes |
| Centro de actualizaciones | 🚧 Planeado | Pantalla provisional |

**Leyenda:** ✅ implementado · 🧱 primera versión o cimientos integrados · 🚧 pendiente · 🧪 requiere validación.

### Última comprobación conocida

- `pnpm check`: **0 errores y 0 advertencias** después de corregir la estructura de `Encyclopedia.svelte`.
- Esa comprobación fue anterior a la validación final del paquete visual Liquid Glass v2. Hay que volver a ejecutarla después de instalar cualquier actualización de estilos.
- No se considera terminada una función solo porque exista su tabla, su tipo TypeScript o una pestaña visual: también debe disponer de operaciones, interfaz y pruebas suficientes.

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

**Comportamiento de eliminación:** actualmente, quitar un juego de la biblioteca guarda su ID en `localStorage`. No elimina la fila de SQLite ni los archivos del disco. La restauración y la eliminación definitiva son mejoras futuras.

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

### 4. Enciclopedia: primera estructura integrada

La Enciclopedia está separada de la biblioteca personal. Un juego puede estar documentado en el catálogo aunque no esté instalado en el equipo.

La primera versión incluye:

- Sección propia en la navegación.
- Catálogo independiente.
- Filtros por juegos oficiales, fangames y ROM hacks.
- Búsqueda por nombre, desarrollador y descripción.
- Creación de una ficha de catálogo.
- Creación de una primera versión asociada al juego.
- Consulta de la ficha y selección de versión.
- Resumen de cantidades registradas para cada versión.
- Pestañas de Resumen, Pokédex, Mundo y Guías, todavía en fase inicial.

Los apartados que muestran mensajes como «todavía no hay Pokémon registrados» son estados iniciales de la interfaz. No representan una Pokédex completa ni datos importados.

---

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

La migración 8 introduce una base de datos aditiva para el catálogo y el contenido específico de cada versión. Está diseñada para no modificar ni eliminar las entradas de la tabla `games` existente.

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
- [ ] Revisar las migraciones desde una base existente y desde una instalación limpia.
- [ ] Añadir pruebas automatizadas para consultas y operaciones críticas.
- [ ] Revisar los diálogos, navegación por teclado y accesibilidad.
- [ ] Empezar a extraer componentes de `+page.svelte` sin alterar su comportamiento.

**Criterio de finalización:** las funciones existentes siguen trabajando y los cambios se pueden comprobar y revertir con seguridad.

### Fase 2 — Catálogo completo y versiones

- [ ] Editar fichas del catálogo.
- [ ] Eliminar fichas con confirmación y reglas claras de integridad.
- [ ] Añadir, editar y seleccionar varias versiones.
- [ ] Guardar fechas, notas y plataformas por versión.
- [ ] Gestionar fuentes y atribución de información.
- [ ] Relacionar entradas del catálogo con juegos de la biblioteca.
- [ ] Permitir deshacer o corregir relaciones equivocadas.

**Criterio de finalización:** el catálogo puede gestionarse sin tocar la biblioteca personal y cada juego admite varias versiones independientes.

### Fase 3 — Pokédex por juego y versión

- [ ] Listado de Pokémon con búsqueda, filtros y ordenación.
- [ ] Número nacional y número de Pokédex local.
- [ ] Sprites, nombres, tipos y formas.
- [ ] Habilidades y estadísticas base.
- [ ] Descripciones de Pokédex.
- [ ] Evoluciones y métodos de evolución.
- [ ] Movimientos y métodos de aprendizaje.
- [ ] Disponibilidad y exclusividad por versión.
- [ ] Gestión de Fakémon y especies personalizadas.
- [ ] Herramientas para importar y revisar datos.

**Criterio de finalización:** una versión puede tener una Pokédex completa, independiente de otras versiones del mismo juego.

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

- [ ] Integración con fuentes de datos oficiales y comunitarias.
- [ ] Importación desde formatos estructurados.
- [ ] Validación y detección de duplicados.
- [ ] Atribución visible y conservación de licencias.
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

- [ ] Centro de actualizaciones real.
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

Este apartado se actualizará conforme se implementen y verifiquen nuevas funciones. Se registrarán por separado los cambios terminados, los que están en curso y las validaciones pendientes.

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

<div align="center">

**DexDeck — Tu universo Pokémon, conectado.**

*Hecho para entrenadores, con cariño.*

</div>
