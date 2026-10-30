#!/usr/bin/env python3
"""Apply the additive DexDeck encyclopedia integration safely."""
from __future__ import annotations

import hashlib
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
PAGE = ROOT / 'src/routes/+page.svelte'
LIB_RS = ROOT / 'src-tauri/src/lib.rs'

BUNDLE_FILES = [
    Path('src/lib/encyclopedia.ts'),
    Path('src/lib/components/Encyclopedia.svelte'),
    Path('src-tauri/src/migrations/0008_pokedex_foundation.sql'),
]

# Only this exact previous release may be upgraded automatically. Any other
# pre-existing custom version is left untouched and causes a safe stop.
KNOWN_PREVIOUS_SHA256 = {
    Path('src/lib/components/Encyclopedia.svelte'): '389fb119ee60399d48a35783c87ff4eccb2bef6de5375c6103823691ca2d346f',
}

IMPORT_LINE = "import { onMount } from 'svelte';"
ENC_IMPORT = "import Encyclopedia from '$lib/components/Encyclopedia.svelte';"
NAV_ANCHOR = "    { label: 'Biblioteca', icon: '▦' },"
NAV_LINE = "    { label: 'Enciclopedia', icon: '◇' },"
SECTION_ANCHOR = "      {:else if activeSection === 'Actualizaciones'}"
ENC_SECTION = "      {:else if activeSection === 'Enciclopedia'}\n        <Encyclopedia />\n\n"

MIGRATION_8 = '''        Migration {
            version: 8,
            description: "create_pokedex_foundation",
            sql: include_str!("migrations/0008_pokedex_foundation.sql"),
            kind: MigrationKind::Up,
        },'''


def fail(message: str) -> None:
    raise RuntimeError(message)


def patch_page(source: str) -> tuple[str, bool]:
    original = source

    if ENC_IMPORT not in source:
        if source.count(IMPORT_LINE) != 1:
            fail("No encuentro una única importación de onMount en +page.svelte; no he modificado nada.")
        source = source.replace(IMPORT_LINE, IMPORT_LINE + "\n  " + ENC_IMPORT, 1)

    if NAV_LINE not in source:
        if source.count(NAV_ANCHOR) != 1:
            fail("No encuentro la entrada Biblioteca esperada en la navegación; no he modificado nada.")
        source = source.replace(NAV_ANCHOR, NAV_ANCHOR + "\n" + NAV_LINE, 1)

    section_marker_count = source.count("activeSection === 'Enciclopedia'")
    if section_marker_count == 0:
        if source.count(SECTION_ANCHOR) != 1:
            fail("No encuentro el bloque de Actualizaciones esperado en +page.svelte; no he modificado nada.")
        source = source.replace(SECTION_ANCHOR, ENC_SECTION + SECTION_ANCHOR, 1)
    elif section_marker_count > 1:
        fail("Ya hay más de una sección Enciclopedia en +page.svelte; revisa el archivo manualmente.")

    return source, source != original


def patch_rust(source: str) -> tuple[str, bool]:
    if re.search(r"(?m)^\s*version:\s*8\s*,", source):
        if ('0008_pokedex_foundation.sql' not in source
                or 'create_pokedex_foundation' not in source):
            fail("lib.rs ya contiene una migración 8 diferente. No la he sobrescrito.")
        return source, False

    pattern = re.compile(
        r"(?P<indent>^[ \t]*)Migration\s*\{\s*\n"
        r"(?P<body>(?:(?!^[ \t]*\},\s*$)[\s\S])*?^[ \t]*version:\s*7\s*,[\s\S]*?"
        r"^[ \t]*kind:\s*MigrationKind::Up\s*,\s*\n(?P=indent)\},)",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        fail("No he podido localizar de forma inequívoca la migración 7 en src-tauri/src/lib.rs. No he modificado nada.")

    match = matches[0]
    indent = match.group('indent')
    migration = MIGRATION_8.replace('        Migration {', indent + 'Migration {').replace(
        '\n            ', '\n' + indent + '    '
    )
    patched = source[:match.end()] + "\n" + migration + source[match.end():]
    return patched, True


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.dexdeck-tmp')
    temporary.write_text(content, encoding='utf-8', newline='')
    temporary.replace(path)


def main() -> int:
    if not PAGE.is_file():
        fail(f"No encuentro {PAGE.relative_to(ROOT)}. Ejecuta el script desde la raíz del proyecto DexDeck.")
    if not LIB_RS.is_file():
        fail(f"No encuentro {LIB_RS.relative_to(ROOT)}. Ejecuta el script desde la raíz del proyecto DexDeck.")

    bundle_root = Path(__file__).resolve().parent / 'payload'
    staged: dict[Path, bytes] = {}
    upgradeable_existing: dict[Path, bytes] = {}
    for relative in BUNDLE_FILES:
        source_path = bundle_root / relative
        if not source_path.is_file():
            fail(f"Falta un archivo del paquete: {relative}")
        destination = ROOT / relative
        data = source_path.read_bytes()
        if destination.exists() and destination.read_bytes() != data:
            existing = destination.read_bytes()
            previous_hash = KNOWN_PREVIOUS_SHA256.get(relative)
            existing_hash = hashlib.sha256(existing).hexdigest()
            if previous_hash and existing_hash == previous_hash:
                upgradeable_existing[destination] = existing
            else:
                fail(
                    f"Ya existe {relative} con contenido distinto. No lo he sobrescrito; "
                    "conserva ese archivo y revisa la diferencia antes de continuar."
                )
        staged[destination] = data

    page_original = PAGE.read_text(encoding='utf-8')
    rust_original = LIB_RS.read_text(encoding='utf-8')
    page_patched, page_changed = patch_page(page_original)
    rust_patched, rust_changed = patch_rust(rust_original)

    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    backups: list[tuple[Path, Path]] = []
    created_files: list[Path] = []
    try:
        files_to_backup: dict[Path, bytes] = dict(upgradeable_existing)
        if page_changed:
            files_to_backup[PAGE] = page_original.encode('utf-8')
        if rust_changed:
            files_to_backup[LIB_RS] = rust_original.encode('utf-8')

        for path in files_to_backup:
            backup = path.with_name(path.name + f'.bak-encyclopedia-{timestamp}')
            shutil.copy2(path, backup)
            backups.append((path, backup))

        for destination, data in staged.items():
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not destination.exists() or destination in upgradeable_existing:
                existed_before = destination.exists()
                temporary = destination.with_name(destination.name + '.dexdeck-tmp')
                temporary.write_bytes(data)
                temporary.replace(destination)
                if not existed_before:
                    created_files.append(destination)

        if page_changed:
            atomic_write(PAGE, page_patched)
        if rust_changed:
            atomic_write(LIB_RS, rust_patched)

    except Exception:
        for original_path, backup_path in backups:
            shutil.copy2(backup_path, original_path)
        for created in created_files:
            created.unlink(missing_ok=True)
        raise

    print('Integración de la Enciclopedia aplicada.')
    print(f"- +page.svelte: {'actualizado' if page_changed else 'ya estaba integrado'}")
    print(f"- src-tauri/src/lib.rs: {'migración 8 registrada' if rust_changed else 'migración 8 ya registrada'}")
    print('- Archivos de catálogo y migración: instalados o ya presentes idénticos.')
    if upgradeable_existing:
        print('- Se ha actualizado la versión anterior conocida del componente y se ha conservado su copia.')
    if backups:
        print('- Copias de seguridad:')
        for _, backup in backups:
            print(f'  {backup.relative_to(ROOT)}')
    print('\nSiguiente comprobación: pnpm check')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        raise SystemExit(1)
