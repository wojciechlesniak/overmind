use serde_json::Value;

pub(crate) fn development_config(
    mut config: Value,
    profile: &str,
    sidecar_present: bool,
    version: &Value,
) -> Option<Value> {
    if profile == "release" || sidecar_present {
        return None;
    }
    config["bundle"]["externalBin"] = serde_json::json!([]);
    let resources = config["bundle"]["resources"]
        .as_object_mut()
        .expect("Tauri resources must be an explicit map");
    for resource in [
        "binaries/overmind-engine.resources/engine.cjs.map",
        "binaries/overmind-engine.resources/LICENSE",
    ] {
        resources.remove(resource);
    }
    config["version"] = version.clone();
    Some(config)
}
