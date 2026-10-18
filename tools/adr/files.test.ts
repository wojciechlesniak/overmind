// SPDX-License-Identifier: Apache-2.0
import type * as FileSystem from "node:fs";
import type * as Crypto from "node:crypto";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Files } from "./files.ts";

const temporaryId = vi.hoisted(() => "00000000-0000-4000-8000-000000000049");

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof Crypto>();
  return { ...actual, randomUUID: () => temporaryId };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof FileSystem>();
  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
});

afterEach(async () => {
  const actual = await vi.importActual<typeof FileSystem>("node:fs");
  vi.mocked(writeFileSync).mockReset().mockImplementation(actual.writeFileSync);
});

function withFiles(run: (root: string, files: Files) => void): void {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "ove-adr-atomic-write-")));
  try {
    run(root, new Files(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("replacing an existing file publishes the replacement without temporary artifacts", () => {
  withFiles((root, files) => {
    writeFileSync(resolve(root, "record.md"), "original document\n");

    files.write("record.md", "updated document\n", "original document\n");

    expect(readFileSync(resolve(root, "record.md"), "utf8")).toBe("updated document\n");
    expect(readdirSync(root).sort()).toEqual(["record.md"]);
  });
});

test("a temporary-name collision preserves the other file and original document", () => {
  withFiles((root, files) => {
    const destination = resolve(root, "record.md");
    const temporary = resolve(root, `.adr-${temporaryId}.tmp`);
    writeFileSync(destination, "original document\n");
    writeFileSync(temporary, "another operation owns these bytes\n");
    const original = lstatSync(destination);
    const competing = lstatSync(temporary);
    const entries = readdirSync(root).sort();

    expect(() => {
      files.write("record.md", "updated document\n", "original document\n");
    }).toThrow(expect.objectContaining({ code: "EEXIST" }));

    expect(readFileSync(destination, "utf8")).toBe("original document\n");
    expect(readFileSync(temporary, "utf8")).toBe("another operation owns these bytes\n");
    expect(lstatSync(destination).ino).toBe(original.ino);
    expect(lstatSync(temporary).ino).toBe(competing.ino);
    expect(readdirSync(root).sort()).toEqual(entries);
  });
});

test("an interrupted real write cleans its own partial file and preserves the original", async () => {
  const actual = await vi.importActual<typeof FileSystem>("node:fs");
  withFiles((root, files) => {
    writeFileSync(resolve(root, "record.md"), "original document\n");
    vi.mocked(writeFileSync).mockImplementationOnce((file, _data, options) => {
      actual.writeFileSync(file, "partial replacement\n", options);
      throw new Error("Interrupted fixture write");
    });

    expect(() => {
      files.write("record.md", "updated document\n", "original document\n");
    }).toThrow("Interrupted fixture write");

    expect(readFileSync(resolve(root, "record.md"), "utf8")).toBe("original document\n");
    expect(readdirSync(root).sort()).toEqual(["record.md"]);
  });
});

test("a replaced temporary file is neither published nor removed by cleanup", async () => {
  const actual = await vi.importActual<typeof FileSystem>("node:fs");
  withFiles((root, files) => {
    const temporary = resolve(root, `.adr-${temporaryId}.tmp`);
    const retained = resolve(root, "retained-writer-output.tmp");
    writeFileSync(resolve(root, "record.md"), "original document\n");
    vi.mocked(writeFileSync).mockImplementationOnce((file, data, options) => {
      actual.writeFileSync(file, data, options);
      actual.renameSync(temporary, retained);
      actual.writeFileSync(temporary, "another operation owns these bytes\n");
    });

    expect(() => {
      files.write("record.md", "updated document\n", "original document\n");
    }).toThrow();

    expect(readFileSync(resolve(root, "record.md"), "utf8")).toBe("original document\n");
    expect(readFileSync(temporary, "utf8")).toBe("another operation owns these bytes\n");
    expect(readFileSync(retained, "utf8")).toBe("updated document\n");
    expect(readdirSync(root).sort()).toEqual([
      `.adr-${temporaryId}.tmp`,
      "record.md",
      "retained-writer-output.tmp",
    ]);
  });
});
