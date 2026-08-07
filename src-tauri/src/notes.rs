use crate::utils::NOTE_EXTENSIONS;

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
