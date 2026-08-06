#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn prefer_kde_window_decorations() {
    std::env::set_var("GDK_BACKEND", "x11");
}

#[cfg(not(target_os = "linux"))]
fn prefer_kde_window_decorations() {}

fn main() {
    prefer_kde_window_decorations();
    memosmith_lib::run()
}
