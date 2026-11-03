import { $, element } from '../ui/dom.js';
import { download } from '../project-files.js';
import { toast, reportError, confirmAction } from '../ui/feedback.js';
import { History } from '../state/history.js';
import { ProjectStorage } from '../state/storage.js';
import { LIMITS } from '../config.js';
import { PARAMETERS, ROLES, readPNG, validate2DProject, setMeshPoint } from './model.js';
import { create2DRenderer } from './renderer.js';
import { playerHTML } from './player.js';
import { demo2DProject } from './demo.js';

export async function start2DEditor() {
  let project = demo2DProject(),
    selected = project.layers[4].id,
    images = new Map(),
    renderer,
    drag = null,
    previewing = false,
    loading = false;
  const history = new History(),
    canvas = $('avatar2d-canvas');
  const values = Object.fromEntries(PARAMETERS.map(([key, , , , value]) => [key, value]));
  const neutral = () => {
    PARAMETERS.forEach(([key, , , , value]) => (values[key] = value));
  };
  const storage = new ProjectStorage(
    (text) => {
      $('save2d-state').textContent = text;
    },
    (error) => reportError(error, '2D-Sicherung fehlgeschlagen'),
    'current-2d',
  );
  const snapshot = () => structuredClone(project),
    layer = () => project.layers.find((l) => l.id === selected);
  const remember = () => history.record(snapshot());
  const saveLater = () => {
    storage.schedule(snapshot);
    $('undo2d').disabled = !history.canUndo;
    $('redo2d').disabled = !history.canRedo;
  };
  const draw = () => renderer?.draw(values, selected, $('mesh2d').checked);
  async function prepare(next) {
    validate2DProject(next);
    const loaded = new Map();
    await Promise.all(
      next.layers.map(
        (l) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              loaded.set(l.id, image);
              resolve();
            };
            image.onerror = () =>
              reject(new Error('PNG-Bild konnte nicht geladen werden: ' + l.name));
            image.src = l.src;
          }),
      ),
    );
    return loaded;
  }
  async function load(next, loaded = null) {
    const prepared = loaded || (await prepare(next));
    project = next;
    images = prepared;
    if (!layer()) selected = project.layers.at(-1)?.id || null;
    canvas.width = project.width;
    canvas.height = project.height;
    renderer = create2DRenderer(canvas, project, images);
    render();
  }
  function render() {
    $('project2d-name').value = project.name;
    const list = $('layers2d');
    list.replaceChildren();
    [...project.layers].reverse().forEach((l) => {
      const row = element('div', 'layer2d-row' + (selected === l.id ? ' selected' : '')),
        button = element('button', 'layer2d-select', l.name),
        visible = element('input');
      visible.type = 'checkbox';
      visible.checked = l.visible;
      visible.setAttribute('aria-label', l.name + ' sichtbar');
      visible.onchange = () => {
        remember();
        l.visible = visible.checked;
        saveLater();
        draw();
      };
      button.onclick = () => {
        selected = l.id;
        render();
      };
      row.append(visible, button);
      list.append(row);
    });
    $('layer2d-count').textContent = project.layers.length + ' / ' + LIMITS.layers2D;
    renderInspector();
    renderParameters();
    draw();
    $('undo2d').disabled = !history.canUndo;
    $('redo2d').disabled = !history.canRedo;
  }
  function field(parent, label, type, value, onChange, { min, max, step } = {}) {
    const wrap = element('label', 'avatar-field', label),
      input = element('input', 'text-input');
    input.type = type;
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    input.onchange = () => {
      if (
        type === 'number' &&
        (!Number.isFinite(Number(input.value)) ||
          Number(input.value) < Number(min) ||
          Number(input.value) > Number(max))
      ) {
        input.value = value;
        return;
      }
      remember();
      onChange(type === 'number' ? Number(input.value) : input.value);
      saveLater();
      render();
    };
    wrap.append(input);
    parent.append(wrap);
  }
  function renderInspector() {
    const l = layer(),
      root = $('inspector2d');
    root.replaceChildren();
    if (!l) {
      root.append(element('p', 'property-hint', 'PNG-Ebenen importieren, um zu beginnen.'));
      return;
    }
    root.append(element('h2', '', l.name));
    field(root, 'Ebenenname', 'text', l.name, (v) => (l.name = v.slice(0, 80) || 'Ebene'));
    const roleLabel = element('label', 'avatar-field', 'Funktion'),
      role = element('select', 'text-input');
    ROLES.forEach(([key, name]) => role.add(new Option(name, key)));
    role.value = l.role;
    role.onchange = () => {
      remember();
      l.role = role.value;
      saveLater();
      draw();
    };
    roleLabel.append(role);
    root.append(roleLabel);
    const group = element('div', 'vector2d');
    for (const [key, label, min, max, step] of [
      ['x', 'Position X', -10000, 10000, 1],
      ['y', 'Position Y', -10000, 10000, 1],
      ['scale', 'Maßstab', 0.01, 20, 0.01],
      ['rotation', 'Drehung', -360, 360, 1],
      ['opacity', 'Deckkraft', 0, 1, 0.05],
    ])
      field(group, label, 'number', l[key], (v) => (l[key] = v), { min, max, step });
    root.append(group);
    for (const [axis, label] of [
      [0, 'Drehpunkt X'],
      [1, 'Drehpunkt Y'],
    ])
      field(root, label, 'number', l.pivot[axis], (v) => (l.pivot[axis] = v), {
        min: 0,
        max: 1,
        step: 0.05,
      });
    const buttons = element('div', 'quick-actions');
    for (const [label, action] of [
      [
        'Nach vorne',
        () => {
          const i = project.layers.indexOf(l);
          if (i < project.layers.length - 1)
            [project.layers[i], project.layers[i + 1]] = [project.layers[i + 1], project.layers[i]];
        },
      ],
      [
        'Nach hinten',
        () => {
          const i = project.layers.indexOf(l);
          if (i > 0)
            [project.layers[i], project.layers[i - 1]] = [project.layers[i - 1], project.layers[i]];
        },
      ],
      [
        'Ebene löschen',
        () => {
          project.layers = project.layers.filter((p) => p !== l);
          selected = project.layers.at(-1)?.id || null;
        },
      ],
    ]) {
      const button = element('button', 'button', label);
      button.onclick = () => {
        remember();
        action();
        saveLater();
        render();
      };
      buttons.append(button);
    }
    root.append(buttons);
    root.append(
      element(
        'p',
        'property-hint',
        'Netz einschalten und Punkte ziehen. „Grundform“ ändert das Netz; ein Parameter am Endwert speichert eine zusätzliche Verformung. Funktion „Auge“ oder „Mund“ ergänzt die automatische Skalierung im Player.',
      ),
    );
  }
  function renderParameters() {
    const root = $('parameters2d');
    root.replaceChildren();
    for (const [key, label, min, max] of PARAMETERS) {
      const wrap = element('label', 'parameter2d', label),
        input = element('input');
      input.type = 'range';
      input.min = min;
      input.max = max;
      input.step = 0.01;
      input.value = values[key];
      input.setAttribute('aria-label', '2D ' + label);
      input.oninput = () => {
        previewing = false;
        $('preview2d').textContent = 'Vorschau starten';
        values[key] = Number(input.value);
        draw();
      };
      wrap.append(input);
      root.append(wrap);
    }
  }
  async function importLayers(files) {
    if (loading) return;
    loading = true;
    try {
      if (project.layers.length + files.length > LIMITS.layers2D)
        throw new Error('Maximal ' + LIMITS.layers2D + ' Ebenen.');
      const next = snapshot();
      for (const file of files) next.layers.push(await readPNG(file, next));
      const loaded = await prepare(next);
      remember();
      selected = next.layers.at(-1)?.id;
      await load(next, loaded);
      saveLater();
      toast(files.length + ' PNG-Ebene(n) importiert.');
    } catch (error) {
      reportError(error, '2D-Import fehlgeschlagen');
    } finally {
      loading = false;
      $('png2d-input').value = '';
    }
  }
  $('import2d').onclick = () => $('png2d-input').click();
  $('png2d-input').onchange = () => importLayers([...$('png2d-input').files]);
  $('open2d').onclick = () => $('project2d-input').click();
  $('project2d-input').onchange = async () => {
    const file = $('project2d-input').files[0];
    if (!file || loading) return;
    loading = true;
    try {
      if (file.size > LIMITS.projectBytes) throw new Error('Die Projektdatei ist zu groß.');
      const next = validate2DProject(JSON.parse(await file.text())),
        loaded = await prepare(next);
      remember();
      await load(next, loaded);
      saveLater();
      toast('2D-Projekt geöffnet.');
    } catch (error) {
      reportError(error, '2D-Projekt konnte nicht geöffnet werden');
    } finally {
      loading = false;
      $('project2d-input').value = '';
    }
  };
  const save = () => {
    download(
      JSON.stringify(project),
      (project.name || 'Avatar').replace(/[^\p{L}\p{N}_-]/gu, '_') + '.vtuber2d.json',
      'application/json',
    );
    toast('2D-Projekt gespeichert.');
  };
  $('save2d').onclick = save;
  $('export2d').onclick = () => {
    if (!project.layers.length) {
      toast('Importiere zuerst mindestens eine PNG-Ebene.', true);
      return;
    }
    download(playerHTML(project), 'VTuber_2D_Player.html', 'text/html');
    toast('OBS-Player exportiert. In OBS als lokale Browserquelle öffnen.');
  };
  $('demo2d').onclick = async () => {
    if (
      await confirmAction(
        '2D-Demo laden?',
        'Speichere dein aktuelles 2D-Projekt, wenn du es behalten möchtest.',
      )
    ) {
      remember();
      await load(demo2DProject());
      saveLater();
    }
  };
  $('project2d-name').onchange = () => {
    remember();
    project.name = $('project2d-name').value.trim().slice(0, 80) || 'Mein 2D-Avatar';
    saveLater();
  };
  const step = async (direction) => {
    if (loading) return;
    const next = history[direction](snapshot());
    if (next) {
      loading = true;
      try {
        await load(next);
        saveLater();
      } catch (error) {
        reportError(error, '2D-Verlauf fehlgeschlagen');
      } finally {
        loading = false;
      }
    }
  };
  $('undo2d').onclick = () => step('undo');
  $('redo2d').onclick = () => step('redo');
  document.addEventListener('keydown', (event) => {
    if (document.body.dataset.workspace !== '2d' || document.querySelector('dialog[open]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    } else if (
      !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
      (event.ctrlKey || event.metaKey) &&
      ['z', 'y'].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      step(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
    }
  });
  $('mesh2d').onchange = draw;
  PARAMETERS.forEach(([key, label]) => $('form2d').add(new Option(label, key)));
  const chooseForm = (value) => {
    previewing = false;
    $('preview2d').textContent = 'Vorschau starten';
    neutral();
    const key = $('form2d').value;
    if (key !== 'base') values[key] = value;
    renderParameters();
    draw();
  };
  $('form2d').onchange = () => chooseForm(1);
  $('form2d-negative').onclick = () =>
    chooseForm(
      $('form2d').value === 'angleX' ||
        $('form2d').value === 'angleY' ||
        $('form2d').value === 'angleZ'
        ? -1
        : 0,
    );
  $('form2d-positive').onclick = () => chooseForm(1);
  $('form2d-neutral').onclick = () => {
    neutral();
    renderParameters();
    draw();
  };
  $('reset2d-form').onclick = () => {
    const l = layer();
    if (!l) return;
    const key = $('form2d').value;
    if (key === 'base') {
      toast('Zum Zurücksetzen der Grundform kannst du Undo verwenden.');
      return;
    }
    remember();
    delete l.forms[key];
    saveLater();
    draw();
  };
  canvas.addEventListener('pointerdown', (event) => {
    const l = layer();
    if (!l || !$('mesh2d').checked || previewing) return;
    const parameter = $('form2d').value,
      value = values[parameter];
    const zeroAllowed = PARAMETERS.find(([key]) => key === parameter)?.[2] === 0 && value === 0;
    if (parameter !== 'base' && Math.abs(value) !== 1 && !zeroAllowed) {
      toast('Zum Speichern einer Form „Minimum“ oder „Maximum“ wählen.');
      return;
    }
    const rect = canvas.getBoundingClientRect(),
      point = [
        ((event.clientX - rect.left) / rect.width) * project.width,
        ((event.clientY - rect.top) / rect.height) * project.height,
      ],
      points = renderer.points(l, values).map((p) => renderer.world(l, p, values));
    let index = -1,
      distance = (25 * project.width) / rect.width;
    points.forEach((p, i) => {
      const d = Math.hypot(p[0] - point[0], p[1] - point[1]);
      if (d < distance) {
        index = i;
        distance = d;
      }
    });
    if (index < 0) return;
    remember();
    drag = { index, parameter, value, id: l.id };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const l = project.layers.find((l) => l.id === drag.id),
      rect = canvas.getBoundingClientRect(),
      point = [
        ((event.clientX - rect.left) / rect.width) * project.width,
        ((event.clientY - rect.top) / rect.height) * project.height,
      ];
    setMeshPoint(l, drag.index, renderer.local(l, point, values), drag.parameter, drag.value);
    draw();
  });
  const endDrag = () => {
    if (drag) {
      drag = null;
      saveLater();
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  $('workspace2d').addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  $('workspace2d').addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    $('drop-zone').classList.remove('visible');
    importLayers([...event.dataTransfer.files]);
  });
  $('preview2d').onclick = () => {
    previewing = !previewing;
    $('preview2d').textContent = previewing ? 'Vorschau anhalten' : 'Vorschau starten';
    if (!previewing) {
      neutral();
      renderParameters();
      draw();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) previewing = false;
  });
  let last = 0;
  function tick(time) {
    requestAnimationFrame(tick);
    if (!previewing || document.body.dataset.workspace !== '2d' || time - last < 33) return;
    last = time;
    const t = time / 1000;
    Object.assign(values, {
      angleX: Math.sin(t * 0.65) * 0.65,
      angleY: Math.sin(t * 0.43) * 0.35,
      angleZ: Math.sin(t * 0.7) * 0.25,
      mouthOpen: (Math.sin(t * 5) + 1) / 2,
      eyeLeft: t % 4.3 < 0.16 ? 0.08 : 1,
      eyeRight: t % 4.3 < 0.16 ? 0.08 : 1,
      breath: (Math.sin(t * 2) + 1) / 2,
    });
    draw();
  }
  requestAnimationFrame(tick);
  const saved = await storage.load();
  if (saved)
    try {
      await load(validate2DProject(saved));
    } catch (error) {
      reportError(error, '2D-Sicherung konnte nicht geladen werden');
      await load(project);
    }
  else await load(project);
  saveLater();
  return {
    stop() {
      previewing = false;
      $('preview2d').textContent = 'Vorschau starten';
      neutral();
      draw();
    },
  };
}
