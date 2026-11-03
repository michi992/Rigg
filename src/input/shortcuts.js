export function bindShortcuts(actions, target = document) {
  const handler = (event) => {
    if (target.body?.dataset.workspace === '2d') return;
    const key = event.key.toLowerCase();
    const editing =
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.activeElement?.tagName) ||
      target.activeElement?.isContentEditable;
    if (key === 'escape') {
      actions.stop();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      actions.save();
      return;
    }
    if (editing || target.querySelector('dialog[open]')) return;
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      event.shiftKey ? actions.redo() : actions.undo();
    } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      actions.redo();
    } else if (event.code === 'Space') {
      event.preventDefault();
      actions.play();
    } else if (key === 'f') actions.focus();
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
