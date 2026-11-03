import { icon } from '../icons.js';

export const $ = (id) => document.getElementById(id);
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function iconElement(name) {
  const node = element('span');
  // Ausschließlich die festen SVG-Pfade aus icons.js gelangen in innerHTML.
  node.innerHTML = icon(name);
  return node;
}
