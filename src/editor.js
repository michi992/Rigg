import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import {
  createProject as freshState,
  validateProject,
  sourceParts,
  disposeParts,
  download,
} from './project-files.js';
import { FPS, LAST_FRAME, LIMITS, fileSizeLabel } from './config.js';
import {
  clone,
  radians,
  defaultPose,
  buildRig,
  applyPose,
  samplePose,
  animationClip,
} from './rig-core.js';
import { createViewport } from './viewport.js';
import { History } from './state/history.js';
import { ProjectStorage } from './state/storage.js';
import { renderTree as renderTreeView } from './ui/tree.js';
import {
  updateInspector as renderInspectorView,
  updateRotationInputs as renderRotations,
} from './ui/inspector.js';
import { refreshTimeline as renderTimelineView } from './ui/timeline.js';
import { bindEditorEvents } from './ui/events.js';
import { $ } from './ui/dom.js';
import { icon } from './icons.js';
import {
  toast,
  status,
  busy,
  confirmAction,
  storageLabel,
  nextPaint,
  reportError,
} from './ui/feedback.js';
import { readImportFile, validateImportFile } from './input/files.js';
import { createAvatarPanel } from './vtuber/panel.js';

let state = freshState(),
  parts = [],
  rig = null,
  viewport,
  avatarPanel;
let playing = false,
  lastTime = 0,
  frameClock = 0,
  busyImport = false,
  dirty = false;
const history = new History();
const storage = new ProjectStorage(storageLabel, (error) =>
  reportError(error, 'Browsersicherung fehlgeschlagen'),
);
const renderTree = () => renderTreeView(state, selectBone);
const updateInspector = () => renderInspectorView(state);
const updateRotationInputs = () => renderRotations(state);
const refreshTimeline = (hint = true) => renderTimelineView(state, hint);
const attachGizmo = () => viewport.attachGizmo();
const updateDisplayMaterials = () => viewport.updateDisplayMaterials();
const clearRig = () => {
  viewport.clear();
  rig = null;
};
const openDatabase = () => storage.load();
const scheduleSave = () => storage.schedule(snapshot);
function remember() {
  history.record(snapshot());
  refreshUndo();
}
function refreshUndo() {
  $('undo').disabled = !history.canUndo;
  $('redo').disabled = !history.canRedo;
}
function rebuildRig() {
  const next = buildRig(parts, state.joints, state.falloff);
  viewport.setRig(next);
  rig = next;
  avatarPanel?.refresh();
  updateMetrics();
}
function snapshot() {
  const { source, ...rest } = state;
  return { ...clone(rest), source };
}

function mutation() {
  dirty = true;
  scheduleSave();
  refreshUndo();
}

function focusModel() {
  viewport.switchCamera($('camera-view').value);
  status('Ansicht zentriert');
}

function selectBone(id) {
  if (!state.joints.some((j) => j.id === id)) return;
  state.selected = id;
  renderTree();
  updateInspector();
  attachGizmo();
  updateDisplayMaterials();
  scheduleSave();
}

function updateMetrics() {
  const vertices = parts.reduce((sum, p) => sum + p.geometry.attributes.position.count, 0);
  $('vertex-count').textContent = vertices.toLocaleString('de-DE') + ' Vertices';
  $('mesh-count').textContent = parts.length + ' Meshes';
  $('model-name').textContent = state.source.name;
  $('model-subtitle').textContent =
    state.source.kind === 'demo'
      ? 'Beispielmodell · bereit zum Riggen'
      : state.source.kind.toUpperCase() + ' · neues Rig';
  $('falloff-value').textContent = state.falloff.toFixed(1).replace('.', ',');
  $('falloff').value = state.falloff;
  $('rig-status-subtitle').textContent =
    'Automatisch · ' + Math.min(4, state.joints.length) + ' Einflüsse pro Vertex';
}

function setMode(mode, save = true) {
  if (!['rig', 'pose', 'weights'].includes(mode)) return;
  stopPlaying();
  state.mode = mode;
  document.body.dataset.mode = mode;
  document
    .querySelectorAll('[data-mode]')
    .forEach((el) => el.classList.toggle('active', el.dataset.mode === mode));
  const titles = {
    rig: ['Skelett bearbeiten', 'REST POSE'],
    pose: ['Pose bearbeiten', 'FORWARD KINEMATICS'],
    weights: ['Gewichte prüfen', 'SKIN WEIGHTS'],
  };
  $('viewport-title').textContent = titles[mode][0];
  $('mode-tag').textContent = titles[mode][1];
  // Zum Positionieren der Gelenke wird die Ruhepose angezeigt. Die zuletzt
  // bearbeitete Pose bleibt dabei im Projektzustand erhalten.
  if (rig) applyPose(rig, mode === 'rig' ? defaultPose(state.joints) : state.pose);
  updateDisplayMaterials();
  attachGizmo();
  updateInspector();
  if (save) scheduleSave();
}

function setFrame(frame) {
  stopPlaying();
  state.frame = Math.max(0, Math.min(LAST_FRAME, Math.round(frame) || 0));
  // Das Verschieben des Abspielkopfs liest die vorhandene Animation aus.
  // Eine bearbeitete Pose wird erst mit „Keyframe setzen“ Teil der Animation.
  if (state.keys.length) state.pose = samplePose(state.keys, state.frame, state.joints, state.pose);
  if (state.mode === 'rig') setMode('pose', false);
  applyPose(rig, state.pose);
  updateInspector();
  refreshTimeline();
  scheduleSave();
}

function stopPlaying() {
  playing = false;
  if ($('play')) {
    $('play').innerHTML = icon('play');
    $('play').setAttribute('aria-label', 'Wiedergabe');
  }
  if (rig) attachGizmo();
}

function togglePlay() {
  if (playing) {
    stopPlaying();
    return;
  }
  if (state.keys.length < 2) {
    toast('Setze mindestens zwei Keyframes auf unterschiedlichen Frames.');
    return;
  }
  setMode('pose', false);
  playing = true;
  frameClock = state.frame >= LAST_FRAME ? 0 : state.frame;
  $('play').innerHTML = icon('pause');
  $('play').setAttribute('aria-label', 'Wiedergabe anhalten');
  attachGizmo();
}

function invalidateAnimation() {
  // Keyframes beziehen sich auf die aktuelle Knochenstruktur und Ruhepose.
  // Nach deren Änderung muss die Animation neu angelegt werden.
  if (state.keys.length)
    toast('Das Skelett wurde geändert. Die bisherigen Animations-Keyframes wurden zurückgesetzt.');
  state.keys = [];
  state.pose = defaultPose(state.joints);
  state.frame = 0;
  refreshTimeline();
}

async function loadState(newState, loadedParts = null) {
  stopPlaying();
  const prepared = loadedParts || (await sourceParts(newState.source));
  clearRig();
  disposeParts(parts);
  parts = prepared;
  state = newState;
  $('project-name').value = state.name;
  rebuildRig();
  renderTree();
  setMode(state.mode, false);
  refreshTimeline();
  updateMetrics();
  refreshUndo();
}

function slugName() {
  return (
    state.name
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .trim()
      .replace(/\s+/g, '_') || 'Mein_Charakter'
  );
}

function saveProject() {
  download(JSON.stringify(snapshot()), slugName() + '.rig.json', 'application/json');
  dirty = false;
  toast('Projektdatei heruntergeladen. Bewahre sie als Sicherung auf.');
  status('Projektdatei gespeichert');
}

async function doNewProject() {
  if (
    !(await confirmAction(
      'Neues Projekt starten?',
      'Das Studio startet wieder mit dem Beispielmodell. Lade dein aktuelles Projekt vorher über „Speichern“ herunter, wenn du es behalten möchtest.',
    ))
  )
    return;
  remember();
  await loadState(freshState());
  mutation();
  focusModel();
  toast('Neues Projekt mit Studio-Bot gestartet.');
}

function setJointPosition(axis, value) {
  if (state.mode !== 'rig' || !Number.isFinite(value) || Math.abs(value) > LIMITS.coordinate)
    return;
  remember();
  const j = state.joints.find((x) => x.id === state.selected);
  j.position[axis] = value;
  invalidateAnimation();
  rebuildRig();
  updateInspector();
  mutation();
  status('Knochenposition geändert');
}

function setRotation(axis, value, record = true) {
  if (!Number.isFinite(value) || state.mode === 'rig') return;
  stopPlaying();
  if (record) remember();
  state.pose[state.selected][axis] = radians(Math.max(-180, Math.min(180, value)));
  applyPose(rig, state.pose);
  updateRotationInputs();
  mutation();
  status('Pose geändert · mit Keyframe sichern');
}

function addBone() {
  if (state.joints.length >= LIMITS.joints) {
    toast('Es sind höchstens ' + LIMITS.joints + ' Knochen pro Projekt möglich.', true);
    return;
  }
  remember();
  stopPlaying();
  const parent = state.joints.find((j) => j.id === state.selected);
  const id = 'bone_' + THREE.MathUtils.generateUUID().replaceAll('-', '').slice(0, 12);
  state.joints.push({
    id,
    name: 'Knochen ' + (state.joints.length + 1),
    parent: parent.id,
    position: [parent.position[0], parent.position[1] + 0.25, parent.position[2]],
  });
  state.selected = id;
  invalidateAnimation();
  rebuildRig();
  renderTree();
  setMode('rig', false);
  mutation();
  toast('Kindknochen hinzugefügt. Ziehe die Achsen oder ändere seine Position rechts.');
}

function deleteBone() {
  if (state.joints.length <= 1) return;
  remember();
  stopPlaying();
  const current = state.joints.find((j) => j.id === state.selected);
  state.joints.filter((j) => j.parent === current.id).forEach((j) => (j.parent = current.parent));
  state.joints = state.joints.filter((j) => j.id !== current.id);
  state.selected = current.parent || state.joints[0].id;
  invalidateAnimation();
  rebuildRig();
  renderTree();
  updateInspector();
  mutation();
  toast('Knochen gelöscht. Kindknochen wurden neu zugeordnet.');
}

function setPreset(kind) {
  remember();
  setMode('pose', false);
  state.pose = defaultPose(state.joints);
  if (kind === 'wave') {
    if (state.pose.arm_L) state.pose.arm_L[2] = radians(48);
    if (state.pose.forearm_L) state.pose.forearm_L[2] = radians(60);
    if (state.pose.hand_L) state.pose.hand_L[1] = radians(20);
    if (state.pose.head) state.pose.head[2] = radians(-8);
    if (state.pose.arm_R) state.pose.arm_R[2] = radians(57);
    if (!state.pose.arm_L)
      toast(
        'Dein Rig verwendet eigene Knochen. Das Winken-Preset benötigt die ursprünglichen Humanoid-IDs.',
      );
  }
  applyPose(rig, state.pose);
  updateInspector();
  mutation();
  status(kind === 'wave' ? 'Pose: Winken' : 'Ruhepose hergestellt');
}

async function exportGLB() {
  if (!rig || busyImport) return;
  stopPlaying();
  busy(true, 'GLB mit Skelett und Animation erstellen …');
  await nextPaint();
  try {
    const materialBackup = rig.meshes.map((m) => m.material),
      poseBackup = clone(state.pose);
    // Die Gewichtsfarben gehören nur zur Editoransicht. Exportiert werden
    // Originalmaterialien und Ruhepose; Bewegungen stehen in den Animationstracks.
    rig.meshes.forEach((m, i) => {
      m.material = parts[i].material;
      const originalColor = parts[i].geometry.getAttribute('color');
      if (originalColor) m.geometry.setAttribute('color', originalColor);
      else m.geometry.deleteAttribute('color');
    });
    const allMaterials = new Set(
      parts.flatMap((p) => (Array.isArray(p.material) ? p.material : [p.material])),
    );
    const wireBackup = new Map([...allMaterials].map((m) => [m, m.wireframe]));
    allMaterials.forEach((m) => (m.wireframe = false));
    applyPose(rig, defaultPose(state.joints));
    let result;
    try {
      const clip = animationClip(state.keys, state.joints, rig);
      result = await new GLTFExporter().parseAsync(rig.group, {
        binary: true,
        trs: true,
        animations: clip ? [clip] : [],
        onlyVisible: true,
        maxTextureSize: 2048,
      });
    } finally {
      allMaterials.forEach((m) => (m.wireframe = wireBackup.get(m)));
      rig.meshes.forEach((m, i) => (m.material = materialBackup[i]));
      applyPose(rig, state.mode === 'rig' ? defaultPose(state.joints) : poseBackup);
      updateDisplayMaterials();
    }
    download(result, slugName() + '.glb', 'model/gltf-binary');
    toast(
      'GLB exportiert: Mesh, ' +
        state.joints.length +
        ' Knochen, Gewichte' +
        (state.keys.length
          ? ' und Animation.'
          : '. Die aktuelle Pose bleibt in deiner Projektdatei; GLB enthält die Ruhepose.'),
    );
    status('GLB erfolgreich exportiert');
  } catch (error) {
    reportError(error, 'Export fehlgeschlagen');
  } finally {
    busy(false);
  }
}

async function openFile(file) {
  if (!file || busyImport) return;
  let extension;
  try {
    extension = validateImportFile(file);
  } catch (error) {
    reportError(error, 'Import fehlgeschlagen');
    return;
  }
  if (
    dirty &&
    !(await confirmAction(
      'Aktuelles Projekt ersetzen?',
      'Speichere dein Projekt über „Speichern“, wenn du es behalten möchtest. Die automatische Browsersicherung wird ersetzt.',
    ))
  )
    return;
  busyImport = true;
  busy(true, 'Modell wird geladen und gewichtet …');
  await nextPaint();
  try {
    const imported = await readImportFile(file);
    await loadState(imported.state, imported.parts);
    history.clear();
    dirty = false;
    refreshUndo();
    scheduleSave();
    focusModel();
    toast(
      extension === 'json'
        ? 'Projekt geöffnet.'
        : 'Modell importiert. Passe das Skelett im Modus „Skelett“ an dein Modell an.',
    );
    status('Modell geladen und gewichtet');
  } catch (error) {
    reportError(error, 'Import fehlgeschlagen');
  } finally {
    busyImport = false;
    busy(false);
    $('file-input').value = '';
  }
}
async function historyStep(direction) {
  if (busyImport) return;
  stopPlaying();
  const next = history[direction](snapshot());
  if (!next) return;
  try {
    await loadState(next);
    mutation();
    status(direction === 'undo' ? 'Änderung rückgängig gemacht' : 'Änderung wiederholt');
  } catch (error) {
    reportError(error, 'Verlauf konnte nicht geladen werden');
  }
}
function advanceAnimation(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  if (!playing || !rig) return;
  frameClock += delta * FPS;
  if (frameClock > LAST_FRAME) frameClock = 0;
  state.frame = Math.floor(frameClock);
  state.pose = samplePose(state.keys, frameClock, state.joints, state.pose);
  applyPose(rig, state.pose);
  refreshTimeline(false);
  updateRotationInputs();
}
export async function startEditor() {
  try {
    document
      .querySelectorAll('[data-icon]')
      .forEach((node) => (node.innerHTML = icon(node.dataset.icon)));
    viewport = createViewport($('viewport'), {
      getState: () => state,
      getParts: () => parts,
      isPlaying: () => playing,
      remember,
      stopPlaying,
      invalidateAnimation,
      rebuildRig,
      mutation,
      updateInspector,
      selectBone,
      toast,
      onFrame: advanceAnimation,
    });
    bindEditorEvents({
      getState: () => state,
      getRig: () => rig,
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
    });
    avatarPanel = createAvatarPanel({
      getState: () => state,
      getParts: () => parts,
      getRig: () => rig,
      remember,
      mutation,
      stopPlaying,
      restoreDisplay: updateDisplayMaterials,
    });
    document.addEventListener('workspacechange', stopPlaying);
    document.querySelector('.format-hint').textContent =
      'GLB, VRM 1.0 oder OBJ · maximal ' + fileSizeLabel(LIMITS.modelBytes);
    const saved = await openDatabase();
    if (saved) {
      try {
        await loadState(validateProject(saved));
        toast('Dein zuletzt bearbeitetes Projekt wurde wiederhergestellt.');
      } catch (error) {
        console.warn('Browsersicherung konnte nicht geladen werden', error);
        await loadState(freshState());
        toast(
          'Die Browsersicherung konnte nicht geladen werden. Öffne bei Bedarf deine Projektdatei.',
          true,
        );
      }
    } else await loadState(freshState());
    busy(false);
    status('Bereit · wähle einen Knochen und leg los');
    scheduleSave();
  } catch (error) {
    busy(false);
    reportError(error, 'Start fehlgeschlagen');
    status('Start fehlgeschlagen');
  }
}
