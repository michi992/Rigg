import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const files = ['build.mjs'];
for (const directory of ['src', 'tests', 'scripts']) {
  for (const entry of readdirSync(directory)) {
    if (/\.(js|mjs)$/.test(entry)) {
      files.push(join(directory, entry));
    }
  }
}

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('JavaScript-Syntax geprüft.');
