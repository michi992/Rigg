import { readFileSync, writeFileSync } from 'node:fs';
import { LIMITS, FPS, LAST_FRAME, fileSizeLabel } from '../src/config.js';
import { format } from 'prettier';

const markerStart = '<!-- limits:start -->';
const markerEnd = '<!-- limits:end -->';
export function limitsSection() {
  return [
    markerStart,
    '| Einstellung | Wert |',
    '| --- | --- |',
    '| Modellimport | ' + fileSizeLabel(LIMITS.modelBytes) + ' |',
    '| Projektdatei | ' + fileSizeLabel(LIMITS.projectBytes) + ' |',
    '| Vertices | ' + LIMITS.vertices.toLocaleString('de-DE') + ' |',
    '| Knochen | ' + LIMITS.joints + ' |',
    '| Zeitleiste | Frame 0–' + LAST_FRAME + ' bei ' + FPS + ' FPS |',
    '| 2D-Ebenen | ' + LIMITS.layers2D + ' |',
    '| PNG pro Ebene | ' + fileSizeLabel(LIMITS.imageBytes) + ' |',
    '| PNG-Abmessungen | ' + LIMITS.imageDimension + ' × ' + LIMITS.imageDimension + ' Pixel |',
    markerEnd,
  ].join('\n');
}
export async function updateReadme() {
  const path = new URL('../README.md', import.meta.url);
  const old = readFileSync(path, 'utf8');
  const start = old.indexOf(markerStart),
    end = old.indexOf(markerEnd);
  if (start < 0 || end < start) throw new Error('Die Limits-Markierungen in der README fehlen.');
  const section = (await format(limitsSection(), { parser: 'markdown' })).trimEnd();
  const next = old.slice(0, start) + section + old.slice(end + markerEnd.length);
  if (old !== next) writeFileSync(path, next);
}
