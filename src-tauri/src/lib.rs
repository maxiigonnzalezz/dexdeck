
mod executable_metadata;
use std::path::{Path, PathBuf};
use std::process::Command;
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


// DEXDECK WALLPAPER-BACKED LIQUID GLASS v1
// Uses the wallpaper source itself, never a screenshot of windows behind DexDeck.
fn encode_wallpaper_data_url(mime: &str, bytes: &[u8]) -> String {
    use base64::Engine as _;
    format!(
        "data:{};base64,{}",
        mime,
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )
}

#[cfg(target_os = "linux")]
fn detect_mpvpaper_source() -> Option<(std::path::PathBuf, f64)> {
    use std::fs;
    use std::path::PathBuf;

    let uptime: f64 = fs::read_to_string("/proc/uptime")
        .ok()?
        .split_whitespace()
        .next()?
        .parse()
        .ok()?;
    // Linux exposes the process start time in clock ticks since boot.
    let ticks_per_second = unsafe { libc::sysconf(libc::_SC_CLK_TCK) };
    if ticks_per_second <= 0 {
        return None;
    }

    for entry in fs::read_dir("/proc").ok()?.flatten() {
        let pid = entry.file_name();
        if !pid.to_string_lossy().bytes().all(|byte| byte.is_ascii_digit()) {
            continue;
        }

        let process_dir = entry.path();
        let Ok(comm) = fs::read_to_string(process_dir.join("comm")) else {
            continue;
        };
        if comm.trim() != "mpvpaper" {
            continue;
        }

        let Ok(raw_args) = fs::read(process_dir.join("cmdline")) else {
            continue;
        };
        let args: Vec<String> = raw_args
            .split(|byte| *byte == 0)
            .filter(|part| !part.is_empty())
            .map(|part| String::from_utf8_lossy(part).into_owned())
            .collect();

        let process_cwd = fs::read_link(process_dir.join("cwd")).ok();
        let wallpaper_path = args.iter().rev().find_map(|arg| {
            let candidate = PathBuf::from(arg);
            let resolved = if candidate.is_absolute() {
                candidate
            } else {
                process_cwd.as_ref()?.join(candidate)
            };
            resolved.is_file().then_some(resolved)
        });
        let Some(wallpaper_path) = wallpaper_path else {
            continue;
        };

        let Ok(stat) = fs::read_to_string(process_dir.join("stat")) else {
            continue;
        };
        let Some((_, fields)) = stat.rsplit_once(')') else {
            continue;
        };
        let fields: Vec<&str> = fields.split_whitespace().collect();
        // After the command name, field 22 (starttime) is index 19.
        let Some(start_ticks_text) = fields.get(19) else {
            continue;
        };
        let Ok(start_ticks) = start_ticks_text.parse::<f64>() else {
            continue;
        };
        let started_at = start_ticks / ticks_per_second as f64;
        let elapsed = (uptime - started_at).max(0.0);
        return Some((wallpaper_path, elapsed));
    }

    None
}

#[cfg(target_os = "linux")]
#[tauri::command]
fn get_wallpaper_snapshot() -> Result<Option<String>, String> {
    use std::process::Command;

    let Some((wallpaper_path, elapsed)) = detect_mpvpaper_source() else {
        return Ok(None);
    };

    // ffprobe reads the source video duration; elapsed process time lets us
    // estimate the frame currently shown by mpvpaper's looping wallpaper.
    let probe = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(&wallpaper_path)
        .output();
    let Ok(probe) = probe else {
        return Ok(None);
    };
    if !probe.status.success() {
        return Ok(None);
    }
    let duration: f64 = String::from_utf8_lossy(&probe.stdout).trim().parse().unwrap_or(0.0);
    if !duration.is_finite() || duration <= 0.0 {
        return Ok(None);
    }

    let position = elapsed % duration;
    let frame = Command::new("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-threads", "1", "-ss"])
        .arg(format!("{position:.3}"))
        .arg("-i")
        .arg(&wallpaper_path)
        .args([
            "-frames:v", "1",
            "-vf", "scale='min(1920,iw)':-2",
            "-q:v", "6",
            "-f", "image2pipe",
            "-vcodec", "mjpeg",
            "pipe:1",
        ])
        .output();
    let Ok(frame) = frame else {
        return Ok(None);
    };
    if !frame.status.success() || frame.stdout.is_empty() {
        return Ok(None);
    }

    Ok(Some(encode_wallpaper_data_url("image/jpeg", &frame.stdout)))
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn get_wallpaper_snapshot() -> Result<Option<String>, String> {
    use std::fs;

    let Some(app_data) = std::env::var_os("APPDATA") else {
        return Ok(None);
    };
    let themes = std::path::PathBuf::from(app_data).join("Microsoft").join("Windows").join("Themes");
    let transcoded = themes.join("TranscodedWallpaper");

    // Windows keeps the current wallpaper in TranscodedWallpaper. CachedFiles
    // is a fallback for installations where that file is unavailable.
    let wallpaper_path = if transcoded.is_file() {
        Some(transcoded)
    } else {
        let cached = themes.join("CachedFiles");
        fs::read_dir(cached)
            .ok()
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|entry| {
                let path = entry.path();
                let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
                if matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "bmp") {
                    let modified = entry.metadata().ok()?.modified().ok()?;
                    Some((modified, path))
                } else {
                    None
                }
            })
            .max_by_key(|(modified, _)| *modified)
            .map(|(_, path)| path)
    };
    let Some(wallpaper_path) = wallpaper_path else {
        return Ok(None);
    };
    let bytes = fs::read(&wallpaper_path).map_err(|error| {
        format!("No se pudo leer el fondo de Windows: {error}")
    })?;
    let mime = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.starts_with(b"BM") {
        "image/bmp"
    } else {
        return Ok(None);
    };

    Ok(Some(encode_wallpaper_data_url(mime, &bytes)))
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
#[tauri::command]
fn get_wallpaper_snapshot() -> Result<Option<String>, String> {
    Ok(None)
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
        Migration {
            version: 10,
            description: "remove_seeded_demo_games",
            sql: include_str!("migrations/0010_remove_seeded_demo_games.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()

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
            executable_metadata::inspect_game_executable,
            get_wallpaper_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
