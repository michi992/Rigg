import { LIMITS, fileSizeLabel } from '../config.js';
export const PARAMETERS = [
  ['angleX', 'Kopf links / rechts', -1, 1, 0],
  ['angleY', 'Kopf hoch / runter', -1, 1, 0],
  ['angleZ', 'Kopf neigen', -1, 1, 0],
  ['mouthOpen', 'Mund öffnen', 0, 1, 0],
  ['eyeLeft', 'Auge links offen', 0, 1, 1],
  ['eyeRight', 'Auge rechts offen', 0, 1, 1],
  ['breath', 'Atmung', 0, 1, 0],
];
export const ROLES = [
  ['normal', 'Normal'],
  ['head', 'Kopf / Haare'],
  ['body', 'Körper'],
  ['eyeLeft', 'Auge links'],
  ['eyeRight', 'Auge rechts'],
  ['mouth', 'Mund'],
];
export function gridPoints(cols = 4, rows = 4) {
  return Array.from({ length: (cols + 1) * (rows + 1) }, (_, i) => [
    (i % (cols + 1)) / cols,
    Math.floor(i / (cols + 1)) / rows,
  ]);
}
export function create2DProject() {
  return {
    format: 'dewald-vtuber-2d',
    version: 1,
    name: 'Mein 2D-Avatar',
    width: 1000,
    height: 1000,
    layers: [],
  };
}
export function createLayer(name, src, width, height, project) {
  const scale = Math.min(project.width / width, project.height / height, 1);
  return {
    id:
      crypto.randomUUID?.() ||
      'layer_' +
        [...crypto.getRandomValues(new Uint32Array(4))].map((n) => n.toString(16)).join(''),
    name: name.slice(0, 80),
    src,
    width,
    height,
    x: (project.width - width * scale) / 2,
    y: (project.height - height * scale) / 2,
    scale,
    rotation: 0,
    pivot: [0.5, 0.5],
    opacity: 1,
    visible: true,
    role: 'normal',
    mesh: { cols: 4, rows: 4, points: gridPoints() },
    forms: {},
  };
}
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
export function validate2DProject(project) {
  if (
    project?.format !== 'dewald-vtuber-2d' ||
    project.version !== 1 ||
    typeof project.name !== 'string' ||
    project.name.length > 80 ||
    !finite(project.width, 16, LIMITS.imageDimension) ||
    !finite(project.height, 16, LIMITS.imageDimension) ||
    !Array.isArray(project.layers) ||
    project.layers.length > LIMITS.layers2D
  )
    throw new Error('Ungültiges 2D-Projekt.');
  const ids = new Set();
  let total = 0;
  for (const layer of project.layers) {
    if (
      !layer ||
      typeof layer.id !== 'string' ||
      layer.id.length > 100 ||
      ids.has(layer.id) ||
      typeof layer.name !== 'string' ||
      layer.name.length > 80 ||
      !ROLES.some(([key]) => key === layer.role) ||
      typeof layer.visible !== 'boolean'
    )
      throw new Error('Ungültige 2D-Ebene.');
    ids.add(layer.id);
    if (
      typeof layer.src !== 'string' ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(layer.src)
    )
      throw new Error('Nur eingebettete PNG-Bilder sind erlaubt.');
    total += layer.src.length;
    if (total > LIMITS.projectBytes) throw new Error('Das 2D-Projekt ist zu groß.');
    const bytes = Uint8Array.from(atob(layer.src.slice(22)), (c) => c.charCodeAt(0));
    const dimensions = pngDimensions(bytes);
    if (dimensions[0] !== layer.width || dimensions[1] !== layer.height)
      throw new Error('Die PNG-Abmessungen stimmen nicht.');
    for (const key of ['x', 'y', 'rotation'])
      if (!finite(layer[key], -10000, 10000)) throw new Error('Ungültige Ebenentransformation.');
    if (
      !finite(layer.scale, 0.01, 20) ||
      !finite(layer.opacity, 0, 1) ||
      !Array.isArray(layer.pivot) ||
      layer.pivot.length !== 2 ||
      layer.pivot.some((v) => !finite(v, 0, 1))
    )
      throw new Error('Ungültiger Drehpunkt oder Maßstab.');
    const mesh = layer.mesh;
    if (
      !mesh ||
      !Number.isInteger(mesh.cols) ||
      !Number.isInteger(mesh.rows) ||
      mesh.cols < 1 ||
      mesh.rows < 1 ||
      mesh.cols > 12 ||
      mesh.rows > 12 ||
      !Array.isArray(mesh.points) ||
      mesh.points.length !== (mesh.cols + 1) * (mesh.rows + 1) ||
      mesh.points.some(
        (p) => !Array.isArray(p) || p.length !== 2 || p.some((v) => !finite(v, -3, 4)),
      )
    )
      throw new Error('Ungültiges Verformungsnetz.');
    if (!layer.forms || typeof layer.forms !== 'object' || Array.isArray(layer.forms))
      throw new Error('Ungültige Parameterformen.');
    for (const [parameter, form] of Object.entries(layer.forms)) {
      if (!PARAMETERS.some(([key]) => key === parameter) || !form || typeof form !== 'object')
        throw new Error('Unbekannter Parameter.');
      for (const [side, points] of Object.entries(form))
        if (
          !['positive', 'negative', 'zero'].includes(side) ||
          !Array.isArray(points) ||
          points.length !== mesh.points.length ||
          points.some(
            (p) => !Array.isArray(p) || p.length !== 2 || p.some((v) => !finite(v, -3, 3)),
          )
        )
          throw new Error('Ungültige Parameterform.');
    }
  }
  if (new Blob([JSON.stringify(project)]).size > LIMITS.projectBytes)
    throw new Error('Das 2D-Projekt ist zu groß.');
  return project;
}
export function pngDimensions(bytes) {
  if (
    bytes.length < 33 ||
    [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR'
  )
    throw new Error('Die Datei ist kein gültiges PNG.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    w = view.getUint32(16),
    h = view.getUint32(20);
  if (!w || !h || w > LIMITS.imageDimension || h > LIMITS.imageDimension)
    throw new Error(
      'PNG-Bilder dürfen höchstens ' +
        LIMITS.imageDimension +
        ' × ' +
        LIMITS.imageDimension +
        ' Pixel haben.',
    );
  return [w, h];
}
export async function readPNG(file, project) {
  if (file.size > LIMITS.imageBytes || file.size <= 0)
    throw new Error(
      'PNG-Dateien müssen zwischen 1 Byte und ' + fileSizeLabel(LIMITS.imageBytes) + ' groß sein.',
    );
  const bytes = new Uint8Array(await file.arrayBuffer()),
    [w, h] = pngDimensions(bytes);
  let text = '';
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return createLayer(
    file.name.replace(/\.png$/i, ''),
    'data:image/png;base64,' + btoa(text),
    w,
    h,
    project,
  );
}
export function deformedPoints(layer, values) {
  return layer.mesh.points.map((point, i) => {
    let [x, y] = point;
    for (const [key, form] of Object.entries(layer.forms)) {
      const value = Number(values[key] || 0),
        offset = form[value < 0 ? 'negative' : 'positive']?.[i];
      if (offset) {
        x += offset[0] * Math.abs(value);
        y += offset[1] * Math.abs(value);
      }
      const zero = form.zero?.[i];
      if (zero) {
        x += zero[0] * (1 - Math.abs(value));
        y += zero[1] * (1 - Math.abs(value));
      }
    }
    return [x, y];
  });
}
export function setMeshPoint(layer, index, point, parameter, value) {
  if (!Number.isInteger(index) || !layer.mesh.points[index]) throw new Error('Netzpunkt fehlt.');
  const target = point.map((v) => Math.max(-2, Math.min(3, v)));
  if (parameter === 'base') layer.mesh.points[index] = target;
  else {
    const definition = PARAMETERS.find(([key]) => key === parameter);
    if (!definition || (Math.abs(value) !== 1 && !(definition[2] === 0 && value === 0)))
      throw new Error('Zum Formen einen Endwert wählen.');
    const side = value === 0 ? 'zero' : value < 0 ? 'negative' : 'positive';
    layer.forms[parameter] ||= {};
    layer.forms[parameter][side] ||= layer.mesh.points.map(() => [0, 0]);
    layer.forms[parameter][side][index] = target.map(
      (v, axis) => v - layer.mesh.points[index][axis],
    );
  }
}
