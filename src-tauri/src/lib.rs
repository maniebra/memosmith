pub mod assets;
pub mod databases;
pub mod notes;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            notes::read_note,
            notes::write_note,
            notes::list_space,
            notes::create_note,
            notes::rename_path,
            notes::delete_path,
            notes::search_notes,
            notes::load_space_meta,
            notes::save_page_meta,
            notes::rename_page_meta,
            notes::delete_page_meta,
            assets::write_asset,
            assets::copy_asset,
            assets::prune_assets,
            databases::list_databases,
            databases::create_database,
            databases::load_database,
            databases::save_database_meta,
            databases::save_database_row,
            databases::delete_database_row,
            databases::delete_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
