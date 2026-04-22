import { readFileSync } from 'node:fs';

const config = readJson('release-please-config.json');
const manifest = readJson('.release-please-manifest.json');
verify(config, manifest, ['npm/package.json', 'ui/package.json']);

function verify(releaseConfig, releaseManifest, managedFiles) {
  if (hasKey(releaseConfig, 'release-as')) throw new Error('release-as is forbidden');
  if (!releaseConfig.packages?.['.']?.['bump-minor-pre-major']) {
    throw new Error('bump-minor-pre-major must be enabled');
  }
  const last = parse(releaseManifest['.']);
  const next = `${last.major}.${last.minor + 1}.0`;
  const postReleaseNext = `${last.major}.${last.minor + 2}.0`;
  if (postReleaseNext === next) throw new Error('post-release calculation is stuck');
  for (const file of managedFiles) {
    const version = readJson(file).version;
    if (![releaseManifest['.'], next].includes(version)) {
      throw new Error(`${file} version ${version} is not ${releaseManifest['.']} or ${next}`);
    }
  }
  console.log(`Release Please: ${releaseManifest['.']} -> ${next} -> ${postReleaseNext}`);
}

function hasKey(value, key) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([name, child]) => name === key || hasKey(child, key));
}

function parse(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid manifest version: ${version}`);
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function readJson(file) {
  return JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
}
