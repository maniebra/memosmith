#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn prefer_native_display_backend() {
    // XWayland renders at scale 1 and lets the compositor upscale it, which is
    // blurry on fractional-scale outputs, so stay native under Wayland. x11 is
    // the fallback elsewhere, and an explicit GDK_BACKEND always wins.
    if std::env::var_os("GDK_BACKEND").is_none() && std::env::var_os("WAYLAND_DISPLAY").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

#[cfg(not(target_os = "linux"))]
fn prefer_native_display_backend() {}

fn main() {
    prefer_native_display_backend();
    memosmith_lib::run()
}
