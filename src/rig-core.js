import * as THREE from 'three';

export const FPS = 24;
export const LAST_FRAME = 120;
export const MAX_VERTICES = 300000;
export const radians = (x) => (x * Math.PI) / 180;
export const degrees = (x) => (x * 180) / Math.PI;
export const clone = (x) => structuredClone(x);

export function humanoidJoints() {
  const data = [
    ['hips', 'Becken', null, [0, 1.35, 0]],
    ['spine', 'Wirbelsäule', 'hips', [0, 1.68, 0]],
    ['chest', 'Brust', 'spine', [0, 2.04, 0]],
    ['neck', 'Hals', 'chest', [0, 2.33, 0]],
    ['head', 'Kopf', 'neck', [0, 2.57, 0]],
    ['arm_L', 'Oberarm.L', 'chest', [0.39, 2.12, 0]],
    ['forearm_L', 'Unterarm.L', 'arm_L', [0.94, 2.12, 0]],
    ['hand_L', 'Hand.L', 'forearm_L', [1.43, 2.12, 0]],
    ['arm_R', 'Oberarm.R', 'chest', [-0.39, 2.12, 0]],
    ['forearm_R', 'Unterarm.R', 'arm_R', [-0.94, 2.12, 0]],
    ['hand_R', 'Hand.R', 'forearm_R', [-1.43, 2.12, 0]],
    ['thigh_L', 'Oberschenkel.L', 'hips', [0.22, 1.32, 0]],
    ['shin_L', 'Unterschenkel.L', 'thigh_L', [0.22, 0.72, 0]],
    ['foot_L', 'Fuß.L', 'shin_L', [0.22, 0.14, 0.04]],
    ['thigh_R', 'Oberschenkel.R', 'hips', [-0.22, 1.32, 0]],
    ['shin_R', 'Unterschenkel.R', 'thigh_R', [-0.22, 0.72, 0]],
    ['foot_R', 'Fuß.R', 'shin_R', [-0.22, 0.14, 0.04]],
  ];
  return data.map(([id, name, parent, position]) => ({ id, name, parent, position }));
}

export function defaultPose(joints) {
  return Object.fromEntries(joints.map((j) => [j.id, [0, 0, 0]]));
}

export function demoParts() {
  const parts = [];
  const clay = new THREE.MeshStandardMaterial({ color: 0x839dae, metalness: 0.15, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33454b, metalness: 0.1, roughness: 0.55 });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x76edc7,
    metalness: 0.1,
    roughness: 0.4,
  });
  const sphere = (p, scale, material = clay, name = 'Körper') => {
    const g = new THREE.SphereGeometry(1, 24, 18);
    g.scale(...scale);
    g.translate(...p);
    const m = new THREE.Mesh(g, material);
    m.name = name;
    parts.push(m);
  };
  const limb = (start, end, radius, material = clay) => {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end);
    const d = a.distanceTo(b);
    const g = new THREE.CapsuleGeometry(radius, Math.max(0.001, d - radius * 2), 8, 16, 12);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    g.applyQuaternion(q);
    g.translate(...a.add(b).multiplyScalar(0.5).toArray());
    parts.push(new THREE.Mesh(g, material));
  };
  sphere([0, 1.43, 0], [0.34, 0.27, 0.22]);
  sphere([0, 1.85, 0], [0.38, 0.46, 0.22]);
  limb([0, 2.24, 0], [0, 2.52, 0], 0.12, dark);
  sphere([0, 2.69, 0], [0.235, 0.29, 0.215]);
  sphere([0, 2.72, 0.188], [0.17, 0.072, 0.048], dark, 'Visier');
  sphere([-0.07, 2.72, 0.232], [0.023, 0.021, 0.012], accent, 'Auge');
  sphere([0.07, 2.72, 0.232], [0.023, 0.021, 0.012], accent, 'Auge');
  for (const sign of [-1, 1]) {
    limb([sign * 0.32, 2.12, 0], [sign * 0.91, 2.12, 0], 0.125);
    sphere([sign * 0.94, 2.12, 0], [0.125, 0.125, 0.125], dark);
    limb([sign * 0.97, 2.12, 0], [sign * 1.43, 2.12, 0], 0.1);
    sphere([sign * 1.5, 2.12, 0], [0.135, 0.095, 0.085]);
    limb([sign * 0.22, 1.35, 0], [sign * 0.22, 0.75, 0], 0.15);
    sphere([sign * 0.22, 0.72, 0], [0.13, 0.13, 0.13], dark);
    limb([sign * 0.22, 0.69, 0], [sign * 0.22, 0.15, 0], 0.115);
    sphere([sign * 0.22, 0.11, 0.09], [0.135, 0.11, 0.24], dark);
  }
  return parts;
}

export function normalizeParts(object) {
  object.updateMatrixWorld(true);
  const parts = [];
  let vertices = 0;
  object.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    if (mesh.isInstancedMesh)
      throw new Error('Instanzierte Meshes bitte vor dem Export in einzelne Meshes umwandeln.');
    vertices += mesh.geometry.attributes.position.count;
    if (vertices > MAX_VERTICES)
      throw new Error('Das Modell hat zu viele Vertices. Bitte auf höchstens 300.000 reduzieren.');
    const geometry = mesh.geometry.clone();
    // Das bisherige Rig zuerst ins Mesh einrechnen. Danach kann ein neues
    // Skelett gebunden werden, ohne beide Verformungen zu überlagern.
    if (mesh.isSkinnedMesh) {
      const p = geometry.attributes.position,
        v = new THREE.Vector3();
      mesh.skeleton.update();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        mesh.applyBoneTransform(i, v);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      geometry.deleteAttribute('skinIndex');
      geometry.deleteAttribute('skinWeight');
      geometry.computeVertexNormals();
    }
    geometry.morphAttributes = {};
    geometry.applyMatrix4(mesh.matrixWorld);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
    const part = new THREE.Mesh(geometry, material);
    part.name = mesh.name || 'Mesh';
    parts.push(part);
  });
  if (!parts.length) throw new Error('Die Datei enthält kein unterstütztes 3D-Mesh.');
  const box = new THREE.Box3();
  parts.forEach((p) => {
    p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox);
  });
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longest) || longest < 1e-6)
    throw new Error('Das Modell hat keine gültige Größe.');
  const factor = 3 / (size.y > longest * 0.1 ? size.y : longest);
  const c = box.getCenter(new THREE.Vector3());
  const matrix = new THREE.Matrix4()
    .makeTranslation(-c.x, -box.min.y, -c.z)
    .premultiply(new THREE.Matrix4().makeScale(factor, factor, factor));
  parts.forEach((p) => p.geometry.applyMatrix4(matrix));
  return parts;
}

export function validateJoints(joints) {
  if (!Array.isArray(joints) || joints.length < 1 || joints.length > 100)
    throw new Error('Ein Projekt benötigt 1 bis 100 Knochen.');
  const ids = new Set(joints.map((j) => j.id));
  if (
    ids.size !== joints.length ||
    joints.some((j) => typeof j.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(j.id))
  )
    throw new Error('Ungültige Knochen-IDs.');
  for (const j of joints) {
    if (
      typeof j.name !== 'string' ||
      j.name.length > 80 ||
      !Array.isArray(j.position) ||
      j.position.length !== 3 ||
      j.position.some((x) => !Number.isFinite(x) || Math.abs(x) > 100)
    )
      throw new Error('Ungültiger Knochen.');
    if (j.parent !== null && !ids.has(j.parent)) throw new Error('Ein Elternknochen fehlt.');
    const visited = new Set([j.id]);
    let current = j;
    while (current.parent !== null) {
      if (visited.has(current.parent))
        throw new Error('Die Knochenhierarchie enthält einen Kreis.');
      visited.add(current.parent);
      current = joints.find((x) => x.id === current.parent);
    }
  }
}

export function isDescendant(joints, id, ancestor) {
  let j = joints.find((x) => x.id === id);
  while (j?.parent) {
    if (j.parent === ancestor) return true;
    j = joints.find((x) => x.id === j.parent);
  }
  return false;
}

const MAX_INFLUENCES = 4;
const MIN_DISTANCE_SQUARED = 0.0025;

function boneSegments(joints) {
  return joints.map((joint) => {
    const start = new THREE.Vector3(...joint.position);
    const children = joints.filter((child) => child.parent === joint.id);
    if (children.length) {
      return children.map((child) => new THREE.Line3(start, new THREE.Vector3(...child.position)));
    }

    // Endknochen brauchen ebenfalls eine Strecke für die Abstandsmessung.
    const tip = start.clone().add(new THREE.Vector3(0, 0.09, 0));
    return [new THREE.Line3(start, tip)];
  });
}

function skinAttributes(geometry, segments, falloff) {
  const positions = geometry.attributes.position;
  const indices = new Uint16Array(positions.count * MAX_INFLUENCES);
  const weights = new Float32Array(positions.count * MAX_INFLUENCES);
  const vertex = new THREE.Vector3();
  const closestPoint = new THREE.Vector3();

  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {
    vertex.fromBufferAttribute(positions, vertexIndex);
    const influences = segments.map((boneSegments, boneIndex) => {
      let distanceSquared = Infinity;
      for (const segment of boneSegments) {
        segment.closestPointToPoint(vertex, true, closestPoint);
        distanceSquared = Math.min(distanceSquared, closestPoint.distanceToSquared(vertex));
      }

      // Am Knochen selbst wäre 1 / Abstand unendlich. Der Mindestabstand
      // begrenzt den Einfluss und hält die anschließende Normierung stabil.
      const weight = 1 / Math.pow(Math.max(MIN_DISTANCE_SQUARED, distanceSquared), falloff / 2);
      return { boneIndex, weight };
    });

    influences.sort((a, b) => b.weight - a.weight);
    const strongest = influences.slice(0, MAX_INFLUENCES);
    const totalWeight = strongest.reduce((total, influence) => total + influence.weight, 0);

    // glTF verwendet hier vier Einflüsse pro Vertex. Ihre Summe muss 1 ergeben,
    // damit das Mesh beim Überblenden zwischen Knochen nicht skaliert wird.
    strongest.forEach((influence, slot) => {
      const offset = vertexIndex * MAX_INFLUENCES + slot;
      indices[offset] = influence.boneIndex;
      weights[offset] = influence.weight / totalWeight;
    });
  }

  return {
    indices: new THREE.Uint16BufferAttribute(indices, MAX_INFLUENCES),
    weights: new THREE.Float32BufferAttribute(weights, MAX_INFLUENCES),
  };
}

export function buildRig(parts, joints, falloff = 3) {
  validateJoints(joints);
  const group = new THREE.Group();
  group.name = 'Dewald_Rig';
  const boneMap = new Map();
  const index = new Map();
  const jointById = new Map(joints.map((joint) => [joint.id, joint]));

  joints.forEach((joint, boneIndex) => {
    const bone = new THREE.Bone();
    bone.name = joint.id;
    boneMap.set(joint.id, bone);
    index.set(joint.id, boneIndex);
  });

  for (const joint of joints) {
    const bone = boneMap.get(joint.id);
    const parent = jointById.get(joint.parent);
    bone.position.fromArray(joint.position);

    // Der Editor speichert absolute Gelenkpositionen. Three.js erwartet
    // innerhalb der Knochenhierarchie Positionen relativ zum Elternknochen.
    if (parent) {
      bone.position.sub(new THREE.Vector3(...parent.position));
      boneMap.get(parent.id).add(bone);
    } else {
      group.add(bone);
    }
  }

  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(joints.map((joint) => boneMap.get(joint.id)));
  skeleton.calculateInverses();
  const segments = boneSegments(joints);

  const meshes = parts.map((part, partIndex) => {
    const geometry = part.geometry.clone();
    const attributes = skinAttributes(geometry, segments, falloff);
    geometry.setAttribute('skinIndex', attributes.indices);
    geometry.setAttribute('skinWeight', attributes.weights);

    const mesh = new THREE.SkinnedMesh(geometry, part.material);
    mesh.name = 'Mesh_' + partIndex;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Die Ruhepose-Boundingbox passt nach einer Knochenbewegung nicht mehr.
    mesh.frustumCulled = false;
    group.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    return mesh;
  });

  return { group, skeleton, boneMap, meshes, index };
}

export function applyPose(rig, pose) {
  for (const [id, bone] of rig.boneMap) {
    const angles = pose[id] || [0, 0, 0];
    bone.rotation.set(...angles);
  }
  rig.group.updateMatrixWorld(true);
  rig.skeleton.update();
}

export function samplePose(keys, frame, joints, fallback) {
  if (!keys.length) return clone(fallback || defaultPose(joints));
  const sorted = [...keys].sort((a, b) => a.frame - b.frame);
  const a = [...sorted].reverse().find((k) => k.frame <= frame) || sorted[0];
  const b = sorted.find((k) => k.frame >= frame) || sorted.at(-1);
  if (a.frame === b.frame) return clone(a.pose);
  const t = (frame - a.frame) / (b.frame - a.frame);
  const result = {},
    qa = new THREE.Quaternion(),
    qb = new THREE.Quaternion(),
    e = new THREE.Euler();
  for (const j of joints) {
    qa.setFromEuler(e.fromArray([...(a.pose[j.id] || [0, 0, 0]), 'XYZ']));
    qb.setFromEuler(e.fromArray([...(b.pose[j.id] || [0, 0, 0]), 'XYZ']));
    // Quaternionen vermeiden Sprünge an der ±180°-Grenze. Erst für die
    // Wertefelder im Editor wird wieder in Eulerwinkel zurückgerechnet.
    qa.slerp(qb, t);
    e.setFromQuaternion(qa, 'XYZ');
    result[j.id] = [e.x, e.y, e.z];
  }
  return result;
}

export function animationClip(keys, joints, rig) {
  if (!keys.length) return null;
  const sorted = [...keys].sort((a, b) => a.frame - b.frame),
    times = sorted.map((k) => k.frame / FPS);
  const tracks = joints.map((j) => {
    const values = [],
      e = new THREE.Euler(),
      q = new THREE.Quaternion();
    for (const k of sorted) {
      q.setFromEuler(e.set(...(k.pose[j.id] || [0, 0, 0])));
      values.push(...q.toArray());
    }
    return new THREE.QuaternionKeyframeTrack(
      rig.boneMap.get(j.id).uuid + '.quaternion',
      times,
      values,
    );
  });
  return new THREE.AnimationClip('Dewald_Animation', -1, tracks);
}
