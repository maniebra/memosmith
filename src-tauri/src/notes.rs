use crate::utils::NOTE_EXTENSIONS;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const META_FOLDER: &str = ".memosmith";
const PAGE_META_FILE: &str = "page-meta.json";

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct PageIcon {
    #[serde(rename = "type")]
    pub kind: String,
    pub value: String,
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct PageMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<PageIcon>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,
    /// Vertical focus of the cover crop, 0 (top) to 100 (bottom).
    #[serde(rename = "coverPosition", skip_serializing_if = "Option::is_none")]
    pub cover_position: Option<f64>,
    /// Manual sibling position set by drag and drop; unset means sort by name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<f64>,
}

pub type SpaceMeta = BTreeMap<String, PageMeta>;

#[tauri::command]
pub fn read_note(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_note(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_note(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);

    if path.exists() {
        return Err(format!("{} already exists", path.display()));
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(path, "").map_err(|error| error.to_string())
}

#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<(), String> {
    let to = std::path::PathBuf::from(to);

    if to.exists() {
        return Err(format!("{} already exists", to.display()));
    }

    std::fs::rename(from, to).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);

    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        std::fs::remove_file(path).map_err(|error| error.to_string())
    }
}

#[tauri::command]
pub fn search_notes(root: String, query: String) -> Result<Vec<String>, String> {
    let root = std::path::PathBuf::from(root);
    let query = query.to_lowercase();
    let mut matches = Vec::new();

    if !root.is_dir() {
        return Err("Root path is not a directory".to_string());
    }

    fn search_recursive(
        dir: &std::path::Path,
        root: &std::path::Path,
        query: &str,
        matches: &mut Vec<String>,
    ) -> std::io::Result<()> {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            if name.starts_with('.') || name == "assets" || entry.file_type()?.is_symlink() {
                continue;
            }

            if path.is_dir() {
                search_recursive(&path, root, query, matches)?;
                continue;
            }

            let extension = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
            if NOTE_EXTENSIONS.contains(&extension.as_str()) {
                let matches_name = name.to_lowercase().contains(query);
                let matches_content = if let Ok(content) = std::fs::read_to_string(&path) {
                    content.to_lowercase().contains(query)
                } else {
                    false
                };

                if matches_name || matches_content {
                    if let Ok(relative) = path.strip_prefix(root) {
                        matches.push(relative.to_string_lossy().replace('\\', "/"));
                    }
                }
            }
        }
        Ok(())
    }

    search_recursive(&root, &root, &query, &mut matches).map_err(|e| e.to_string())?;
    matches.sort();
    Ok(matches)
}

#[tauri::command]
pub fn load_space_meta(root: String) -> Result<SpaceMeta, String> {
    read_space_meta(&std::path::PathBuf::from(root))
}

#[tauri::command]
pub fn save_page_meta(root: String, path: String, meta: PageMeta) -> Result<(), String> {
    let root = std::path::PathBuf::from(root);
    let mut space_meta = read_space_meta(&root)?;

    if meta.icon.is_none() && meta.cover.is_none() && meta.order.is_none() {
        space_meta.remove(&path);
    } else {
        space_meta.insert(path, meta);
    }

    write_space_meta(&root, &space_meta)
}

#[tauri::command]
pub fn save_space_meta(root: String, meta: SpaceMeta) -> Result<(), String> {
    write_space_meta(&std::path::PathBuf::from(root), &meta)
}

#[tauri::command]
pub fn rename_page_meta(root: String, from: String, to: String, folder: bool) -> Result<(), String> {
    let root = std::path::PathBuf::from(root);
    let space_meta = read_space_meta(&root)?;
    let mut next_meta = SpaceMeta::new();
    let prefix = format!("{from}/");

    for (key, value) in space_meta {
        if key == from {
            next_meta.insert(to.clone(), value);
        } else if folder && key.starts_with(&prefix) {
            next_meta.insert(format!("{to}/{}", &key[prefix.len()..]), value);
        } else {
            next_meta.insert(key, value);
        }
    }

    write_space_meta(&root, &next_meta)
}

#[tauri::command]
pub fn delete_page_meta(root: String, path: String, folder: bool) -> Result<(), String> {
    let root = std::path::PathBuf::from(root);
    let space_meta = read_space_meta(&root)?;
    let prefix = format!("{path}/");
    let next_meta = space_meta
        .into_iter()
        .filter(|(key, _)| key != &path && !(folder && key.starts_with(&prefix)))
        .collect();

    write_space_meta(&root, &next_meta)
}

#[tauri::command]
pub fn list_space(root: String) -> Result<Vec<String>, String> {
    let root = std::path::PathBuf::from(root);
    let mut notes = Vec::new();

    collect_notes(&root, &root, &mut notes).map_err(|error| error.to_string())?;
    notes.sort();

    Ok(notes)
}

fn collect_notes(
    root: &std::path::Path,
    dir: &std::path::Path,
    notes: &mut Vec<String>,
) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Symlinks are skipped so a loop cannot make this recursion run forever.
        // `assets` holds note media, not notes, so it stays out of the sidebar.
        if name.starts_with('.') || name == "assets" || entry.file_type()?.is_symlink() {
            continue;
        }

        if path.is_dir() {
            collect_notes(root, &path, notes)?;
            continue;
        }

        let extension = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();

        if NOTE_EXTENSIONS.contains(&extension.as_str()) {
            if let Ok(relative) = path.strip_prefix(root) {
                notes.push(relative.to_string_lossy().replace('\\', "/"));
            }
        }
    }

    Ok(())
}

fn page_meta_path(root: &std::path::Path) -> std::path::PathBuf {
    root.join(META_FOLDER).join(PAGE_META_FILE)
}

fn read_space_meta(root: &std::path::Path) -> Result<SpaceMeta, String> {
    let path = page_meta_path(root);

    if !path.exists() {
        return Ok(SpaceMeta::new());
    }

    let raw = std::fs::read_to_string(path).map_err(|error| error.to_string())?;

    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn write_space_meta(root: &std::path::Path, meta: &SpaceMeta) -> Result<(), String> {
    let path = page_meta_path(root);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let raw = serde_json::to_string_pretty(meta).map_err(|error| error.to_string())?;

    std::fs::write(path, raw).map_err(|error| error.to_string())
}
