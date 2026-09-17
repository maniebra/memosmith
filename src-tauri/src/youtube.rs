//! YouTube's embedded player refuses to play without an HTTP `Referer`
//! (error 153), and the webview sends none from the app's `tauri://` origin.
//! A loopback server hands out a wrapper page, so the player is framed from
//! `http://127.0.0.1:<port>` and gets a referrer it accepts.

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::OnceLock;

static PORT: OnceLock<u16> = OnceLock::new();

/// Starts the server on first use and returns its port.
#[tauri::command]
pub fn youtube_port() -> Result<u16, String> {
    if let Some(port) = PORT.get() {
        return Ok(*port);
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || serve(stream));
        }
    });
    Ok(*PORT.get_or_init(|| port))
}

fn serve(mut stream: TcpStream) {
    let mut line = String::new();
    if BufReader::new(&stream).read_line(&mut line).is_err() {
        return;
    }
    let path = line.split_whitespace().nth(1).unwrap_or("");
    let (status, body) = match embed_page(path) {
        Some(page) => ("200 OK", page),
        None => ("404 Not Found", String::new()),
    };
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nReferrer-Policy: strict-origin-when-cross-origin\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
}

/// Whether the webview can decode YouTube's streams. WebKitGTK plays media
/// through GStreamer and claims support for formats it has no decoder for,
/// so the registry is asked directly. Other platforms bring their own codecs.
#[tauri::command]
pub fn youtube_decodable() -> bool {
    if !cfg!(target_os = "linux") {
        return true;
    }
    // Software decoders only: hardware ones (`vp9dec`, `vah264dec`) register
    // even when the driver cannot run them, and YouTube then fails anyway.
    let decoders = ["avdec_h264", "openh264dec", "vpxdec", "dav1ddec", "av1dec"];
    decoders.iter().any(|name| {
        std::process::Command::new("gst-inspect-1.0")
            .args(["--exists", name])
            .status()
            // Without the inspector there is nothing to go on; let the player try.
            .map_or(true, |status| status.success())
    })
}

/// The wrapper for `/embed/<id>?start=<seconds>`; anything else is refused.
pub fn embed_page(path: &str) -> Option<String> {
    let rest = path.strip_prefix("/embed/")?;
    let (id, query) = rest.split_once('?').unwrap_or((rest, ""));
    let valid_id = id.len() == 11
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !valid_id {
        return None;
    }
    let start = query
        .strip_prefix("start=")
        .filter(|value| !value.is_empty() && value.chars().all(|c| c.is_ascii_digit()))
        .map(|value| format!("&start={value}"))
        .unwrap_or_default();
    Some(format!(
        "<!doctype html><html><head><meta name=\"referrer\" content=\"strict-origin-when-cross-origin\"><style>html,body{{margin:0;height:100%;background:#000}}iframe{{border:0;width:100%;height:100%}}</style></head><body><iframe src=\"https://www.youtube-nocookie.com/embed/{id}?playsinline=1{start}\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe></body></html>"
    ))
}
