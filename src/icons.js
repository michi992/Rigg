const paths = {
  rig: '<path d="m12 3-5 5 5 5 5-5-5-5Zm0 10-5 5 5 3 5-3-5-5ZM7 8l-4 4 4 6m10-10 4 4-4 6"/>',
  joint:
    '<path d="m7 17 10-10M7 7l10 10"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9v9M4 7.5l8 4.5 8-4.5M8 5.3l8 4.5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  export: '<path d="M13 3h8v8m0-8L10 14M9 5H4v16h16v-5"/>',
  folder: '<path d="M3 7V4h6l2 3h10v13H3V7Zm0 3h18"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v7h9V3M7 21v-7h10v7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.6 2.6 0 0 1 5 .8c0 2-2.5 2-2.5 4.2m0 3h.01"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>',
  pose: '<circle cx="12" cy="4" r="2"/><path d="M12 6v8m-7-5 7 2 7-4m-7 7-5 7m5-7 5 7"/>',
  weights:
    '<path d="M4 17c0-4 4-11 8-14 4 3 8 10 8 14a8 8 0 0 1-16 0Z"/><path d="M8 16a4 4 0 0 0 4 4"/>',
  grid: '<path d="m12 4 10 14H2L12 4Zm-4 6h8M5 14h14M12 4v14m0-14L7 18m5-14 5 14"/>',
  wire: '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 0v20M3 7l18 10M21 7 3 17m0-10 9 5 9-5M3 17l9-5 9 5"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  timeline: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11m6-11v11"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  start: '<path d="M5 5v14m13-14L7 12l11 7V5Z"/>',
  diamond: '<path d="m12 3 9 9-9 9-9-9 9-9Z"/>',
  sliders:
    '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
  rotate: '<path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/>',
  sparkles:
    '<path d="m13 3 2.4 6.6L22 12l-6.6 2.4L13 21l-2.4-6.6L4 12l6.6-2.4L13 3ZM4 2v5M1.5 4.5h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  bulb: '<path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7H8Zm0 3h8m-6 3h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M3 12h18m-7-7 7 7-7 7"/>',
};
export function icon(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.joint) + '</svg>';
}
