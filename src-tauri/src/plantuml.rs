use std::io::Write;
use crate::utils::background_command;
use std::process::Stdio;

const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn base64(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let block = chunk.iter().enumerate().fold(0u32, |block, (index, byte)| {
            block | (u32::from(*byte) << (16 - 8 * index))
        });

        for index in 0..4 {
            out.push(if index <= chunk.len() {
                BASE64[(block >> (18 - 6 * index) & 0x3f) as usize] as char
            } else {
                '='
            });
        }
    }

    out
}

/// Renders a diagram with a local PlantUML binary (or a `java -jar plantuml.jar` style command).
/// Server rendering goes over HTTP from the frontend instead, so it never touches this path.
/// SVG and ASCII come back as text; PNG comes back as a `data:` URL.
#[tauri::command]
pub fn render_plantuml(source: String, command: String, format: String) -> Result<String, String> {
    let format = match format.as_str() {
        "png" | "txt" => format.as_str(),
        _ => "svg",
    };
    let trimmed = command.trim();
    let mut parts = if trimmed.is_empty() { "plantuml" } else { trimmed }.split_whitespace();
    let program = parts.next().unwrap_or("plantuml");
    let mut process = background_command(program)
        .args(parts)
        .args([&format!("-t{format}"), "-pipe", "-charset", "UTF-8"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!("`{program}` could not be run ({error}). Check the path in Settings > Features.")
        })?;

    process
        .stdin
        .take()
        .ok_or("PlantUML did not accept input")?
        .write_all(source.as_bytes())
        .map_err(|error| error.to_string())?;

    let output = process.wait_with_output().map_err(|error| error.to_string())?;

    if !output.stdout.is_empty() {
        return Ok(match format {
            "png" => format!("data:image/png;base64,{}", base64(&output.stdout)),
            _ => String::from_utf8_lossy(&output.stdout).to_string(),
        });
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    Err(if stderr.is_empty() { "PlantUML produced no diagram".into() } else { stderr })
}

#[cfg(test)]
mod tests {
    use super::base64;

    #[test]
    fn encodes_with_padding() {
        assert_eq!(base64(b"a"), "YQ==");
        assert_eq!(base64(b"ab"), "YWI=");
        assert_eq!(base64(b"abc"), "YWJj");
        assert_eq!(base64(b"hello world"), "aGVsbG8gd29ybGQ=");
    }
}
