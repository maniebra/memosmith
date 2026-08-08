use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Printed by every kernel once a cell finished, followed by its exit status.
const END: &str = "__MEMOSMITH_END__";
/// Sent after a cell's source so the python kernel knows the cell is complete.
const EOC: &str = "__MEMOSMITH_EOC__";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;

const PYTHON_DRIVER: &str = r#"
import sys, ast, traceback
sys.stderr = sys.stdout
scope = {"__name__": "__main__"}
buffer = []
for line in sys.stdin:
    if line.rstrip("\n") != "__MEMOSMITH_EOC__":
        buffer.append(line)
        continue
    source = "".join(buffer)
    buffer = []
    status = 0
    try:
        tree = ast.parse(source)
        tail = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
        exec(compile(tree, "<cell>", "exec"), scope)
        if tail is not None:
            value = eval(compile(ast.Expression(tail.value), "<cell>", "eval"), scope)
            if value is not None:
                print(repr(value))
    except SystemExit:
        pass
    except BaseException:
        traceback.print_exc()
        status = 1
    print("__MEMOSMITH_END__%d" % status, flush=True)
"#;

const NODE_DRIVER: &str = r#"
const vm = require("vm");
const util = require("util");
const write = process.stdout.write.bind(process.stdout);
process.stderr.write = write;

const context = vm.createContext({
  console, require, process, Buffer, URL, URLSearchParams,
  TextEncoder, TextDecoder, fetch: globalThis.fetch,
  setTimeout, setInterval, clearTimeout, clearInterval, structuredClone,
});

async function run(payload) {
  const newline = payload.indexOf("\n");
  const language = payload.slice(0, newline).trim();
  let source = payload.slice(newline + 1);
  let status = 0;

  try {
    if (language === "ts") {
      const strip = require("module").stripTypeScriptTypes;
      if (!strip) {
        throw new Error("TypeScript cells need Node 22.13+ (module.stripTypeScriptTypes). Use a js cell instead.");
      }
      source = strip(source, { mode: "strip" });
    }

    // Script-scoped let/const would vanish between cells; var lands on the shared context.
    source = source.replace(/^(const|let)\s/gm, "var ");

    const value = /\bawait\b/.test(source)
      ? await vm.runInContext(`(async () => {\n${source}\n})()`, context, { filename: "cell.js" })
      : vm.runInContext(source, context, { filename: "cell.js" });

    if (value !== undefined) {
      write(util.inspect(value, { depth: 4, colors: false }) + "\n");
    }
  } catch (error) {
    write((error && error.stack ? error.stack : String(error)) + "\n");
    status = 1;
  }

  write("__MEMOSMITH_END__" + status + "\n");
}

let buffer = "";
let queue = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n__MEMOSMITH_EOC__\n")) !== -1) {
    const payload = buffer.slice(0, index + 1);
    buffer = buffer.slice(index + "\n__MEMOSMITH_EOC__\n".length);
    queue = queue.then(() => run(payload));
  }
});
"#;

/// R has no cell protocol of its own, so every cell is handed to this evaluator as a string.
const R_DRIVER: &str = r#"
options(warn = 1)
sink(stdout(), type = "message")
.memosmith_run <- function(source) {
  status <- 0
  result <- tryCatch(
    withVisible(eval(parse(text = source), envir = globalenv())),
    error = function(condition) {
      cat("Error: ", conditionMessage(condition), "\n", sep = "")
      status <<- 1
      NULL
    }
  )
  if (!is.null(result) && result$visible) print(result$value)
  cat(sprintf("__MEMOSMITH_END__%d\n", status))
  flush(stdout())
}
"#;

/// Enough of the standard library that a bare snippet compiles without ceremony.
const CPP_PREAMBLE: &str = "#include <algorithm>\n#include <chrono>\n#include <cmath>\n#include <cstdint>\n#include <cstdio>\n#include <functional>\n#include <iostream>\n#include <map>\n#include <memory>\n#include <numeric>\n#include <set>\n#include <sstream>\n#include <string>\n#include <unordered_map>\n#include <unordered_set>\n#include <vector>\nusing namespace std;\n";

struct Session {
    child: Child,
    stdin: ChildStdin,
    lines: Receiver<String>,
}

impl Session {
    fn stop(mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// ponytail: one global lock, so cells run one at a time app-wide. Per-session locks if that bites.
fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    static SESSIONS: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();

    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Which kernel a fenced block's language belongs to; unknown languages are not runnable.
pub fn kernel_for(language: &str) -> Option<&'static str> {
    match language.trim().to_lowercase().as_str() {
        "bash" | "sh" | "shell" | "zsh" => Some("bash"),
        "python" | "py" => Some("python"),
        "js" | "javascript" | "ts" | "typescript" => Some("node"),
        "java" => Some("java"),
        "kotlin" | "kt" | "kts" => Some("kotlin"),
        "r" => Some("r"),
        "rust" | "rs" => Some("rust"),
        "cpp" | "c++" | "cc" | "cxx" => Some("cpp"),
        _ => None,
    }
}

pub const KERNELS: [&str; 8] =
    ["bash", "python", "node", "java", "kotlin", "r", "cpp", "rust"];

fn candidates(kernel: &str) -> &'static [&'static str] {
    match kernel {
        "python" => &["python3", "python"],
        "node" => &["node"],
        "java" => &["jshell"],
        "kotlin" => &["kotlinc"],
        "r" => &["R"],
        "cpp" => &["g++", "clang++"],
        "rust" => &["rustc"],
        _ => &["bash", "sh"],
    }
}

fn works(program: &str) -> bool {
    // kotlinc and a few others only answer to the single-dash spelling.
    ["--version", "-version"].iter().any(|flag| {
        Command::new(program)
            .arg(flag)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    })
}

fn resolve(kernel: &str, command: Option<&str>) -> Result<String, String> {
    if let Some(program) = command.map(str::trim).filter(|program| !program.is_empty()) {
        return if works(program) {
            Ok(program.to_string())
        } else {
            Err(format!("`{program}` could not be run. Check the path in Settings > Features."))
        };
    }

    candidates(kernel)
        .iter()
        .find(|program| works(program))
        .map(|program| program.to_string())
        .ok_or_else(|| {
            format!(
                "No {kernel} runtime found. Install it, or set its path in Settings > Features."
            )
        })
}

fn pump(reader: impl std::io::Read + Send + 'static, sender: Sender<String>) {
    std::thread::spawn(move || {
        for line in BufReader::new(reader).lines() {
            match line {
                Ok(line) => {
                    if sender.send(line).is_err() {
                        return;
                    }
                }
                Err(_) => return,
            }
        }
    });
}

fn spawn(kernel: &str, command: Option<&str>) -> Result<Session, String> {
    let program = resolve(kernel, command)?;
    let mut process = Command::new(&program);

    match kernel {
        "python" => {
            process.args(["-u", "-c", PYTHON_DRIVER]);
        }
        "node" => {
            process.args(["-e", NODE_DRIVER]);
        }
        // Script mode: jshell reads snippets off stdin without prompts or banners.
        "java" => {
            process.args(["-q", "--execution", "local", "-"]);
        }
        "kotlin" => {}
        "r" => {
            process.args(["--vanilla", "--no-echo"]);
        }
        _ => {
            process.arg("-s");
        }
    }

    let mut child = process
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start `{program}`: {error}"))?;

    let mut stdin = child.stdin.take().ok_or("kernel has no stdin")?;
    let (sender, lines) = channel();

    pump(child.stdout.take().ok_or("kernel has no stdout")?, sender.clone());
    pump(child.stderr.take().ok_or("kernel has no stderr")?, sender);

    match kernel {
        // Everything the shell says lands on one stream, in the order it was said.
        "bash" => stdin.write_all(b"exec 2>&1\n").map_err(|error| error.to_string())?,
        "r" => stdin.write_all(R_DRIVER.as_bytes()).map_err(|error| error.to_string())?,
        _ => {}
    }

    let mut session = Session { child, stdin, lines };

    // The Kotlin REPL greets with a banner and takes its time booting; swallow both up front.
    if kernel == "kotlin" {
        session
            .stdin
            .write_all(format!("println(\"{END}0\")\n").as_bytes())
            .and_then(|_| session.stdin.flush())
            .map_err(|error| error.to_string())?;

        let deadline = Instant::now() + Duration::from_secs(180);

        loop {
            match session.lines.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(line) if line.starts_with(END) => break,
                Ok(_) => {}
                Err(_) => break,
            }
        }
    }

    Ok(session)
}

fn payload(kernel: &str, language: &str, code: &str) -> String {
    let code = if code.ends_with('\n') {
        code.to_string()
    } else {
        format!("{code}\n")
    };

    match kernel {
        "python" => format!("{code}{EOC}\n"),
        "node" => {
            let tag = if matches!(language.trim().to_lowercase().as_str(), "ts" | "typescript") {
                "ts"
            } else {
                "js"
            };

            format!("{tag}\n{code}{EOC}\n")
        }
        "java" => format!("{code}System.out.println(\"{END}0\");\n"),
        "kotlin" => format!("{code}println(\"{END}0\")\n"),
        "r" => format!(".memosmith_run('{}')\n", r_string(&code)),
        _ => format!("{code}printf '{END}%s\\n' \"$?\"\n"),
    }
}

/// Cells reach R as a single-quoted string, so the quoting characters have to travel escaped.
fn r_string(code: &str) -> String {
    code.chars()
        .map(|character| match character {
            '\\' => "\\\\".to_string(),
            '\'' => "\\'".to_string(),
            '\n' => "\\n".to_string(),
            '\r' => "\\r".to_string(),
            other => other.to_string(),
        })
        .collect()
}

/// jshell and the Kotlin REPL report failures in prose and carry on, so the text is the status.
fn failed(kernel: &str, output: &str) -> bool {
    output.lines().any(|line| match kernel {
        "java" => line.starts_with("Error:") || line.starts_with("|  Error"),
        "kotlin" => line.starts_with("error:"),
        _ => false,
    })
}

/// A snippet becomes a program: its includes stay on top, the rest becomes the body of `main`.
fn cpp_program(code: &str) -> String {
    if code.contains("int main") || code.contains("auto main") {
        return code.to_string();
    }

    let (preamble, body): (Vec<&str>, Vec<&str>) = code.lines().partition(|line| {
        let line = line.trim_start();

        line.starts_with('#') || line.starts_with("using ")
    });

    format!(
        "{CPP_PREAMBLE}{}\nint main() {{\n{}\nreturn 0;\n}}\n",
        preamble.join("\n"),
        body.join("\n"),
    )
}

/// Same deal as C++: a bare snippet becomes the body of `main`, with its items hoisted above it.
fn rust_program(code: &str) -> String {
    if code.contains("fn main") {
        return code.to_string();
    }

    let (items, body): (Vec<&str>, Vec<&str>) = code.lines().partition(|line| {
        let line = line.trim_start();

        line.starts_with("use ")
            || line.starts_with("#[")
            || line.starts_with("mod ")
            || line.starts_with("extern ")
    });

    format!(
        "#![allow(unused)]\n{}\nfn main() {{\n{}\n}}\n",
        items.join("\n"),
        body.join("\n"),
    )
}

/// ponytail: every C++ and Rust cell is its own program, since a compiler has no REPL to keep state in.
/// The cells of one note do share a working directory, so files written by an earlier cell stay put.
fn run_compiled(
    kernel: &str,
    session: &str,
    code: &str,
    command: Option<&str>,
    timeout: Duration,
) -> Result<RunOutput, String> {
    let compiler = resolve(kernel, command)?;
    let directory =
        std::env::temp_dir().join(format!("memosmith-{kernel}-{:x}", fingerprint(session)));

    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let rust = kernel == "rust";
    let source = directory.join(if rust { "cell.rs" } else { "cell.cpp" });
    let binary = directory.join(if cfg!(windows) { "cell.exe" } else { "cell" });
    let program = if rust { rust_program(code) } else { cpp_program(code) };

    std::fs::write(&source, program).map_err(|error| error.to_string())?;

    // ponytail: the compile itself is not on the clock, only the program it produces.
    let build = Command::new(&compiler)
        .args(if rust {
            ["--edition", "2021"]
        } else {
            ["-std=c++20", "-O0"]
        })
        .arg("-o")
        .arg(&binary)
        .arg(&source)
        .current_dir(&directory)
        .output()
        .map_err(|error| format!("Could not run `{compiler}`: {error}"))?;

    if !build.status.success() {
        return Ok(RunOutput {
            output: String::from_utf8_lossy(&build.stderr).to_string(),
            status: 1,
            timed_out: false,
        });
    }

    let mut child = Command::new(&binary)
        .current_dir(&directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    let (sender, lines) = channel();

    pump(child.stdout.take().ok_or("program has no stdout")?, sender.clone());
    pump(child.stderr.take().ok_or("program has no stderr")?, sender);

    let deadline = Instant::now() + timeout;
    let mut output = String::new();

    loop {
        match lines.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
            Ok(line) => {
                output.push_str(&line);
                output.push('\n');
            }
            // Both pipes closed: the program is done talking.
            Err(RecvTimeoutError::Disconnected) => {
                let status = child.wait().map(|status| status.code().unwrap_or(1)).unwrap_or(1);

                return Ok(RunOutput { output, status, timed_out: false });
            }
            Err(RecvTimeoutError::Timeout) => {
                let _ = child.kill();
                let _ = child.wait();

                return Ok(RunOutput { output, status: -1, timed_out: true });
            }
        }
    }
}

pub fn fingerprint(value: &str) -> u64 {
    value.bytes().fold(0xcbf2_9ce4_8422_2325, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunOutput {
    pub output: String,
    pub status: i32,
    pub timed_out: bool,
}

#[tauri::command]
pub fn run_code(
    session: String,
    language: String,
    code: String,
    command: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<RunOutput, String> {
    let kernel = kernel_for(&language).ok_or_else(|| format!("`{language}` is not runnable"))?;

    if code.contains(END) || code.contains(EOC) {
        return Err("Code may not contain the kernel's internal markers".into());
    }

    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));

    if matches!(kernel, "cpp" | "rust") {
        return run_compiled(kernel, &session, &code, command.as_deref(), timeout);
    }

    let key = format!("{session}::{kernel}");
    let mut open = sessions().lock().map_err(|error| error.to_string())?;
    // The session lives outside the map while it runs, so a dead kernel is simply never put back.
    let mut entry = match open.remove(&key) {
        Some(entry) => entry,
        None => spawn(kernel, command.as_deref())?,
    };

    // Anything left over from a killed cell belongs to nobody.
    while entry.lines.try_recv().is_ok() {}

    if entry
        .stdin
        .write_all(payload(kernel, &language, &code).as_bytes())
        .and_then(|_| entry.stdin.flush())
        .is_err()
    {
        entry.stop();

        return Err("The kernel stopped. Run the cell again to restart it.".into());
    }

    let deadline = Instant::now() + timeout;
    let mut output = String::new();

    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());

        match entry.lines.recv_timeout(remaining) {
            Ok(line) => {
                if let Some(status) = line.strip_prefix(END) {
                    let mut status = status.trim().parse().unwrap_or(0);

                    if status == 0 && failed(kernel, &output) {
                        status = 1;
                    }

                    open.insert(key, entry);

                    return Ok(RunOutput { output, status, timed_out: false });
                }

                output.push_str(&line);
                output.push('\n');
            }
            Err(RecvTimeoutError::Timeout) => {
                entry.stop();

                return Ok(RunOutput { output, status: -1, timed_out: true });
            }
            Err(RecvTimeoutError::Disconnected) => {
                entry.stop();

                return Ok(RunOutput { output, status: -1, timed_out: false });
            }
        }
    }
}

/// Drops the kernel holding a note's variables, so the next run starts from nothing.
#[tauri::command]
pub fn reset_session(session: String, language: String) -> Result<(), String> {
    let kernel = kernel_for(&language).ok_or_else(|| format!("`{language}` is not runnable"))?;
    let mut open = sessions().lock().map_err(|error| error.to_string())?;

    open.remove(&format!("{session}::{kernel}")).map(Session::stop);

    Ok(())
}

/// Resolved command per kernel, empty when nothing usable was found.
#[tauri::command]
pub fn detect_runtimes(commands: HashMap<String, String>) -> HashMap<String, String> {
    KERNELS
        .into_iter()
        .map(|kernel| {
            let resolved = resolve(kernel, commands.get(kernel).map(String::as_str)).unwrap_or_default();

            (kernel.to_string(), resolved)
        })
        .collect()
}
