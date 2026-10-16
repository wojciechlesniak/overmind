use super::*;
use crate::tests::support::Fixture;
use std::os::unix::fs::{PermissionsExt, symlink};
#[tokio::test]
async fn sockets_require_private_owner_directory_and_mode() {
    let f = Fixture::new();
    let _listener = f.socket(&f.paths.gateway);
    assert!(connect(&f.paths.gateway).await.is_ok());
    fs::set_permissions(&f.paths.gateway, fs::Permissions::from_mode(0o666)).unwrap();
    assert_eq!(
        connect(&f.paths.gateway).await.unwrap_err(),
        NativeError::Insecure
    );
    fs::set_permissions(&f.paths.gateway, fs::Permissions::from_mode(0o600)).unwrap();
    fs::set_permissions(&f.root, fs::Permissions::from_mode(0o777)).unwrap();
    assert_eq!(
        connect(&f.paths.gateway).await.unwrap_err(),
        NativeError::Insecure
    );
}
#[tokio::test]
async fn socket_and_ancestor_symlinks_are_refused() {
    let f = Fixture::new();
    let other = Fixture::new();
    let _listener = f.socket(&f.paths.gateway);
    let linked = other.root.join("linked.sock");
    symlink(&f.paths.gateway, &linked).unwrap();
    assert_eq!(connect(&linked).await.unwrap_err(), NativeError::Insecure);
    let ancestor = other.root.join("ancestor");
    symlink(&f.root, &ancestor).unwrap();
    assert_eq!(
        connect(&ancestor.join("g.sock")).await.unwrap_err(),
        NativeError::Insecure
    );
}
#[tokio::test]
async fn ordinary_files_and_missing_sockets_are_refused() {
    let f = Fixture::new();
    assert_eq!(
        connect(&f.paths.gateway).await.unwrap_err(),
        NativeError::Unavailable
    );
    fs::write(&f.paths.gateway, "untrusted").unwrap();
    assert_eq!(
        connect(&f.paths.gateway).await.unwrap_err(),
        NativeError::Insecure
    );
}
#[test]
fn structured_log_is_private_and_contains_only_static_fields() {
    let f = Fixture::new();
    log(&f.paths, "bridge.denied", "bridge.invalid_request").unwrap();
    log(&f.paths, "engine.status", "running").unwrap();
    assert_eq!(fs::metadata(&f.paths.log).unwrap().mode() & 0o777, 0o600);
    let content = fs::read_to_string(&f.paths.log).unwrap();
    assert_eq!(content.lines().count(), 2);
    for line in content.lines() {
        let value: serde_json::Value = serde_json::from_str(line).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 3);
    }
    fs::set_permissions(&f.paths.log, fs::Permissions::from_mode(0o644)).unwrap();
    assert_eq!(
        log(&f.paths, "bridge.denied", "blocked"),
        Err(NativeError::Insecure)
    );
    assert_eq!(fs::read_to_string(&f.paths.log).unwrap(), content);
}
#[test]
fn logger_rejects_symlinks_and_hardlinks_without_writing() {
    let f = Fixture::new();
    let other = f.root.join("other");
    fs::write(&other, "untouched").unwrap();
    symlink(&other, &f.paths.log).unwrap();
    assert!(log(&f.paths, "test", "denied").is_err());
    fs::remove_file(&f.paths.log).unwrap();
    fs::hard_link(&other, &f.paths.log).unwrap();
    assert!(log(&f.paths, "test", "denied").is_err());
    assert_eq!(fs::read_to_string(other).unwrap(), "untouched");
}
