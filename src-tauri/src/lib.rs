pub mod assets;
pub mod databases;
pub mod frame_menu;
pub mod lsp;
pub mod notes;
pub mod pdf;
pub mod plantuml;
pub mod runner;
pub mod utils;
pub mod youtube;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's JSC rejects the relaxed-SIMD wasm that pdf.js uses to decode
    // JPEG 2000 images unless this is switched on.
    std::env::set_var("JSC_useWasmRelaxedSIMD", "1");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            frame_menu::install(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notes::read_note,
            notes::read_binary,
            notes::write_note,
            notes::append_log,
            notes::list_space,
            notes::list_templates,
            notes::list_all_templates,
            notes::create_note,
            notes::rename_path,
            notes::delete_path,
            notes::search_notes,
            notes::load_space_meta,
            notes::save_page_meta,
            notes::save_space_meta,
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
            databases::delete_database_table,
            databases::delete_database_row,
            databases::delete_database,
            runner::run_code,
            runner::reset_session,
            runner::detect_runtimes,
            lsp::lsp_complete,
            lsp::reset_language_servers,
            lsp::detect_language_servers,
            plantuml::render_plantuml,
            pdf::export_pdf,
            youtube::youtube_port,
            youtube::youtube_decodable
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
