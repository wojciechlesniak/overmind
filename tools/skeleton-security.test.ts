import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('an unreviewed dependency postinstall is blocked before it can write a file', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'overmind-build-denial-'));
  try {
    const packageDirectory = join(fixture, 'package');
    const projectDirectory = join(fixture, 'project');
    const marker = join(fixture, 'postinstall-ran');
    mkdirSync(packageDirectory);
    mkdirSync(projectDirectory);
    const payload = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`;
    writeFileSync(join(packageDirectory, 'package.json'), JSON.stringify({
      name: 'overmind-unreviewed-build-fixture', version: '1.0.0',
      scripts: { postinstall: `node -e ${JSON.stringify(payload)}` },
    }));
    execFileSync('tar', ['-czf', join(fixture, 'dependency.tgz'), '-C', fixture, 'package']);
    writeFileSync(join(projectDirectory, 'package.json'), JSON.stringify({
      name: 'overmind-build-denial-fixture', private: true,
      dependencies: { 'overmind-unreviewed-build-fixture': 'file:../dependency.tgz' },
    }));
    const policy = readFileSync(fileURLToPath(new URL('../pnpm-workspace.yaml', import.meta.url)), 'utf8');
    writeFileSync(join(projectDirectory, 'pnpm-workspace.yaml'), policy);
    const result = spawnSync('corepack', ['pnpm', 'install', '--offline', '--reporter=append-only'], {
      cwd: projectDirectory, encoding: 'utf8', timeout: 30_000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0, 'an unreviewed build must make install fail');
    assert.match(result.stdout + result.stderr, /ERR_PNPM_IGNORED_BUILDS/);
    assert.equal(existsSync(marker), false, 'the postinstall payload must never execute');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
