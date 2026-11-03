export function bindWorkspaceTabs(onChange) {
  const buttons = [...document.querySelectorAll('.workspace-tabs button[data-workspace]')];
  for (const button of buttons) {
    button.onclick = () => {
      const workspace = button.dataset.workspace;
      document.body.dataset.workspace = workspace;
      buttons.forEach((node) => node.setAttribute('aria-pressed', String(node === button)));
      document.dispatchEvent(new document.defaultView.Event('workspacechange'));
      return onChange(workspace);
    };
  }
}
