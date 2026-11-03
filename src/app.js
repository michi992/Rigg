import { startEditor } from './editor.js';
import { start2DEditor } from './twod/editor.js';
import { reportError } from './ui/feedback.js';
import { bindWorkspaceTabs } from './ui/workspaces.js';

startEditor();
let editor2D, starting2D;
bindWorkspaceTabs(async (workspace) => {
  if (workspace === '2d') {
    try {
      starting2D ||= start2DEditor();
      editor2D = await starting2D;
    } catch (error) {
      starting2D = null;
      reportError(error, '2D-Editor konnte nicht gestartet werden');
    }
    document.getElementById('status-text').textContent =
      '2D-Avatar · Ebenen und Parameter bearbeiten';
    document.getElementById('status-right').textContent =
      '2D-Canvas · PNG-Ebenen · eigener OBS-Player';
  } else {
    editor2D?.stop();
    document.getElementById('status-text').textContent = '3D-Rig · Skelett, Gesichtsformen und VRM';
    document.getElementById('status-right').textContent = '3D-Ansicht · Lokal auf deinem Gerät';
  }
});
