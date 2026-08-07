#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_note(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_note(path: String) -> Result<(), String> {
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
fn rename_path(from: String, to: String) -> Result<(), String> {
    let to = std::path::PathBuf::from(to);

    if to.exists() {
        return Err(format!("{} already exists", to.display()));
    }

    std::fs::rename(from, to).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);

    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        std::fs::remove_file(path).map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn search_notes(root: String, query: String) -> Result<Vec<String>, String> {
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

/// Never overwrite an existing asset: `shot.png` becomes `shot-1.png`.
fn unique_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    // Only the file name part is trusted: a caller-supplied name must not walk out of `dir`.
    let name = std::path::Path::new(name)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let (stem, extension) = match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() => (stem.to_string(), format!(".{extension}")),
        _ => (name.clone(), String::new()),
    };

    let mut candidate = dir.join(&name);
    let mut index = 1;

    while candidate.exists() {
        candidate = dir.join(format!("{stem}-{index}{extension}"));
        index += 1;
    }

    candidate
}

fn asset_path(dir: &str, name: &str) -> Result<std::path::PathBuf, String> {
    let dir = std::path::PathBuf::from(dir);

    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    Ok(unique_path(&dir, name))
}

/// Absolute path of the stored asset, `/`-separated.
#[tauri::command]
fn write_asset(dir: String, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let target = asset_path(&dir, &name)?;

    std::fs::write(&target, bytes).map_err(|error| error.to_string())?;

    Ok(target.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn copy_asset(dir: String, source: String) -> Result<String, String> {
    let source = std::path::PathBuf::from(source);
    let name = source.file_name().unwrap_or_default().to_string_lossy().to_string();
    let target = asset_path(&dir, &name)?;

    std::fs::copy(&source, &target).map_err(|error| error.to_string())?;

    Ok(target.to_string_lossy().replace('\\', "/"))
}

/// Markdown links percent-encode names, so the notes are decoded before they are searched.
fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        let decoded = (bytes[index] == b'%' && index + 2 < bytes.len())
            .then(|| u8::from_str_radix(&text[index + 1..index + 3], 16).ok())
            .flatten();

        match decoded {
            Some(byte) => {
                out.push(byte);
                index += 3;
            }
            None => {
                out.push(bytes[index]);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&out).to_string()
}

fn note_text(dir: &std::path::Path, text: &mut String) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        if name.starts_with('.') || name == "assets" || entry.file_type()?.is_symlink() {
            continue;
        }

        if path.is_dir() {
            note_text(&path, text)?;
            continue;
        }

        let extension = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();

        if NOTE_EXTENSIONS.contains(&extension.as_str()) {
            text.push_str(&std::fs::read_to_string(&path)?);
            text.push('\n');
        }
    }

    Ok(())
}

fn prune_dir(dir: &std::path::Path, notes: &str, removed: &mut usize) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            prune_dir(&path, notes, removed)?;
            continue;
        }

        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Matching on the file name keeps this cheap and errs towards keeping a file.
        if !notes.contains(&name) {
            std::fs::remove_file(&path)?;
            *removed += 1;
        }
    }

    Ok(())
}

/// Delete files under `<dir>/assets` that no note in `dir` links to any more.
#[tauri::command]
fn prune_assets(dir: String) -> Result<usize, String> {
    let dir = std::path::PathBuf::from(dir);
    let assets = dir.join("assets");

    if !assets.is_dir() {
        return Ok(0);
    }

    let mut notes = String::new();
    let mut removed = 0;

    note_text(&dir, &mut notes).map_err(|error| error.to_string())?;
    prune_dir(&assets, &percent_decode(&notes), &mut removed).map_err(|error| error.to_string())?;

    Ok(removed)
}

const NOTE_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];

/// Relative paths of every note under the space root, `/`-separated.
#[tauri::command]
fn list_space(root: String) -> Result<Vec<String>, String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_note,
            write_note,
            list_space,
            create_note,
            rename_path,
            delete_path,
            search_notes,
            write_asset,
            copy_asset,
            prune_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_percent_escapes() {
        assert_eq!(percent_decode("a%20b.png"), "a b.png");
        assert_eq!(percent_decode("caf%C3%A9.png"), "café.png");
        assert_eq!(percent_decode("100%"), "100%");
    }

    #[test]
    fn unique_path_avoids_collisions_and_escapes() {
        let dir = std::env::temp_dir().join("memosmith-unique-test");
        std::fs::create_dir_all(&dir).unwrap();
        let first = unique_path(&dir, "../shot.png");
        assert_eq!(first, dir.join("shot.png"));
        std::fs::write(&first, "x").unwrap();
        assert_eq!(unique_path(&dir, "shot.png"), dir.join("shot-1.png"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
