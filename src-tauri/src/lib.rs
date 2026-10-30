
mod executable_metadata;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

// DEXDECK MULTIPLATFORM SUPPORT v1
#[tauri::command]
fn launch_game(
    executable_path: String,
    install_path: String,
) -> Result<(), String> {
    let raw_executable = PathBuf::from(executable_path.trim());

    if raw_executable.as_os_str().is_empty() {
        return Err("Este juego no tiene una ruta de ejecutable configurada.".into());
    }

    let base_directory = if install_path.trim().is_empty() {
        std::env::current_dir()
            .map_err(|error| format!("No se pudo obtener el directorio actual: {error}"))?
    } else {
        let path = PathBuf::from(install_path.trim());
        let resolved = path
            .canonicalize()
            .map_err(|error| format!("No se encuentra la carpeta de instalación: {error}"))?;

        if !resolved.is_dir() {
            return Err("La ruta de instalación no es una carpeta.".into());
        }

        resolved
    };

    let executable_candidate = if raw_executable.is_absolute() {
        raw_executable
    } else {
        base_directory.join(raw_executable)
    };

    let executable = executable_candidate
        .canonicalize()
        .map_err(|error| format!("No se encuentra el ejecutable: {error}"))?;

    if !executable.is_file() {
        return Err("La ruta seleccionada no corresponde a un archivo.".into());
    }

    let working_directory = if !install_path.trim().is_empty() {
        base_directory
    } else {
        executable
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf()
    };

    let is_windows_executable = executable
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"));

    launch_platform_executable(&executable, &working_directory, is_windows_executable)
}

fn spawn_native_executable(executable: &Path, working_directory: &Path) -> Result<(), String> {
    let _child = Command::new(executable)
        .current_dir(working_directory)
        .spawn()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::PermissionDenied {
                format!(
                    "No tienes permisos para ejecutar el archivo. Comprueba sus permisos: {}",
                    executable.display()
                )
            } else {
                format!("No se pudo iniciar el juego: {error}")
            }
        })?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_platform_executable(
    executable: &Path,
    working_directory: &Path,
    is_windows_executable: bool,
) -> Result<(), String> {
    if is_windows_executable {
        let _child = Command::new("wine")
            .arg(executable)
            .current_dir(working_directory)
            .spawn()
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::NotFound {
                    "No se encuentra Wine. Instálalo para ejecutar juegos de Windows.".to_string()
                } else {
                    format!("No se pudo iniciar el juego con Wine: {error}")
                }
            })?;
        Ok(())
    } else {
        spawn_native_executable(executable, working_directory)
    }
}

#[cfg(target_os = "windows")]
fn launch_platform_executable(
    executable: &Path,
    working_directory: &Path,
    _is_windows_executable: bool,
) -> Result<(), String> {
    // Windows ejecuta sus programas directamente; no requiere Wine.
    spawn_native_executable(executable, working_directory)
}

#[cfg(target_os = "macos")]
fn launch_platform_executable(
    executable: &Path,
    working_directory: &Path,
    is_windows_executable: bool,
) -> Result<(), String> {
    if is_windows_executable {
        return Err(
            "Los ejecutables .exe no se pueden iniciar de forma nativa en macOS. La compatibilidad con Wine está pendiente.".into(),
        );
    }
    spawn_native_executable(executable, working_directory)
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn launch_platform_executable(
    executable: &Path,
    working_directory: &Path,
    is_windows_executable: bool,
) -> Result<(), String> {
    if is_windows_executable {
        return Err("La ejecución de archivos .exe no está configurada para este sistema operativo.".into());
    }
    spawn_native_executable(executable, working_directory)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemInfo {
    os: String,
    os_name: String,
    architecture: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let os = std::env::consts::OS;
    let os_name = match os {
        "linux" => "Linux",
        "windows" => "Windows",
        "macos" => "macOS",
        "android" => "Android",
        "ios" => "iOS",
        _ => "Sistema desconocido",
    };
    let architecture = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "ARM64",
        "x86" => "x86",
        "arm" => "ARM",
        other => other,
    };

    SystemInfo {
        os: os.to_string(),
        os_name: os_name.to_string(),
        architecture: architecture.to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_games_table",
            sql: "
                CREATE TABLE IF NOT EXISTS games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    developer TEXT NOT NULL DEFAULT 'Desarrollador desconocido',
                    version TEXT NOT NULL DEFAULT 'Sin especificar',
                    type TEXT NOT NULL DEFAULT 'Fangame',
                    color TEXT NOT NULL DEFAULT 'blue',
                    symbol TEXT NOT NULL DEFAULT '✦',
                    status TEXT NOT NULL DEFAULT 'En biblioteca'
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_initial_games",
            sql: "
                INSERT INTO games
                    (id, name, developer, version, type, color, symbol, status)
                VALUES
                    (1, 'Pokémon Añil', 'Eric Lostie', '2.0', 'Aventura', 'blue', '✦', 'En biblioteca'),
                    (2, 'Pokémon Ópalo', 'Eric Lostie', '1.3', 'Aventura', 'purple', '◇', 'En biblioteca'),
                    (3, 'Pokémon Iberia', 'Eric Lostie', '2.04', 'RPG', 'red', '✧', 'En biblioteca');
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_game_description",
            sql: "ALTER TABLE games ADD COLUMN description TEXT NOT NULL DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_game_cover",
            sql: "ALTER TABLE games ADD COLUMN cover TEXT NOT NULL DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_game_official_url",
            sql: "ALTER TABLE games ADD COLUMN official_url TEXT NOT NULL DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_game_install_path",
            sql: "ALTER TABLE games ADD COLUMN install_path TEXT NOT NULL DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "add_game_executable_path",
            sql: "ALTER TABLE games ADD COLUMN executable_path TEXT NOT NULL DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "create_pokedex_foundation",
            sql: include_str!("migrations/0008_pokedex_foundation.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_game_hidden_state",
            sql: "
                ALTER TABLE games
                ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .setup(|app| {
            // DevTools solo durante el desarrollo.
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dexdeck.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            launch_game,
            get_system_info,
            executable_metadata::inspect_game_executable
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
