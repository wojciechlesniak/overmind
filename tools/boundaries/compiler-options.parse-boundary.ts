// SPDX-License-Identifier: Apache-2.0
import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { readSource } from "./policy.parse-boundary.ts";

function within(root: string, path: string): boolean {
  const distance = relative(root, path);
  return !isAbsolute(distance) && distance !== ".." && !distance.startsWith(`..${sep}`);
}
/** Shared metadata-only host: source links deny; dependency links must end in the real store. */
export function resolutionHost(root: string, limit = 2 * 1024 * 1024): ts.ModuleResolutionHost {
  const nodeModules = resolve(root, "node_modules");
  const store = resolve(nodeModules, ".pnpm");
  const device = lstatSync(root).dev;
  function admit(path: string): { path: string; directory: boolean } | undefined {
    const absolute = resolve(path);
    if (!within(root, absolute)) {
      return undefined;
    }
    if (/[\p{Cc}]/u.test(path)) {
      throw new Error("Invalid repository source input.");
    }
    const dependency = within(nodeModules, absolute);
    let current = root;
    const parts = relative(root, absolute).split(sep).filter(Boolean);
    for (const [index, part] of parts.entries()) {
      current = resolve(current, part);
      let info = lstatSync(current, { throwIfNoEntry: false });
      if (!info) {
        return undefined;
      }
      if (info.isSymbolicLink()) {
        if (!dependency || current === nodeModules || current === store) {
          throw new Error("Invalid repository source input.");
        }
        const destination = realpathSync(current);
        if (!within(store, destination) || realpathSync(store) !== store) {
          throw new Error("Invalid repository source input.");
        }
        current = destination;
        info = lstatSync(current);
      }
      if (info.dev !== device || (!info.isFile() && !info.isDirectory())) {
        throw new Error("Invalid repository source input.");
      }
      if (index < parts.length - 1 && info.isFile()) {
        return undefined;
      }
    }
    const info = lstatSync(current);
    if (info.isFile() && dependency && !within(store, current)) {
      throw new Error("Invalid repository source input.");
    }
    return { path: current, directory: info.isDirectory() };
  }
  function read(path: string): string | undefined {
    const input = admit(path);
    if (!input || input.directory) {
      return undefined;
    }
    return readSource(root, input.path, path.endsWith("/package.json") ? 128 * 1024 : limit);
  }
  return {
    useCaseSensitiveFileNames: true,
    getCurrentDirectory: () => root,
    fileExists: (path) => read(path) !== undefined,
    readFile: read,
    directoryExists: (path) => admit(path)?.directory === true,
    realpath: (path) => {
      const input = admit(path);
      if (!input) {
        throw new Error("Invalid repository source input.");
      }
      return input.path;
    },
  };
}
export function compilerOptions(root: string, filename: string): ts.CompilerOptions {
  try {
    const canonicalRoot = realpathSync(root);
    // Admit the original source path before searching; realpath must not erase a source alias.
    readSource(canonicalRoot, filename);
    const defaults = {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
    };
    let directory = dirname(filename);
    for (;;) {
      const config = resolve(directory, "tsconfig.json");
      if (lstatSync(config, { throwIfNoEntry: false })) {
        const host = resolutionHost(canonicalRoot, 512 * 1024);
        const parsed = ts.getParsedCommandLineOfConfigFile(config, undefined, {
          ...host,
          useCaseSensitiveFileNames: true,
          getCurrentDirectory: () => canonicalRoot,
          // This seam reads options, not program membership. No files or directories are invented.
          readDirectory: () => [],
          readFile: (path) => {
            const text = host.readFile(path);
            if (text !== undefined && ts.parseConfigFileTextToJson(path, text).error) {
              throw new Error("Invalid TypeScript configuration.");
            }
            return text;
          },
          onUnRecoverableConfigFileDiagnostic: () => {
            throw new Error("Invalid TypeScript configuration.");
          },
        });
        // 18003 is the program's empty-input diagnostic, unrelated to option/config validity.
        if (!parsed || parsed.errors.some((error) => error.code !== 18003)) {
          throw new Error("Invalid TypeScript configuration.");
        }
        return { ...defaults, ...parsed.options };
      }
      if (directory === canonicalRoot) {
        return defaults;
      }
      const parent = dirname(directory);
      if (parent === directory || !within(canonicalRoot, parent)) {
        throw new Error("Invalid TypeScript configuration.");
      }
      directory = parent;
    }
  } catch {
    throw new Error("Invalid TypeScript configuration.");
  }
}
