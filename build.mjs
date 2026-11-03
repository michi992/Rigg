import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const [html, css, js] = await Promise.all([
  readFile('src/index.html', 'utf8'),
  readFile('src/styles.css', 'utf8'),
  readFile('dist/app.js', 'utf8'),
]);
await writeFile('dist/index.html', html);
await writeFile('dist/styles.css', css);
const license = await readFile('node_modules/three/LICENSE', 'utf8');
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
      license.replaceAll('--', '—') +
      ' -->\n</body>',
  );
await writeFile('dist/dewald-rig-studio.html', offline);
await writeFile('dist/THREE-LICENSE.txt', license);
console.log('Rig Studio gebaut, einschließlich eigenständiger Offline-HTML-Datei.');
