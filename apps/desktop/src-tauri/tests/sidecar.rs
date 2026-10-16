use super::*;
use crate::{engine, tests::support::Fixture};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};
static HELPER_LOCK: Mutex<()> = Mutex::new(());
struct Helper(PathBuf);
impl Helper {
    fn create(script: &str) -> Self {
        let executable = std::env::current_exe().unwrap();
        let path = executable
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("overmind-engine");
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .expect("refuse to overwrite a real sidecar");
        file.write_all(script.as_bytes()).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        Self(path)
    }
}
impl Drop for Helper {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}
struct Service(u32);
impl Drop for Service {
    fn drop(&mut self) {
        let _ = Command::new("/bin/kill")
            .arg(self.0.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}
fn app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
        .plugin(tauri_plugin_shell::init())
        .build(crate::context())
        .unwrap()
}
#[test]
fn exact_sidecar_arguments_and_service_survive_app_drop() {
    let _lock = HELPER_LOCK.lock().unwrap();
    let f = Fixture::new();
    let socket = f.paths.engine.to_str().unwrap();
    let daemon = format!(
        "import socket,os,time; s=socket.socket(socket.AF_UNIX); s.bind({socket:?}); os.chmod({socket:?},0o600); s.listen(); c,_=s.accept(); c.recv(100); c.sendall(b'{{}}'); c.close(); time.sleep(30)"
    );
    let script = format!(
        "#!/usr/bin/python3\nimport subprocess,sys,json,time,os\nassert sys.argv[1:]==['ensure-running','--json']\np=subprocess.Popen(['/usr/bin/python3','-c',{daemon:?}],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)\nfor _ in range(200):\n if os.path.exists({socket:?}): break\n time.sleep(.01)\nprint(json.dumps(dict(status='running',pid=p.pid,socket={socket:?})),flush=True)\n"
    );
    let _helper = Helper::create(&script);
    let app = app();
    let outcome = tauri::async_runtime::block_on(launch(app.handle().clone())).unwrap();
    assert_eq!(outcome.code, 0);
    let receipt: serde_json::Value = serde_json::from_slice(&outcome.output).unwrap();
    let service = Service(u32::try_from(receipt["pid"].as_u64().unwrap()).unwrap());
    drop(app);
    assert!(tauri::async_runtime::block_on(engine::ping(&f.paths)).is_ok());
    assert!(
        Command::new("/bin/kill")
            .args(["-0", &service.0.to_string()])
            .status()
            .unwrap()
            .success()
    );
}
#[test]
fn outer_timeout_kills_hung_helper_and_reports_safe_error() {
    let _lock = HELPER_LOCK.lock().unwrap();
    let f = Fixture::new();
    let pidfile = f.root.join("helper.pid");
    let script = format!(
        "#!/usr/bin/python3\nimport os,time\nopen({:?},'w').write(str(os.getpid()))\ntime.sleep(60)\n",
        pidfile.to_str().unwrap()
    );
    let _helper = Helper::create(&script);
    let app = app();
    let status =
        tauri::async_runtime::block_on(engine::ensure(&f.paths, || launch(app.handle().clone())));
    assert_eq!(status.detail, Some("timeout"));
    let pid = fs::read_to_string(pidfile).unwrap();
    assert!(
        !Command::new("/bin/kill")
            .args(["-0", &pid])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .unwrap()
            .success()
    );
}
