import { $, element, iconElement } from './dom.js';

export function renderTree(state, onSelect) {
  const fragment = document.createDocumentFragment();
  function visit(joint, depth) {
    const selected = joint.id === state.selected;
    const row = element('button', 'bone-row' + (selected ? ' selected' : ''));
    row.dataset.bone = joint.id;
    row.style.paddingLeft = 9 + depth * 11 + 'px';
    row.title = joint.name;
    row.setAttribute('aria-pressed', String(selected));
    if (depth) row.append(element('span', 'tree-indent'));
    row.append(iconElement('joint'), element('span', 'bone-name', joint.name));
    if (selected) row.append(element('span', 'bone-dot'));
    row.onclick = () => onSelect(joint.id);
    fragment.append(row);
    state.joints
      .filter((child) => child.parent === joint.id)
      .forEach((child) => visit(child, depth + 1));
  }
  state.joints.filter((joint) => !joint.parent).forEach((joint) => visit(joint, 0));
  $('bone-tree').replaceChildren(fragment);
  $('bone-count').textContent = state.joints.length;
}
