pub mod assets;
pub mod notes;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            notes::read_note,
            notes::write_note,
            notes::list_space,
            notes::create_note,
            notes::rename_path,
            notes::delete_path,
            notes::search_notes,
            assets::write_asset,
            assets::copy_asset,
            assets::prune_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
