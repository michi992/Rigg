import { $ } from './dom.js';

export const nextPaint = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

export function toast(message, error = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = message;
  $('toasts').append(el);
  setTimeout(() => el.remove(), error ? 9000 : 4300);
}

export function status(text) {
  $('status-text').textContent = text;
}

export function busy(on, message = 'Einen Moment …') {
  $('loading-overlay').hidden = !on;
  $('loading-text').textContent = message;
}

export function confirmAction(title, body) {
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  $('confirm-dialog').showModal();
  return new Promise((resolve) => {
    $('confirm-ok').onclick = () => {
      $('confirm-dialog').close();
      resolve(true);
    };
    $('confirm-cancel').onclick = () => {
      $('confirm-dialog').close();
      resolve(false);
    };
    $('confirm-dialog').oncancel = () => resolve(false);
  });
}

export function storageLabel(text, success = true) {
  const el = $('save-state');
  el.replaceChildren();
  const dot = document.createElement('i');
  dot.style.background = success ? '#72bba0' : '#cfaa76';
  el.append(dot, document.createTextNode(text));
}

export function readableError(error) {
  const s = String(error?.message || error);
  if (/DRACO|draco|KTX|ktx|Meshopt|meshopt/.test(s))
    return 'Komprimierte Modelle werden nicht unterstützt. Exportiere eine unkomprimierte GLB-Datei.';
  return s.length > 230 ? s.slice(0, 230) + ' …' : s;
}

export function reportError(error, context) {
  console.error(context, error);
  toast(context + ': ' + readableError(error), true);
}
