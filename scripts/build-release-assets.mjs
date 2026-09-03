import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'server');
const output = path.join(root, 'release-assets');
const version = JSON.parse(
  readFileSync(path.join(root, 'npm', 'package.json'), 'utf8'),
).version;
const targets = [
  ['darwin', 'arm64'],
  ['darwin', 'amd64'],
  ['linux', 'arm64'],
  ['linux', 'amd64'],
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const [goos, goarch] of targets) {
  const name = `ojs-playground-${goos}-${goarch}`;
  run(
    'go',
    [
      'build',
      `-ldflags=-s -w -X main.version=${version} -X github.com/openjobspec/ojs-playground/server/internal/api.version=${version}`,
      '-o',
      path.join(output, name),
      './cmd/playground',
    ],
    {
      ...process.env,
      GOWORK: 'off',
      CGO_ENABLED: '0',
      GOOS: goos,
      GOARCH: goarch,
    },
  );
}

copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
copyFileSync(
  path.join(root, 'THIRD_PARTY_NOTICES.md'),
  path.join(output, 'THIRD_PARTY_NOTICES.md'),
);

const checksums = readdirSync(output)
  .sort()
  .map((name) => {
    const digest = createHash('sha256')
      .update(readFileSync(path.join(output, name)))
      .digest('hex');
    return `${digest}  ${name}`;
  });
writeFileSync(path.join(output, 'checksums.txt'), `${checksums.join('\n')}\n`);

console.log(`Built ${targets.length} OJS Playground ${version} release binaries.`);

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: server,
    encoding: 'utf8',
    env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`,
    );
  }
}
