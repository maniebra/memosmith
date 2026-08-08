use memosmith_lib::lsp::{complete, detect_language_servers};
use std::collections::HashMap;

/// The only server this test can count on is whichever one the machine happens to have.
#[test]
fn a_present_language_server_answers_with_completions() {
    let found = detect_language_servers(HashMap::new());

    if found.get("cpp").map(String::is_empty).unwrap_or(true) {
        eprintln!("no C++ language server installed, skipping");
        return;
    }

    let code = "#include <string>\nint main() {\n  std::stri\n}\n";
    let items = complete("lsp-note", "cpp", code, 2, 11, None).expect("the server answered");

    assert!(
        items.iter().any(|item| item.label.starts_with("string")),
        "std::stri completes to string, got {:?}",
        items.iter().take(5).map(|item| &item.label).collect::<Vec<_>>()
    );
}
