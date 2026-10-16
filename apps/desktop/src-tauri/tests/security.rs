#[path = "support.rs"]
pub(crate) mod support;
use super::*;
#[test]
fn navigation_requires_exact_origin_and_blocks_remote_schemes() {
    for url in [
        "https://example.com",
        "https://tauri.localhost",
        "http://tauri.localhost.evil",
        "tauri://user@localhost",
        "tauri://localhost:99",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
    ] {
        assert!(!navigation_allowed(&url.parse().unwrap(), true), "{url}");
    }
    for url in ["tauri://localhost/index.html", "http://tauri.localhost/"] {
        assert!(navigation_allowed(&url.parse().unwrap(), false));
    }
    let dev = "http://127.0.0.1:5173/".parse().unwrap();
    assert!(!navigation_allowed(&dev, false));
    assert!(navigation_allowed(&dev, true));
}
#[test]
fn actual_capability_resolution_denies_shell_and_remote_ipc() {
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_shell::init())
        .build(context())
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    for url in ["http://tauri.localhost", "https://example.com"] {
        let response = tauri::test::get_ipc_response(
            &window,
            tauri::webview::InvokeRequest {
                cmd: "plugin:shell|execute".into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: url.parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(
                    serde_json::json!({"program":"/usr/bin/true","args":[]}),
                ),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.to_string(),
            },
        );
        let error = response.unwrap_err();
        assert!(error.to_string().contains("not allowed"), "{error}");
    }
}
#[test]
fn custom_permissions_allow_only_main_local_origin() {
    let mut context = context::<tauri::test::MockRuntime>();
    let acl = context.runtime_authority_mut();
    for command in ["gateway_request", "gateway_subscribe", "pick_directory"] {
        assert!(
            acl.resolve_access(command, "main", "main", &tauri::ipc::Origin::Local)
                .is_some()
        );
        assert!(
            acl.resolve_access(command, "other", "other", &tauri::ipc::Origin::Local)
                .is_none()
        );
        assert!(
            acl.resolve_access(
                command,
                "main",
                "main",
                &tauri::ipc::Origin::Remote {
                    url: "https://example.com".parse().unwrap()
                }
            )
            .is_none()
        );
    }
    assert!(
        acl.resolve_access(
            "plugin:shell|execute",
            "main",
            "main",
            &tauri::ipc::Origin::Local
        )
        .is_none()
    );
}

#[test]
fn packaged_debug_mode_rejects_development_origin() {
    assert_eq!(tauri::is_dev(), !cfg!(feature = "custom-protocol"));
    let url = "http://127.0.0.1:5173/".parse().unwrap();
    assert_eq!(
        navigation_allowed(&url, tauri::is_dev()),
        !cfg!(feature = "custom-protocol")
    );
}
