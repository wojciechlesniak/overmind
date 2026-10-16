use nix::{
    sys::socket::{getsockopt, sockopt::LocalPeerCred},
    unistd::geteuid,
};
use serde::Serialize;
use std::{
    fs::{self, DirBuilder, File, OpenOptions},
    io::Write,
    os::unix::fs::{DirBuilderExt, FileTypeExt, MetadataExt, OpenOptionsExt},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::net::UnixStream;
#[derive(Clone, Debug)]
pub(crate) struct Paths {
    pub engine: PathBuf,
    pub gateway: PathBuf,
    pub log: PathBuf,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum NativeError {
    Unavailable,
    Insecure,
}
impl std::fmt::Display for NativeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Unavailable => "native.unavailable",
            Self::Insecure => "native.insecure",
        })
    }
}
impl std::error::Error for NativeError {}
impl Paths {
    // ASSUMPTION(OVE_ARCH005): replaced by the shared data-directory layout when it lands.
    pub fn from_home(home: PathBuf) -> Result<Self, NativeError> {
        if !home.is_absolute() {
            return Err(NativeError::Insecure);
        }
        let run = home.join("Library/Application Support/Overmind/run");
        Ok(Self {
            engine: run.join("engine.sock"),
            gateway: run.join("gateway.sock"),
            log: home.join("Library/Logs/Overmind/desktop.log"),
        })
    }
}
fn checked_directory(path: &Path, private: bool) -> Result<(), NativeError> {
    if path.canonicalize().map_err(|_| NativeError::Unavailable)? != path {
        return Err(NativeError::Insecure);
    }
    let metadata = fs::symlink_metadata(path).map_err(|_| NativeError::Unavailable)?;
    if !metadata.file_type().is_dir()
        || metadata.uid() != geteuid().as_raw()
        || (private && metadata.mode() & 0o077 != 0)
    {
        return Err(NativeError::Insecure);
    }
    Ok(())
}
pub(crate) fn init_logging(paths: &Paths) -> Result<(), NativeError> {
    let parent = paths.log.parent().ok_or(NativeError::Insecure)?;
    let logs = parent.parent().ok_or(NativeError::Insecure)?;
    let library = logs.parent().ok_or(NativeError::Insecure)?;
    for path in [library, logs, parent] {
        if !path.try_exists().map_err(|_| NativeError::Unavailable)? {
            DirBuilder::new()
                .mode(0o700)
                .create(path)
                .map_err(|_| NativeError::Unavailable)?;
        }
        checked_directory(path, path == parent)?;
    }
    log(paths, "desktop.starting", "starting")
}
#[derive(Serialize)]
struct LogLine {
    timestamp_ms: u128,
    event: &'static str,
    code: &'static str,
}
static LOG_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
pub(crate) fn log(
    paths: &Paths,
    event: &'static str,
    code: &'static str,
) -> Result<(), NativeError> {
    let _lock = LOG_LOCK.lock().map_err(|_| NativeError::Unavailable)?;
    checked_directory(paths.log.parent().ok_or(NativeError::Insecure)?, true)?;
    let mut file: File = OpenOptions::new()
        .create(true)
        .append(true)
        .mode(0o600)
        .custom_flags(nix::libc::O_NOFOLLOW)
        .open(&paths.log)
        .map_err(|_| NativeError::Unavailable)?;
    let metadata = file.metadata().map_err(|_| NativeError::Unavailable)?;
    if !metadata.is_file()
        || metadata.uid() != geteuid().as_raw()
        || metadata.mode() & 0o077 != 0
        || metadata.nlink() != 1
    {
        return Err(NativeError::Insecure);
    }
    let line = LogLine {
        timestamp_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        event,
        code,
    };
    serde_json::to_writer(&mut file, &line).map_err(|_| NativeError::Unavailable)?;
    file.write_all(b"\n")
        .map_err(|_| NativeError::Unavailable)?;
    file.sync_data().map_err(|_| NativeError::Unavailable)
}
pub(crate) async fn connect(path: &Path) -> Result<UnixStream, NativeError> {
    checked_directory(path.parent().ok_or(NativeError::Insecure)?, true)?;
    let metadata = fs::symlink_metadata(path).map_err(|_| NativeError::Unavailable)?;
    if !metadata.file_type().is_socket()
        || metadata.uid() != geteuid().as_raw()
        || metadata.mode() & 0o077 != 0
    {
        return Err(NativeError::Insecure);
    }
    let stream = UnixStream::connect(path)
        .await
        .map_err(|_| NativeError::Unavailable)?;
    let peer = getsockopt(&stream, LocalPeerCred).map_err(|_| NativeError::Insecure)?;
    if peer.uid() != geteuid().as_raw() {
        return Err(NativeError::Insecure);
    }
    Ok(stream)
}

#[cfg(test)]
#[path = "../tests/native_io.rs"]
mod tests;
