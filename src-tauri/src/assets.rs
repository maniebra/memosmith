use crate::utils::{percent_decode, NOTE_EXTENSIONS};

/// Absolute path of the stored asset, `/`-separated.
#[tauri::command]
pub fn write_asset(dir: String, name: String, bytes: Vec<u8>) -> Result<String, String> {
    let target = asset_path(&dir, &name)?;

    std::fs::write(&target, bytes).map_err(|error| error.to_string())?;

    Ok(target.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn copy_asset(dir: String, source: String) -> Result<String, String> {
    let source = std::path::PathBuf::from(source);
    let name = source.file_name().unwrap_or_default().to_string_lossy().to_string();
    let target = asset_path(&dir, &name)?;

    std::fs::copy(&source, &target).map_err(|error| error.to_string())?;

    Ok(target.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn prune_assets(dir: String) -> Result<usize, String> {
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

/// Never overwrite an existing asset: `shot.png` becomes `shot-1.png`.
pub fn unique_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
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
