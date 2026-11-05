use serde::Serialize;
use std::{
    env, fs,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

#[cfg(target_os = "linux")]
const APP_IDENTIFIER: &str = "com.dexdeck.launcher";
#[cfg(target_os = "windows")]
const DELETE_DATA_MARKER: &str = "uninstall-delete-data.flag";

static TEMP_SCRIPT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn create_temp_script(
    prefix: &str,
    extension: &str,
    contents: &str,
) -> Result<PathBuf, String> {
    let temp_dir = env::temp_dir();

    for _ in 0..32 {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();

        let sequence = TEMP_SCRIPT_SEQUENCE.fetch_add(1, Ordering::Relaxed);

        let path = temp_dir.join(format!(
            "{prefix}-{}-{timestamp}-{sequence}.{extension}",
            std::process::id()
        ));

        let mut options = OpenOptions::new();
        options.write(true).create_new(true);

        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o700);
        }

        match options.open(&path) {
            Ok(mut file) => {
                if let Err(error) = file.write_all(contents.as_bytes()) {
                    drop(file);
                    let _ = fs::remove_file(&path);
                    return Err(format!(
                        "No se pudo escribir el script temporal: {error}"
                    ));
                }

                return Ok(path);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                continue;
            }
            Err(error) => {
                return Err(format!(
                    "No se pudo crear el script temporal: {error}"
                ));
            }
        }
    }

    Err("No se pudo encontrar un nombre seguro para el script temporal.".into())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallationInfo {
    pub kind: String,
    pub can_update: bool,
    pub can_uninstall: bool,
    pub message: String,
}

fn unsupported(message: &str) -> InstallationInfo {
    InstallationInfo {
        kind: "unsupported".into(),
        can_update: false,
        can_uninstall: false,
        message: message.into(),
    }
}

#[cfg(target_os = "windows")]
fn detect_installation() -> InstallationInfo {
    let uninstaller = env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|parent| parent.join("uninstall.exe")));

    if uninstaller.as_ref().is_some_and(|path| path.is_file()) {
        InstallationInfo {
            kind: "windowsNsis".into(),
            can_update: true,
            can_uninstall: true,
            message: "Instalación de Windows (NSIS). Actualizaciones firmadas disponibles.".into(),
        }
    } else {
        unsupported(
            "No se ha detectado una instalación NSIS. En modo desarrollo no se puede desinstalar DexDeck.",
        )
    }
}

#[cfg(target_os = "linux")]
fn deb_package_for_executable(executable: &Path) -> Option<String> {
    let mut candidates = vec![executable.to_path_buf()];
    if let Ok(canonical) = fs::canonicalize(executable) {
        if canonical != executable {
            candidates.push(canonical);
        }
    }

    for candidate in candidates {
        let output = Command::new("dpkg-query")
            .args(["-S"])
            .arg(&candidate)
            .output()
            .ok()?;
        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let Some((package_field, _)) = line.split_once(": ") else {
                continue;
            };
            let package = package_field.split(',').next()?.trim();
            if !package.is_empty()
                && package.bytes().all(|byte| {
                    byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"+.-:".contains(&byte)
                })
            {
                return Some(package.to_string());
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn detect_installation() -> InstallationInfo {
    if let Some(appimage) = env::var_os("APPIMAGE") {
        if Path::new(&appimage).is_file() {
            return InstallationInfo {
                kind: "appImage".into(),
                can_update: true,
                can_uninstall: true,
                message: "AppImage detectada. Actualizaciones y desinstalación disponibles.".into(),
            };
        }
    }

    if let Ok(executable) = env::current_exe() {
        if let Some(package) = deb_package_for_executable(&executable) {
            if Path::new("/usr/bin/apt-get").is_file() && Path::new("/usr/bin/pkexec").is_file() {
                return InstallationInfo {
                    kind: "deb".into(),
                    can_update: false,
                    can_uninstall: true,
                    message: format!(
                        "Paquete DEB detectado ({package}). Las actualizaciones se descargan y se instalan con el gestor de paquetes del sistema."
                    ),
                };
            }
            return InstallationInfo {
                kind: "debNoPackageManager".into(),
                can_update: false,
                can_uninstall: false,
                message: "Se ha detectado un paquete DEB, pero no se encuentra apt-get o pkexec para desinstalarlo desde DexDeck.".into(),
            };
        }
    }

    unsupported(
        "No se ha detectado una instalación AppImage o DEB compatible. En modo desarrollo no se puede desinstalar DexDeck.",
    )
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn detect_installation() -> InstallationInfo {
    unsupported("La gestión integrada de instalación todavía no está disponible en este sistema.")
}

#[tauri::command]
pub fn get_installation_info() -> InstallationInfo {
    detect_installation()
}

#[cfg(target_os = "linux")]
fn xdg_base_directory(variable: &str, fallback: PathBuf) -> PathBuf {
    env::var_os(variable)
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .unwrap_or(fallback)
}

#[cfg(target_os = "linux")]
fn expected_app_data_locations(
    data_home: &Path,
    config_home: &Path,
    cache_home: &Path,
) -> Vec<(PathBuf, PathBuf, PathBuf)> {
    let app_data = PathBuf::from(APP_IDENTIFIER);
    vec![
        (
            data_home.join(&app_data),
            data_home.to_path_buf(),
            app_data.clone(),
        ),
        (
            config_home.join(&app_data),
            config_home.to_path_buf(),
            app_data.clone(),
        ),
        (
            cache_home.join(&app_data),
            cache_home.to_path_buf(),
            app_data.clone(),
        ),
        (
            data_home.join(&app_data).join("logs"),
            data_home.to_path_buf(),
            app_data.join("logs"),
        ),
    ]
}

#[cfg(target_os = "linux")]
fn validate_xdg_app_data_directory(
    directory: &Path,
    expected_path: &Path,
    base_directory: &Path,
    relative_path: &Path,
) -> Result<Option<PathBuf>, String> {
    if directory != expected_path {
        return Err(format!(
            "La ruta de datos no coincide con los directorios XDG permitidos; se cancela por seguridad: {}",
            directory.display()
        ));
    }

    let metadata = match fs::symlink_metadata(directory) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "No se pudo comprobar el directorio de datos {}: {error}",
                directory.display()
            ));
        }
    };

    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "El destino de limpieza no es un directorio real; se cancela por seguridad: {}",
            directory.display()
        ));
    }

    let canonical_base = fs::canonicalize(base_directory).map_err(|error| {
        format!(
            "No se pudo resolver el directorio base {}: {error}",
            base_directory.display()
        )
    })?;
    let canonical_expected = canonical_base.join(relative_path);
    let canonical_directory = fs::canonicalize(directory).map_err(|error| {
        format!(
            "No se pudo resolver el directorio de datos {}: {error}",
            directory.display()
        )
    })?;

    if canonical_directory != canonical_expected {
        return Err(format!(
            "La ruta real del directorio no coincide con la ubicación XDG de DexDeck; se cancela por seguridad: {}",
            canonical_directory.display()
        ));
    }

    Ok(Some(canonical_directory))
}

#[cfg(target_os = "linux")]
fn app_data_directories(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let resolver = app.path();
    let home = resolver.home_dir().map_err(|error| error.to_string())?;

    let data_home = xdg_base_directory("XDG_DATA_HOME", home.join(".local/share"));
    let config_home = xdg_base_directory("XDG_CONFIG_HOME", home.join(".config"));
    let cache_home = xdg_base_directory("XDG_CACHE_HOME", home.join(".cache"));

    let expected = expected_app_data_locations(&data_home, &config_home, &cache_home);

    let candidates = vec![
        resolver.app_data_dir().map_err(|error| error.to_string())?,
        resolver
            .app_config_dir()
            .map_err(|error| error.to_string())?,
        resolver
            .app_local_data_dir()
            .map_err(|error| error.to_string())?,
        resolver
            .app_cache_dir()
            .map_err(|error| error.to_string())?,
        resolver.app_log_dir().map_err(|error| error.to_string())?,
    ];

    let mut validated = Vec::with_capacity(candidates.len());
    for directory in candidates {
        let Some((expected_path, base_directory, relative_path)) = expected
            .iter()
            .find(|(expected_path, _, _)| expected_path == &directory)
        else {
            return Err(format!(
                "La ruta de datos no coincide con los directorios XDG permitidos; se cancela por seguridad: {}",
                directory.display()
            ));
        };

        if let Some(canonical_directory) = validate_xdg_app_data_directory(
            &directory,
            expected_path,
            base_directory,
            relative_path,
        )? {
            validated.push(canonical_directory);
        }
    }

    validated.sort_by(|left, right| {
        right
            .components()
            .count()
            .cmp(&left.components().count())
            .then_with(|| left.cmp(right))
    });
    validated.dedup();
    Ok(validated)
}

#[cfg(target_os = "windows")]
fn validate_windows_data_directory(path: &Path) -> Result<(), String> {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

    let candidates = [path.parent(), Some(path)];
    for candidate in candidates.into_iter().flatten() {
        match fs::symlink_metadata(candidate) {
            Ok(metadata) => {
                if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                    return Err(format!(
                        "Se ha detectado un enlace o punto de reanálisis en una ruta de datos; se cancela por seguridad: {}",
                        candidate.display()
                    ));
                }
                if !metadata.is_dir() {
                    return Err(format!(
                        "La ruta de datos no es un directorio: {}",
                        candidate.display()
                    ));
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(format!(
                    "No se pudo comprobar la ruta de datos {}: {error}",
                    candidate.display()
                ));
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn prepare_windows_delete_marker(marker: &Path, delete_data: bool) -> Result<(), String> {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

    let app_data = marker
        .parent()
        .ok_or_else(|| "No se ha podido determinar el directorio de datos de DexDeck.".to_string())?;

    validate_windows_data_directory(app_data)?;
    fs::create_dir_all(app_data).map_err(|error| {
        format!("No se pudo preparar el directorio de datos de DexDeck: {error}")
    })?;
    validate_windows_data_directory(app_data)?;

    match fs::symlink_metadata(marker) {
        Ok(metadata) => {
            if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
                || !metadata.is_file()
            {
                return Err(
                    "El marcador de desinstalación existe, pero no es un archivo normal. Se cancela por seguridad.".into(),
                );
            }
            fs::remove_file(marker).map_err(|error| {
                format!("No se pudo retirar un marcador anterior de desinstalación: {error}")
            })?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!("No se pudo comprobar el marcador de desinstalación: {error}"));
        }
    }

    if delete_data {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(marker)
            .map_err(|error| format!("No se pudo crear el marcador de eliminación: {error}"))?;

        if let Err(error) = file.write_all(b"delete DexDeck user data\n") {
            drop(file);
            let _ = fs::remove_file(marker);
            return Err(format!("No se pudo escribir el marcador de eliminación: {error}"));
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn powershell_literal(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "''"))
}

#[cfg(target_os = "windows")]
fn start_windows_uninstall(app: &AppHandle, delete_data: bool) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let executable = env::current_exe().map_err(|error| error.to_string())?;
    let install_directory = executable
        .parent()
        .ok_or_else(|| "No se ha podido determinar la carpeta de instalación.".to_string())?;
    let uninstaller = install_directory.join("uninstall.exe");
    if !uninstaller.is_file() {
        return Err("No se ha encontrado uninstall.exe junto a DexDeck. Reinstala la aplicación antes de desinstalarla desde aquí.".into());
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let app_local_data = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    validate_windows_data_directory(&app_data)?;
    validate_windows_data_directory(&app_local_data)?;

    let marker = app_data.join(DELETE_DATA_MARKER);
    let script = format!(
        "$ErrorActionPreference = 'Stop'\n$targetPid = {}\n$uninstaller = {}\n$marker = {}\n$exitCode = 1\ntry {{\n  while (Get-Process -Id $targetPid -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 400 }}\n  if (-not (Test-Path -LiteralPath $uninstaller)) {{ throw 'No se ha encontrado uninstall.exe.' }}\n  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait\n  $exitCode = [int]$process.ExitCode\n}} catch {{\n  $exitCode = 1\n}} finally {{\n  if (Test-Path -LiteralPath $marker) {{ Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue }}\n  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue\n}}\nexit $exitCode\n",
        std::process::id(),
        powershell_literal(&uninstaller),
        powershell_literal(&marker)
    );
    let script_path = create_temp_script("dexdeck-uninstall", "ps1", &script)?;

    if let Err(error) = prepare_windows_delete_marker(&marker, delete_data) {
        let _ = fs::remove_file(&script_path);
        return Err(error);
    }

    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
        ])
        .arg(&script_path)
        .creation_flags(0x08000000)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let _ = fs::remove_file(&script_path);
            let _ = fs::remove_file(&marker);
            format!("No se pudo iniciar el desinstalador de Windows: {error}")
        })?;

    Ok(())
}

#[cfg(target_os = "linux")]
fn linux_uninstall_script() -> &'static str {
    r##"#!/bin/sh
set -eu
PATH=/usr/bin:/bin
export PATH
trap '/usr/bin/rm -f -- "$0"' EXIT
app_pid="$1"
install_kind="$2"
target="$3"
delete_data="$4"
shift 4

if [ "$delete_data" = "1" ]; then
  [ -d /proc/self/fd ] || { echo "No está disponible /proc/self/fd; se cancela la limpieza." >&2; exit 5; }
  [ -x /usr/bin/stat ] || { echo "No está disponible /usr/bin/stat; se cancela la limpieza." >&2; exit 5; }
  [ -x /usr/bin/find ] || { echo "No está disponible /usr/bin/find; se cancela la limpieza." >&2; exit 5; }
  [ -x /usr/bin/rmdir ] || { echo "No está disponible /usr/bin/rmdir; se cancela la limpieza." >&2; exit 5; }
fi

while kill -0 "$app_pid" 2>/dev/null; do
  /usr/bin/sleep 1
done

case "$install_kind" in
  appImage)
    /usr/bin/rm -f -- "$target"
    ;;
  deb)
    /usr/bin/pkexec /usr/bin/apt-get purge -y -- "$target"
    ;;
  *)
    exit 2
    ;;
esac

while [ "$#" -gt 0 ]; do
  [ "$#" -ge 6 ] || { echo "Argumentos de limpieza incompletos." >&2; exit 4; }
  data_parent="$1"
  data_name="$2"
  expected_parent_dev="$3"
  expected_parent_ino="$4"
  expected_child_dev="$5"
  expected_child_ino="$6"
  shift 6

  case "$data_name" in
    com.dexdeck.launcher)
      ;;
    logs)
      if [ "${data_parent##*/}" != "com.dexdeck.launcher" ]; then
        echo "El directorio de logs tiene un padre inesperado." >&2
        exit 4
      fi
      ;;
    *)
      echo "Nombre de directorio no permitido: $data_name" >&2
      exit 4
      ;;
  esac

  cd -P "$data_parent" || {
    echo "No se pudo abrir el directorio padre: $data_parent" >&2
    exit 4
  }
  actual_parent_identity=$(/usr/bin/stat -Lc '%d:%i' .) || {
    echo "No se pudo verificar la identidad del directorio padre." >&2
    exit 4
  }
  if [ "$actual_parent_identity" != "$expected_parent_dev:$expected_parent_ino" ]; then
    echo "El directorio padre cambió desde la validación; se cancela el borrado: $data_parent" >&2
    exit 4
  fi

  exec 9< . || {
    echo "No se pudo fijar el directorio padre mediante un descriptor." >&2
    exit 4
  }
  descriptor_parent_identity=$(/usr/bin/stat -Lc '%d:%i' /proc/self/fd/9) || {
    echo "No se pudo verificar el descriptor del directorio padre." >&2
    exit 4
  }
  if [ "$descriptor_parent_identity" != "$expected_parent_dev:$expected_parent_ino" ]; then
    echo "El descriptor del directorio padre no coincide; se cancela el borrado." >&2
    exit 4
  fi

  target_path="/proc/self/fd/9/$data_name"
  if [ -L "$target_path" ]; then
    echo "Se ha detectado un enlace simbólico en el destino: $data_name" >&2
    exit 4
  fi

  if [ -d "$target_path" ]; then
    actual_child_identity=$(/usr/bin/stat -c '%d:%i' -- "$target_path") || {
      echo "No se pudo verificar la identidad del directorio DexDeck: $data_name" >&2
      exit 4
    }
    if [ "$actual_child_identity" != "$expected_child_dev:$expected_child_ino" ]; then
      echo "El directorio DexDeck cambió desde la validación; se cancela el borrado: $data_name" >&2
      exit 4
    fi

    cd -P "$target_path" || {
      echo "No se pudo abrir el directorio DexDeck: $data_name" >&2
      exit 4
    }
    exec 8< . || {
      echo "No se pudo fijar el directorio DexDeck mediante un descriptor." >&2
      exit 4
    }
    opened_child_identity=$(/usr/bin/stat -Lc '%d:%i' /proc/self/fd/8) || {
      echo "No se pudo verificar el descriptor del directorio DexDeck." >&2
      exit 4
    }
    if [ "$opened_child_identity" != "$expected_child_dev:$expected_child_ino" ]; then
      echo "El descriptor del directorio DexDeck no coincide; se cancela el borrado." >&2
      exit 4
    fi

    /usr/bin/find -P . -xdev -mindepth 1 -depth -delete
    cd -P /proc/self/fd/9 || {
      echo "No se pudo volver al directorio padre fijado." >&2
      exit 4
    }
    exec 8<&-

    if [ -L "$target_path" ]; then
      echo "El destino cambió a un enlace simbólico durante la limpieza." >&2
      exit 4
    fi
    if [ -d "$target_path" ]; then
      final_child_identity=$(/usr/bin/stat -c '%d:%i' -- "$target_path") || {
        echo "No se pudo verificar el directorio antes de retirarlo." >&2
        exit 4
      }
      if [ "$final_child_identity" != "$expected_child_dev:$expected_child_ino" ]; then
        echo "El directorio cambió antes de retirarlo; se conserva el destino." >&2
        exit 4
      fi
      /usr/bin/rmdir -- "$target_path"
    elif [ -e "$target_path" ]; then
      echo "El destino dejó de ser un directorio; se cancela la limpieza." >&2
      exit 4
    fi
  elif [ -e "$target_path" ]; then
    echo "El destino de limpieza ya no es un directorio: $data_name" >&2
    exit 4
  fi
  exec 9<&-
done
"##
}

#[cfg(target_os = "linux")]
fn start_linux_uninstall(app: &AppHandle, kind: &str, delete_data: bool) -> Result<(), String> {
    use std::os::unix::{fs::MetadataExt, process::CommandExt};

    let target = match kind {
        "appImage" => {
            let path = env::var_os("APPIMAGE")
                .map(PathBuf::from)
                .filter(|path| path.is_file())
                .ok_or_else(|| "No se ha encontrado la ruta del AppImage actual.".to_string())?;
            path.to_string_lossy().into_owned()
        }
        "deb" => {
            let executable = env::current_exe().map_err(|error| error.to_string())?;
            deb_package_for_executable(&executable).ok_or_else(|| {
                "No se ha podido identificar el paquete DEB instalado.".to_string()
            })?
        }
        _ => return Err("Este tipo de instalación no admite la desinstalación integrada.".into()),
    };

    let directories = if delete_data {
        app_data_directories(app)?
    } else {
        Vec::new()
    };

    let script = linux_uninstall_script();

    let script_path = create_temp_script("dexdeck-uninstall", "sh", script)?;

    let delete_flag = if delete_data { "1" } else { "0" };
    let mut command = Command::new("/bin/sh");
    command.arg(&script_path);

    command
        .arg(std::process::id().to_string())
        .arg(kind)
        .arg(target)
        .arg(delete_flag);
    for directory in &directories {
        let parent = directory.parent().ok_or_else(|| {
            format!("No se pudo determinar el directorio padre de {}.", directory.display())
        })?;
        let name = directory
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| format!("Nombre de directorio no válido: {}", directory.display()))?;
        let canonical_parent = fs::canonicalize(parent).map_err(|error| {
            format!("No se pudo resolver el directorio padre {}: {error}", parent.display())
        })?;
        if canonical_parent != parent {
            return Err(format!(
                "El directorio padre cambió de ubicación; se cancela por seguridad: {}",
                parent.display()
            ));
        }
        let parent_metadata = fs::symlink_metadata(&canonical_parent).map_err(|error| {
            format!("No se pudo comprobar el directorio padre {}: {error}", canonical_parent.display())
        })?;
        if parent_metadata.file_type().is_symlink() || !parent_metadata.is_dir() {
            return Err(format!(
                "El directorio padre no es un directorio normal: {}",
                canonical_parent.display()
            ));
        }

        let child_metadata = fs::symlink_metadata(directory).map_err(|error| {
            format!("No se pudo comprobar el directorio DexDeck {}: {error}", directory.display())
        })?;
        if child_metadata.file_type().is_symlink() || !child_metadata.is_dir() {
            return Err(format!(
                "El destino de limpieza dejó de ser un directorio normal: {}",
                directory.display()
            ));
        }
        let canonical_child = fs::canonicalize(directory).map_err(|error| {
            format!("No se pudo resolver el directorio DexDeck {}: {error}", directory.display())
        })?;
        if canonical_child != *directory {
            return Err(format!(
                "El directorio DexDeck cambió de ubicación; se cancela por seguridad: {}",
                directory.display()
            ));
        }

        command
            .arg(&canonical_parent)
            .arg(name)
            .arg(parent_metadata.dev().to_string())
            .arg(parent_metadata.ino().to_string())
            .arg(child_metadata.dev().to_string())
            .arg(child_metadata.ino().to_string());
    }

    command
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let _ = fs::remove_file(&script_path);
            if kind == "deb" {
                format!("No se pudo iniciar el proceso de desinstalación del paquete: {error}")
            } else {
                format!("No se pudo iniciar la limpieza del AppImage: {error}")
            }
        })?;

    Ok(())
}

#[tauri::command]
pub fn start_uninstall(app: AppHandle, delete_data: bool) -> Result<(), String> {
    let installation = detect_installation();
    if !installation.can_uninstall {
        return Err(installation.message);
    }

    #[cfg(target_os = "windows")]
    start_windows_uninstall(&app, delete_data)?;

    #[cfg(target_os = "linux")]
    start_linux_uninstall(&app, &installation.kind, delete_data)?;

    app.exit(0);
    Ok(())
}

#[cfg(all(test, target_os = "linux"))]
mod maintenance_tests {
    use super::*;

    static TEST_DIRECTORY_SEQUENCE: std::sync::atomic::AtomicU64 =
        std::sync::atomic::AtomicU64::new(0);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            for _ in 0..32 {
                let sequence = TEST_DIRECTORY_SEQUENCE.fetch_add(
                    1,
                    std::sync::atomic::Ordering::Relaxed,
                );
                let path = env::temp_dir().join(format!(
                    "dexdeck-xdg-test-{}-{sequence}",
                    std::process::id()
                ));
                match fs::create_dir(&path) {
                    Ok(()) => return Self(path),
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("No se pudo crear el directorio temporal de prueba: {error}"),
                }
            }
            panic!("No se pudo reservar un directorio temporal único para la prueba");
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn accepts_existing_directory_at_expected_xdg_location() {
        let temp = TestDirectory::new();
        let base = temp.path().join("data");
        fs::create_dir(&base).unwrap();
        let relative = PathBuf::from(APP_IDENTIFIER);
        let expected = base.join(&relative);
        fs::create_dir(&expected).unwrap();

        let result = validate_xdg_app_data_directory(
            &expected,
            &expected,
            &base,
            &relative,
        )
        .unwrap();

        assert_eq!(result, Some(fs::canonicalize(expected).unwrap()));
    }

    #[test]
    fn rejects_directory_outside_the_expected_xdg_location() {
        let temp = TestDirectory::new();
        let base = temp.path().join("data");
        fs::create_dir(&base).unwrap();
        let relative = PathBuf::from(APP_IDENTIFIER);
        let expected = base.join(&relative);
        let outside = temp.path().join("unrelated").join(APP_IDENTIFIER);
        fs::create_dir_all(&outside).unwrap();

        assert!(validate_xdg_app_data_directory(
            &outside,
            &expected,
            &base,
            &relative,
        )
        .is_err());
    }

    #[test]
    fn skips_a_missing_expected_directory() {
        let temp = TestDirectory::new();
        let base = temp.path().join("data");
        fs::create_dir(&base).unwrap();
        let relative = PathBuf::from(APP_IDENTIFIER);
        let expected = base.join(&relative);

        let result = validate_xdg_app_data_directory(
            &expected,
            &expected,
            &base,
            &relative,
        )
        .unwrap();

        assert_eq!(result, None);
    }

    #[test]
    fn rejects_a_regular_file_at_the_expected_directory_path() {
        let temp = TestDirectory::new();
        let base = temp.path().join("data");
        fs::create_dir(&base).unwrap();
        let relative = PathBuf::from(APP_IDENTIFIER);
        let expected = base.join(&relative);
        fs::write(&expected, b"not a directory").unwrap();

        assert!(validate_xdg_app_data_directory(
            &expected,
            &expected,
            &base,
            &relative,
        )
        .is_err());
    }

    #[test]
    fn rejects_a_symbolic_link_at_the_expected_directory_path() {
        use std::os::unix::fs::symlink;

        let temp = TestDirectory::new();
        let base = temp.path().join("data");
        let outside = temp.path().join("outside");
        fs::create_dir(&base).unwrap();
        fs::create_dir(&outside).unwrap();
        let relative = PathBuf::from(APP_IDENTIFIER);
        let expected = base.join(&relative);
        symlink(&outside, &expected).unwrap();

        assert!(validate_xdg_app_data_directory(
            &expected,
            &expected,
            &base,
            &relative,
        )
        .is_err());
    }


    #[cfg(target_os = "linux")]
    fn append_cleanup_entry(
        args: &mut Vec<std::ffi::OsString>,
        parent: &Path,
        name: &str,
        parent_metadata: &fs::Metadata,
        child_metadata: &fs::Metadata,
    ) {
        use std::os::unix::fs::MetadataExt;
        args.push(parent.as_os_str().to_owned());
        args.push(name.into());
        args.push(parent_metadata.dev().to_string().into());
        args.push(parent_metadata.ino().to_string().into());
        args.push(child_metadata.dev().to_string().into());
        args.push(child_metadata.ino().to_string().into());
    }

    #[cfg(target_os = "linux")]
    fn run_linux_cleanup_script(
        app_image: &Path,
        args: &[std::ffi::OsString],
    ) -> std::process::Output {
        let script_path = create_temp_script(
            "dexdeck-cleanup-test",
            "sh",
            linux_uninstall_script(),
        )
        .unwrap();
        let output = Command::new("/bin/sh")
            .arg(&script_path)
            .arg("2147483647")
            .arg("appImage")
            .arg(app_image)
            .arg("1")
            .args(args)
            .output()
            .expect("No se pudo ejecutar el script de limpieza de prueba");
        assert!(
            !script_path.exists(),
            "El trap debe retirar el script temporal de prueba"
        );
        output
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_cleanup_script_removes_only_validated_directories() {
        use std::os::unix::fs::symlink;

        let temp = TestDirectory::new();
        let data_parent = temp.path().join("data");
        fs::create_dir(&data_parent).unwrap();
        let app_data = data_parent.join(APP_IDENTIFIER);
        fs::create_dir(&app_data).unwrap();
        let logs = app_data.join("logs");
        fs::create_dir(&logs).unwrap();
        fs::write(app_data.join("dexdeck.db"), b"fixture").unwrap();
        fs::write(logs.join("dexdeck.log"), b"fixture").unwrap();

        let outside = temp.path().join("outside");
        fs::create_dir(&outside).unwrap();
        let outside_sentinel = outside.join("keep.txt");
        fs::write(&outside_sentinel, b"must survive").unwrap();
        symlink(&outside, app_data.join("external-link")).unwrap();

        let app_image = temp.path().join("DexDeck-test.AppImage");
        fs::write(&app_image, b"test image").unwrap();

        let logs_parent_metadata = fs::symlink_metadata(&app_data).unwrap();
        let logs_metadata = fs::symlink_metadata(&logs).unwrap();
        let data_parent_metadata = fs::symlink_metadata(&data_parent).unwrap();
        let app_data_metadata = fs::symlink_metadata(&app_data).unwrap();
        let mut args = Vec::new();
        append_cleanup_entry(
            &mut args,
            &app_data,
            "logs",
            &logs_parent_metadata,
            &logs_metadata,
        );
        append_cleanup_entry(
            &mut args,
            &data_parent,
            APP_IDENTIFIER,
            &data_parent_metadata,
            &app_data_metadata,
        );

        let output = run_linux_cleanup_script(&app_image, &args);
        assert!(
            output.status.success(),
            "Script falló: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(!app_data.exists());
        assert!(!app_image.exists());
        assert_eq!(fs::read(&outside_sentinel).unwrap(), b"must survive");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_cleanup_script_rejects_replaced_child_directory() {

        let temp = TestDirectory::new();
        let data_parent = temp.path().join("data");
        fs::create_dir(&data_parent).unwrap();
        let app_data = data_parent.join(APP_IDENTIFIER);
        fs::create_dir(&app_data).unwrap();
        let parent_metadata = fs::symlink_metadata(&data_parent).unwrap();
        let original_child_metadata = fs::symlink_metadata(&app_data).unwrap();

        let moved_original = data_parent.join("original-directory");
        fs::rename(&app_data, &moved_original).unwrap();
        fs::create_dir(&app_data).unwrap();
        let sentinel = app_data.join("must-survive.txt");
        fs::write(&sentinel, b"keep").unwrap();

        let app_image = temp.path().join("DexDeck-test.AppImage");
        fs::write(&app_image, b"test image").unwrap();
        let mut args = Vec::new();
        append_cleanup_entry(
            &mut args,
            &data_parent,
            APP_IDENTIFIER,
            &parent_metadata,
            &original_child_metadata,
        );

        let output = run_linux_cleanup_script(&app_image, &args);
        assert!(!output.status.success());
        assert_eq!(fs::read(&sentinel).unwrap(), b"keep");
        assert!(moved_original.is_dir());
        assert!(!moved_original.join("must-survive.txt").exists());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_cleanup_script_rejects_replaced_parent_directory() {
        let temp = TestDirectory::new();
        let data_parent = temp.path().join("data");
        fs::create_dir(&data_parent).unwrap();
        let app_data = data_parent.join(APP_IDENTIFIER);
        fs::create_dir(&app_data).unwrap();
        fs::write(app_data.join("original.txt"), b"original").unwrap();
        let original_parent_metadata = fs::symlink_metadata(&data_parent).unwrap();
        let original_child_metadata = fs::symlink_metadata(&app_data).unwrap();

        let moved_parent = temp.path().join("data-original");
        fs::rename(&data_parent, &moved_parent).unwrap();
        fs::create_dir(&data_parent).unwrap();
        let replacement = data_parent.join(APP_IDENTIFIER);
        fs::create_dir(&replacement).unwrap();
        let sentinel = replacement.join("must-survive.txt");
        fs::write(&sentinel, b"keep").unwrap();

        let app_image = temp.path().join("DexDeck-test.AppImage");
        fs::write(&app_image, b"test image").unwrap();
        let mut args = Vec::new();
        append_cleanup_entry(
            &mut args,
            &data_parent,
            APP_IDENTIFIER,
            &original_parent_metadata,
            &original_child_metadata,
        );

        let output = run_linux_cleanup_script(&app_image, &args);
        assert!(!output.status.success());
        assert_eq!(fs::read(&sentinel).unwrap(), b"keep");
        assert!(moved_parent.join(APP_IDENTIFIER).join("original.txt").exists());
    }

}
