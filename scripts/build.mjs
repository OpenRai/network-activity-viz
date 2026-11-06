import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'dist');
const pages = [
  'index.html',
  'starmap.html',
  'constellation.html',
  'hangtime.html',
  'score.html',
  'lattice.html',
  'send-mountains.html'
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const page of pages) {
  await cp(join(root, page), join(output, page));
}
await cp(join(root, 'js'), join(output, 'js'), { recursive: true });

const missing = [];
for (const path of [...pages, 'js/gallery-nav.js', 'js/nano-feed.js']) {
  try {
    await stat(join(output, path));
  } catch {
    missing.push(path);
  }
}
if (missing.length) {
  throw new Error(`Build output is missing required files: ${missing.join(', ')}`);
}

console.log(`Built ${pages.length} pages and shared JavaScript into dist/.`);
