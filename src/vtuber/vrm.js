import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { defaultPose, applyPose } from '../rig-core.js';

export const HUMAN_BONES = [
  ['hips', 'Becken', 'hips', null],
  ['spine', 'Wirbelsäule', 'spine', 'hips'],
  ['head', 'Kopf', 'head', 'spine'],
  ['leftUpperArm', 'Oberarm links', 'arm_L', 'spine'],
  ['leftLowerArm', 'Unterarm links', 'forearm_L', 'leftUpperArm'],
  ['leftHand', 'Hand links', 'hand_L', 'leftLowerArm'],
  ['rightUpperArm', 'Oberarm rechts', 'arm_R', 'spine'],
  ['rightLowerArm', 'Unterarm rechts', 'forearm_R', 'rightUpperArm'],
  ['rightHand', 'Hand rechts', 'hand_R', 'rightLowerArm'],
  ['leftUpperLeg', 'Oberschenkel links', 'thigh_L', 'hips'],
  ['leftLowerLeg', 'Unterschenkel links', 'shin_L', 'leftUpperLeg'],
  ['leftFoot', 'Fuß links', 'foot_L', 'leftLowerLeg'],
  ['rightUpperLeg', 'Oberschenkel rechts', 'thigh_R', 'hips'],
  ['rightLowerLeg', 'Unterschenkel rechts', 'shin_R', 'rightUpperLeg'],
  ['rightFoot', 'Fuß rechts', 'foot_R', 'rightLowerLeg'],
  ['chest', 'Brust (optional)', 'chest', 'spine', true],
  ['neck', 'Hals (optional)', 'neck', 'spine', true],
  ['leftEye', 'Auge links (optional)', 'eye_L', 'head', true],
  ['rightEye', 'Auge rechts (optional)', 'eye_R', 'head', true],
  ['jaw', 'Kiefer (optional)', 'jaw', 'head', true],
];
export const EXPRESSIONS = [
  ['blinkLeft', 'Blinzeln links'],
  ['blinkRight', 'Blinzeln rechts'],
  ['aa', 'Mund A'],
  ['ih', 'Mund I'],
  ['ou', 'Mund U'],
  ['ee', 'Mund E'],
  ['oh', 'Mund O'],
  ['happy', 'Freude'],
  ['angry', 'Wut'],
  ['sad', 'Traurig'],
  ['relaxed', 'Entspannt'],
  ['surprised', 'Überrascht'],
];
export function morphTargets(parts) {
  return parts.flatMap((part, mesh) =>
    Object.entries(part.morphTargetDictionary || {}).map(([name, index]) => ({
      mesh,
      index,
      name,
      label: (part.name || 'Mesh ' + mesh) + ' · ' + name,
    })),
  );
}
export function createAvatar(joints, parts) {
  const targets = morphTargets(parts);
  const aliases = {
    blinkLeft: ['blinkleft', 'eyeblinkleft', 'blink_l'],
    blinkRight: ['blinkright', 'eyeblinkright', 'blink_r'],
    aa: ['aa', 'a', 'mouthopen', 'jawopen'],
    happy: ['happy', 'joy'],
  };
  return {
    meta: {
      name: 'Mein Avatar',
      version: '1.0',
      authors: [],
      licenseUrl: 'https://vrm.dev/licenses/1.0/',
    },
    humanBones: Object.fromEntries(
      HUMAN_BONES.filter(([, , id]) => joints.some((j) => j.id === id)).map(([name, , id]) => [
        name,
        id,
      ]),
    ),
    expressions: Object.fromEntries(
      EXPRESSIONS.map(([name]) => [
        name,
        targets
          .filter((t) => (aliases[name] || [name]).includes(t.name.toLowerCase()))
          .map(({ mesh, index }) => ({ mesh, index, weight: 1 })),
      ]),
    ),
  };
}
export function validateAvatar(avatar, joints, parts) {
  if (!avatar || !avatar.meta || !avatar.humanBones || !avatar.expressions)
    throw new Error('Ungültige VTuber-Einstellungen.');
  const meta = avatar.meta;
  if (
    typeof meta.name !== 'string' ||
    meta.name.length > 100 ||
    !Array.isArray(meta.authors) ||
    meta.authors.length > 20 ||
    meta.authors.some((s) => typeof s !== 'string' || s.length > 100)
  )
    throw new Error('Ungültige Avatar-Metadaten.');
  if (meta.licenseUrl !== 'https://vrm.dev/licenses/1.0/')
    throw new Error('Nicht unterstützte VRM-Lizenz.');
  const ids = new Set(joints.map((j) => j.id));
  for (const [role, id] of Object.entries(avatar.humanBones))
    if (!HUMAN_BONES.some(([name]) => name === role) || !ids.has(id))
      throw new Error('Ungültige Humanoid-Zuordnung.');
  for (const [name, binds] of Object.entries(avatar.expressions)) {
    if (!EXPRESSIONS.some(([key]) => key === name) || !Array.isArray(binds) || binds.length > 1000)
      throw new Error('Ungültiger Gesichtsausdruck.');
    for (const bind of binds)
      if (
        !bind ||
        !Number.isInteger(bind.mesh) ||
        bind.mesh < 0 ||
        bind.mesh > 10000 ||
        !Number.isInteger(bind.index) ||
        bind.index < 0 ||
        bind.index >= 64 ||
        !Number.isFinite(bind.weight) ||
        bind.weight < 0 ||
        bind.weight > 1 ||
        (parts && !parts[bind.mesh]?.geometry.morphAttributes.position?.[bind.index])
      )
        throw new Error('Eine Gesichtsform fehlt oder ist ungültig.');
  }
  return avatar;
}
export function avatarProblems(avatar, joints) {
  const problems = [],
    used = new Set();
  if (!avatar.meta.name.trim()) problems.push('Avatarname fehlt.');
  if (!avatar.meta.authors.some((s) => s.trim())) problems.push('Name des Modellautors fehlt.');
  for (const [role, label, , parent, optional] of HUMAN_BONES) {
    const id = avatar.humanBones[role];
    if (!id) {
      if (!optional) problems.push(label + ' zuordnen.');
      continue;
    }
    if (used.has(id)) problems.push('Ein Knochen ist mehrfach zugeordnet: ' + id);
    used.add(id);
    let bone = joints.find((j) => j.id === id);
    if (!bone) {
      problems.push(label + ': Knochen fehlt.');
      continue;
    }
    if (parent && avatar.humanBones[parent]) {
      const ancestors = new Set();
      while (bone?.parent && !ancestors.has(bone.parent)) {
        ancestors.add(bone.parent);
        bone = joints.find((j) => j.id === bone.parent);
      }
      if (!ancestors.has(avatar.humanBones[parent]))
        problems.push(label + ': übergeordnete Knochenkette prüfen.');
    }
  }
  return problems;
}
export function applyExpressions(rig, avatar, values) {
  rig.meshes.forEach((mesh) => mesh.morphTargetInfluences?.fill(0));
  for (const [name, value] of Object.entries(values))
    for (const bind of avatar.expressions[name] || []) {
      const influences = rig.meshes[bind.mesh]?.morphTargetInfluences;
      if (influences && bind.index < influences.length)
        influences[bind.index] = Math.min(
          1,
          influences[bind.index] + Math.max(0, Math.min(1, value)) * bind.weight,
        );
    }
}
export async function exportVRM(rig, parts, joints, avatar) {
  validateAvatar(avatar, joints, parts);
  const problems = avatarProblems(avatar, joints);
  if (problems.length) throw new Error(problems.join(' '));
  const exporter = new GLTFExporter();
  exporter.register((writer) => ({
    afterParse() {
      const humanBones = Object.fromEntries(
        Object.entries(avatar.humanBones).map(([name, id]) => [
          name,
          { node: writer.nodeMap.get(rig.boneMap.get(id)) },
        ]),
      );
      const preset = Object.fromEntries(
        Object.entries(avatar.expressions)
          .filter(([, binds]) => binds.length)
          .map(([name, binds]) => [
            name,
            {
              morphTargetBinds: binds.map(({ mesh, index, weight }) => ({
                node: writer.nodeMap.get(rig.meshes[mesh]),
                index,
                weight,
              })),
              isBinary: false,
              overrideBlink: 'none',
              overrideLookAt: 'none',
              overrideMouth: 'none',
            },
          ]),
      );
      writer.json.extensions ||= {};
      writer.json.extensions.VRMC_vrm = {
        specVersion: '1.0',
        meta: structuredClone(avatar.meta),
        humanoid: { humanBones },
        expressions: { preset },
      };
      writer.extensionsUsed.VRMC_vrm = true;
    },
  }));
  const materials = rig.meshes.map((m) => m.material),
    rotations = joints.map((j) => rig.boneMap.get(j.id).rotation.toArray());
  const faces = rig.meshes.map((m) => m.morphTargetInfluences?.slice());
  try {
    applyPose(rig, defaultPose(joints));
    rig.meshes.forEach((mesh, i) => {
      mesh.material = parts[i].material;
      mesh.morphTargetInfluences?.fill(0);
      const colors = parts[i].geometry.getAttribute('color');
      if (colors) mesh.geometry.setAttribute('color', colors);
      else mesh.geometry.deleteAttribute('color');
    });
    return await exporter.parseAsync(rig.group, {
      binary: true,
      trs: true,
      onlyVisible: true,
      maxTextureSize: 2048,
    });
  } finally {
    rig.meshes.forEach((m, i) => {
      m.material = materials[i];
      if (faces[i]) m.morphTargetInfluences.splice(0, faces[i].length, ...faces[i]);
    });
    joints.forEach((j, i) => rig.boneMap.get(j.id).rotation.fromArray(rotations[i]));
    rig.group.updateMatrixWorld(true);
    rig.skeleton.update();
  }
}
