import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  demoParts,
  humanoidJoints,
  defaultPose,
  buildRig,
  applyPose,
  samplePose,
  animationClip,
  validateJoints,
  normalizeParts,
} from '../src/rig-core.js';

// Der GLB-Exporter erwartet FileReader. Im Node-Test wird dieselbe Schnittstelle
// mit Blob.arrayBuffer nachgebildet, ohne einen Browser zu starten.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(
      (result) => {
        this.result = result;
        this.onloadend?.();
      },
      (error) => this.onerror?.(error),
    );
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(
      (result) => {
        this.result = 'data:' + blob.type + ';base64,' + Buffer.from(result).toString('base64');
        this.onloadend?.();
      },
      (error) => this.onerror?.(error),
    );
  }
};

test('Gewichte und Ruhepose', () => {
  const joints = humanoidJoints(),
    parts = demoParts(),
    rig = buildRig(parts, joints);
  let tested = 0,
    maxError = 0;
  rig.meshes.forEach((mesh, index) => {
    const pos = mesh.geometry.attributes.position,
      weights = mesh.geometry.attributes.skinWeight,
      indices = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < pos.count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const w = weights.array[i * 4 + k];
        assert.ok(Number.isFinite(w) && w >= 0);
        assert.ok(indices.array[i * 4 + k] < joints.length);
        sum += w;
      }
      assert.ok(Math.abs(sum - 1) < 1e-6);
      const expected = new THREE.Vector3().fromBufferAttribute(
        parts[index].geometry.attributes.position,
        i,
      );
      const actual = mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i));
      maxError = Math.max(maxError, actual.distanceTo(expected));
      tested++;
    }
  });
  assert.ok(tested > 10000);
  assert.ok(maxError < 1e-5);
});

test('Arm drehen und zurücksetzen', () => {
  const joints = humanoidJoints(),
    rig = buildRig(demoParts(), joints),
    mesh = rig.meshes[10];
  const pos = mesh.geometry.attributes.position,
    pose = defaultPose(joints);
  const before = mesh.applyBoneTransform(0, new THREE.Vector3().fromBufferAttribute(pos, 0));
  pose.arm_L[2] = Math.PI / 2;
  pose.arm_R[2] = Math.PI / 2;
  applyPose(rig, pose);
  const after = mesh.applyBoneTransform(0, new THREE.Vector3().fromBufferAttribute(pos, 0));
  assert.ok(after.distanceTo(before) > 0.2);
  applyPose(rig, defaultPose(joints));
  assert.ok(
    mesh.applyBoneTransform(0, new THREE.Vector3().fromBufferAttribute(pos, 0)).distanceTo(before) <
      1e-5,
  );
});

test('Animation und GLB-Rundlauf', async () => {
  const joints = humanoidJoints(),
    rig = buildRig(demoParts(), joints),
    first = defaultPose(joints),
    last = defaultPose(joints);
  last.forearm_L[2] = Math.PI / 2;
  const keys = [
    { frame: 0, pose: first },
    { frame: 48, pose: last },
  ];
  assert.ok(Math.abs(samplePose(keys, 24, joints).forearm_L[2] - Math.PI / 4) < 1e-6);
  const clip = animationClip(keys, joints, rig);
  const data = await new GLTFExporter().parseAsync(rig.group, {
    binary: true,
    trs: true,
    animations: [clip],
  });
  assert.ok(data.byteLength > 100000);
  const result = await new GLTFLoader().parseAsync(data, '');
  const meshes = [];
  result.scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  assert.equal(meshes.length, rig.meshes.length);
  assert.equal(meshes[0].skeleton.bones.length, 17);
  assert.equal(result.animations.length, 1);
  assert.equal(result.animations[0].duration, 2);
  assert.equal(result.animations[0].tracks.length, 17);
  const mixer = new THREE.AnimationMixer(result.scene);
  mixer.clipAction(result.animations[0]).play();
  mixer.setTime(1);
  assert.ok(
    Math.abs(meshes[0].skeleton.getBoneByName('forearm_L').rotation.z - Math.PI / 4) < 1e-5,
  );
});

test('Knochenzyklen und Modellnormalisierung', () => {
  const joints = humanoidJoints();
  joints[0].parent = 'head';
  assert.throws(() => validateJoints(joints), /Kreis/);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshStandardMaterial());
  mesh.position.set(10, -7, 2);
  mesh.scale.setScalar(2);
  const [part] = normalizeParts(mesh);
  part.geometry.computeBoundingBox();
  assert.ok(Math.abs(part.geometry.boundingBox.max.y - 3) < 1e-5);
  assert.ok(Math.abs(part.geometry.boundingBox.min.y) < 1e-5);
  assert.ok(Math.abs(part.geometry.boundingBox.getCenter(new THREE.Vector3()).x) < 1e-5);
});
