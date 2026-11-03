import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createProject } from '../src/project-files.js';
import { renderTree } from '../src/ui/tree.js';
import { updateInspector } from '../src/ui/inspector.js';
import { createTimeRuler, refreshTimeline } from '../src/ui/timeline.js';
import { bindShortcuts } from '../src/input/shortcuts.js';
import { readFileSync } from 'node:fs';

function page() {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  globalThis.document = dom.window.document;
  globalThis.Option = dom.window.Option;
  return dom;
}
test('Baumansicht behandelt importierte Namen als Text und wählt Knochen aus', () => {
  const dom = page(),
    state = createProject();
  state.joints[0].name = '<img src=x onerror=alert(1)>';
  let selected = null;
  renderTree(state, (id) => (selected = id));
  const row = document.querySelector('[data-bone="hips"]');
  assert.equal(row.querySelector('.bone-name').textContent, state.joints[0].name);
  assert.equal(row.querySelector('img'), null);
  row.click();
  assert.equal(selected, 'hips');
  dom.window.close();
});
test('Inspector bietet weder den Knochen selbst noch seine Nachfahren als Eltern an', () => {
  const dom = page(),
    state = createProject();
  state.selected = 'chest';
  state.joints.find((joint) => joint.id === 'spine').name = '<script>x</script>';
  updateInspector(state);
  const options = [...document.querySelector('#bone-parent').options];
  assert.equal(
    options.some((option) => option.value === 'chest' || option.value === 'head'),
    false,
  );
  assert.equal(
    options.find((option) => option.value === 'spine').textContent,
    '<script>x</script>',
  );
  assert.equal(document.querySelector('#bone-parent script'), null);
  dom.window.close();
});
test('Zeitleiste markiert den aktuellen Keyframe und ersetzt alte Marker', () => {
  const dom = page(),
    state = createProject();
  createTimeRuler();
  state.keys = [{ frame: 0 }, { frame: 48 }];
  state.frame = 48;
  refreshTimeline(state);
  assert.equal(document.querySelectorAll('.key-marker').length, 2);
  assert.equal(document.querySelectorAll('.key-marker.current').length, 1);
  assert.equal(document.querySelector('#delete-key').disabled, false);
  state.keys = [];
  refreshTimeline(state);
  assert.equal(document.querySelectorAll('.key-marker').length, 0);
  assert.equal(document.querySelector('#delete-key').disabled, true);
  dom.window.close();
});
test('Tastenkürzel beachten Eingabefelder und lassen sich wieder entfernen', () => {
  const dom = page();
  const calls = [];
  const actions = Object.fromEntries(
    ['save', 'undo', 'redo', 'play', 'focus', 'stop'].map((name) => [name, () => calls.push(name)]),
  );
  const unbind = bindShortcuts(actions, document);
  const press = (key, options = {}) =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }),
    );
  press('z', { ctrlKey: true });
  press('z', { ctrlKey: true, shiftKey: true });
  document.querySelector('#project-name').focus();
  press('z', { ctrlKey: true });
  press(' ', { code: 'Space' });
  press('s', { ctrlKey: true });
  assert.deepEqual(calls, ['undo', 'redo', 'save']);
  document.querySelector('#project-name').blur();
  document.querySelector('#help-dialog').setAttribute('open', '');
  press('f');
  assert.deepEqual(calls, ['undo', 'redo', 'save']);
  unbind();
  press('Escape');
  assert.deepEqual(calls, ['undo', 'redo', 'save']);
  dom.window.close();
});

test('Arbeitsbereich-Tabs schalten einmal um und fangen Klicks im Editor nicht ab', async () => {
  const { bindWorkspaceTabs } = await import('../src/ui/workspaces.js');
  const dom = page(),
    calls = [];
  bindWorkspaceTabs((workspace) => calls.push(workspace));
  document.querySelector('[data-workspace="2d"]:not(body)').click();
  assert.equal(document.body.dataset.workspace, '2d');
  assert.equal(
    document.querySelector('.workspace-tabs [data-workspace="2d"]').getAttribute('aria-pressed'),
    'true',
  );
  document.querySelector('#preview2d').click();
  assert.deepEqual(calls, ['2d']);
  document.querySelector('.workspace-tabs [data-workspace="3d"]').click();
  assert.deepEqual(calls, ['2d', '3d']);
  dom.window.close();
});

test('VTuber-Metadaten aktivieren den Export direkt beim Eingeben und bilden einen Verlaufsschritt', async () => {
  const { createAvatarPanel } = await import('../src/vtuber/panel.js');
  const { demoParts, buildRig } = await import('../src/rig-core.js');
  const dom = page(),
    state = createProject(),
    parts = demoParts(),
    rig = buildRig(parts, state.joints);
  let remembered = 0,
    changed = 0;
  createAvatarPanel({
    getState: () => state,
    getParts: () => parts,
    getRig: () => rig,
    remember: () => remembered++,
    mutation: () => changed++,
    stopPlaying() {},
    restoreDisplay() {},
  });
  document.querySelector('#open-avatar').click();
  assert.equal(document.querySelector('#export-vrm').disabled, true);
  const input = document.querySelector('#avatar-authors');
  input.value = 'Modellautor';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.querySelector('#export-vrm').disabled, false);
  input.value = 'Modellautor 2';
  input.dispatchEvent(new dom.window.Event('input'));
  assert.equal(remembered, 1);
  assert.equal(changed, 2);
  assert.deepEqual(state.avatar.meta.authors, ['Modellautor 2']);
  dom.window.close();
});
