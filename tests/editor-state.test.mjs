import test from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../src/state/history.js';
import { putKeyframe, removeKeyframe } from '../src/state/keyframes.js';
import { LAST_FRAME } from '../src/config.js';

test('Undo und Redo stellen den Projektstand wieder her', () => {
  const history = new History();
  history.record({ name: 'Vorher', pose: { arm: [0, 0, 0] } });
  const old = history.undo({ name: 'Nachher', pose: { arm: [1, 0, 0] } });
  assert.equal(old.name, 'Vorher');
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.redo(old).pose.arm, [1, 0, 0]);
});
test('Neue Änderungen verwerfen Redo und der Verlauf bleibt begrenzt', () => {
  const history = new History(2);
  history.record({ frame: 0 });
  history.record({ frame: 1 });
  history.record({ frame: 2 });
  assert.equal(history.undo({ frame: 3 }).frame, 2);
  assert.equal(history.undo({ frame: 2 }).frame, 1);
  assert.equal(history.undo({ frame: 1 }), null);
  history.record({ frame: 4 });
  assert.equal(history.canRedo, false);
  history.clear();
  assert.equal(history.canUndo, false);
});
test('Keyframes werden ersetzt, sortiert und von der bearbeiteten Pose getrennt', () => {
  const pose = { arm: [0, 0, 0] };
  let keys = putKeyframe([], 48, pose);
  pose.arm[0] = 1;
  assert.equal(keys[0].pose.arm[0], 0);
  keys = putKeyframe(keys, 0, pose);
  keys = putKeyframe(keys, 48, pose);
  assert.deepEqual(
    keys.map((key) => key.frame),
    [0, 48],
  );
  assert.equal(keys[1].pose.arm[0], 1);
  assert.deepEqual(
    removeKeyframe(keys, 48).map((key) => key.frame),
    [0],
  );
  assert.equal(keys.length, 2);
});
test('Keyframes akzeptieren nur gültige ganze Frames', () => {
  for (const frame of [-1, 0.5, NaN, Infinity, LAST_FRAME + 1]) {
    assert.throws(() => putKeyframe([], frame, {}), /Ungültiger Frame/);
  }
});
