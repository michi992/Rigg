import { element, $ } from '../ui/dom.js';
import {
  HUMAN_BONES,
  EXPRESSIONS,
  createAvatar,
  morphTargets,
  avatarProblems,
  applyExpressions,
  exportVRM,
  validateAvatar,
} from './vrm.js';
import { download } from '../project-files.js';
import { toast, reportError, busy, nextPaint } from '../ui/feedback.js';

export function createAvatarPanel({
  getState,
  getParts,
  getRig,
  remember,
  mutation,
  stopPlaying,
  restoreDisplay,
}) {
  const values = {};
  const ensure = () => (getState().avatar ||= createAvatar(getState().joints, getParts()));
  const preview = () => {
    if (getRig()) applyExpressions(getRig(), ensure(), values);
  };
  const reset = () => {
    Object.keys(values).forEach((key) => (values[key] = 0));
    preview();
  };
  function render() {
    const avatar = ensure(),
      state = getState(),
      root = $('avatar-settings');
    root.replaceChildren();
    const heading = element('h2', '', 'VTuber · VRM 1.0');
    root.append(heading);
    root.append(
      element(
        'p',
        'property-hint',
        'T-Pose mit Blickrichtung +Z vorbereiten. Vorhandene Gesichtsformen zuordnen; eigene Formen entstehen im Modellierungsprogramm.',
      ),
    );
    for (const [key, label] of [
      ['name', 'Avatarname'],
      ['authors', 'Modellautor'],
    ]) {
      const wrap = element('label', 'avatar-field', label),
        input = element('input', 'text-input');
      input.id = 'avatar-' + key;
      input.value = key === 'authors' ? avatar.meta.authors.join(', ') : avatar.meta.name;
      input.maxLength = 100;
      let editing = false;
      input.onblur = () => {
        editing = false;
      };
      input.oninput = () => {
        if (!editing) {
          remember();
          editing = true;
        }
        avatar.meta[key] =
          key === 'authors'
            ? input.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : input.value.trim();
        mutation();
        refreshProblems();
      };
      wrap.append(input);
      root.append(wrap);
    }
    root.append(element('h3', '', 'Humanoid-Knochen'));
    const boneDetails = element('details', 'avatar-bones'),
      summary = element('summary', '', 'Knochenzuordnung bearbeiten');
    boneDetails.append(summary);
    for (const [name, label, , , optional] of HUMAN_BONES) {
      const row = element('label', 'avatar-field', label + (optional ? '' : ' *')),
        select = element('select', 'text-input');
      select.setAttribute('aria-label', 'VRM ' + label);
      select.add(new Option('Nicht zugeordnet', ''));
      state.joints.forEach((j) => select.add(new Option(j.name, j.id)));
      select.value = avatar.humanBones[name] || '';
      select.onchange = () => {
        remember();
        if (select.value) avatar.humanBones[name] = select.value;
        else delete avatar.humanBones[name];
        mutation();
        refreshProblems();
      };
      row.append(select);
      boneDetails.append(row);
    }
    root.append(boneDetails);
    root.append(element('h3', '', 'Gesicht & Lippen'));
    const targets = morphTargets(getParts());
    if (!targets.length)
      root.append(
        element(
          'p',
          'property-hint',
          'Keine Gesichtsformen im Modell. Importiere eine GLB mit Morph Targets, z. B. für Blinzeln und Mundöffnung.',
        ),
      );
    for (const [name, label] of EXPRESSIONS) {
      const row = element('div', 'expression-row'),
        caption = element('label', '', label),
        select = element('select', 'text-input');
      select.setAttribute('aria-label', label + ' zuordnen');
      select.add(new Option('Keine Form', ''));
      select.add(new Option('Automatische Zuordnung', 'auto'));
      targets.forEach((t) => select.add(new Option(t.label, t.mesh + ':' + t.index)));
      const binds = avatar.expressions[name] || [];
      select.value =
        binds.length === 1 ? binds[0].mesh + ':' + binds[0].index : binds.length ? 'auto' : '';
      select.onchange = () => {
        remember();
        if (select.value === 'auto')
          avatar.expressions[name] = createAvatar(state.joints, getParts()).expressions[name];
        else
          avatar.expressions[name] = select.value
            ? [
                {
                  mesh: Number(select.value.split(':')[0]),
                  index: Number(select.value.split(':')[1]),
                  weight: 1,
                },
              ]
            : [];
        mutation();
        preview();
      };
      const slider = element('input');
      slider.type = 'range';
      slider.min = 0;
      slider.max = 1;
      slider.step = 0.01;
      slider.value = values[name] || 0;
      slider.setAttribute('aria-label', label + ' Vorschau');
      slider.oninput = () => {
        stopPlaying();
        values[name] = Number(slider.value);
        preview();
      };
      caption.append(select);
      row.append(caption, slider);
      root.append(row);
    }
    const clear = element('button', 'button full', 'Gesicht zurücksetzen');
    clear.onclick = () => {
      reset();
      render();
    };
    root.append(clear);
    const issues = element('p', 'property-hint');
    issues.id = 'avatar-problems';
    root.append(issues);
    const button = element('button', 'button primary full', 'VRM exportieren');
    button.id = 'export-vrm';
    button.onclick = async () => {
      stopPlaying();
      busy(true, 'VTuber als VRM exportieren …');
      await nextPaint();
      try {
        const buffer = await exportVRM(getRig(), getParts(), state.joints, avatar);
        download(
          buffer,
          (state.name || 'Avatar').replace(/[^\p{L}\p{N}_-]/gu, '_') + '.vrm',
          'model/gltf-binary',
        );
        toast('VRM 1.0 mit Humanoid-Rig und Gesichtszuordnungen exportiert.');
      } catch (error) {
        reportError(error, 'VRM-Export fehlgeschlagen');
      } finally {
        restoreDisplay();
        preview();
        busy(false);
      }
    };
    root.append(button);
    root.append(
      element(
        'p',
        'property-hint',
        'VRM-Lizenz: vrm.dev/licenses/1.0. Neue Exporte verwenden die dortigen Standardbedingungen. Keine Haar- oder Kleidungsphysik; prüfe den Avatar in deiner Ziel-App.',
      ),
    );
    refreshProblems();
  }
  function refreshProblems() {
    const issues = avatarProblems(ensure(), getState().joints);
    $('avatar-problems').textContent = issues.length
      ? issues.join(' ')
      : 'Humanoid vollständig · bereit zum Export.';
    $('export-vrm').disabled = issues.length > 0;
  }
  $('open-avatar').onclick = () => {
    $('avatar-panel').hidden = !$('avatar-panel').hidden;
    if (!$('avatar-panel').hidden) render();
  };
  $('close-avatar').onclick = () => {
    $('avatar-panel').hidden = true;
  };
  return {
    refresh() {
      values.aa = 0;
      reset();
      if (!getState().avatar) ensure();
      else {
        const ids = new Set(getState().joints.map((j) => j.id));
        for (const [role, id] of Object.entries(getState().avatar.humanBones))
          if (!ids.has(id)) delete getState().avatar.humanBones[role];
        validateAvatar(getState().avatar, getState().joints, getParts());
      }
      if (!$('avatar-panel').hidden) render();
    },
    preview,
  };
}
