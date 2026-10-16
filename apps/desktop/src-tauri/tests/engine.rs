use super::*;
use crate::tests::support::Fixture;
use std::sync::atomic::AtomicUsize;
#[tokio::test]
async fn running_engine_skips_helper_and_sends_exact_ping() {
    let f = Fixture::new();
    let listener = f.socket(&f.paths.engine);
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut line = vec![0; 18];
        socket.read_exact(&mut line).await.unwrap();
        assert_eq!(line, b"{\"method\":\"ping\"}\n");
        socket.write_all(b"{}\n").await.unwrap();
    });
    let calls = AtomicUsize::new(0);
    let status = ensure(&f.paths, || async {
        calls.fetch_add(1, Ordering::Relaxed);
        Err("unexpected helper")
    })
    .await;
    assert_eq!(status.state, State::Running);
    assert_eq!(calls.load(Ordering::Relaxed), 0);
    server.await.unwrap();
}
#[tokio::test]
async fn absent_engine_calls_helper_once_and_maps_exit_codes() {
    let f = Fixture::new();
    for (code, state, detail) in [
        (20, State::Unavailable, "cannot start"),
        (30, State::Incompatible, "version mismatch"),
        (7, State::Unavailable, "unexpected exit"),
        (0, State::Unavailable, "invalid engine status"),
    ] {
        let calls = AtomicUsize::new(0);
        let result = ensure(&f.paths, || async {
            calls.fetch_add(1, Ordering::Relaxed);
            Ok(Outcome {
                code,
                output: b"untrusted sidecar output".to_vec(),
            })
        })
        .await;
        assert_eq!(result.state, state);
        assert_eq!(result.detail, Some(detail));
        assert_eq!(calls.load(Ordering::Relaxed), 1);
    }
}
#[tokio::test]
async fn successful_helper_requires_valid_receipt_and_live_socket() {
    for code in [0, 10] {
        let f = Fixture::new();
        let path = f.paths.engine.clone();
        let status = ensure(&f.paths, || async {
            let listener = f.socket(&path);
            tokio::spawn(async move {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut line = vec![0; 18];
                socket.read_exact(&mut line).await.unwrap();
                socket.write_all(b"{}").await.unwrap();
            });
            Ok(Outcome {
                code,
                output: serde_json::to_vec(
                    &serde_json::json!({"status":"running", "pid":42, "socket":path}),
                )
                .unwrap(),
            })
        })
        .await;
        assert_eq!(status.state, State::Running);
    }
}
#[tokio::test]
async fn insecure_socket_fails_without_helper() {
    use std::{fs, os::unix::fs::PermissionsExt};
    let f = Fixture::new();
    let _listener = f.socket(&f.paths.engine);
    fs::set_permissions(&f.paths.engine, fs::Permissions::from_mode(0o666)).unwrap();
    let status = ensure(&f.paths, || async {
        panic!("must not start");
    })
    .await;
    assert_eq!(status.detail, Some("insecure socket"));
}
#[test]
fn cooldown_and_single_flight_are_enforced() {
    let gate = Arc::new(Gate::default());
    let now = Instant::now();
    let attempt = gate.take_at(now).unwrap();
    assert!(gate.take_at(now + Duration::from_secs(20)).is_none());
    drop(attempt);
    assert!(gate.take_at(now + Duration::from_secs(9)).is_none());
    assert!(gate.take_at(now + Duration::from_secs(10)).is_some());
}
#[tokio::test]
async fn unresponsive_ping_is_bounded_before_single_helper_attempt() {
    let f = Fixture::new();
    let _listener = f.socket(&f.paths.engine);
    let began = Instant::now();
    let status = ensure(&f.paths, || async { Err("sidecar missing") }).await;
    assert_eq!(status.detail, Some("sidecar missing"));
    assert!(began.elapsed() >= Duration::from_millis(450));
    assert!(began.elapsed() < Duration::from_secs(5));
}
