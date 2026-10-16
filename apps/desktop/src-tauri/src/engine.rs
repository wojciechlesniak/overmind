use crate::native_io::{self, NativeError, Paths};
use serde::{Deserialize, Serialize};
use std::{
    future::Future,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum State {
    Running,
    Starting,
    Unavailable,
    Incompatible,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub(crate) struct Status {
    pub state: State,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<&'static str>,
}
impl Status {
    fn new(state: State, detail: Option<&'static str>) -> Self {
        Self { state, detail }
    }
}
#[derive(Default)]
pub(crate) struct Gate {
    last: Mutex<Option<Instant>>,
    busy: AtomicBool,
}
pub(crate) struct Attempt(Arc<Gate>);
impl Drop for Attempt {
    fn drop(&mut self) {
        self.0.busy.store(false, Ordering::Release);
    }
}
impl Gate {
    pub fn take_at(self: &Arc<Self>, now: Instant) -> Option<Attempt> {
        if self
            .busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_err()
        {
            return None;
        }
        let allowed = self.last.lock().ok().is_some_and(|mut last| {
            if last
                .is_some_and(|value| now.saturating_duration_since(value) < Duration::from_secs(10))
            {
                false
            } else {
                *last = Some(now);
                true
            }
        });
        if allowed {
            Some(Attempt(Arc::clone(self)))
        } else {
            self.busy.store(false, Ordering::Release);
            None
        }
    }
}
pub(crate) async fn ping(paths: &Paths) -> Result<(), NativeError> {
    tokio::time::timeout(Duration::from_millis(500), async {
        let mut socket = native_io::connect(&paths.engine).await?;
        socket
            .write_all(b"{\"method\":\"ping\"}\n")
            .await
            .map_err(|_| NativeError::Unavailable)?;
        let mut answer = [0u8; 1];
        socket
            .read_exact(&mut answer)
            .await
            .map_err(|_| NativeError::Unavailable)?;
        Ok(())
    })
    .await
    .map_err(|_| NativeError::Unavailable)?
}
pub(crate) struct Outcome {
    pub code: i32,
    pub output: Vec<u8>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Receipt {
    status: String,
    pid: u32,
    socket: String,
}
pub(crate) async fn ensure<F, T>(paths: &Paths, start: F) -> Status
where
    F: FnOnce() -> T,
    T: Future<Output = Result<Outcome, &'static str>>,
{
    match ping(paths).await {
        Ok(()) => return Status::new(State::Running, None),
        Err(NativeError::Insecure) => {
            return Status::new(State::Unavailable, Some("insecure socket"));
        }
        Err(NativeError::Unavailable) => {}
    }
    let outcome = match tokio::time::timeout(Duration::from_secs(15), start()).await {
        Ok(Ok(value)) => value,
        Ok(Err(code)) => return Status::new(State::Unavailable, Some(code)),
        Err(_) => return Status::new(State::Unavailable, Some("timeout")),
    };
    match outcome.code {
        30 => Status::new(State::Incompatible, Some("version mismatch")),
        0 | 10 => {
            let valid = serde_json::from_slice::<Receipt>(&outcome.output)
                .ok()
                .is_some_and(|value| {
                    value.status == "running"
                        && value.pid > 0
                        && std::path::Path::new(&value.socket) == paths.engine
                });
            if valid && ping(paths).await.is_ok() {
                Status::new(State::Running, None)
            } else {
                Status::new(State::Unavailable, Some("invalid engine status"))
            }
        }
        20 => Status::new(State::Unavailable, Some("cannot start")),
        _ => Status::new(State::Unavailable, Some("unexpected exit")),
    }
}
fn notify<R: Runtime>(app: &AppHandle<R>, paths: &Paths, status: Status) {
    let code = match status.state {
        State::Running => "running",
        State::Starting => "starting",
        State::Unavailable => "unavailable",
        State::Incompatible => "incompatible",
    };
    if native_io::log(paths, "engine.status", code).is_ok() {
        let _ = app.emit_to("main", "engine:status", status);
    }
}
pub(crate) fn trigger<R: Runtime>(app: AppHandle<R>, paths: Paths, gate: Arc<Gate>) {
    let Some(attempt) = gate.take_at(Instant::now()) else {
        return;
    };
    if native_io::log(&paths, "engine.ensure", "starting").is_err() {
        return;
    }
    notify(&app, &paths, Status::new(State::Starting, None));
    tauri::async_runtime::spawn(async move {
        let _attempt = attempt;
        let handle = app.clone();
        let status = ensure(&paths, || crate::sidecar::launch(handle)).await;
        notify(&app, &paths, status);
    });
}

#[cfg(test)]
#[path = "../tests/engine.rs"]
mod tests;
