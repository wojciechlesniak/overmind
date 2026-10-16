#![forbid(unsafe_code)]
mod engine;
mod gateway_bridge;
mod native_io;
mod pick_directory;
mod sidecar;
mod transport;
use native_io::Paths;
use std::sync::Arc;
use tauri::{Manager, Runtime, WebviewWindowBuilder, WindowEvent};
pub(crate) struct ShellState {
    paths: Paths,
    gate: Arc<engine::Gate>,
    streams: Arc<gateway_bridge::Streams>,
}
fn navigation_allowed(url: &tauri::Url, development: bool) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    match (url.scheme(), url.host_str(), url.port()) {
        ("tauri", Some("localhost"), None) | ("http", Some("tauri.localhost"), None) => true,
        ("http", Some("127.0.0.1"), Some(5173)) => development,
        _ => false,
    }
}
fn ensure<R: Runtime>(app: &tauri::AppHandle<R>) {
    let state = app.state::<ShellState>();
    engine::trigger(app.clone(), state.paths.clone(), Arc::clone(&state.gate));
}
fn context<R: Runtime>() -> tauri::Context<R> {
    tauri::generate_context!()
}
pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            gateway_bridge::gateway_request,
            gateway_bridge::gateway_subscribe,
            pick_directory::pick_directory
        ])
        .setup(|app| {
            let paths = Paths::from_home(app.path().home_dir()?)?;
            native_io::init_logging(&paths)?;
            app.manage(ShellState {
                paths,
                gate: Arc::default(),
                streams: Arc::default(),
            });
            let config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("desktop.window_missing")?;
            WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(|url| navigation_allowed(url, tauri::is_dev()))
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            ensure(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => ensure(window.app_handle()),
            WindowEvent::Destroyed => window.app_handle().state::<ShellState>().streams.close(),
            _ => {}
        })
        .run(context())
}
pub fn report_startup_failure() {
    if let Some(home) = std::env::var_os("HOME")
        && let Ok(paths) = Paths::from_home(home.into())
    {
        let _ = native_io::init_logging(&paths);
        let _ = native_io::log(&paths, "desktop.failed", "startup_failed");
    }
}

#[cfg(test)]
#[path = "../tests/security.rs"]
mod tests;
