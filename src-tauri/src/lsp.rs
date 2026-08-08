use crate::runner::{fingerprint, kernel_for, KERNELS};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Generous, because a server's first answer comes after it has read the standard library.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
/// rust-analyzer and jdtls index a project before they answer their first request.
const STARTUP_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_ITEMS: usize = 200;

struct Server {
    child: Child,
    stdin: ChildStdin,
    messages: Receiver<Value>,
    next_id: i64,
    version: i32,
    opened: HashSet<String>,
}

impl Server {
    fn send(&mut self, message: &Value) -> Result<(), String> {
        let body = message.to_string();

        write!(self.stdin, "Content-Length: {}\r\n\r\n{body}", body.len())
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("The language server stopped: {error}"))
    }

    fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        self.send(&json!({ "jsonrpc": "2.0", "method": method, "params": params }))
    }

    fn request(&mut self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        self.next_id += 1;

        let id = self.next_id;

        self.send(&json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }))?;
        self.wait(id, timeout)
    }

    /// Reads until the reply with this id shows up; anything else the server says is handled or dropped.
    fn wait(&mut self, id: i64, timeout: Duration) -> Result<Value, String> {
        let deadline = Instant::now() + timeout;

        loop {
            let received = self
                .messages
                .recv_timeout(deadline.saturating_duration_since(Instant::now()));

            let message = match received {
                Ok(message) => message,
                Err(RecvTimeoutError::Timeout) => return Err("The language server timed out.".into()),
                Err(RecvTimeoutError::Disconnected) => {
                    return Err("The language server stopped.".into())
                }
            };

            let method = message.get("method").and_then(Value::as_str).map(str::to_string);

            match (message.get("id").cloned(), method) {
                (Some(Value::Number(number)), None) if number.as_i64() == Some(id) => {
                    if let Some(error) = message.get("error") {
                        let text = error.get("message").and_then(Value::as_str).unwrap_or("failed");

                        return Err(text.to_string());
                    }

                    return Ok(message.get("result").cloned().unwrap_or(Value::Null));
                }
                // A request from the server: some of them block on an answer, so every one gets one.
                (Some(other), Some(method)) => {
                    let result = if method == "workspace/configuration" {
                        let count = message["params"]["items"].as_array().map_or(0, Vec::len);

                        Value::Array(vec![json!({}); count])
                    } else {
                        Value::Null
                    };

                    self.send(&json!({ "jsonrpc": "2.0", "id": other, "result": result }))?;
                }
                _ => {}
            }
        }
    }

    fn stop(mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// ponytail: one server per language, shared by every note. Per-space servers if projects need isolating.
fn servers() -> &'static Mutex<HashMap<String, Server>> {
    static SERVERS: OnceLock<Mutex<HashMap<String, Server>>> = OnceLock::new();

    SERVERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn candidates(kernel: &str) -> &'static [&'static str] {
    match kernel {
        "python" => &["pyright-langserver", "basedpyright-langserver", "pylsp", "jedi-language-server"],
        "node" => &["typescript-language-server"],
        "java" => &["jdtls"],
        "kotlin" => &["kotlin-language-server"],
        "r" => &["R"],
        "cpp" => &["clangd"],
        "rust" => &["rust-analyzer"],
        _ => &["bash-language-server"],
    }
}

fn arguments(program: &str) -> Vec<&'static str> {
    match program.rsplit(['/', '\\']).next().unwrap_or(program) {
        "pyright-langserver" | "basedpyright-langserver" | "typescript-language-server" => {
            vec!["--stdio"]
        }
        "bash-language-server" => vec!["start"],
        "R" => vec!["--vanilla", "--no-echo", "-e", "languageserver::run()"],
        _ => vec![],
    }
}

/// What the server calls the dialect, which is not always what the fence calls it.
fn language_id(kernel: &str, language: &str) -> &'static str {
    match kernel {
        "bash" => "shellscript",
        "node" => {
            if matches!(language.trim().to_lowercase().as_str(), "ts" | "typescript") {
                "typescript"
            } else {
                "javascript"
            }
        }
        "python" => "python",
        "java" => "java",
        "kotlin" => "kotlin",
        "r" => "r",
        "cpp" => "cpp",
        _ => "rust",
    }
}

fn extension(kernel: &str, language: &str) -> &'static str {
    match kernel {
        "bash" => "sh",
        "python" => "py",
        "node" => {
            if matches!(language.trim().to_lowercase().as_str(), "ts" | "typescript") {
                "ts"
            } else {
                "js"
            }
        }
        "java" => "java",
        "kotlin" => "kt",
        "r" => "R",
        "cpp" => "cpp",
        _ => "rs",
    }
}

/// A language server is only ever asked for; whether it answers is the spawn's problem.
fn installed(program: &str) -> bool {
    Command::new(program)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
}

fn resolve(kernel: &str, command: Option<&str>) -> Result<String, String> {
    if let Some(program) = command.map(str::trim).filter(|program| !program.is_empty()) {
        return if installed(program) {
            Ok(program.to_string())
        } else {
            Err(format!("`{program}` could not be run. Check the path in Settings > Features."))
        };
    }

    candidates(kernel)
        .iter()
        .find(|program| installed(program))
        .map(|program| program.to_string())
        .ok_or_else(|| {
            format!(
                "No {kernel} language server found. Install one, or set its path in Settings > Features."
            )
        })
}

/// Every cell of a note is written to a real file, since most servers only reason about files on disk.
fn workspace(kernel: &str) -> PathBuf {
    std::env::temp_dir().join(format!("memosmith-lsp-{kernel}"))
}

fn reader(stdout: impl Read + Send + 'static, sender: Sender<Value>) {
    std::thread::spawn(move || {
        let mut stream = BufReader::new(stdout);

        loop {
            let mut length = 0usize;

            loop {
                let mut line = String::new();

                if stream.read_line(&mut line).unwrap_or(0) == 0 {
                    return;
                }

                let line = line.trim();

                if line.is_empty() {
                    break;
                }

                if let Some(value) = line.strip_prefix("Content-Length:") {
                    length = value.trim().parse().unwrap_or(0);
                }
            }

            if length == 0 {
                continue;
            }

            let mut body = vec![0u8; length];

            if stream.read_exact(&mut body).is_err() {
                return;
            }

            if let Ok(message) = serde_json::from_slice(&body) {
                if sender.send(message).is_err() {
                    return;
                }
            }
        }
    });
}

fn start(kernel: &str, command: Option<&str>) -> Result<Server, String> {
    let program = resolve(kernel, command)?;
    let root = workspace(kernel);

    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let mut child = Command::new(&program)
        .args(arguments(&program))
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start `{program}`: {error}"))?;

    let stdin = child.stdin.take().ok_or("language server has no stdin")?;
    let stdout = child.stdout.take().ok_or("language server has no stdout")?;
    let (sender, messages) = channel();

    reader(stdout, sender);

    let mut server = Server {
        child,
        stdin,
        messages,
        next_id: 0,
        version: 0,
        opened: HashSet::new(),
    };

    let uri = format!("file://{}", root.display());

    server.request(
        "initialize",
        json!({
            "processId": std::process::id(),
            "rootUri": uri,
            "workspaceFolders": [{ "uri": uri, "name": "memosmith" }],
            "capabilities": {
                "workspace": { "configuration": true, "workspaceFolders": true },
                "textDocument": {
                    "synchronization": { "didSave": false, "willSave": false },
                    "completion": {
                        "contextSupport": true,
                        "completionItem": {
                            "snippetSupport": false,
                            "documentationFormat": ["plaintext"],
                        },
                    },
                },
            },
        }),
        STARTUP_TIMEOUT,
    )?;

    server.notify("initialized", json!({}))?;

    Ok(server)
}

#[derive(Serialize)]
pub struct Completion {
    pub label: String,
    pub detail: String,
    pub insert: String,
    pub filter: String,
}

fn kind_label(kind: i64) -> &'static str {
    match kind {
        2 | 3 => "function",
        4 => "constructor",
        5 => "field",
        6 => "variable",
        7 => "class",
        8 => "interface",
        9 => "module",
        10 => "property",
        12 => "value",
        13 => "enum",
        14 => "keyword",
        15 => "snippet",
        16 => "color",
        21 => "constant",
        22 => "struct",
        _ => "",
    }
}

fn completion(value: &Value) -> Option<Completion> {
    let label = value.get("label")?.as_str()?.trim().to_string();

    if label.is_empty() {
        return None;
    }

    // Snippet placeholders were not asked for; a server that sends them anyway inserts its label.
    let snippet = value.get("insertTextFormat").and_then(Value::as_i64) == Some(2);
    let insert = value
        .get("textEdit")
        .and_then(|edit| edit.get("newText"))
        .or_else(|| value.get("insertText"))
        .and_then(Value::as_str)
        .filter(|_| !snippet)
        .unwrap_or(&label)
        .to_string();

    let detail = value
        .get("detail")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| {
            kind_label(value.get("kind").and_then(Value::as_i64).unwrap_or(0)).to_string()
        });

    let filter = value
        .get("filterText")
        .and_then(Value::as_str)
        .unwrap_or(&label)
        .to_string();

    Some(Completion { label, detail, insert, filter })
}

fn completions(result: &Value) -> Vec<Completion> {
    let items = result
        .get("items")
        .and_then(Value::as_array)
        .or_else(|| result.as_array());

    items
        .map(|items| items.iter().take(MAX_ITEMS).filter_map(completion).collect())
        .unwrap_or_default()
}

fn ask(
    server: &mut Server,
    uri: &str,
    kernel: &str,
    language: &str,
    code: &str,
    line: u32,
    character: u32,
) -> Result<Vec<Completion>, String> {
    server.version += 1;

    if server.opened.contains(uri) {
        server.notify(
            "textDocument/didChange",
            json!({
                "textDocument": { "uri": uri, "version": server.version },
                "contentChanges": [{ "text": code }],
            }),
        )?;
    } else {
        server.notify(
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": uri,
                    "languageId": language_id(kernel, language),
                    "version": server.version,
                    "text": code,
                },
            }),
        )?;
        server.opened.insert(uri.to_string());
    }

    let result = server.request(
        "textDocument/completion",
        json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
            "context": { "triggerKind": 1 },
        }),
        REQUEST_TIMEOUT,
    )?;

    Ok(completions(&result))
}

/// Async so Tauri keeps it off the main thread: a server that thinks for a second must not
/// freeze the editor for a second.
#[tauri::command]
pub async fn lsp_complete(
    session: String,
    language: String,
    code: String,
    line: u32,
    character: u32,
    command: Option<String>,
) -> Result<Vec<Completion>, String> {
    complete(&session, &language, &code, line, character, command.as_deref())
}

/// Completions for the caret inside one fenced block, the block being the whole document the server sees.
pub fn complete(
    session: &str,
    language: &str,
    code: &str,
    line: u32,
    character: u32,
    command: Option<&str>,
) -> Result<Vec<Completion>, String> {
    let kernel =
        kernel_for(language).ok_or_else(|| format!("`{language}` has no language server"))?;
    let mut open = servers().lock().map_err(|error| error.to_string())?;
    let mut server = match open.remove(kernel) {
        Some(server) => server,
        None => start(kernel, command)?,
    };

    let root = workspace(kernel);
    let path = root.join(format!(
        "cell-{:x}.{}",
        fingerprint(session),
        extension(kernel, language)
    ));

    let _ = std::fs::create_dir_all(&root);
    let _ = std::fs::write(&path, code);

    let uri = format!("file://{}", path.display());
    let answer = ask(&mut server, &uri, kernel, language, code, line, character);

    // A server that merely timed out is still worth keeping; one that died is not.
    if server.child.try_wait().map(|status| status.is_none()).unwrap_or(false) {
        open.insert(kernel.to_string(), server);
    } else {
        server.stop();
    }

    answer
}

/// Drops every running server, so the next completion starts one fresh.
#[tauri::command]
pub async fn reset_language_servers() -> Result<(), String> {
    let mut open = servers().lock().map_err(|error| error.to_string())?;

    for (_, server) in open.drain() {
        server.stop();
    }

    Ok(())
}

/// Resolved server command per language, empty when nothing usable was found.
///
/// Async as well: probing eight servers means eight processes, which is no work for the main thread.
#[tauri::command]
pub async fn detect_language_servers(commands: HashMap<String, String>) -> HashMap<String, String> {
    KERNELS
        .into_iter()
        .map(|kernel| {
            let resolved =
                resolve(kernel, commands.get(kernel).map(String::as_str)).unwrap_or_default();

            (kernel.to_string(), resolved)
        })
        .collect()
}
