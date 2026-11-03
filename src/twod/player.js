import { create2DRenderer } from './renderer.js';
import { validate2DProject } from './model.js';

export function avatarPlayer(project, makeRenderer) {
  const canvas = document.querySelector('canvas'),
    images = new Map(),
    button = document.querySelector('#microphone'),
    hide = document.querySelector('#hide-controls');
  let analyser = null,
    context = null,
    stream = null,
    samples = null,
    pointer = [0, 0];
  canvas.width = project.width;
  canvas.height = project.height;
  const renderer = makeRenderer(canvas, project, images);
  Promise.all(
    project.layers.map(
      (layer) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            images.set(layer.id, image);
            resolve();
          };
          image.onerror = reject;
          image.src = layer.src;
        }),
    ),
  ).catch(() => {
    document.querySelector('#message').textContent = 'Ein PNG-Bild konnte nicht geladen werden.';
  });
  document.addEventListener('pointermove', (event) => {
    pointer = [(event.clientX / innerWidth - 0.5) * 2, (event.clientY / innerHeight - 0.5) * 2];
  });
  button.onclick = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      await context.close();
      stream = null;
      analyser = null;
      button.textContent = 'Mikrofon einschalten';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      context = new AudioContext();
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      samples = new Uint8Array(analyser.fftSize);
      button.textContent = 'Mikrofon ausschalten';
      document.querySelector('#message').textContent =
        'Mund reagiert auf Lautstärke. Es werden keine Audiodaten gespeichert.';
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      context?.close();
      stream = null;
      analyser = null;
      document.querySelector('#message').textContent =
        'Mikrofon nicht verfügbar. Über localhost/HTTPS öffnen und die Mikrofonfreigabe prüfen.';
    }
  };
  addEventListener('pagehide', () => {
    stream?.getTracks().forEach((track) => track.stop());
    context?.close();
  });
  hide.onclick = () => {
    document.querySelector('aside').hidden = true;
  };
  addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'h') {
      const controls = document.querySelector('aside');
      controls.hidden = !controls.hidden;
    }
  });
  function tick(time) {
    let mouth = 0;
    if (analyser) {
      analyser.getByteTimeDomainData(samples);
      mouth = Math.min(
        1,
        Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length) * 7,
      );
    }
    const t = time / 1000,
      blink = t % 4.3 < 0.16 ? 0.08 : 1;
    renderer.draw({
      angleX: pointer[0],
      angleY: pointer[1],
      angleZ: Math.sin(t * 0.7) * 0.18,
      eyeLeft: blink,
      eyeRight: blink,
      mouthOpen: mouth,
      breath: (Math.sin(t * 2) + 1) / 2,
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
export function playerHTML(project) {
  validate2DProject(project);
  const data = JSON.stringify(project)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
  return (
    '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>2D VTuber Player</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color:#effaf5;font:14px system-ui}canvas{width:100%;height:100%;object-fit:contain}aside{position:fixed;bottom:18px;left:18px;max-width:340px;background:#13251eed;padding:16px;border-radius:12px}button{background:#b2f4d3;border:0;border-radius:7px;padding:9px;margin-right:6px;cursor:pointer}p{line-height:1.5}aside[hidden]{display:none}</style><canvas aria-label="2D-VTuber"></canvas><aside><b>2D VTuber Player</b><p id="message">Automatisches Blinzeln und Atmen. Die Maus bewegt den Kopf. In OBS als Browserquelle mit transparentem Hintergrund verwenden.</p><button id="microphone">Mikrofon einschalten</button><button id="hide-controls">Bedienung ausblenden</button><p>H blendet die Bedienung wieder ein. Keine Webcam-Verfolgung.</p></aside><script>(' +
    avatarPlayer.toString() +
    ')(' +
    data +
    ',' +
    create2DRenderer.toString() +
    ');</script></html>'
  );
}
