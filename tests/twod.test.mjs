import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { JSDOM } from 'jsdom';
import {
  create2DProject,
  createLayer,
  deformedPoints,
  setMeshPoint,
  validate2DProject,
  pngDimensions,
  readPNG,
} from '../src/twod/model.js';
import { playerHTML } from '../src/twod/player.js';
import { create2DRenderer } from '../src/twod/renderer.js';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAccAAAAASUVORK5CYII=';
function fixture() {
  const project = create2DProject();
  project.layers = [createLayer('Auge', png, 1, 1, project)];
  return project;
}
test('2D-Parameterformen interpolieren und verändern die Grundform nicht', () => {
  const layer = fixture().layers[0],
    base = structuredClone(layer.mesh.points);
  setMeshPoint(layer, 0, [0.4, 0.2], 'angleX', 1);
  setMeshPoint(layer, 0, [-0.2, -0.4], 'angleX', -1);
  assert.deepEqual(layer.mesh.points, base);
  assert.deepEqual(deformedPoints(layer, { angleX: 0.5 })[0], [0.2, 0.1]);
  assert.deepEqual(deformedPoints(layer, { angleX: -0.5 })[0], [-0.1, -0.2]);
  assert.throws(() => setMeshPoint(layer, 0, [0, 0], 'angleX', 0), /Endwert/);
});
test('2D-Projekte weisen fremde URLs, übergroße PNGs und ungültige Netze ab', async () => {
  assert.equal(validate2DProject(fixture()).layers.length, 1);
  const project = fixture();
  project.layers[0].src = 'https://example.com/tracker.png';
  assert.throws(() => validate2DProject(project), /eingebettete/);
  const bad = fixture();
  bad.layers[0].mesh.points[0][0] = Infinity;
  assert.throws(() => validate2DProject(bad), /Verformungsnetz/);
  const cycle = fixture();
  cycle.layers.push(structuredClone(cycle.layers[0]));
  assert.throws(() => validate2DProject(cycle), /Ebene/);
  const bytes = Uint8Array.from(atob(png.slice(22)), (c) => c.charCodeAt(0));
  new DataView(bytes.buffer).setUint32(16, 9000);
  assert.throws(() => pngDimensions(bytes), /4096/);
  await assert.rejects(
    readPNG(
      {
        size: 9 * 1024 * 1024,
        arrayBuffer() {
          throw new Error('Must not read');
        },
      },
      create2DProject(),
    ),
    /8 MB/,
  );
});
test('OBS-Export enthält Modell und Renderer, bleibt ausführbar und schützt Script-Grenzen', () => {
  const project = fixture();
  project.name = '</script><script>alert(1)</script>';
  project.layers[0].name = '</script>';
  const html = playerHTML(project),
    dom = new JSDOM(html),
    scripts = dom.window.document.querySelectorAll('script');
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Script(scripts[0].textContent));
  assert.match(html, /getUserMedia/);
  assert.match(html, /background:transparent/);
  assert.doesNotMatch(html, /<script src=/);
  dom.window.close();
});
test('2D-Transformationen sind auch bei gedrehten und skalierten Ebenen umkehrbar', () => {
  const project = fixture(),
    layer = project.layers[0];
  layer.rotation = 27;
  layer.scale = 1.7;
  layer.role = 'head';
  const canvas = { getContext: () => ({}) },
    renderer = create2DRenderer(canvas, project, new Map()),
    values = { angleZ: 0.5, angleX: 0.8 };
  const point = [0.3, 0.7],
    result = renderer.local(layer, renderer.world(layer, point, values), values);
  assert.ok(Math.abs(result[0] - point[0]) < 1e-8);
  assert.ok(Math.abs(result[1] - point[1]) < 1e-8);
});

test('Minifizierter OBS-Player startet und gibt das Mikrofon nach Benutzung wieder frei', async () => {
  const { build } = await import('esbuild');
  const { runInNewContext } = await import('node:vm');
  const result = await build({
    stdin: {
      contents: "export {playerHTML} from './src/twod/player.js';",
      resolveDir: new URL('..', import.meta.url).pathname,
    },
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    globalName: 'PlayerTest',
    target: 'es2022',
  });
  const api = { atob, Uint8Array, DataView, Blob };
  runInNewContext(result.outputFiles[0].text, api);
  const html = api.PlayerTest.playerHTML(fixture()),
    dom = new JSDOM(html),
    frames = [],
    listeners = {};
  let requests = 0,
    stopped = 0,
    closed = 0;
  const context = new Proxy({}, { get: () => () => {} });
  dom.window.document.querySelector('canvas').getContext = () => context;
  const audioContext = class {
    createAnalyser() {
      return {
        fftSize: 256,
        getByteTimeDomainData(data) {
          data.fill(140);
        },
      };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    async close() {
      closed++;
    }
  };
  const sandbox = {
    document: dom.window.document,
    Image: class {
      set src(value) {
        this.onload();
      }
    },
    innerWidth: 1000,
    innerHeight: 1000,
    requestAnimationFrame: (callback) => frames.push(callback),
    addEventListener: (name, callback) => (listeners[name] = callback),
    navigator: {
      mediaDevices: {
        async getUserMedia() {
          requests++;
          return {
            getTracks: () => [
              {
                stop() {
                  stopped++;
                },
              },
            ],
          };
        },
      },
    },
    AudioContext: audioContext,
  };
  runInNewContext(dom.window.document.querySelector('script').textContent, sandbox);
  frames.shift()(1000);
  assert.equal(requests, 0);
  const button = dom.window.document.querySelector('#microphone');
  await button.onclick();
  assert.equal(requests, 1);
  assert.match(button.textContent, /ausschalten/);
  frames.shift()(1100);
  await button.onclick();
  assert.equal(stopped, 1);
  assert.equal(closed, 1);
  assert.match(button.textContent, /einschalten/);
  dom.window.close();
});
