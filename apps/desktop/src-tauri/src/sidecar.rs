use crate::engine::Outcome;
use std::time::Duration;
use tauri::{AppHandle, Runtime};
use tauri_plugin_shell::{
    ShellExt,
    process::{CommandChild, CommandEvent},
};
// Dropping the ensure future (including its outer timeout) must kill only the helper.
struct ChildGuard(Option<CommandChild>);
impl Drop for ChildGuard {
    fn drop(&mut self) {
        if let Some(child) = self.0.take() {
            let _ = child.kill();
        }
    }
}
pub(crate) async fn launch<R: Runtime>(app: AppHandle<R>) -> Result<Outcome, &'static str> {
    let command = app
        .shell()
        .sidecar("overmind-engine")
        .map_err(|_| "sidecar missing")?
        .args(["ensure-running", "--json"])
        .set_raw_out(true);
    let (mut events, child) = command.spawn().map_err(|_| "cannot start")?;
    let mut guard = ChildGuard(Some(child));
    let result = tokio::time::timeout(Duration::from_secs(15), async {
        let mut output = Vec::new();
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if output.len() + bytes.len() > 8192 {
                        return Err("invalid engine status");
                    }
                    output.extend_from_slice(&bytes);
                }
                CommandEvent::Terminated(value) => {
                    return value
                        .code
                        .map(|code| Outcome { code, output })
                        .ok_or("unexpected exit");
                }
                CommandEvent::Error(_) => return Err("cannot start"),
                CommandEvent::Stderr(_) => {}
                _ => {}
            }
        }
        Err("unexpected exit")
    })
    .await;
    match result {
        Ok(Ok(value)) => {
            guard.0.take();
            Ok(value)
        }
        Ok(Err(code)) => Err(code),
        Err(_) => Err("timeout"),
    }
}

#[cfg(test)]
#[path = "../tests/sidecar.rs"]
mod tests;
