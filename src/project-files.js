import { LIMITS } from './config.js';
import { createAvatar, HUMAN_BONES, EXPRESSIONS, validateAvatar } from './vtuber/vrm.js';
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
    project.source.name.length > LIMITS.sourceName
  )
    throw new Error('Ungültige Modellquelle.');
  if (
    project.source.kind !== 'demo' &&
    (typeof project.source.data !== 'string' ||
      project.source.data.length > LIMITS.sourceCharacters)
  )
    throw new Error('Die Modelldaten fehlen oder sind zu groß.');
  if (
    typeof project.name !== 'string' ||
    project.name.length > LIMITS.projectName ||
    !Number.isFinite(project.falloff) ||
    project.falloff < LIMITS.falloffMin ||
    project.falloff > LIMITS.falloffMax
  )
    throw new Error('Ungültige Projekteinstellungen.');
  const checkPose = (pose) => {
    if (!pose || typeof pose !== 'object') throw new Error('Die Pose ist ungültig.');
    project.joints.forEach((j) => {
      const a = pose[j.id];
      if (
        !Array.isArray(a) ||
        a.length !== 3 ||
        a.some((x) => !Number.isFinite(x) || Math.abs(x) > LIMITS.poseAngle)
      )
        throw new Error('Die Pose enthält ungültige Rotationen.');
    });
  };
  checkPose(project.pose);
  if (!Array.isArray(project.keys) || project.keys.length > LAST_FRAME + 1)
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
  if (project.avatar) validateAvatar(project.avatar, project.joints);
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
  if (gltf.parser.json.extensions?.VRM)
    throw new Error('Bitte VRM 0.x zuerst als VRM 1.0 konvertieren.');
  const parts = normalizeParts(gltf.scene);
  const vrm = gltf.parser.json.extensions?.VRMC_vrm;
  if (vrm) {
    if (vrm.specVersion !== '1.0') throw new Error('Nur VRM 1.0 wird unterstützt.');
    const nodes = new Map();
    for (const [role, , ,] of HUMAN_BONES) {
      const bind = vrm.humanoid?.humanBones?.[role];
      if (bind) nodes.set(role, await gltf.parser.getDependency('node', bind.node));
    }
    const canonical = new Map(HUMAN_BONES.map(([role, , id]) => [role, id]));
    const jointNodes = new Map([...nodes].map(([role, node]) => [node, canonical.get(role)]));
    const joints = [...nodes].map(([role, node]) => {
      let parent = node.parent;
      while (parent && !jointNodes.has(parent)) parent = parent.parent;
      return {
        id: canonical.get(role),
        name: HUMAN_BONES.find(([name]) => name === role)[1],
        parent: jointNodes.get(parent) || null,
        position: node
          .getWorldPosition(new THREE.Vector3())
          .applyMatrix4(parts.normalization)
          .toArray(),
      };
    });
    validateJoints(joints);
    const avatar = createAvatar(joints, parts);
    avatar.meta = structuredClone(vrm.meta);
    const original = [];
    gltf.scene.traverse((node) => {
      if (node.isMesh && node.geometry?.attributes.position) original.push(node);
    });
    for (const [name] of EXPRESSIONS) {
      const binds = [];
      for (const bind of vrm.expressions?.preset?.[name]?.morphTargetBinds || []) {
        const node = await gltf.parser.getDependency('node', bind.node);
        node.traverse((mesh) => {
          const index = original.indexOf(mesh);
          if (index >= 0) binds.push({ mesh: index, index: bind.index, weight: bind.weight });
        });
      }
      avatar.expressions[name] = binds;
    }
    validateAvatar(avatar, joints, parts);
    parts.importJoints = joints;
    parts.importAvatar = avatar;
  }
  return parts;
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
