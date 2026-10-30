use std::path::Path;

use pelite::resources::version_info::{Language, VersionInfo};
use pelite::{FileMap, PeFile};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutableMetadata {
    pub name: String,
    pub version: Option<String>,
    pub company_name: Option<String>,
    pub description: Option<String>,
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().trim_matches('\0').trim().to_string())
        .filter(|text| !text.is_empty())
}

fn read_value(
    info: VersionInfo<'_>,
    languages: &[Language],
    keys: &[&str],
) -> Option<String> {
    // Prefer the desired property across language tables instead of taking a
    // lower-priority property from the first language.
    keys.iter().find_map(|key| {
        languages
            .iter()
            .find_map(|language| non_empty(info.value(*language, key)))
    })
}

fn fallback_version(info: VersionInfo<'_>) -> Option<String> {
    let fixed = info.fixed()?;
    let version = fixed.dwProductVersion;

    if version.Major == 0 && version.Minor == 0 && version.Patch == 0 && version.Build == 0 {
        return None;
    }

    Some(format!(
        "{}.{}.{}.{}",
        version.Major, version.Minor, version.Patch, version.Build
    ))
}

/// Reads the version resources embedded in Windows PE executables (.exe).
/// If the executable has no version resource, the caller still receives a
/// filename-based name so the game can be added without blocking the user.
#[tauri::command]
pub fn inspect_game_executable(executable_path: String) -> Result<ExecutableMetadata, String> {
    let path = Path::new(executable_path.trim());
    if !path.is_file() {
        return Err("El archivo seleccionado ya no existe o no es un archivo válido.".to_string());
    }

    let fallback_name = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(str::trim)
        .filter(|stem| !stem.is_empty())
        .unwrap_or("Juego nuevo")
        .to_string();

    let mut metadata = ExecutableMetadata {
        name: fallback_name,
        version: None,
        company_name: None,
        description: None,
    };

    let is_windows_executable = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("exe"))
        .unwrap_or(false);

    if !is_windows_executable {
        return Ok(metadata);
    }

    // Unusual or non-PE .exe files should not prevent adding the game.
    let file_map = match FileMap::open(path) {
        Ok(file_map) => file_map,
        Err(_) => return Ok(metadata),
    };
    let image = match PeFile::from_bytes(file_map.as_ref()) {
        Ok(image) => image,
        Err(_) => return Ok(metadata),
    };
    let resources = match image.resources() {
        Ok(resources) => resources,
        Err(_) => return Ok(metadata),
    };
    let info = match resources.version_info() {
        Ok(info) => info,
        Err(_) => return Ok(metadata),
    };

    let mut languages = info.translation().to_vec();
    // Some executables omit VarFileInfo/Translation but still contain the
    // common en-US Unicode or Windows-1252 string table.
    for language in [
        Language { lang_id: 0x0409, charset_id: 0x04B0 },
        Language { lang_id: 0x0409, charset_id: 0x04E4 },
    ] {
        if !languages.contains(&language) {
            languages.push(language);
        }
    }

    if let Some(name) = read_value(info, &languages, &["ProductName", "FileDescription", "InternalName"]) {
        metadata.name = name;
    }
    metadata.description = read_value(info, &languages, &["FileDescription", "Comments"]);
    metadata.company_name = read_value(info, &languages, &["CompanyName"]);
    metadata.version = read_value(info, &languages, &["ProductVersion", "FileVersion"])
        .or_else(|| fallback_version(info));

    Ok(metadata)
}
