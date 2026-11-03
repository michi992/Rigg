import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  validateProject,
  bufferToBase64,
  base64ToBuffer,
  sourceParts,
} from '../src/project-files.js';

test('Unabhängige Projektzustände', () => {
  const first = createProject();
  const second = createProject();
  first.joints[0].position[0] = 5;
  first.pose.hips[0] = 1;
  assert.equal(second.joints[0].position[0], 0);
  assert.equal(second.pose.hips[0], 0);
  assert.equal(validateProject(second), second);
});

test('Doppelte Keyframes abweisen', () => {
  const project = createProject();
  project.keys = [
    { frame: 24, pose: structuredClone(project.pose) },
    { frame: 24, pose: structuredClone(project.pose) },
  ];
  assert.throws(() => validateProject(project), /doppelter Keyframe/);
});

test('Ungültige und unvollständige Posen abweisen', () => {
  const incomplete = createProject();
  delete incomplete.pose.head;
  assert.throws(() => validateProject(incomplete), /ungültige Rotationen/);

  const invalid = createProject();
  invalid.pose.head[0] = Infinity;
  assert.throws(() => validateProject(invalid), /ungültige Rotationen/);
});

test('Ungültige Auswahl zurücksetzen', () => {
  const project = createProject();
  const before = structuredClone(project.joints);
  project.selected = 'removed_bone';
  project.mode = 'old_mode';
  const loaded = validateProject(project);
  assert.equal(loaded.selected, loaded.joints[0].id);
  assert.equal(loaded.mode, 'rig');
  assert.deepEqual(loaded.joints, before);
});

test('Base64-Rundlauf mit mehreren Blöcken', () => {
  // Drei volle Blöcke und ein kurzer Rest prüfen auch den letzten Teilblock.
  const payloadLength = 3 * 32_768 + 7;
  const bytes = Uint8Array.from({ length: payloadLength }, (_, index) => index % 256);
  const restored = new Uint8Array(base64ToBuffer(bufferToBase64(bytes.buffer)));
  assert.deepEqual(restored, bytes);
});

test('OBJ-Geometrie normalisieren', async () => {
  const data = 'v 0 0 0\nv 1 0 0\nv 0 2 0\nf 1 2 3\n';
  const parts = await sourceParts({ kind: 'obj', name: 'triangle.obj', data });
  assert.equal(parts.length, 1);
  parts[0].geometry.computeBoundingBox();
  assert.equal(parts[0].geometry.boundingBox.min.y, 0);
  assert.equal(parts[0].geometry.boundingBox.max.y, 3);
});
