use crate::native_io::Paths;
use std::{
    fs,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
use tokio::net::UnixListener;
static NEXT: AtomicU64 = AtomicU64::new(0);
pub struct Fixture {
    pub root: PathBuf,
    pub paths: Paths,
}
impl Fixture {
    pub fn new() -> Self {
        let root = std::env::temp_dir().canonicalize().unwrap().join(format!(
            "ove010-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        Self {
            paths: Paths {
                engine: root.join("e.sock"),
                gateway: root.join("g.sock"),
                log: root.join("desktop.log"),
            },
            root,
        }
    }
    pub fn socket(&self, path: &std::path::Path) -> UnixListener {
        let listener = UnixListener::bind(path).unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).unwrap();
        listener
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
