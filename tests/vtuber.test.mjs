import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { buildRig, humanoidJoints, demoParts, normalizeParts } from '../src/rig-core.js';
import { createAvatar, exportVRM, avatarProblems, applyExpressions } from '../src/vtuber/vrm.js';
import { readImportFile } from '../src/input/files.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
function fixture() {
  const joints = humanoidJoints(),
    parts = demoParts(),
    rig = buildRig(parts, joints),
    avatar = createAvatar(joints, parts);
  avatar.meta.authors = ['Testautor'];
  return { joints, parts, rig, avatar };
}
test('VRM-Export wird vom unabhängigen VRM-Loader mit Humanoid und Gesichtsformen geladen', async () => {
  const { rig, parts, joints, avatar } = fixture();
  rig.boneMap.get('head').rotation.z = 0.4;
  applyExpressions(rig, avatar, { aa: 0.7 });
  const buffer = await exportVRM(rig, parts, joints, avatar);
  assert.ok(Math.abs(rig.boneMap.get('head').rotation.z - 0.4) < 1e-6);
  assert.equal(rig.meshes.at(-1).morphTargetInfluences[0], 0.7);
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const loaded = await loader.parseAsync(buffer, '');
  const vrm = loaded.userData.vrm;
  assert.ok(vrm);
  assert.equal(vrm.meta.metaVersion, '1');
  assert.ok(vrm.humanoid.getRawBoneNode('leftHand'));
  assert.ok(vrm.expressionManager.getExpression('aa'));
  assert.ok(vrm.expressionManager.getExpression('blinkLeft'));
  vrm.expressionManager.setValue('aa', 1);
  vrm.update(0);
  const mouth = loaded.scene.getObjectByName('Mesh_' + (parts.length - 1));
  assert.equal(mouth.morphTargetInfluences[0], 1);
  const imported = await readImportFile({
    name: 'avatar.vrm',
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  });
  assert.equal(imported.state.avatar.meta.authors[0], 'Testautor');
  assert.equal(imported.state.avatar.humanBones.leftHand, 'hand_L');
  assert.ok(imported.state.avatar.expressions.aa.length);
});
test('VRM benötigt eindeutige Humanoid-Ketten und einen Modellautor', () => {
  const { avatar, joints } = fixture();
  avatar.meta.authors = [];
  avatar.humanBones.leftHand = avatar.humanBones.rightHand;
  const errors = avatarProblems(avatar, joints).join(' ');
  assert.match(errors, /Modellautors/);
  assert.match(errors, /mehrfach/);
  assert.match(errors, /Knochenkette/);
});
test('Relative Gesichtsformen behalten nach Welttransformation und Normalisierung ihre Größe', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0], 3),
  );
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 1, 0], 3),
  ];
  geometry.morphTargetsRelative = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.position.set(4, 6, 0);
  mesh.scale.setScalar(2);
  mesh.updateMorphTargets();
  mesh.morphTargetDictionary = { aa: 0 };
  const group = new THREE.Group();
  group.add(mesh);
  const [part] = normalizeParts(group);
  assert.equal(part.morphTargetDictionary.aa, 0);
  assert.ok(Math.abs(part.geometry.morphAttributes.position[0].getY(2) - 1.5) < 1e-6);
  assert.ok(Math.abs(part.geometry.attributes.position.getY(2) - 3) < 1e-6);
});
