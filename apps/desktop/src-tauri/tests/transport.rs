use super::*;
use crate::tests::support::Fixture;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
fn input() -> Input {
    Input {
        method: "POST".into(),
        path: "/v1/echo?plain=1".into(),
        headers: vec![("authorization".into(), "Bearer fake-test-marker".into())],
        body: Some(b"opaque request".to_vec()),
    }
}
#[tokio::test]
async fn invalid_input_is_rejected_before_socket_access() {
    let missing = Path::new("/missing/socket");
    for path in [
        "/v1/../etc",
        "/v1/ok\r\nx: y",
        "https://remote/v1/",
        "/other",
        "/v1/space here",
    ] {
        let mut value = input();
        value.path = path.into();
        assert_eq!(request(missing, value).await.unwrap_err(), Error::INVALID);
    }
    for method in ["get", "CONNECT", "TRACE"] {
        let mut value = input();
        value.method = method.into();
        assert_eq!(request(missing, value).await.unwrap_err(), Error::INVALID);
    }
    for header in [
        ("x\r\nname", "value"),
        ("x-name", "value\r\nsmuggled"),
        ("Content-Length", "0"),
        ("Host", "remote"),
        ("Transfer-Encoding", "chunked"),
    ] {
        let mut value = input();
        value.headers = vec![(header.0.into(), header.1.into())];
        assert_eq!(request(missing, value).await.unwrap_err(), Error::INVALID);
    }
    let mut value = input();
    value.body = Some(vec![0; LIMIT + 1]);
    assert_eq!(request(missing, value).await.unwrap_err(), Error::INVALID);
    let mut value = input();
    value
        .headers
        .push(("Authorization".into(), "duplicate".into()));
    assert!(validate(value).is_err());
}
#[tokio::test]
async fn bridge_forwards_auth_and_opaque_bytes_over_unix_http() {
    let f = Fixture::new();
    let listener = f.socket(&f.paths.gateway);
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = vec![0; 4096];
        let mut length = 0;
        while !bytes[..length].ends_with(b"opaque request") {
            length += socket.read(&mut bytes[length..]).await.unwrap();
        }
        let text = String::from_utf8_lossy(&bytes[..length]);
        assert!(text.starts_with("POST /v1/echo?plain=1 HTTP/1.1\r\n"));
        assert!(text.contains("authorization: Bearer fake-test-marker\r\n"));
        socket
            .write_all(
                b"HTTP/1.1 202 Accepted\r\nContent-Length: 4\r\nX-Reply: yes\r\n\r\n\x00\xff{}",
            )
            .await
            .unwrap();
    });
    let response = request(&f.paths.gateway, input()).await.unwrap();
    assert_eq!(response.status, 202);
    assert_eq!(response.body, b"\x00\xff{}");
    assert!(response.headers.contains(&("x-reply".into(), "yes".into())));
    server.await.unwrap();
}
#[tokio::test]
async fn oversized_response_is_rejected() {
    let f = Fixture::new();
    let listener = f.socket(&f.paths.gateway);
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0; 4096];
        assert!(socket.read(&mut buffer).await.unwrap() > 0);
        let header = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n", LIMIT + 1);
        socket.write_all(header.as_bytes()).await.unwrap();
        let _ = socket.write_all(&vec![0; LIMIT + 1]).await;
    });
    assert_eq!(
        request(&f.paths.gateway, input()).await.unwrap_err(),
        Error::RESPONSE
    );
    server.await.unwrap();
}
#[tokio::test]
async fn dropping_subscription_closes_connection() {
    let f = Fixture::new();
    let listener = f.socket(&f.paths.gateway);
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0; 4096];
        assert!(socket.read(&mut buffer).await.unwrap() > 0);
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\ndata\r\n")
            .await
            .unwrap();
        let n = socket.read(&mut buffer).await.unwrap();
        assert_eq!(n, 0);
    });
    let (_, _, mut body) = subscribe(&f.paths.gateway, validate(input()).unwrap())
        .await
        .unwrap();
    assert_eq!(body.next().await.unwrap().unwrap(), b"data");
    drop(body);
    tokio::time::timeout(Duration::from_secs(2), server)
        .await
        .unwrap()
        .unwrap();
}
#[tokio::test]
async fn hanging_request_times_out_and_disconnects() {
    let f = Fixture::new();
    let listener = f.socket(&f.paths.gateway);
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = [0; 4096];
        assert!(socket.read(&mut bytes).await.unwrap() > 0);
        assert_eq!(socket.read(&mut bytes).await.unwrap(), 0);
    });
    assert_eq!(
        request(&f.paths.gateway, input()).await.unwrap_err(),
        Error::TIMEOUT
    );
    tokio::time::timeout(Duration::from_secs(2), server)
        .await
        .unwrap()
        .unwrap();
}
#[tokio::test]
async fn cancellation_during_stream_headers_also_disconnects() {
    let f = Fixture::new();
    let listener = f.socket(&f.paths.gateway);
    let (ready, wait) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = [0; 4096];
        assert!(socket.read(&mut bytes).await.unwrap() > 0);
        ready.send(()).unwrap();
        assert_eq!(socket.read(&mut bytes).await.unwrap(), 0);
    });
    let path = f.paths.gateway.clone();
    let job = tokio::spawn(async move {
        let _ = subscribe(&path, validate(input()).unwrap()).await;
    });
    wait.await.unwrap();
    job.abort();
    assert!(job.await.unwrap_err().is_cancelled());
    tokio::time::timeout(Duration::from_secs(2), server)
        .await
        .unwrap()
        .unwrap();
}
