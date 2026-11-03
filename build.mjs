import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { LIMITS, FPS, LAST_FRAME, fileSizeLabel } from './src/config.js';
import { updateReadme } from './scripts/update-readme.mjs';
await updateReadme();
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: 'dist/app.js',
  target: ['es2022'],
  legalComments: 'eof',
});
const [template, css, js] = await Promise.all([
  readFile('src/index.html', 'utf8'),
  readFile('src/styles.css', 'utf8'),
  readFile('dist/app.js', 'utf8'),
]);
const values = {
  MODEL_SIZE: fileSizeLabel(LIMITS.modelBytes),
  LAST_FRAME,
  FPS,
  PROJECT_NAME: LIMITS.projectName,
  BONE_NAME: LIMITS.boneName,
  COORDINATE: LIMITS.coordinate,
  FALLOFF_MIN: LIMITS.falloffMin,
  FALLOFF_MAX: LIMITS.falloffMax,
  PNG_SIZE: fileSizeLabel(LIMITS.imageBytes),
};
const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
  if (!(name in values)) throw new Error('Unbekannter HTML-Platzhalter: ' + name);
  return String(values[name]);
});
await writeFile('dist/index.html', html);
await writeFile('dist/styles.css', css);
const license = await readFile('node_modules/three/LICENSE', 'utf8');
const projectLicense = await readFile('LICENSE', 'utf8');
// Inline-Skripte müssen nach dem DOM stehen. Die Callback-Ersetzung verhindert,
// dass Zeichenfolgen wie $& im Bundle als Ersetzungsmuster ausgewertet werden.
const styleTag = /<link\b[^>]*href=(["'])\.\/styles\.css\1[^>]*>/;
const scriptTag = /<script\b[^>]*src=(["'])\.\/app\.js\1[^>]*>\s*<\/script>/;
if (!styleTag.test(html) || !scriptTag.test(html) || !html.includes('</body>')) {
  throw new Error('Die HTML-Vorlage enthält nicht die erwarteten CSS- und Script-Verweise.');
}
const offline = html
  .replace(styleTag, () => '<style>' + css + '</style>')
  .replace(scriptTag, '')
  .replace(/^[ \t]+$/gm, '')
  .replace(
    '</body>',
    () =>
      '<script>' +
      js.replaceAll('</script', '<\\/script') +
      '</script>\n<!-- ' +
      (projectLicense + '\nThree.js\n\n' + license).replaceAll('--', '—') +
      ' -->\n</body>',
  );
await writeFile('dist/dewald-rig-studio.html', offline);
await writeFile('dist/THREE-LICENSE.txt', license);
await writeFile('dist/LICENSE.txt', projectLicense);
console.log('Rig Studio gebaut, einschließlich eigenständiger Offline-HTML-Datei.');
