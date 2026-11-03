import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  LAST_FRAME,
  humanoidJoints,
  defaultPose,
  demoParts,
  normalizeParts,
  validateJoints,
} from './rig-core.js';

export function createProject() {
  const joints = humanoidJoints();
  return {
    format: 'dewald-rig-studio',
    version: 1,
    name: 'Mein Charakter',
    source: { kind: 'demo', name: 'Studio-Bot' },
    joints,
    pose: defaultPose(joints),
    keys: [],
    falloff: 3,
    frame: 0,
    selected: 'chest',
    mode: 'rig',
  };
}
export function validateProject(project) {
  if (project?.format !== 'dewald-rig-studio' || project.version !== 1)
    throw new Error('Das ist keine unterstützte Rig-Studio-Projektdatei.');
  validateJoints(project.joints);
  if (
    !project.source ||
    !['demo', 'obj', 'glb'].includes(project.source.kind) ||
    typeof project.source.name !== 'string' ||
    project.source.name.length > 250
  )
    throw new Error('Ungültige Modellquelle.');
  if (
    project.source.kind !== 'demo' &&
    (typeof project.source.data !== 'string' || project.source.data.length > 50000000)
  )
    throw new Error('Die Modelldaten fehlen oder sind zu groß.');
  if (
    typeof project.name !== 'string' ||
    project.name.length > 60 ||
    !Number.isFinite(project.falloff) ||
    project.falloff < 1 ||
    project.falloff > 6
  )
    throw new Error('Ungültige Projekteinstellungen.');
  const checkPose = (pose) => {
    if (!pose || typeof pose !== 'object') throw new Error('Die Pose ist ungültig.');
    project.joints.forEach((j) => {
      const a = pose[j.id];
      if (
        !Array.isArray(a) ||
        a.length !== 3 ||
        a.some((x) => !Number.isFinite(x) || Math.abs(x) > 100)
      )
        throw new Error('Die Pose enthält ungültige Rotationen.');
    });
  };
  checkPose(project.pose);
  if (!Array.isArray(project.keys) || project.keys.length > 121)
    throw new Error('Zu viele Keyframes.');
  const frames = new Set();
  project.keys.forEach((k) => {
    if (!Number.isInteger(k.frame) || k.frame < 0 || k.frame > LAST_FRAME || frames.has(k.frame))
      throw new Error('Ungültiger oder doppelter Keyframe.');
    frames.add(k.frame);
    checkPose(k.pose);
  });
  if (!Number.isInteger(project.frame) || project.frame < 0 || project.frame > LAST_FRAME)
    throw new Error('Ungültiger Frame.');
  if (!project.joints.some((j) => j.id === project.selected))
    project.selected = project.joints[0].id;
  if (!['rig', 'pose', 'weights'].includes(project.mode)) project.mode = 'rig';
  return project;
}
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  // Bei großen Modellen würde ein Spread aller Bytes das Argumentlimit
  // des Browsers überschreiten. Deshalb in kleinen Blöcken umwandeln.
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
export function base64ToBuffer(data) {
  const s = atob(data),
    bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}
function safeLoader() {
  const manager = new THREE.LoadingManager();
  // GLB-Dateien dürfen eingebettete Daten und eigene Blob-URLs nutzen.
  // Externe Dateien würden beim Öffnen eines lokalen Modells Netzabrufe auslösen.
  manager.setURLModifier((url) => {
    if (/^(data:|blob:)/i.test(url)) return url;
    throw new Error(
      'Externe Ressourcen sind nicht erlaubt. Bitte eine vollständig eingebettete GLB-Datei verwenden.',
    );
  });
  return new GLTFLoader(manager);
}
export async function sourceParts(source) {
  if (source.kind === 'demo') return demoParts();
  if (source.kind === 'obj') return normalizeParts(new OBJLoader().parse(source.data));
  const gltf = await safeLoader().parseAsync(base64ToBuffer(source.data), '');
  return normalizeParts(gltf.scene);
}
export function disposeParts(oldParts) {
  const materials = new Set(),
    textures = new Set();
  oldParts.forEach((p) => {
    p.geometry.dispose();
    (Array.isArray(p.material) ? p.material : [p.material]).forEach((m) => materials.add(m));
  });
  materials.forEach((m) => {
    Object.values(m).forEach((v) => {
      if (v?.isTexture) textures.add(v);
    });
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
}
export function download(data, name, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  // Die Blob-URL erst freigeben, nachdem der Browser den Download übernehmen konnte.
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
