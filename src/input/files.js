import { LIMITS, fileSizeLabel } from '../config.js';
import { createProject, validateProject, bufferToBase64, sourceParts } from '../project-files.js';
import { defaultPose } from '../rig-core.js';

export function validateImportFile(file) {
  if (!file || typeof file.name !== 'string' || !Number.isFinite(file.size) || file.size < 0) {
    throw new Error('Ungültige Datei.');
  }
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (!['glb', 'vrm', 'obj', 'json'].includes(extension)) {
    throw new Error('Bitte GLB, VRM 1.0, OBJ oder eine .rig.json-Projektdatei auswählen.');
  }
  const maximum = extension === 'json' ? LIMITS.projectBytes : LIMITS.modelBytes;
  if (file.size > maximum)
    throw new Error('Die Datei darf höchstens ' + fileSizeLabel(maximum) + ' groß sein.');
  if (file.size === 0) throw new Error('Die Datei ist leer.');
  return extension;
}
export async function readImportFile(file) {
  const extension = validateImportFile(file);
  let state;
  if (extension === 'json') {
    state = validateProject(JSON.parse(await file.text()));
  } else {
    state = createProject();
    state.name = file.name.replace(/\.[^.]+$/, '').slice(0, LIMITS.projectName);
    state.source = {
      kind: extension === 'vrm' ? 'glb' : extension,
      name: file.name,
      data: extension === 'obj' ? await file.text() : bufferToBase64(await file.arrayBuffer()),
    };
  }
  const parts = await sourceParts(state.source);
  if (extension !== 'json' && parts.importJoints) {
    state.joints = parts.importJoints;
    state.pose = defaultPose(state.joints);
    state.selected = state.joints[0].id;
    state.avatar = parts.importAvatar;
  }
  return { state, parts, extension };
}
