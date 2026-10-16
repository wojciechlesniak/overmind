use crate::native_io::{self, NativeError};
use http_body_util::{BodyExt, Full, Limited};
use hyper::{
    body::{Bytes, Incoming},
    client::conn::http1,
    http::{
        HeaderMap, Request,
        header::{HOST, HeaderName, HeaderValue},
    },
};
use hyper_util::rt::TokioIo;
use serde::Serialize;
use std::{path::Path, time::Duration};
const LIMIT: usize = 8 * 1024 * 1024;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub(crate) struct Error {
    pub code: &'static str,
}
impl Error {
    const fn code(code: &'static str) -> Self {
        Self { code }
    }
    pub const INVALID: Self = Self::code("bridge.invalid_request");
    pub const UNAVAILABLE: Self = Self::code("bridge.unavailable");
    pub const TIMEOUT: Self = Self::code("bridge.timeout");
    pub const RESPONSE: Self = Self::code("bridge.invalid_response");
}
impl From<NativeError> for Error {
    fn from(value: NativeError) -> Self {
        match value {
            NativeError::Insecure => Self {
                code: "bridge.insecure_socket",
            },
            NativeError::Unavailable => Self::UNAVAILABLE,
        }
    }
}
pub(crate) struct Input {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<Vec<u8>>,
}
#[derive(Serialize, Debug)]
pub(crate) struct Response {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}
pub(crate) struct Validated(Request<Full<Bytes>>);
pub(crate) fn validate(input: Input) -> Result<Validated, Error> {
    if !["GET", "POST", "PUT", "PATCH", "DELETE"].contains(&input.method.as_str())
        || !input.path.starts_with("/v1/")
        || input.path.len() > 2048
        || input.path.contains("..")
        || input.path.chars().any(|c| c.is_ascii_control() || c == ' ')
        || input.body.as_ref().is_some_and(|b| b.len() > LIMIT)
        || input.headers.len() > 64
    {
        return Err(Error::INVALID);
    }
    let mut request = Request::builder()
        .method(input.method.as_str())
        .uri(input.path.as_str());
    let headers = request.headers_mut().ok_or(Error::INVALID)?;
    let mut size = 0usize;
    for (name, value) in input.headers {
        size = size.saturating_add(name.len()).saturating_add(value.len());
        if size > 65536 || name.len() > 128 || value.len() > 8192 || value.contains(['\r', '\n']) {
            return Err(Error::INVALID);
        }
        let name = HeaderName::from_bytes(name.as_bytes()).map_err(|_| Error::INVALID)?;
        if [
            "host",
            "content-length",
            "transfer-encoding",
            "connection",
            "upgrade",
            "trailer",
            "te",
            "keep-alive",
            "proxy-authorization",
            "proxy-authenticate",
        ]
        .contains(&name.as_str())
            || headers.contains_key(&name)
        {
            return Err(Error::INVALID);
        }
        headers.insert(
            name,
            HeaderValue::from_str(&value).map_err(|_| Error::INVALID)?,
        );
    }
    headers.insert(HOST, HeaderValue::from_static("localhost"));
    request
        .body(Full::new(Bytes::from(input.body.unwrap_or_default())))
        .map(Validated)
        .map_err(|_| Error::INVALID)
}
struct Driver(tokio::task::JoinHandle<()>);
impl Drop for Driver {
    fn drop(&mut self) {
        self.0.abort();
    }
}
fn headers(values: &HeaderMap) -> Result<Vec<(String, String)>, Error> {
    values
        .iter()
        .map(|(name, value)| {
            Ok((
                name.as_str().to_owned(),
                value.to_str().map_err(|_| Error::RESPONSE)?.to_owned(),
            ))
        })
        .collect()
}
async fn open(
    path: &Path,
    request: Request<Full<Bytes>>,
) -> Result<(hyper::Response<Incoming>, Driver), Error> {
    let socket = native_io::connect(path).await?;
    let (mut sender, connection) = http1::Builder::new()
        .max_headers(64)
        .max_buf_size(65536)
        .handshake(TokioIo::new(socket))
        .await
        .map_err(|_| Error::UNAVAILABLE)?;
    // Send/body results report failures; never log protocol data from the driver.
    let driver = Driver(tokio::spawn(async move {
        let _ = connection.await;
    }));
    let response = sender
        .send_request(request)
        .await
        .map_err(|_| Error::UNAVAILABLE)?;
    Ok((response, driver))
}
pub(crate) async fn request(path: &Path, input: Input) -> Result<Response, Error> {
    let request = validate(input)?;
    tokio::time::timeout(Duration::from_secs(30), async {
        let (response, _driver) = open(path, request.0).await?;
        let status = response.status().as_u16();
        let headers = headers(response.headers())?;
        let body = Limited::new(response.into_body(), LIMIT)
            .collect()
            .await
            .map_err(|_| Error::RESPONSE)?
            .to_bytes()
            .to_vec();
        Ok(Response {
            status,
            headers,
            body,
        })
    })
    .await
    .map_err(|_| Error::TIMEOUT)?
}
pub(crate) struct Subscription {
    body: Incoming,
    _driver: Driver,
}
pub(crate) async fn subscribe(
    path: &Path,
    request: Validated,
) -> Result<(u16, Vec<(String, String)>, Subscription), Error> {
    let (response, driver) = tokio::time::timeout(Duration::from_secs(30), open(path, request.0))
        .await
        .map_err(|_| Error::TIMEOUT)??;
    let status = response.status().as_u16();
    let headers = headers(response.headers())?;
    Ok((
        status,
        headers,
        Subscription {
            body: response.into_body(),
            _driver: driver,
        },
    ))
}
impl Subscription {
    pub async fn next(&mut self) -> Result<Option<Vec<u8>>, Error> {
        while let Some(frame) = self.body.frame().await {
            if let Ok(bytes) = frame.map_err(|_| Error::RESPONSE)?.into_data() {
                if bytes.len() > LIMIT {
                    return Err(Error::RESPONSE);
                }
                return Ok(Some(bytes.to_vec()));
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
#[path = "../tests/transport.rs"]
mod tests;
