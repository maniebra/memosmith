//! Loopback streaming source for the in-app media player.
//!
//! WebKitGTK plays media through GStreamer, which fetches the URL outside the
//! webview: custom schemes such as `asset://` never reach it, so a video sits
//! black. GStreamer does speak HTTP, so media is served from a loopback
//! server, the same trick `youtube.rs` uses to give the embed a referrer.
//! Ranges are answered with `206`, without which the pipeline cannot seek.

use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::OnceLock;

static SERVER: OnceLock<(u16, String)> = OnceLock::new();

/// Bytes per response to an open-ended range: enough to keep the pipeline
/// fed, small enough that seeking around a large file stays cheap.
const CHUNK: u64 = 4 * 1024 * 1024;

/// The URL the player should load `path` from, starting the server once.
#[tauri::command]
pub fn media_url(path: String) -> Result<String, String> {
    if !std::path::Path::new(&path).is_file() {
        return Err(format!("no such file: {path}"));
    }

    let (port, token) = server()?;

    Ok(format!("http://127.0.0.1:{port}/{token}{}", encode(&path)))
}

fn server() -> Result<&'static (u16, String), String> {
    if let Some(running) = SERVER.get() {
        return Ok(running);
    }

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    // Anything else on the loopback interface can reach this port, so a
    // per-run secret keeps the served file list to what the app asked for.
    let token = format!(
        "{:x}{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |since| since.as_nanos() as u64),
        u64::from(std::process::id()) ^ (&listener as *const TcpListener as u64),
    );

    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || serve(stream));
        }
    });

    Ok(SERVER.get_or_init(|| (port, token)))
}

fn serve(mut stream: TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(clone) => clone,
        Err(_) => return,
    });
    let mut request = String::new();

    if reader.read_line(&mut request).is_err() {
        return;
    }

    let mut range = None;
    let mut header = String::new();

    while reader.read_line(&mut header).unwrap_or(0) > 0 {
        if header.trim().is_empty() {
            break;
        }

        if let Some(value) = header.to_ascii_lowercase().strip_prefix("range:") {
            range = parse_range(value.trim());
        }

        header.clear();
    }

    let target = request.split_whitespace().nth(1).unwrap_or("");
    let Some((_, token)) = SERVER.get() else {
        return;
    };
    let Some(rest) = target.strip_prefix(&format!("/{token}")) else {
        let _ = write!(stream, "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
        return;
    };

    if send(&mut stream, &decode(rest), range).is_err() {
        // A closed pipe is the player seeking or the tab going away.
    }
}

fn send(
    stream: &mut TcpStream,
    path: &str,
    range: Option<(u64, Option<u64>)>,
) -> std::io::Result<()> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(_) => {
            return write!(stream, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
        }
    };
    let total = file.metadata()?.len();
    let mime = mime_type(path);

    let (status, start, last) = match range {
        Some((start, _)) if start >= total => {
            return write!(
                stream,
                "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{total}\r\n\
                 Content-Length: 0\r\n\r\n"
            );
        }
        // An open-ended range gets one chunk, so a seek stays cheap.
        Some((start, end)) => (
            "206 Partial Content",
            start,
            end.unwrap_or(start + CHUNK - 1).min(total.saturating_sub(1)),
        ),
        None => ("200 OK", 0, total.saturating_sub(1)),
    };
    let length = last + 1 - start;

    write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nAccept-Ranges: bytes\r\n\
         Content-Length: {length}\r\n"
    )?;

    if status.starts_with("206") {
        write!(stream, "Content-Range: bytes {start}-{last}/{total}\r\n")?;
    }

    write!(stream, "Connection: close\r\n\r\n")?;
    file.seek(SeekFrom::Start(start))?;

    // Copied in steps, so a full-file response never sits in memory.
    let mut left = length;
    let mut buffer = vec![0; 64 * 1024];

    while left > 0 {
        let want = buffer.len().min(left as usize);
        let read = file.read(&mut buffer[..want])?;

        if read == 0 {
            break;
        }

        stream.write_all(&buffer[..read])?;
        left -= read as u64;
    }

    stream.flush()
}

/// `bytes=START-END`, where the end is optional. Multi-range is not served.
fn parse_range(value: &str) -> Option<(u64, Option<u64>)> {
    let (start, end) = value.strip_prefix("bytes=")?.split_once('-')?;
    let end = end.trim();

    Some((
        start.trim().parse().ok()?,
        if end.is_empty() {
            None
        } else {
            Some(end.parse().ok()?)
        },
    ))
}

/// Percent-encoding for the path segment; the player sends it back as is.
fn encode(path: &str) -> String {
    path.bytes()
        .map(|byte| match byte {
            b'/' => "/".to_string(),
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect()
}

fn decode(path: &str) -> String {
    let bytes = path.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or("");

                match u8::from_str_radix(hex, 16) {
                    Ok(byte) => {
                        out.push(byte);
                        index += 3;
                    }
                    Err(_) => {
                        out.push(bytes[index]);
                        index += 1;
                    }
                }
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&out).into_owned()
}

fn mime_type(path: &str) -> &'static str {
    let extension = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();

    match extension.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_escaped_paths() {
        let path = "/a/2. Nondeterminism [oNsscmUwjMU].webm";

        assert_eq!(decode(&encode(path)), path);
        assert!(encode(path).contains("%20"));
    }

    #[test]
    fn parses_ranges() {
        assert_eq!(parse_range("bytes=0-499"), Some((0, Some(499))));
        assert_eq!(parse_range("bytes=500-"), Some((500, None)));
        assert_eq!(parse_range("junk"), None);
    }

    #[test]
    fn serves_whole_files_and_ranges() {
        let path = std::env::temp_dir().join("memosmith-media-test.mp4");
        std::fs::write(&path, b"0123456789").unwrap();

        let url = media_url(path.to_string_lossy().into_owned()).unwrap();
        let body = |range: Option<&str>| {
            let mut socket = TcpStream::connect(url.split('/').nth(2).unwrap()).unwrap();
            let target = url.splitn(4, '/').nth(3).unwrap();
            let range = range.map_or(String::new(), |r| format!("Range: {r}\r\n"));

            write!(socket, "GET /{target} HTTP/1.1\r\nHost: x\r\n{range}\r\n").unwrap();

            let mut response = Vec::new();
            socket.read_to_end(&mut response).unwrap();
            String::from_utf8_lossy(&response).into_owned()
        };

        let whole = body(None);
        assert!(whole.starts_with("HTTP/1.1 200 OK"), "{whole}");
        assert!(whole.contains("Accept-Ranges: bytes"));
        assert!(whole.ends_with("0123456789"));

        let part = body(Some("bytes=2-5"));
        assert!(part.starts_with("HTTP/1.1 206"), "{part}");
        assert!(part.contains("Content-Range: bytes 2-5/10"));
        assert!(part.ends_with("2345"));

        let past = body(Some("bytes=99-"));
        assert!(past.starts_with("HTTP/1.1 416"), "{past}");

        std::fs::remove_file(path).ok();
    }
}
