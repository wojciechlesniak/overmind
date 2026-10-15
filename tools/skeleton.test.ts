import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const rootManifest = readJson('package.json');
const workspaceYaml = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
const adapterNames = ['sqlite', 'herdr', 'sandbox-macos', 'providers', 'telegram', 'keychain-macos', 'notifications-macos'];
const expectedEdges: Record<string, string[]> = {
  contracts: [], domain: ['contracts'], application: ['contracts', 'domain'],
  'workflow-runtime': ['application', 'contracts', 'domain'],
  gateway: ['application', 'contracts'], 'api-client': ['contracts'], 'ui-kit': [],
  desktop: ['api-client', 'contracts', 'ui-kit'], tools: [],
};
for (const name of adapterNames) expectedEdges[`adapter-${name}`] = ['application', 'contracts', 'domain'];
expectedEdges["engine"] = Object.keys(expectedEdges).filter(name => !['desktop', 'tools'].includes(name));

function collectManifests(directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', 'tasks', 'docs'].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectManifests(path);
    return entry.name === 'package.json' && directory !== root ? [relative(root, path)] : [];
  });
}
const manifestPaths = collectManifests();

test('all 17 packages encode exactly the required Clean Architecture graph', () => {
  assert.equal(manifestPaths.length, 17);
  const names = manifestPaths.map(path => readJson(path).name.replace('@overmind/', '')).sort();
  assert.deepEqual(names, Object.keys(expectedEdges).sort());
  for (const path of manifestPaths) {
    const manifest = readJson(path);
    const name = manifest.name.replace('@overmind/', '');
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}).map(key => key.replace('@overmind/', '')).sort(), expectedEdges[name]?.toSorted(), name);
    assert.ok(Object.values(manifest.dependencies ?? {}).every(value => value === 'workspace:*'), name);
    assert.equal(manifest.main, undefined);
    assert.deepEqual(manifest.exports, { '.': './src/index.ts' });
    if (path.startsWith('packages/')) assert.equal(manifest.sideEffects, false);
    const source = readFileSync(resolve(root, path, '../src/index.ts'), 'utf8');
    assert.match(source, /^\/\/ PLACEHOLDER\(OVE_[A-Z]+\d{3}\): replaced wholesale by the owner task\.\nexport \{\};\n$/);
  }
});

test('every manifest is private ESM under Apache-2.0 and every external dependency uses the catalog', () => {
  for (const path of ['package.json', ...manifestPaths]) {
    const manifest = readJson(path);
    assert.equal(manifest.private, true, path);
    assert.equal(manifest.type, 'module', path);
    assert.equal(manifest.version, '0.0.0', path);
    assert.equal(manifest.license, 'Apache-2.0', path);
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        assert.equal(version, name.startsWith('@overmind/') ? 'workspace:*' : 'catalog:', `${path}: ${name}`);
      }
    }
  }
  assert.equal(rootManifest.dependencies, undefined);
});

test('all reserved scripts exist and future tool implementations are not fabricated', () => {
  const scripts = 'dev dev:tauri build typecheck lint lint:fix format format:check test test:watch test:coverage test:e2e test:visual test:escape storybook build:storybook check:boundaries check:licenses check:deps check:tasks check:owns check:docs check:headers check:contracts gen:contracts gen:task-index task:claim task:finish task:status task:next audit sbom package:engine check prepare'.split(' ');
  assert.deepEqual(Object.keys(rootManifest.scripts).sort(), scripts.sort());
  assert.equal(rootManifest.scripts.typecheck, 'tsc -b');
  assert.equal(rootManifest.scripts.test, 'vitest run');
  assert.equal(rootManifest.scripts.audit, 'pnpm audit --audit-level=high --prod');
  assert.ok(!readdirSync(resolve(root, 'tools')).includes('dev'));
});

test('runtime, package manager integrity and catalog versions are pinned', () => {
  assert.equal(readFileSync(resolve(root, '.nvmrc'), 'utf8'), '22.23.3\n');
  assert.deepEqual(rootManifest.engines, { node: '>=22.22.2 <23', pnpm: '>=12.11.2 <13' });
  assert.match(rootManifest.packageManager, /^pnpm@12\.11\.2\+sha512\.[a-f0-9]{128}$/);
  const catalog = workspaceYaml.split('catalog:\n')[1]?.split('\n\n')[0];
  assert.ok(catalog);
  const entries = [...catalog.matchAll(/^  "([^"]+)": "([^"]+)"$/gm)];
  assert.ok(entries.length >= 39);
  for (const [, name, version] of entries) assert.match(version!, /^\d+\.\d+\.\d+$/, name);
  assert.ok(entries.some(([, name, version]) => name === 'typescript' && version === '6.0.3'));
});

test('supply-chain settings reject unknown builds, peer conflicts and unsupported runtimes', () => {
  for (const setting of ['minimumReleaseAge: 4320', 'strictDepBuilds: true', 'engineStrict: true', 'strictPeerDependencies: true', 'autoInstallPeers: false', 'savePrefix: ""', 'linkWorkspacePackages: false', 'shamefullyHoist: false', 'verifyDepsBeforeRun: error']) {
    assert.ok(workspaceYaml.split('\n').includes(setting), setting);
  }
  assert.match(workspaceYaml, /^allowBuilds:\n  esbuild: false$/m);
  assert.equal(readFileSync(resolve(root, '.npmrc'), 'utf8'), 'engine-strict=true\n');
});

test('Git excludes credentials, generated files and local environment while retaining the lockfile', () => {
  const denied = ['foo.p12', 'foo.p8', 'foo.pem', 'foo.key', '.env.local', 'target/test', 'node_modules/test', 'dist/test', '.DS_Store'];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', ...denied], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(ignored, denied);
  const visible = execFileSync('git', ['check-ignore', '--no-index', '--non-matching', '--verbose', '.env.example', 'pnpm-lock.yaml'], { cwd: root, encoding: 'utf8' });
  assert.match(visible, /!\.env\.example/);
  assert.match(visible, /::\s+pnpm-lock\.yaml/);
  assert.ok(!readFileSync(resolve(root, '.gitattributes'), 'utf8').includes('-diff'));
});
