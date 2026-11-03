import { isDescendant, degrees } from '../rig-core.js';
import { $, element } from './dom.js';

export function updateRotationInputs(state) {
  const pose = state.pose[state.selected] || [0, 0, 0];
  ['x', 'y', 'z'].forEach((axis, index) => {
    const value = Math.round(degrees(pose[index]) * 10) / 10;
    for (const id of ['rot-' + axis, 'rot-' + axis + '-slider']) {
      $(id).value = value;
      $(id).disabled = state.mode === 'rig';
    }
  });
}

export function updateInspector(state) {
  const joint = state.joints.find((entry) => entry.id === state.selected);
  if (!joint) return;
  $('bone-name').value = joint.name;
  $('inspector-name').textContent = joint.name;
  $('selected-pill').textContent = joint.name;
  const parent = $('bone-parent');
  const options = [element('option', '', 'Kein Elternknochen')];
  options[0].value = '';
  for (const candidate of state.joints) {
    if (candidate.id === joint.id || isDescendant(state.joints, candidate.id, joint.id)) continue;
    const option = element('option', '', candidate.name);
    option.value = candidate.id;
    options.push(option);
  }
  parent.replaceChildren(...options);
  parent.value = joint.parent || '';
  parent.disabled = state.mode !== 'rig';
  ['x', 'y', 'z'].forEach((axis, index) => {
    $('pos-' + axis).value = joint.position[index].toFixed(3);
    $('pos-' + axis).disabled = state.mode !== 'rig';
  });
  updateRotationInputs(state);
  $('delete-bone').disabled = state.joints.length === 1;
  $('reset-bone').disabled = state.mode === 'rig';
}
