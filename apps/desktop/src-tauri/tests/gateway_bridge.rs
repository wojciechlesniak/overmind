use super::*;
#[tokio::test]
async fn closing_window_aborts_attached_and_pending_jobs() {
    let streams = Streams::default();
    let id = streams.reserve().unwrap();
    let job = tauri::async_runtime::spawn(std::future::pending::<()>());
    let abort = job.inner().abort_handle();
    streams.attach(id, job);
    let pending = streams.reserve().unwrap();
    streams.close();
    assert!(streams.reserve().is_err());
    let late = tauri::async_runtime::spawn(std::future::pending::<()>());
    let late_abort = late.inner().abort_handle();
    streams.attach(pending, late);
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    assert!(abort.is_finished());
    assert!(late_abort.is_finished());
}
#[test]
fn stream_limit_and_finish_are_bounded() {
    let streams = Streams::default();
    let first = streams.reserve().unwrap();
    for _ in 1..8 {
        streams.reserve().unwrap();
    }
    assert!(streams.reserve().is_err());
    streams.finish(first);
    assert!(streams.reserve().is_ok());
}
