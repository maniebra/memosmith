/// Page layout for an export. Sizes are in millimetres.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfOptions {
    /// A GTK paper name such as `iso_a4` or `na_letter`.
    pub paper: String,
    pub landscape: bool,
    pub margin: f64,
    /// The title, pre-rendered by the webview as an alpha mask so any script and font prints
    /// right: PDF base fonts only cover Latin.
    pub header: Option<TextMask>,
    pub page_numbers: bool,
}

#[derive(serde::Deserialize)]
pub struct TextMask {
    pub width: u32,
    pub height: u32,
    /// One alpha byte per pixel, row by row.
    pub alpha: Vec<u8>,
    /// Height on the page, in millimetres.
    pub size: f64,
}

/// Room the header and footer need inside the page margin.
#[cfg(target_os = "linux")]
const BAND_MM: f64 = 12.0;

/// Headless PDF export: WebKit prints the live webview straight to a file, so the PDF
/// contains exactly what the print stylesheet leaves on screen — no second renderer,
/// no dialog. Linux only; other platforms fall back to the browser print dialog.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn export_pdf(
    webview: tauri::Webview,
    path: String,
    options: PdfOptions,
) -> Result<String, String> {
    use webkit2gtk::PrintOperationExt;

    // Without this, a stale file from an earlier export would pass the existence check below.
    match std::fs::remove_file(&path) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => return Err(error.to_string()),
        _ => {}
    }

    // Spaces, `#` and non-ASCII names must be percent-encoded in the output URI.
    let uri = gtk::glib::filename_to_uri(&path, None).map_err(|error| error.to_string())?;
    let (sender, receiver) = std::sync::mpsc::channel::<Result<(), String>>();
    let paper = options.paper.clone();
    let landscape = options.landscape;
    let top = if options.header.is_some() {
        options.margin.max(BAND_MM)
    } else {
        options.margin
    };
    let bottom = if options.page_numbers {
        options.margin.max(BAND_MM)
    } else {
        options.margin
    };
    let side = options.margin;

    webview
        .with_webview(move |platform| {
            let operation = webkit2gtk::PrintOperation::new(&platform.inner());
            let settings = gtk::PrintSettings::new();

            // The "Print to File" backend is what turns a print job into a PDF on disk.
            settings.set_printer("Print to File");
            settings.set("output-uri", Some(uri.as_str()));
            settings.set("output-file-format", Some("pdf"));
            operation.set_print_settings(&settings);

            let page = gtk::PageSetup::new();
            page.set_paper_size(&gtk::PaperSize::new(Some(&paper)));
            page.set_orientation(if landscape {
                gtk::PageOrientation::Landscape
            } else {
                gtk::PageOrientation::Portrait
            });
            page.set_top_margin(top, gtk::Unit::Mm);
            page.set_bottom_margin(bottom, gtk::Unit::Mm);
            page.set_left_margin(side, gtk::Unit::Mm);
            page.set_right_margin(side, gtk::Unit::Mm);
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

    // WebKitGTK ignores CSS page-margin boxes, so running headers and page numbers are
    // stamped onto the finished file instead.
    if options.header.is_some() || options.page_numbers {
        let target = path.clone();
        tauri::async_runtime::spawn_blocking(move || stamp(&target, &options, top, bottom))
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| format!("The PDF was saved without header or footer: {error}"))?;
    }

    Ok(path)
}

#[cfg(target_os = "linux")]
fn stamp(path: &str, options: &PdfOptions, top: f64, bottom: f64) -> Result<(), lopdf::Error> {
    use lopdf::{dictionary, Document, Object, Stream};

    const PT_PER_MM: f64 = 72.0 / 25.4;
    // stone-500, the app's muted text colour.
    const GRAY: f64 = 0.47;

    let mut doc = Document::load(path)?;
    let pages = doc.get_pages();
    let total = pages.len();

    let font = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });

    let header = match &options.header {
        Some(mask) if mask.alpha.len() == (mask.width * mask.height) as usize => {
            let mut alpha = Stream::new(
                dictionary! {
                    "Type" => "XObject",
                    "Subtype" => "Image",
                    "Width" => mask.width,
                    "Height" => mask.height,
                    "ColorSpace" => "DeviceGray",
                    "BitsPerComponent" => 8,
                },
                mask.alpha.clone(),
            );
            let _ = alpha.compress();
            let alpha = doc.add_object(alpha);
            let mut image = Stream::new(
                dictionary! {
                    "Type" => "XObject",
                    "Subtype" => "Image",
                    "Width" => mask.width,
                    "Height" => mask.height,
                    "ColorSpace" => "DeviceGray",
                    "BitsPerComponent" => 8,
                    "SMask" => alpha,
                },
                vec![(GRAY * 255.0) as u8; mask.alpha.len()],
            );
            let _ = image.compress();
            let height = mask.size * PT_PER_MM;
            Some((
                doc.add_object(image),
                height * mask.width as f64 / mask.height as f64,
                height,
            ))
        }
        _ => None,
    };

    for (number, page_id) in pages {
        let (width, height) = page_size(&doc, page_id).unwrap_or((595.0, 842.0));
        // The original drawing is wrapped so its leftover graphics state cannot skew the stamp.
        let mut content = b"q\n".to_vec();
        content.extend(doc.get_page_content(page_id));
        content.extend(b"\nQ\n");

        if let Some((image, w, h)) = header {
            // Centred in the top margin, scaled down if the title is wider than the page.
            let scale = (width * 0.8 / w).min(1.0);
            let (w, h) = (w * scale, h * scale);
            let x = (width - w) / 2.0;
            let y = height - top * PT_PER_MM / 2.0 - h / 2.0;
            content
                .extend(format!("q {w:.2} 0 0 {h:.2} {x:.2} {y:.2} cm /MsHeader Do Q\n").bytes());
            doc.add_xobject(page_id, "MsHeader", image)?;
        }

        if options.page_numbers {
            let label = format!("{number} / {total}");
            // Helvetica digits are 0.556 em wide; the separator is close enough.
            let text_width = label.len() as f64 * 0.556 * 9.0;
            let x = (width - text_width) / 2.0;
            let y = bottom * PT_PER_MM / 2.0 - 3.0;
            content.extend(
                format!("q BT {GRAY} g /MsFont 9 Tf {x:.2} {y:.2} Td ({label}) Tj ET Q\n").bytes(),
            );
            let resources = doc.get_or_create_resources(page_id)?.as_dict_mut()?;
            if !resources.has(b"Font") {
                resources.set("Font", lopdf::Dictionary::new());
            }
            if let Ok(fonts) = resources.get_mut(b"Font").and_then(Object::as_dict_mut) {
                fonts.set("MsFont", font);
            }
        }

        doc.change_page_content(page_id, content)?;
    }

    doc.compress();
    doc.save(path)?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn page_size(doc: &lopdf::Document, page_id: lopdf::ObjectId) -> Option<(f64, f64)> {
    let page = doc.get_dictionary(page_id).ok()?;
    let media = page.get(b"MediaBox").ok()?.as_array().ok()?;
    let value = |index: usize| media.get(index)?.as_float().ok().map(f64::from);

    Some((value(2)? - value(0)?, value(3)? - value(1)?))
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use lopdf::{dictionary, Document, Object, Stream};

    #[test]
    fn stamps_header_and_page_numbers_on_every_page() {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let kids: Vec<Object> = (0..2)
            .map(|_| {
                let content =
                    doc.add_object(Stream::new(dictionary! {}, b"0 0 m 10 10 l S".to_vec()));
                doc.add_object(dictionary! {
                    "Type" => "Page",
                    "Parent" => pages_id,
                    "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
                    "Contents" => content,
                    "Resources" => dictionary! {},
                })
                .into()
            })
            .collect();
        doc.objects.insert(
            pages_id,
            dictionary! { "Type" => "Pages", "Kids" => kids, "Count" => 2 }.into(),
        );
        let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
        doc.trailer.set("Root", catalog);

        let path = std::env::temp_dir().join(format!("ms-stamp-{}.pdf", std::process::id()));
        doc.save(&path).unwrap();

        let options = PdfOptions {
            paper: "iso_a4".into(),
            landscape: false,
            margin: 10.0,
            header: Some(TextMask {
                width: 2,
                height: 1,
                alpha: vec![255, 0],
                size: 4.0,
            }),
            page_numbers: true,
        };
        stamp(path.to_str().unwrap(), &options, 12.0, 12.0).unwrap();

        let stamped = Document::load(&path).unwrap();
        for (number, page_id) in stamped.get_pages() {
            let content = String::from_utf8_lossy(&stamped.get_page_content(page_id)).into_owned();
            assert!(content.contains("0 0 m 10 10 l S"), "original drawing kept");
            assert!(
                content.contains(&format!("({number} / 2) Tj")),
                "page number on page {number}"
            );
            assert!(content.contains("/MsHeader Do"), "header on page {number}");
        }
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn export_pdf(
    _webview: tauri::Webview,
    _path: String,
    _options: PdfOptions,
) -> Result<String, String> {
    Err("unsupported".into())
}
