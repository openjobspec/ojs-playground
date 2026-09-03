import { createHash } from 'node:crypto';
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(uiRoot, '..');
const lockPath = path.join(uiRoot, 'package-lock.json');
const outputPath = path.join(repositoryRoot, 'THIRD_PARTY_NOTICES.md');
const lockBytes = readFileSync(lockPath);
const lock = JSON.parse(lockBytes);
const documents = new Map();

const dependencies = Object.entries(lock.packages)
  .filter(([packagePath, metadata]) => {
    return packagePath.includes('node_modules/') && !metadata.dev;
  })
  .map(([packagePath, metadata]) => {
    const installedPath = path.join(uiRoot, packagePath);
    const installedManifest = JSON.parse(
      readFileSync(path.join(installedPath, 'package.json'), 'utf8'),
    );
    if (installedManifest.version !== metadata.version) {
      throw new Error(
        `${installedManifest.name} install ${installedManifest.version} does not match lock ${metadata.version}`,
      );
    }

    const sourceFiles = discoverNoticeFiles(installedPath);
    if (sourceFiles.length === 0) {
      throw new Error(
        `${installedManifest.name}@${metadata.version} has no installed license or notice text`,
      );
    }

    const documentIds = sourceFiles.map((sourcePath) => {
      const text = readFileSync(sourcePath, 'utf8').replaceAll('\r\n', '\n');
      const digest = createHash('sha256').update(text).digest('hex');
      const id = digest.slice(0, 12);
      const source = `${installedManifest.name}@${metadata.version}/${path.relative(installedPath, sourcePath)}`;
      const existing = documents.get(digest);
      if (existing) {
        existing.sources.push(source);
      } else {
        documents.set(digest, { id, text, sources: [source] });
      }
      return id;
    });

    return {
      name: installedManifest.name,
      version: metadata.version,
      license: metadata.license,
      documentIds: [...new Set(documentIds)].sort(),
    };
  })
  .sort((left, right) => {
    return (
      left.name.localeCompare(right.name) ||
      left.version.localeCompare(right.version)
    );
  });

const lockDigest = createHash('sha256').update(lockBytes).digest('hex');
const rows = dependencies.map(({ name, version, license, documentIds }) => {
  const registryUrl = `https://www.npmjs.com/package/${encodeURIComponent(name)}/v/${version}`;
  return `| [${name}](${registryUrl}) | ${version} | ${license.replaceAll('|', '\\|')} | ${documentIds.join(', ')} |`;
});
const texts = [...documents.values()]
  .sort((left, right) => left.id.localeCompare(right.id))
  .map(({ id, text, sources }) => {
    const normalized = text.endsWith('\n') ? text : `${text}\n`;
    return `## License document ${id}

Installed sources:

${sources
  .sort()
  .map((source) => `- \`${source}\``)
  .join('\n')}

~~~~text
${normalized}~~~~
`;
  });
const content = `# Third-Party Notices

The OJS Playground frontend bundles the production dependencies listed below.
This file is generated from the actual license, notice, copying, and copyright
files installed by \`npm ci\` from \`ui/package-lock.json\` (SHA-256
\`${lockDigest}\`). Identical texts are stored once and referenced by document
ID.

Run \`cd ui && npm run notices\` after a locked dependency change, and
\`npm run notices:check\` before shipping an embedded frontend.

| Package | Version | Declared license | Documents |
| --- | --- | --- | --- |
${rows.join('\n')}

${texts.join('\n')}
Open Job Spec itself is licensed under Apache-2.0.
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== content) {
    throw new Error(
      'THIRD_PARTY_NOTICES.md is stale; run `cd ui && npm run notices`.',
    );
  }
  console.log(
    `Verified ${dependencies.length} production dependencies and ${documents.size} license texts.`,
  );
} else {
  writeFileSync(outputPath, content);
  console.log(
    `Wrote ${dependencies.length} production dependencies and ${documents.size} license texts.`,
  );
}

function discoverNoticeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      if (entry.name === 'node_modules') return [];
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return discoverNoticeFiles(entryPath);
      if (!entry.isFile()) return [];
      return /^(licen[sc]e|notice|copying|copyright)(\.|$)/i.test(entry.name)
        ? [entryPath]
        : [];
    })
    .filter((filePath) => statSync(filePath).size > 0);
}
