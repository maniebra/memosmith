//! A right click inside an embedded player (a cross-origin iframe) never
//! reaches the page, so the webview would show its own menu there. On Linux
//! the webview reports it instead; the page opens the editor's menu at that
//! point. The page cancels `contextmenu` itself, so only frames get here.

use tauri::{Emitter, Manager};

#[derive(Clone, serde::Serialize)]
struct FramePoint {
    x: f64,
    y: f64,
}

pub fn install(app: &tauri::App) {
    #[cfg(target_os = "linux")]
    for window in app.webview_windows().into_values() {
        let emitter = window.clone();
        let _ = window.with_webview(move |platform| {
            use webkit2gtk::WebViewExt;
            let emitter = emitter.clone();
            platform
                .inner()
                .connect_context_menu(move |view, _, event, _| {
                    if let Some((x, y)) = event.coords() {
                        // Widget coordinates are scaled by the page zoom; the page wants CSS pixels.
                        let zoom = view.zoom_level().max(0.01);
                        let _ = emitter.emit(
                            "frame-context-menu",
                            FramePoint { x: x / zoom, y: y / zoom },
                        );
                    }
                    true
                });
        });
    }
    // ponytail: Linux only; macOS/Windows still show the native menu inside players.
    #[cfg(not(target_os = "linux"))]
    let _ = app;
}
