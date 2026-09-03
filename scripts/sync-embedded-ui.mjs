import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'ui', 'dist');
const destination = path.join(root, 'server', 'internal', 'embed', 'dist');

if (
  !existsSync(path.join(source, 'index.html')) ||
  !existsSync(path.join(source, 'ojs-playground.js'))
) {
  throw new Error('UI build is incomplete; run `cd ui && npm run build` first.');
}

rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
cpSync(
  path.join(root, 'THIRD_PARTY_NOTICES.md'),
  path.join(destination, 'THIRD_PARTY_NOTICES.md'),
);

console.log('Synchronized ui/dist into server/internal/embed/dist.');
