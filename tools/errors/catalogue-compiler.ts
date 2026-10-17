import { existsSync, lstatSync, readSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import ts from "typescript";
import { parseCompilerInput } from "./catalogue-compiler.parse-boundary.ts";

const maxInputBytes = 262_144;
const root = realpathSync(resolve(import.meta.dirname, "../.."));
const sourceDirectory = realpathSync(resolve(root, "packages/contracts/src/errors"));
const sourceDevice = lstatSync(sourceDirectory).dev;

function canonicalSource(path: string): void {
  if (resolve(path) !== path || dirname(path) !== sourceDirectory) {
    throw new Error("Invalid compiler source location.");
  }
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat) {
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.dev !== sourceDevice ||
      realpathSync(path) !== path
    ) {
      throw new Error("Invalid compiler source identity.");
    }
  }
}

function readInput(): string {
  const chunks: Buffer[] = [];
  const buffer = Buffer.alloc(16_384);
  let total = 0;
  for (;;) {
    const bytes = readSync(0, buffer, 0, buffer.length, null);
    if (bytes === 0) {
      break;
    }
    total += bytes;
    if (total > maxInputBytes) {
      throw new Error("Compiler input exceeds its bound.");
    }
    chunks.push(Buffer.from(buffer.subarray(0, bytes)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function compile(): readonly number[] {
  const input = parseCompilerInput(readInput());
  canonicalSource(input.assertionPath);
  if (
    !/^extension\.typecheck(?:_\d+)?\.ts$/u.test(basename(input.assertionPath)) ||
    existsSync(input.assertionPath)
  ) {
    throw new Error("Compiler assertion must be a new fixture.");
  }
  const virtual = new Map(input.files);
  if (virtual.size !== input.files.length || !virtual.has(input.assertionPath)) {
    throw new Error("Invalid compiler overlay inventory.");
  }
  for (const path of virtual.keys()) {
    canonicalSource(path);
    if (
      path !== input.assertionPath &&
      basename(path) !== "index.generated.ts" &&
      !/^[a-z]+\.errors\.ts$/u.test(basename(path))
    ) {
      throw new Error("Compiler overlay is outside its scope.");
    }
  }
  const testPath = resolve(sourceDirectory, "registry.test.ts");
  canonicalSource(testPath);
  const configuration = ts.getParsedCommandLineOfConfigFile(
    resolve(root, "tsconfig.tests.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {
        throw new Error("Cannot read the test compiler configuration.");
      },
    },
  );
  if (!configuration || configuration.errors.length > 0) {
    throw new Error("Invalid test compiler configuration.");
  }
  const options = configuration.options;
  const original = ts.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...original,
    fileExists: (path) => virtual.has(path) || original.fileExists(path),
    readFile: (path) => virtual.get(path) ?? original.readFile(path),
    getSourceFile: (path, version, onError, fresh) => {
      const text = virtual.get(path);
      return text === undefined
        ? original.getSourceFile(path, version, onError, fresh)
        : ts.createSourceFile(path, text, version, true);
    },
  };
  const program = ts.createProgram([testPath, input.assertionPath], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code);
  if (diagnostics.length > 1000) {
    throw new Error("Compiler diagnostics exceed their bound.");
  }
  return diagnostics;
}

try {
  const output = compile().join(",") + "\n";
  if (Buffer.byteLength(output) > 16_384) {
    throw new Error("Compiler output exceeds its bound.");
  }
  process.stdout.write(output);
} catch {
  process.stderr.write("Catalogue compiler failed.\n");
  process.exitCode = 1;
}
