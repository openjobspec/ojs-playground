import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.resolve(
  process.env.OJS_RELEASE_ASSETS ?? path.join(root, 'release-assets'),
);
const version = JSON.parse(
  readFileSync(path.join(root, 'npm', 'package.json'), 'utf8'),
).version;
const expectedTag = process.env.OJS_RELEASE_TAG;
if (expectedTag && expectedTag !== `v${version}`) {
  throw new Error(`Release tag ${expectedTag} does not match package v${version}`);
}

const binaries = [
  'ojs-playground-darwin-arm64',
  'ojs-playground-darwin-amd64',
  'ojs-playground-linux-arm64',
  'ojs-playground-linux-amd64',
];
const payloads = [...binaries, 'LICENSE', 'THIRD_PARTY_NOTICES.md'].sort();
const expected = [...payloads, 'checksums.txt'].sort();
const actual = readdirSync(assets).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    `Release assets differ:\nexpected ${expected.join(', ')}\nactual ${actual.join(', ')}`,
  );
}

for (const binary of binaries) {
  if (statSync(path.join(assets, binary)).size < 1_000_000) {
    throw new Error(`Release binary is unexpectedly small: ${binary}`);
  }
}

const expectedChecksums = payloads
  .map((asset) => {
    const digest = createHash('sha256')
      .update(readFileSync(path.join(assets, asset)))
      .digest('hex');
    return `${digest}  ${asset}`;
  })
  .join('\n');
const actualChecksums = readFileSync(
  path.join(assets, 'checksums.txt'),
  'utf8',
).trim();
if (actualChecksums !== expectedChecksums) {
  throw new Error('checksums.txt does not match the local release binaries');
}

const hostArch = process.arch === 'x64' ? 'amd64' : process.arch;
const hostBinary = `ojs-playground-${process.platform}-${hostArch}`;
if (binaries.includes(hostBinary)) {
  const result = spawnSync(path.join(assets, hostBinary), ['version'], {
    encoding: 'utf8',
  });
  if (result.status !== 0 || result.stdout.trim() !== `ojs-playground ${version}`) {
    throw new Error(
      `${hostBinary} reports ${JSON.stringify(result.stdout.trim())}; expected ${version}`,
    );
  }
}

console.log(`Verified all four OJS Playground ${version} release binaries.`);
