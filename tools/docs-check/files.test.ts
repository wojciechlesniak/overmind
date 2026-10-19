import {
  mkdtemp,
  mkdir,
  symlink,
  writeFile,
  rm,
  unlink,
  open,
  appendFile,
  rename,
} from "node:fs/promises";
import { constants } from "node:fs";
import type * as FileSystem from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import {
  readRepositoryFile,
  readBoundedFile,
  MAX_DOCUMENT_BYTES,
  type ReadableFile,
} from "./files.ts";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystem>();
  return { ...actual, open: vi.fn(actual.open) };
});

it("stops at the byte bound when a real file grows during positional reading", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-live-growth-"));
  const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
  const path = join(root, "guide.md");
  await writeFile(path, "# Small\n");
  const handle = await actual.open(path, constants.O_RDONLY);
  let grown = false;
  let requested = 0;
  let consumed = 0;
  const source: ReadableFile = {
    stat: () => handle.stat(),
    read: async (buffer, offset, length, position) => {
      if (!grown) {
        grown = true;
        await appendFile(path, Buffer.alloc(MAX_DOCUMENT_BYTES * 2, 65));
      }
      requested += length;
      const chunk = await handle.read(buffer, offset, length, position);
      consumed += chunk.bytesRead;
      return chunk;
    },
  };
  try {
    await expect(readBoundedFile(source)).rejects.toThrow();
    expect(grown).toBe(true);
    expect(requested).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES + 1);
    expect(consumed).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES + 1);
  } finally {
    await handle.close();
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects an inode replaced after canonicalization before any content is read", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-inode-"));
  const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
  let reads = () => 0;
  try {
    await writeFile(join(root, "guide.md"), "# Small\n");
    vi.mocked(open).mockImplementationOnce(async (path, flags, mode) => {
      await rename(path, join(root, "previous.md"));
      await writeFile(path, "# Other\n");
      const handle = await actual.open(path, flags, mode);
      const whole = vi.spyOn(handle, "readFile");
      const chunks = vi.spyOn(handle, "read");
      reads = () => whole.mock.calls.length + chunks.mock.calls.length;
      return handle;
    });
    await expect(readRepositoryFile(root, "guide.md")).rejects.toThrow();
    expect(reads()).toBe(0);
  } finally {
    vi.mocked(open).mockReset().mockImplementation(actual.open);
    await rm(root, { recursive: true, force: true });
  }
});

it("reads real repository files and denies symlinks escaping root or executable plugin aliases", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-files-"));
  const outside = await mkdtemp(join(tmpdir(), "ove-doc-outside-"));
  try {
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "README.md"), "# Root\n");
    await writeFile(join(outside, "secret.txt"), "private fixture");
    await symlink(join(outside, "secret.txt"), join(root, "docs", "escape.md"));
    await symlink("README.md", join(root, "alias.md"));
    expect(await readRepositoryFile(root, "README.md")).toBe("# Root\n");
    await expect(readRepositoryFile(root, "docs/escape.md")).rejects.toThrow();
    await expect(readRepositoryFile(root, "alias.md", true)).rejects.toThrow();
    await expect(readRepositoryFile(root, "../secret.txt")).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

it("rejects a real file grown after the precheck before reading any data", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-growth-"));
  const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
  let reads = () => 0;
  try {
    await writeFile(join(root, "guide.md"), "# Small\n");
    vi.mocked(open).mockImplementationOnce(async (path, flags, mode) => {
      await writeFile(path, Buffer.alloc(2_097_152, 65));
      const handle = await actual.open(path, flags, mode);
      const whole = vi.spyOn(handle, "readFile");
      const chunks = vi.spyOn(handle, "read");
      reads = () => whole.mock.calls.length + chunks.mock.calls.length;
      return handle;
    });
    await expect(readRepositoryFile(root, "guide.md")).rejects.toThrow();
    expect(reads()).toBe(0);
  } finally {
    vi.mocked(open).mockReset().mockImplementation(actual.open);
    await rm(root, { recursive: true, force: true });
  }
});

it("opens a raced FIFO without blocking and rejects it before data access", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-fifo-"));
  const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
  let nonblocking = false;
  let reads = () => 0;
  try {
    await writeFile(join(root, "guide.md"), "# Small\n");
    vi.mocked(open).mockImplementationOnce(async (path, flags, mode) => {
      await unlink(path);
      execFileSync("mkfifo", [String(path)]);
      nonblocking = typeof flags === "number" && (flags & constants.O_NONBLOCK) !== 0;
      if (!nonblocking) {
        throw new Error("Refuse a blocking FIFO open in the regression fixture.");
      }
      const handle = await actual.open(path, flags, mode);
      const whole = vi.spyOn(handle, "readFile");
      const chunks = vi.spyOn(handle, "read");
      reads = () => whole.mock.calls.length + chunks.mock.calls.length;
      return handle;
    });
    await expect(readRepositoryFile(root, "guide.md")).rejects.toThrow();
    expect(nonblocking).toBe(true);
    expect(reads()).toBe(0);
  } finally {
    vi.mocked(open).mockReset().mockImplementation(actual.open);
    await rm(root, { recursive: true, force: true });
  }
});

it.each([
  { name: "invalid UTF-8 sequence", bytes: [0xff] },
  { name: "truncated UTF-8 sequence", bytes: [0xe2, 0x82] },
])("rejects $name through the real bounded repository reader", async ({ bytes }) => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-utf8-denial-"));
  try {
    await writeFile(join(root, "guide.md"), Buffer.from(bytes));
    await expect(readRepositoryFile(root, "guide.md")).rejects.toThrow(
      /^Repository file is not valid UTF-8\.$/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("preserves valid Unicode, a leading BOM and literal replacement characters", async () => {
  const root = await mkdtemp(join(tmpdir(), "ove-doc-utf8-preservation-"));
  const contents = "\ufeff# Unicode \u03a9 and \ufffd\n";
  try {
    await writeFile(join(root, "guide.md"), contents);
    expect(await readRepositoryFile(root, "guide.md")).toBe(contents);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
