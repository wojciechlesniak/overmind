#![forbid(unsafe_code)]
use std::{env, fs, path::PathBuf};
mod build_config;
fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=../package.json");
    let mut attributes =
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "gateway_request",
            "gateway_subscribe",
            "pick_directory",
        ]));
    let target = env::var("TARGET").expect("Cargo target unavailable");
    let profile = env::var("PROFILE").expect("Cargo profile unavailable");
    let sidecar_present = PathBuf::from(format!("binaries/overmind-engine-{target}")).is_file();
    if profile != "release" && !sidecar_present {
        let config: serde_json::Value =
            serde_json::from_slice(&fs::read("tauri.conf.json").expect("Tauri config unavailable"))
                .expect("Invalid Tauri config");
        let package: serde_json::Value = serde_json::from_slice(
            &fs::read("../package.json").expect("Desktop manifest unavailable"),
        )
        .expect("Invalid desktop manifest");
        let config = build_config::development_config(
            config,
            &profile,
            sidecar_present,
            &package["version"],
        )
        .expect("Source-only development configuration required");
        let directory = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo output unavailable"))
            .join("dev-config");
        fs::create_dir_all(&directory).expect("Cannot create dev build config");
        let path = directory.join("tauri.conf.json");
        fs::write(
            &path,
            serde_json::to_vec(&config).expect("Cannot encode dev config"),
        )
        .expect("Cannot write dev config");
        attributes = attributes.config_path(path);
    }
    tauri_build::try_build(attributes).expect("Tauri build configuration rejected");
}
