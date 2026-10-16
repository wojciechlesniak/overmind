use crate::{
    ShellState, native_io,
    transport::{self, Error, Input, Response},
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};
use tauri::{State, ipc::Channel};
#[derive(Default)]
pub(crate) struct Streams {
    next: AtomicU64,
    closed: AtomicBool,
    jobs: Mutex<HashMap<u64, Option<tauri::async_runtime::JoinHandle<()>>>>,
}
impl Streams {
    fn reserve(&self) -> Result<u64, Error> {
        let mut jobs = self.jobs.lock().map_err(|_| Error::UNAVAILABLE)?;
        if self.closed.load(Ordering::Acquire) || jobs.len() >= 8 {
            return Err(Error::UNAVAILABLE);
        }
        let id = self
            .next
            .fetch_update(Ordering::AcqRel, Ordering::Relaxed, |n| n.checked_add(1))
            .map_err(|_| Error::UNAVAILABLE)?;
        jobs.insert(id, None);
        Ok(id)
    }
    fn attach(&self, id: u64, job: tauri::async_runtime::JoinHandle<()>) {
        let mut jobs = self
            .jobs
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(slot) = jobs.get_mut(&id) {
            *slot = Some(job);
        } else {
            job.abort();
        }
    }
    fn finish(&self, id: u64) {
        self.jobs
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(&id);
    }
    pub fn close(&self) {
        self.closed.store(true, Ordering::Release);
        let mut jobs = self
            .jobs
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        for job in jobs.drain().filter_map(|(_, value)| value) {
            job.abort();
        }
    }
}
#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub(crate) enum Event {
    Response {
        status: u16,
        headers: Vec<(String, String)>,
    },
    Data {
        body: Vec<u8>,
    },
    End,
    Error {
        code: &'static str,
    },
}
#[tauri::command]
pub(crate) async fn gateway_request(
    state: State<'_, ShellState>,
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Option<Vec<u8>>,
) -> Result<Response, Error> {
    let paths = state.paths.clone();
    let result = transport::request(
        &paths.gateway,
        Input {
            method,
            path,
            headers,
            body,
        },
    )
    .await;
    if let Err(error) = result {
        let _ = native_io::log(&paths, "bridge.denied", error.code);
    }
    result
}
#[tauri::command]
pub(crate) fn gateway_subscribe(
    state: State<'_, ShellState>,
    path: String,
    headers: Option<Vec<(String, String)>>,
    on_event: Channel<Event>,
) -> Result<(), Error> {
    let request = transport::validate(Input {
        method: "GET".into(),
        path,
        headers: headers.unwrap_or_default(),
        body: None,
    })?;
    let id = state.streams.reserve()?;
    let paths = state.paths.clone();
    let streams = Arc::clone(&state.streams);
    let finished = Arc::clone(&streams);
    let job = tauri::async_runtime::spawn(async move {
        let result = async {
            let (status, headers, mut body) = transport::subscribe(&paths.gateway, request).await?;
            on_event
                .send(Event::Response { status, headers })
                .map_err(|_| Error::UNAVAILABLE)?;
            while let Some(body) = body.next().await? {
                on_event
                    .send(Event::Data { body })
                    .map_err(|_| Error::UNAVAILABLE)?;
            }
            on_event.send(Event::End).map_err(|_| Error::UNAVAILABLE)
        }
        .await;
        if let Err(error) = result {
            let _ = native_io::log(&paths, "bridge.stream_failed", error.code);
            let _ = on_event.send(Event::Error { code: error.code });
        }
        finished.finish(id);
    });
    // Tauri uses Tokio; retain its task for deterministic cancellation on window destruction.
    streams.attach(id, job);
    Ok(())
}

#[cfg(test)]
#[path = "../tests/gateway_bridge.rs"]
mod tests;
