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
#[test]
fn native_resource_copy_preserves_complete_mpl_sources_and_notices() {
    let exe = std::env::current_exe().unwrap();
    let resources = exe
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("licenses/rust");
    macro_rules! source {
        ($name:literal) => {
            (
                $name,
                include_bytes!(concat!(
                    env!("CARGO_MANIFEST_DIR"),
                    "/../../../third-party/rust/sources/",
                    $name
                ))
                .as_slice(),
            )
        };
    }
    for (name, expected) in [
        source!("cssparser-0.37.0.crate"),
        source!("cssparser-macros-0.7.1.crate"),
        source!("dtoa-short-0.3.5.crate"),
        source!("option-ext-0.2.0.crate"),
        source!("selectors-0.38.0.crate"),
    ] {
        assert_eq!(
            std::fs::read(resources.join("sources").join(name)).unwrap(),
            expected
        );
    }
    assert_eq!(
        std::fs::read_to_string(resources.join("README.md")).unwrap(),
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../third-party/rust/README.md"
        ))
    );
    let count: usize = std::fs::read_dir(resources.join("licenses"))
        .unwrap()
        .map(|directory| {
            std::fs::read_dir(directory.unwrap().path())
                .unwrap()
                .count()
        })
        .sum();
    assert_eq!(count, 29);
}

#[path = "../build_config.rs"]
mod build_config;

fn packaging_config() -> serde_json::Value {
    serde_json::from_str(include_str!("../tauri.conf.json")).unwrap()
}

#[test]
fn source_only_rust_build_omits_only_generated_engine_resources() {
    let mut original = packaging_config();
    original["bundle"]["resources"]["extra-notice.txt"] = serde_json::json!("licenses/extra.txt");
    let mut expected = original.clone();
    expected["bundle"]["externalBin"] = serde_json::json!([]);
    expected["bundle"]["resources"] = serde_json::json!({
        "../../../third-party/rust/": "licenses/rust/",
        "extra-notice.txt": "licenses/extra.txt"
    });
    expected["version"] = serde_json::json!("0.0.0");
    assert_eq!(
        build_config::development_config(original, "debug", false, &serde_json::json!("0.0.0")),
        Some(expected)
    );
}

#[test]
fn release_build_never_omits_missing_engine_resources() {
    assert!(
        build_config::development_config(
            packaging_config(),
            "release",
            false,
            &serde_json::json!("0.0.0")
        )
        .is_none()
    );
}

#[test]
fn packaged_debug_build_retains_required_engine_resources() {
    assert!(
        build_config::development_config(
            packaging_config(),
            "debug",
            true,
            &serde_json::json!("0.0.0")
        )
        .is_none()
    );
}

#[test]
fn source_only_rust_build_rejects_implicit_resource_maps() {
    let mut malformed = packaging_config();
    malformed["bundle"]["resources"] = serde_json::json!([]);
    assert!(
        std::panic::catch_unwind(|| build_config::development_config(
            malformed,
            "debug",
            false,
            &serde_json::json!("0.0.0")
        ))
        .is_err()
    );
}
