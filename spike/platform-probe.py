"""Temporary LaunchAgent checks; only this experiment's own fixture is read."""
import json
import os
import plistlib
import socket
import stat
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESULTS = []
DOMAIN = "gui/" + str(os.getuid())


def command(args, timeout=10):
    result = subprocess.run(args, text=True, capture_output=True, timeout=timeout)
    return {"status": result.returncode, "stdout": result.stdout, "stderr": result.stderr}


def launch(executable, candidate, mode, data, iteration):
    label = "dev.overmind.ove011." + candidate.lower() + "." + mode + "." + str(iteration)
    out, err = data / "stdout.txt", data / "stderr.txt"
    plist = data / "probe.plist"
    payload = {"Label": label, "ProgramArguments": [str(executable), "--mode", mode, "--dir", str(data)], "RunAtLoad": True,
               "StandardOutPath": str(out), "StandardErrorPath": str(err)}
    plist.write_bytes(plistlib.dumps(payload))
    started = time.monotonic()
    bootstrap = command(["/bin/launchctl", "bootstrap", DOMAIN, str(plist)])
    try:
        for _ in range(100):
            stdout = out.read_text() if out.exists() else ""
            stderr = err.read_text() if err.exists() else ""
            if stdout or bootstrap["status"]:
                break
            time.sleep(0.05)
        ready_ms = (time.monotonic() - started) * 1000
        response = None
        if mode == "serve" and (data / "engine.sock").exists():
            with socket.socket(socket.AF_UNIX) as client:
                client.settimeout(2)
                client.connect(str(data / "engine.sock"))
                response = client.recv(8192).decode()
            socket_mode = stat.S_IMODE((data / "engine.sock").stat().st_mode)
        else:
            socket_mode = None
        return {"candidate": candidate, "iteration": iteration, "mode": mode, "bootstrap": bootstrap,
                "readyMs": ready_ms, "stdout": stdout, "stderr": stderr, "socketMode": socket_mode, "response": response}
    finally:
        command(["/bin/launchctl", "bootout", DOMAIN + "/" + label])


def main():
    fixture = Path.home() / "Documents/.overmind-ove011-probe.txt"
    marker = b"overmind-owned-nonsensitive-probe\n"
    created = False
    try:
        if fixture.parent.is_symlink():
            raise RuntimeError("Documents symlink: TCC fixture not created")
        fd = os.open(fixture, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as file:
            file.write(marker)
        created = True
        for candidate, iteration in (("A", 0), ("B", 0), ("C", 0)):
            executable = ROOT / "dist" / candidate / str(iteration) / "Contents/MacOS/overmind-engine"
            for run in range(1, 11):
                data = Path(tempfile.mkdtemp(prefix="ove11-launch-", dir="/private/tmp"))
                result = launch(executable, candidate, "serve", data, run)
                RESULTS.append(result)
                print(json.dumps(result), flush=True)
                if not result["response"]:
                    break
            data = Path(tempfile.mkdtemp(prefix="ove11-tcc-", dir="/private/tmp"))
            result = launch(executable, candidate, "tcc", data, 1)
            RESULTS.append(result)
            print(json.dumps(result), flush=True)
    finally:
        if created and not fixture.is_symlink() and fixture.read_bytes() == marker:
            fixture.unlink()
        (ROOT / "dist/platform-results.json").write_text(json.dumps(RESULTS, indent=2) + "\n")


if __name__ == "__main__":
    main()
