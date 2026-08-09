/// Headless PDF export: WebKit prints the live webview straight to a file, so the PDF
/// contains exactly what the print stylesheet leaves on screen — no second renderer,
/// no dialog. Linux only; other platforms fall back to the browser print dialog.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn export_pdf(webview: tauri::Webview, path: String) -> Result<String, String> {
    use webkit2gtk::PrintOperationExt;

    let (sender, receiver) = std::sync::mpsc::channel::<Result<(), String>>();
    let target = path.clone();

    webview
        .with_webview(move |platform| {
            let operation = webkit2gtk::PrintOperation::new(&platform.inner());
            let settings = gtk::PrintSettings::new();

            // The "Print to File" backend is what turns a print job into a PDF on disk.
            settings.set_printer("Print to File");
            settings.set("output-uri", Some(&format!("file://{target}")));
            settings.set("output-file-format", Some("pdf"));
            operation.set_print_settings(&settings);

            let page = gtk::PageSetup::new();
            page.set_orientation(gtk::PageOrientation::Portrait);
            operation.set_page_setup(&page);

            let done = sender.clone();
            operation.connect_finished(move |_| {
                let _ = done.send(Ok(()));
            });
            let failed = sender.clone();
            operation.connect_failed(move |_, error| {
                let _ = failed.send(Err(error.to_string()));
            });

            operation.print();
        })
        .map_err(|error| error.to_string())?;

    // The print runs on the GTK main loop, so the command waits off it for the signal.
    tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "The PDF export timed out.".to_string())?
    })
    .await
    .map_err(|error| error.to_string())??;

    // A print job can report success while writing nothing, typically when GTK could not match
    // the file printer and fell back to a real one.
    if !std::path::Path::new(&path).is_file() {
        return Err(format!(
            "The print job wrote no file to {path}. Use the print dialog and pick \"Print to File\"."
        ));
    }

    Ok(path)
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn export_pdf(_webview: tauri::Webview, _path: String) -> Result<String, String> {
    Err("unsupported".into())
}
