import test from 'node:test';
import assert from 'node:assert/strict';
import { readImportFile, validateImportFile } from '../src/input/files.js';
import { createProject } from '../src/project-files.js';
import { LIMITS } from '../src/config.js';

const file = (name, data) => Object.assign(new Blob([data]), { name });
function triangleGLB(external = false) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const document = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [
      {
        byteLength: positions.byteLength,
        ...(external ? { uri: 'https://example.invalid/model.bin' } : {}),
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 2, 0],
      },
    ],
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const padding = (4 - (json.length % 4)) % 4;
  const length = 12 + 8 + json.length + padding + (external ? 0 : 8 + positions.byteLength);
  const buffer = new ArrayBuffer(length),
    view = new DataView(buffer),
    bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, json.length + padding, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(json, 20);
  bytes.fill(32, 20 + json.length, 20 + json.length + padding);
  if (!external) {
    const offset = 20 + json.length + padding;
    view.setUint32(offset, positions.byteLength, true);
    view.setUint32(offset + 4, 0x004e4942, true);
    bytes.set(new Uint8Array(positions.buffer), offset + 8);
  }
  return buffer;
}
test('OBJ und GLB werden über denselben Dateiimport normalisiert', async () => {
  for (const input of [
    file('triangle.obj', 'v 0 0 0\nv 1 0 0\nv 0 2 0\nf 1 2 3\n'),
    file('triangle.glb', triangleGLB()),
  ]) {
    const loaded = await readImportFile(input);
    assert.equal(loaded.parts.length, 1);
    loaded.parts[0].geometry.computeBoundingBox();
    assert.equal(loaded.parts[0].geometry.boundingBox.max.y, 3);
    assert.equal(loaded.state.joints.length, 17);
  }
});
test('Leere und beschädigte GLB-Dateien werden abgewiesen', async () => {
  await assert.rejects(readImportFile(file('empty.glb', '')), /leer/);
  await assert.rejects(readImportFile(file('broken.glb', new Uint8Array([1, 2, 3, 4]))));
});
test('Externe Ressourcen einer GLB-Datei werden vor einem Netzabruf blockiert', async () => {
  await assert.rejects(
    readImportFile(file('external.glb', triangleGLB(true))),
    /Externe Ressourcen/,
  );
});
test('Größenlimits greifen vor dem Lesen des Dateiinhalts', async () => {
  let read = false;
  await assert.rejects(
    readImportFile({
      name: 'large.glb',
      size: LIMITS.modelBytes + 1,
      arrayBuffer() {
        read = true;
        throw new Error('Nicht lesen');
      },
    }),
    /höchstens/,
  );
  assert.equal(read, false);
  assert.throws(
    () => validateImportFile({ name: 'large.json', size: LIMITS.projectBytes + 1 }),
    /höchstens/,
  );
  assert.throws(() => validateImportFile({ name: 'unknown.exe', size: 1 }), /GLB, VRM 1.0, OBJ/);
});
test('Projektimport weist falsche IDs, Knochenzyklen und ungültige JSON-Dateien ab', async () => {
  const wrongId = createProject();
  wrongId.joints[0].id = 'bad id';
  await assert.rejects(
    readImportFile(file('bad.rig.json', JSON.stringify(wrongId))),
    /Knochen-IDs/,
  );
  const cycle = createProject();
  cycle.joints[0].parent = 'head';
  await assert.rejects(readImportFile(file('cycle.rig.json', JSON.stringify(cycle))), /Kreis/);
  await assert.rejects(readImportFile(file('bad.json', '{')));
  const nullJoint = createProject();
  nullJoint.joints[0] = null;
  await assert.rejects(
    readImportFile(file('null.json', JSON.stringify(nullJoint))),
    /Ungültiger Knochen/,
  );
});
