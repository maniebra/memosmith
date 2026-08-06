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
        if name.starts_with('.') || entry.file_type()?.is_symlink() {
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
            delete_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
