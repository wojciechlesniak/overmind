use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub(crate) async fn pick_directory<R: Runtime>(app: AppHandle<R>, title: String) -> Option<String> {
    if title.len() > 200 || title.chars().any(char::is_control) {
        return None;
    }
    let (send, receive) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title(title)
        .pick_folder(move |value| {
            let path = value
                .and_then(|value| value.into_path().ok())
                .and_then(|value| value.canonicalize().ok())
                .filter(|value| value.is_dir())
                .and_then(|value| value.into_os_string().into_string().ok());
            // A closed window may drop the awaiting caller before the native dialog completes.
            let _ = send.send(path);
        });
    receive.await.unwrap_or(None)
}
