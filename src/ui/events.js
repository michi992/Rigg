import { $ } from './dom.js';
import { busy, nextPaint, toast, status, reportError } from './feedback.js';
import { createTimeRuler } from './timeline.js';
import { bindShortcuts } from '../input/shortcuts.js';
import { clone, applyPose } from '../rig-core.js';
import { putKeyframe, removeKeyframe } from '../state/keyframes.js';
import { download } from '../project-files.js';
import { LIMITS } from '../config.js';

export function bindEditorEvents({
  getState,
  getRig,
  viewport,
  historyStep,
  saveProject,
  exportGLB,
  openFile,
  doNewProject,
  focusModel,
  setMode,
  remember,
  mutation,
  updateInspector,
  renderTree,
  invalidateAnimation,
  rebuildRig,
  setJointPosition,
  setRotation,
  stopPlaying,
  addBone,
  deleteBone,
  setPreset,
  togglePlay,
  setFrame,
  refreshTimeline,
}) {
  $('undo').onclick = () => historyStep('undo');
  $('redo').onclick = () => historyStep('redo');
  $('save-project').onclick = saveProject;
  $('export').onclick = exportGLB;
  $('open-project').onclick = () => {
    $('file-input').accept = '.rig.json,.json';
    $('file-input').click();
  };
  $('import-model').onclick = () => {
    $('file-input').accept = '.glb,.vrm,.obj';
    $('file-input').click();
  };
  $('file-input').onchange = () => openFile($('file-input').files[0]);
  $('new-project').onclick = doNewProject;
  document.querySelector('.brand').onclick = (e) => {
    e.preventDefault();
    focusModel();
  };
  $('help-button').onclick = () => $('help-dialog').showModal();
  $('close-help').onclick = () => $('help-dialog').close();
  $('start-working').onclick = () => $('help-dialog').close();
  document
    .querySelectorAll('[data-mode]')
    .forEach((el) => (el.onclick = () => setMode(el.dataset.mode)));
  $('project-name').onfocus = () => {
    $('project-name').dataset.previous = getState().name;
  };
  $('project-name').onchange = () => {
    const name = $('project-name').value.trim().slice(0, LIMITS.projectName) || 'Mein Charakter';
    remember();
    getState().name = name;
    $('project-name').value = name;
    mutation();
  };
  $('bone-name').onchange = () => {
    const name = $('bone-name').value.trim().slice(0, LIMITS.boneName);
    if (!name) {
      updateInspector();
      return;
    }
    remember();
    getState().joints.find((j) => j.id === getState().selected).name = name;
    renderTree();
    updateInspector();
    mutation();
  };
  $('bone-parent').onchange = () => {
    if (getState().mode !== 'rig') return;
    remember();
    const j = getState().joints.find((x) => x.id === getState().selected);
    j.parent = $('bone-parent').value || null;
    invalidateAnimation();
    rebuildRig();
    renderTree();
    updateInspector();
    mutation();
  };
  ['x', 'y', 'z'].forEach((axis, i) => {
    $('pos-' + axis).onchange = () => setJointPosition(i, parseFloat($('pos-' + axis).value));
    $('rot-' + axis).oninput = () => setRotation(i, parseFloat($('rot-' + axis).value));
    const slider = $('rot-' + axis + '-slider');
    slider.addEventListener('pointerdown', () => {
      remember();
      stopPlaying();
    });
    slider.oninput = () => setRotation(i, Number(slider.value), false);
    slider.addEventListener('keydown', (e) => {
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'PageUp',
          'PageDown',
        ].includes(e.key) &&
        !e.repeat
      )
        remember();
    });
  });
  $('add-bone').onclick = addBone;
  $('delete-bone').onclick = deleteBone;
  $('reset-bone').onclick = () => {
    remember();
    stopPlaying();
    getState().pose[getState().selected] = [0, 0, 0];
    applyPose(getRig(), getState().pose);
    updateInspector();
    mutation();
  };
  $('rest-pose').onclick = () => setPreset('rest');
  $('wave-pose').onclick = () => setPreset('wave');
  $('mirror').onclick = () => {
    remember();
    setMode('pose', false);
    const old = clone(getState().pose);
    for (const j of getState().joints) {
      const partner = j.id.endsWith('_L')
        ? j.id.slice(0, -2) + '_R'
        : j.id.endsWith('_R')
          ? j.id.slice(0, -2) + '_L'
          : j.id;
      const p = old[partner] || old[j.id];
      getState().pose[j.id] = [p[0], -p[1], -p[2]];
    }
    applyPose(getRig(), getState().pose);
    updateInspector();
    mutation();
    toast('Pose über die X-Achse gespiegelt.');
  };
  $('falloff').oninput = () =>
    ($('falloff-value').textContent = Number($('falloff').value).toFixed(1).replace('.', ','));
  $('falloff').onchange = () => {
    remember();
    getState().falloff = Number($('falloff').value);
    rebuildRig();
    mutation();
    toast('Einflussabfall geändert und Gewichte berechnet.');
  };
  $('auto-weights').onclick = async () => {
    busy(true, 'Gewichte werden berechnet …');
    await nextPaint();
    try {
      rebuildRig();
      mutation();
      toast('Gewichte für ' + getState().joints.length + ' Knochen neu berechnet.');
      status('Gewichtung aktualisiert');
    } catch (error) {
      reportError(error, 'Gewichtung fehlgeschlagen');
    } finally {
      busy(false);
    }
  };
  $('toggle-bones').onclick = () => {
    const enabled = viewport.toggleBones();
    $('toggle-bones').classList.toggle('active', enabled);
    $('toggle-bones').setAttribute('aria-pressed', String(enabled));
  };
  $('toggle-wire').onclick = () => {
    const enabled = viewport.toggleWire();
    $('toggle-wire').classList.toggle('active', enabled);
    $('toggle-wire').setAttribute('aria-pressed', String(enabled));
  };
  $('toggle-grid').onclick = () => {
    const enabled = viewport.toggleGrid();
    $('toggle-grid').classList.toggle('active', enabled);
    $('toggle-grid').setAttribute('aria-pressed', String(enabled));
  };
  $('focus').onclick = focusModel;
  $('camera-view').onchange = () => viewport.switchCamera($('camera-view').value);
  $('play').onclick = togglePlay;
  $('to-start').onclick = () => setFrame(0);
  $('frame-slider').oninput = () => setFrame(Number($('frame-slider').value));
  $('frame-number').oninput = () => setFrame(Number($('frame-number').value));
  $('add-key').onclick = () => {
    stopPlaying();
    remember();
    if (getState().mode === 'rig') setMode('pose', false);
    const existing = getState().keys.some((key) => key.frame === getState().frame);
    getState().keys = putKeyframe(getState().keys, getState().frame, getState().pose);
    refreshTimeline();
    mutation();
    toast('Keyframe bei Frame ' + getState().frame + (existing ? ' aktualisiert.' : ' gesetzt.'));
  };
  $('delete-key').onclick = () => {
    if (!getState().keys.some((k) => k.frame === getState().frame)) return;
    remember();
    getState().keys = removeKeyframe(getState().keys, getState().frame);
    refreshTimeline();
    mutation();
  };
  $('download-offline').onclick = async () => {
    if (location.protocol === 'file:') {
      toast('Du verwendest bereits die Offline-Version. Bewahre diese HTML-Datei auf.');
      return;
    }
    try {
      const response = await fetch('./dewald-rig-studio.html');
      if (!response.ok) throw new Error('Download nicht verfügbar');
      download(await response.blob(), 'Dewald_Rig_Studio.html', 'text/html');
      toast('Offline-Version heruntergeladen. Öffne die HTML-Datei per Doppelklick.');
    } catch (error) {
      reportError(error, 'Offline-Download fehlgeschlagen');
    }
  };
  bindShortcuts({
    save: saveProject,
    undo: () => historyStep('undo'),
    redo: () => historyStep('redo'),
    play: togglePlay,
    focus: focusModel,
    stop: stopPlaying,
  });
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      dragDepth++;
      $('drop-zone').classList.add('visible');
    }
  });
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) $('drop-zone').classList.remove('visible');
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    $('drop-zone').classList.remove('visible');
    openFile(e.dataTransfer.files[0]);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPlaying();
  });
  createTimeRuler();
}
