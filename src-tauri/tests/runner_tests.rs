use memosmith_lib::runner::{kernel_for, run_code};

fn run(session: &str, language: &str, code: &str) -> String {
    run_code(
        session.into(),
        language.into(),
        code.into(),
        None,
        Some(20_000),
    )
    .expect("cell ran")
    .output
}

#[test]
fn languages_map_to_kernels() {
    assert_eq!(kernel_for("PYTHON"), Some("python"));
    assert_eq!(kernel_for("ts"), Some("node"));
    assert_eq!(kernel_for("sh"), Some("bash"));
    assert_eq!(kernel_for("rust"), Some("rust"));
    assert_eq!(kernel_for("haskell"), None);
}

#[test]
fn bash_keeps_variables_between_cells() {
    run("bash-note", "bash", "greeting=hello");

    assert_eq!(run("bash-note", "bash", "echo $greeting"), "hello\n");
}

#[test]
fn python_keeps_variables_and_reports_errors() {
    run("python-note", "python", "total = 40\ntotal += 2");

    assert_eq!(run("python-note", "python", "total"), "42\n");

    let failed = run_code(
        "python-note".into(),
        "python".into(),
        "1 / 0".into(),
        None,
        Some(20_000),
    )
    .expect("cell ran");

    assert_eq!(failed.status, 1);
    assert!(failed.output.contains("ZeroDivisionError"), "{}", failed.output);
}

#[test]
fn javascript_keeps_variables_between_cells() {
    run("js-note", "js", "let seen = [1, 2, 3]");

    assert_eq!(run("js-note", "javascript", "seen.length"), "3\n");
}

/// The heavy toolchains are optional; skip instead of failing where they are not installed.
fn available(program: &str) -> bool {
    ["--version", "-version"].iter().any(|flag| {
        std::process::Command::new(program)
            .arg(flag)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    })
}

#[test]
fn java_keeps_variables_and_flags_errors() {
    if !available("jshell") {
        return;
    }

    run("java-note", "java", "int total = 40;");

    assert_eq!(
        run("java-note", "java", "System.out.println(total + 2);"),
        "42\n"
    );

    let failed = run_code(
        "java-note".into(),
        "java".into(),
        "int broken = missing;".into(),
        None,
        Some(60_000),
    )
    .expect("cell ran");

    assert_eq!(failed.status, 1, "{}", failed.output);
}

#[test]
fn cpp_wraps_a_snippet_in_a_program() {
    if !available("g++") && !available("clang++") {
        return;
    }

    assert_eq!(
        run("cpp-note", "cpp", "cout << 6 * 7 << endl;"),
        "42\n"
    );

    let failed = run_code(
        "cpp-note".into(),
        "cpp".into(),
        "cout << nope;".into(),
        None,
        Some(60_000),
    )
    .expect("cell ran");

    assert_eq!(failed.status, 1, "compile errors are reported");
    assert!(!failed.output.is_empty(), "the compiler explains itself");
}

#[test]
fn kotlin_keeps_variables_between_cells() {
    if !available("kotlinc") {
        return;
    }

    run("kotlin-note", "kotlin", "val total = 40");

    assert!(run("kotlin-note", "kotlin", "println(total + 2)").contains("42"));
}

#[test]
fn rust_wraps_a_snippet_in_a_program() {
    if !available("rustc") {
        return;
    }

    assert_eq!(run("rust-note", "rust", "println!(\"{}\", 6 * 7);"), "42\n");

    let failed = run_code(
        "rust-note".into(),
        "rust".into(),
        "println!(\"{}\", nope);".into(),
        None,
        Some(60_000),
    )
    .expect("cell ran");

    assert_eq!(failed.status, 1, "compile errors are reported");
    assert!(!failed.output.is_empty(), "the compiler explains itself");
}

#[test]
fn r_keeps_variables_between_cells() {
    if !available("R") {
        return;
    }

    run("r-note", "r", "total <- 40");

    assert_eq!(run("r-note", "r", "total + 2"), "[1] 42\n");
}

#[test]
fn a_hung_cell_times_out() {
    let result = run_code(
        "timeout-note".into(),
        "bash".into(),
        "sleep 5".into(),
        None,
        Some(300),
    )
    .expect("cell ran");

    assert!(result.timed_out);
}
