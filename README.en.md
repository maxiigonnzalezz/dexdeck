[🇪🇸 Spanish](README.md) · [🇬🇧 English](README.en.md)

---

<div align="center">

# ◈ DexDeck

### Your Pokémon universe. All in one place.

**A library, an encyclopedia and a gaming hub to discover, organize and enjoy Pokémon fangames and ROM hacks.**

![Status](https://img.shields.io/badge/status-active_development-62e6c2?style=for-the-badge&labelColor=172126)
![Version](https://img.shields.io/badge/version-0.1.0-8b9aa5?style=for-the-badge&labelColor=172126)
![Stack](https://img.shields.io/badge/Tauri_2-Svelte_5-Rust-8b9aa5?style=for-the-badge&labelColor=172126)

*From official classics to community-created projects: the entire Pokémon universe, connected.*

</div>

---

<!-- DEXDECK-DOWNLOADS:START -->
## ⬇️ Downloads

Download the latest stable version of DexDeck. The links are updated automatically whenever a new version is published on GitHub Releases.

| System | Format | Download |
|---|---|---|
| Linux x64 | AppImage | [Download](https://github.com/maxiigonnzalezz/dexdeck/releases/latest/download/DexDeck-Linux-x64.AppImage) |
| Linux x64 (Debian, Ubuntu and derivatives) | `.deb` | [Download](https://github.com/maxiigonnzalezz/dexdeck/releases/latest/download/DexDeck-Linux-x64.deb) |
| Windows x64 | `.exe` installer (NSIS) | [Download](https://github.com/maxiigonnzalezz/dexdeck/releases/latest/download/DexDeck-Windows-x64-Setup.exe) |

[View all releases and their release notes](https://github.com/maxiigonnzalezz/dexdeck/releases).

**AppImage:** after downloading it, you may need to make it executable:

```bash
chmod +x DexDeck-Linux-x64.AppImage
./DexDeck-Linux-x64.AppImage
```

<!-- DEXDECK-DOWNLOADS:END -->

## ✨ The idea

DexDeck aims to become the go-to place for anyone who enjoys exploring the world of Pokémon video games.

It is meant to be more than just an executable launcher or another wiki. The vision is to bring together, in a single application:

- **A personal library** to organize games, installations and releases.
- **An encyclopedia** with detailed information about official games, fangames and ROM hacks.
- **A Pokédex for each game and version**, able to include original Pokémon and Fakémon.
- **A world atlas** with regions, routes, locations, encounters and items.
- **A collection of guides** for walkthroughs, missions, secrets and solutions.
- **A universal launching system** that connects each game to the appropriate emulator or tool.

The goal is for DexDeck to let users discover a game, learn everything about it, prepare its installation, play it and consult all its information from one place.

> **Project philosophy:** local-first, modular and extensible. Important information should be stored on the device and remain accessible without constantly relying on the Internet.

---

## 🧭 Project status

DexDeck is at an early stage of development (`0.1.0`). The personal library already provides working management features and can launch Windows executables through Wine. The Encyclopedia has its first catalogue and database structure integrated; its Pokédex, world and guides sections still need functional implementation.

| Area | Status | Current situation |
|---|---|---|
| Desktop application | ✅ Foundation implemented | Tauri 2 + Svelte 5 |
| Personal library | ✅ Functional | Add, edit, search, view and hide entries |
| `.exe` launching | ✅ Implemented | Launches through Wine |
| Metadata detection | ✅ Implemented | Folders and PE metadata from Windows executables |
| Light and dark themes | ✅ Implemented | Persistent preference |
| Liquid Glass | 🧪 Evolving | Pearl v2 design prepared; installation and final build still need validation |
| Encyclopedia: catalogue | 🧱 First version | Listing, filters, search and entry creation |
| Game versions | 🧱 First version | Initial creation and version selector |
| Per-version Pokédex | 🗺️ Structure prepared | Tables and initial screen; data management and importing are still missing |
| Regions and locations | 🗺️ Structure prepared | Data model; interface and content are still missing |
| Encounters and items | 🗺️ Structure prepared | Data model; interface and content are still missing |
| Maps and guides | 🗺️ Structure prepared | Data model; functional editor and viewer are still missing |
| Offline synchronization and cache | 🚧 Planned | Not implemented yet |
| ROM and emulator launchers | 🚧 Planned | Adapters still pending |
| Update centre | 🚧 Planned | Provisional screen |

**Legend:** ✅ implemented · 🧱 first version or foundations integrated · 🚧 pending · 🧪 requires validation.

### Latest known check

- `pnpm check`: **0 errors and 0 warnings** after fixing the structure of `Encyclopedia.svelte`.
- That check took place before the final validation of the Liquid Glass v2 visual package. It must be run again after installing any style updates.
- A feature is not considered complete just because its table, TypeScript type or visual tab exists: it must also have operations, an interface and sufficient tests.

---

## 🎮 Implemented features

### 1. Personal library

The library lets users maintain a collection of games that are installed or still need configuring.

- Add and edit entries.
- Store the name, developer, version, type, status, description, cover art, official website and paths.
- Search by name, developer and description.
- View each game's details.
- Display cards with cover art or CSS-generated artwork.
- Show whether a game has an executable configured.
- Launch `.exe` executables through Wine.
- Hide a library entry without deleting the game's files.

**Removal behaviour:** currently, removing a game from the library stores its ID in `localStorage`. It does not delete the SQLite row or files from disk. Restoring entries and permanently deleting them are future improvements.

### 2. Automatic information detection

When an executable is selected, DexDeck tries to fill in the entry's information to reduce manual work.

- Prioritizes the name and version detected in the game's folders.
- Recognizes folder names containing versions, such as `Pokémon Añil v2.0` or `Pokémon Ópalo (v1.3.0)`.
- Ignores common technical folders such as `Binaries`, `Win64`, `WindowsNoEditor`, `Release` or `Game` when looking for the descriptive folder.
- Reads the executable's PE metadata when available.
- Can retrieve the name, version, company and description from the `.exe` metadata.
- Calculates a possible installation root folder.
- Preserves fields that have been edited manually.

Detection is an aid, not a guarantee: users can always review and correct the values before saving.

### 3. Themes and visual experience

The application offers three appearances:

- **Light:** bright surfaces and green accents.
- **Dark:** graphite with mint accents.
- **Liquid Glass:** translucent surfaces, blur and pearlescent reflections inspired by liquid-glass interfaces.

Transitions, entrance animations, hover states, configuration indicators, responsive layouts and support for the system's reduced-motion preference have also been added.

Liquid Glass is still undergoing visual refinement. Actual transparency and blur depend on the Tauri WebView, window composition and the operating system's compositor.

### 4. Encyclopedia: first integrated structure

The Encyclopedia is separate from the personal library. A game can be documented in the catalogue even if it is not installed on the computer.

The first version includes:

- Its own section in the navigation.
- An independent catalogue.
- Filters for official games, fangames and ROM hacks.
- Search by name, developer and description.
- Creation of a catalogue entry.
- Creation of an initial version linked to the game.
- Viewing an entry and selecting a version.
- A summary of the amounts of data recorded for each version.
- Summary, Pokédex, World and Guides tabs, which are still at an early stage.

Sections displaying messages such as “there are no Pokémon registered yet” are initial interface states. They do not represent a complete Pokédex or imported data.

---

## 🏗️ Architecture and technologies

DexDeck uses a desktop architecture with a web interface, native access through Tauri and local persistence with SQLite.

| Layer | Technology | Responsibility |
|---|---|---|
| Interface | Svelte 5 + SvelteKit | Screens, navigation, entries and states |
| Interface language | TypeScript | Types, validation and presentation logic |
| Desktop | Tauri 2 | Native window, plugins and communication with Rust |
| Native backend | Rust | Launching and system-level features |
| Persistence | SQLite | Library, catalogue and encyclopedia data |
| Package manager | pnpm | Dependencies and project scripts |
| JavaScript runtime | Node.js | Development and build tools |

### Separation of domains

The application distinguishes between two concepts that should not be mixed:

**Personal library** — what the user has added, installed or wants to play.

**Encyclopedia catalogue** — general information about games, their versions and all associated content.

An optional relationship connects both sides when a personal-library entry corresponds to a game in the catalogue. This avoids duplicate entries and allows the same catalogue entry to be shared by different local installations in the future.

### Relevant structure

```text
src/
├── routes/
│   └── +page.svelte                 # Main application and navigation
└── lib/
    ├── db.ts                        # Personal library access
    ├── encyclopedia.ts              # Catalogue queries and operations
    └── components/
        └── Encyclopedia.svelte      # Encyclopedia interface

src-tauri/
└── src/
    ├── lib.rs                       # Native configuration and migrations
    └── migrations/
        └── 0008_pokedex_foundation.sql
                                       # Encyclopedia database
```

The structure may evolve as components and services are separated. The priority is to do so incrementally, without unnecessarily rewriting parts that already work.

---

## 🗄️ Encyclopedia data model

Migration 8 introduces an additive database for the catalogue and the content specific to each version. It is designed not to modify or delete entries in the existing `games` table.

| Table | Purpose |
|---|---|
| `data_sources` | Data sources, licences and data attribution |
| `catalog_games` | Identity and general entry for each game |
| `game_versions` | A game's versions and platforms |
| `installed_game_catalog_links` | Optional relationship with the personal library |
| `pokemon_species` | Identity of known Pokémon species |
| `game_pokemon` | Pokédex, forms and Pokémon data for each version |
| `regions` | Regions in each version |
| `locations` | Towns, routes, caves and other locations |
| `encounters` | Pokémon available at each location |
| `game_items` | Items available in each version |
| `item_locations` | Places where items can be obtained |
| `guides` | Guides and walkthroughs associated with a version |
| `map_assets` | Maps and images linked to the game's world |
| `sync_state` | Record of resource synchronization status |

The model supports custom content: a `game_pokemon` entry can exist without being associated with a canonical species, making it possible to represent Fakémon and exclusive creatures.

The tables and constraints lay the groundwork, but they do not automatically implement importers, synchronization, editing screens or content. Those pieces will be built in stages.

---

## 🗺️ Roadmap

The roadmap is ordered by dependencies. The data model is consolidated first, followed by the features that use that data.

### Phase 1 — Stabilization and quality

- [ ] Validate the installation of Liquid Glass v2 in the actual project.
- [ ] Run `pnpm check` after visual changes.
- [ ] Review migrations from an existing database and from a clean installation.
- [ ] Add automated tests for critical queries and operations.
- [ ] Review dialogs, keyboard navigation and accessibility.
- [ ] Start extracting components from `+page.svelte` without changing its behaviour.

**Completion criteria:** existing features continue to work, and changes can be checked and safely reverted.

### Phase 2 — Complete catalogue and versions

- [ ] Edit catalogue entries.
- [ ] Delete entries with confirmation and clear integrity rules.
- [ ] Add, edit and select multiple versions.
- [ ] Store dates, notes and platforms for each version.
- [ ] Manage information sources and attribution.
- [ ] Link catalogue entries to games in the personal library.
- [ ] Allow incorrect relationships to be undone or corrected.

**Completion criteria:** the catalogue can be managed without touching the personal library, and each game supports multiple independent versions.

### Phase 3 — Pokédex for each game and version

- [ ] Pokémon list with search, filters and sorting.
- [ ] National Pokédex number and local Pokédex number.
- [ ] Sprites, names, types and forms.
- [ ] Abilities and base stats.
- [ ] Pokédex descriptions.
- [ ] Evolutions and evolution methods.
- [ ] Moves and learning methods.
- [ ] Availability and version exclusivity.
- [ ] Management of Fakémon and custom species.
- [ ] Tools to import and review data.

**Completion criteria:** a version can have a complete Pokédex, independent of other versions of the same game.

### Phase 4 — World, regions and maps

- [ ] Create and edit regions.
- [ ] Create towns, routes, buildings, caves and dungeons.
- [ ] Establish relationships between locations.
- [ ] Attach world, regional and local maps.
- [ ] Navigate from a map to a location.
- [ ] Associate trainers, events and points of interest.
- [ ] Store resources locally for offline access.

**Completion criteria:** a game's world can be explored from its region down to individual locations.

### Phase 5 — Encounters and items

- [ ] Record encounters by location and method.
- [ ] Add levels and probabilities when provided by the source.
- [ ] Distinguish encounters by time, weather, event or other conditions.
- [ ] Record items, TMs and rewards.
- [ ] Indicate how and where each item can be obtained.
- [ ] Link Pokémon, items and locations in both directions.

**Completion criteria:** when viewing a route, users can see its Pokémon and items, and each Pokémon can show where it appears.

### Phase 6 — Guides and walkthroughs

- [ ] Markdown guide editor.
- [ ] Main adventure walkthrough.
- [ ] Gyms, trainers and important events.
- [ ] Side quests and secrets.
- [ ] Capture, breeding and evolution guides.
- [ ] Link guides to regions, routes, items and Pokémon.
- [ ] Publish, sort and filter guides.
- [ ] Read guides offline.

**Completion criteria:** each version can have a browsable wiki that is useful while playing.

### Phase 7 — Sources, importing and synchronization

- [ ] Integration with official and community data sources.
- [ ] Import from structured formats.
- [ ] Validation and duplicate detection.
- [ ] Visible attribution and licence preservation.
- [ ] Local cache for data and images.
- [ ] Incremental synchronization when a connection is available.
- [ ] Conflict and synchronization error resolution.
- [ ] Tools to export and back up user-created content.

**Completion criteria:** DexDeck can update data in a controlled way and remain useful without an Internet connection.

### Phase 8 — Universal launcher and tools

The launching system will evolve towards independent adapters. Each adapter will detect the formats it supports, check dependencies and prepare the execution arguments.

| Format / system | Planned adapter | Status |
|---|---|---|
| `.exe` | Wine | ✅ Implemented for the current workflow |
| `.gba` | mGBA | 🚧 Pending |
| `.nds` | melonDS | 🚧 Pending |
| `.3ds` / `.cci` | Azahar | 🚧 Pending |
| `.cia` | Workflow compatible with emulator installation | 🧭 To be designed |
| `.ips` / `.bps` / `.ups` | Patch application tool | 🚧 Pending |

Other planned features:

- Detect installed emulators.
- Configure paths and arguments for each system.
- Choose an emulator for each game.
- Check dependencies and show understandable errors.
- Associate patched ROM hacks with their original games.
- Manage execution profiles and specific options where feasible.

**Completion criteria:** users select a game and DexDeck prepares the appropriate engine without requiring them to manage each command manually.

### Phase 9 — Updates, settings and distribution

- [ ] Actual update centre.
- [ ] Check official sources for each project.
- [ ] Compare installed and published versions.
- [ ] Changelog and links to sources.
- [ ] Advanced emulator and storage settings.
- [ ] Cache and offline resource management.
- [ ] Backups and restoration.
- [ ] Import and export the library and catalogue.
- [ ] DexDeck packaging, installation and updating.
- [ ] Final testing on Linux and Windows.

---

## 🧪 Development and checks

### Main requirements

- Node.js.
- pnpm.
- Rust and Cargo.
- Tauri 2 development dependencies for the operating system.
- WebView and native tools required to build the application.

### Setting up the project

From the repository root:

```bash
pnpm install
pnpm check
```

`pnpm check` runs SvelteKit synchronization and `svelte-check` with the project's TypeScript configuration. It is a static check; it does not replace database tests, native builds or manual interface testing.

To start or build the application, check the scripts available in `package.json` and use the Tauri workflow configured in the project.

### Development guidelines

1. **Small, reviewable changes.** Avoid massive rewrites when a new component or service is enough.
2. **Do not break what works.** The library, launcher, themes and Encyclopedia must retain their responsibilities.
3. **Additive migrations.** Do not delete or transform existing data without a migration plan and a backup.
4. **Test after each phase.** Run `pnpm check` and the relevant tests before considering a task complete.
5. **No silent destructive operations.** Any cleanup of databases, files or entries must be explicit and reversible where possible.
6. **Traceable data.** Record the origin and attribution of external data whenever applicable.
7. **Offline-first.** A connection improves and updates content, but should not be a permanent requirement for accessing content that has already been downloaded.

---

## 📚 Data sources and respect for content

DexDeck may combine data from APIs, official sources, community documentation and manually entered information. Each source must be reviewed before integration, especially regarding licensing, attribution, usage limits and redistribution terms.

PokéAPI may be useful as a source for some official-game data, but it does not cover the specific content of fangames and ROM hacks on its own. Custom data will require its own editing and importing tools.

DexDeck must not distribute commercial ROMs, BIOS files, firmware or other third-party protected files. Users must provide their own files and comply with applicable law. The application is an independent fan project and is not affiliated with, endorsed by or sponsored by Nintendo, The Pokémon Company or Game Freak.

---

## 🔐 Data philosophy

- The personal library belongs to the user.
- The general catalogue and local installations are separate entities.
- Data should be exportable and backed up.
- External sources must be identified.
- Online features should have a local alternative whenever reasonable.
- Paths and executables must be validated before starting processes.
- Deletion and migration operations must be protected and documented.

---

## 💡 Ideas for the future

These ideas are not part of the implemented scope; they are possibilities that fit the project's vision:

- Trainer profiles and multiple libraries.
- Progress tracking for each playthrough.
- Wishlists and games to play.
- Version comparer and changes between editions.
- Tracking collections, teams and favourite Pokémon.
- Personal notes linked to routes, Pokémon and guides.
- Data importing from compatible tools.
- Extension system or community packages to expand entries.
- Optional synchronization between devices.

---

## 🗓️ Progress log

This section will be updated as new features are implemented and verified. Completed changes, work in progress and pending validation will be recorded separately.

### 30 October 2026 — DexDeck and Encyclopedia foundations

- ✅ Personal library with entry management, search and `.exe` launching through Wine.
- ✅ Detection of names, versions and metadata from Windows executables.
- ✅ Light and dark themes and the first version of Liquid Glass.
- ✅ Integration of the Encyclopedia section.
- ✅ Local catalogue separated from the personal library.
- ✅ Creation of catalogue entries with an initial version.
- ✅ Version selector and per-version statistics summary.
- ✅ Migration 8 with the Encyclopedia's core tables, relationships, constraints and indexes.
- ✅ Fixed markup warnings and errors in `Encyclopedia.svelte`; reported check result: `0 errors and 0 warnings`.
- 🧪 Liquid Glass v2 — Pearl Droplets visually prepared and approved; `pnpm check` still needs to be confirmed after installation in the project.

---

<div align="center">

**DexDeck — Your Pokémon universe, connected.**

*Made for trainers, with care.*

</div>
