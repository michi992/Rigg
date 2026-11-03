import * as THREE from 'three';

// Canvas-Ersatz für Geräte ohne WebGL 2. Kamera und Skinning stammen aus
// demselben Rig wie in der GPU-Ansicht; Texturen werden hier nicht abgebildet.
export class SoftwareRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.ctx = this.domElement.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Dieser Browser unterstützt keine Canvas-Ansicht.');
    this.shadowMap = {};
    this.ratio = 1;
    this.width = 1;
    this.height = 1;
    this.lastSignature = '';
    this.lastRender = 0;
    this.vector = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.edge = new THREE.Vector3();
    this.light = new THREE.Vector3(-0.25, 0.7, 1).normalize();
  }
  setPixelRatio(value) {
    this.ratio = Math.min(value, 1.5);
  }
  setSize(w, h) {
    this.width = w;
    this.height = h;
    this.domElement.width = Math.round(w * this.ratio);
    this.domElement.height = Math.round(h * this.ratio);
    this.lastSignature = '';
  }
  project(v, camera) {
    const p = v.clone().project(camera);
    return [(p.x * 0.5 + 0.5) * this.width, (-p.y * 0.5 + 0.5) * this.height, p.z];
  }
  render(scene, camera, rig, options = {}) {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const now = performance.now();
    if (now - this.lastRender < 75) return;
    // Ohne Änderung an Kamera, Pose oder Anzeige bleibt das letzte Bild stehen.
    const signature =
      camera.matrixWorld.elements.join(',') +
      camera.projectionMatrix.elements.join(',') +
      rig.skeleton.boneMatrices.join(',') +
      options.selected +
      options.mode +
      options.showBones +
      options.showGrid +
      options.wireframe;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.lastRender = now;
    const ctx = this.ctx,
      w = this.width,
      h = this.height;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    const gradient = ctx.createRadialGradient(
      w * 0.5,
      h * 0.38,
      10,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.85,
    );
    gradient.addColorStop(0, '#34453b');
    gradient.addColorStop(1, '#1b2823');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    if (options.showGrid) {
      ctx.lineWidth = 0.6;
      for (let n = -10; n <= 10; n++)
        for (const across of [true, false]) {
          const a = this.project(
            new THREE.Vector3(across ? n : -10, -0.025, across ? -10 : n),
            camera,
          );
          const b = this.project(
            new THREE.Vector3(across ? n : 10, -0.025, across ? 10 : n),
            camera,
          );
          if (a[2] >= 1 || b[2] >= 1 || a[2] < -1 || b[2] < -1) continue;
          ctx.strokeStyle = n === 0 ? (across ? '#546879' : '#7a5750') : '#405548';
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
    }
    const shadow = this.project(new THREE.Vector3(0, 0.001, 0), camera);
    ctx.save();
    ctx.translate(shadow[0], shadow[1]);
    ctx.scale(1, 0.22);
    const sh = ctx.createRadialGradient(0, 0, 1, 0, 0, w * 0.19);
    sh.addColorStop(0, '#08140d99');
    sh.addColorStop(1, '#08140d00');
    ctx.fillStyle = sh;
    ctx.fillRect(-w * 0.2, -w * 0.2, w * 0.4, w * 0.4);
    ctx.restore();
    const faces = [],
      color = new THREE.Color(),
      a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      normal = new THREE.Vector3(),
      edge = new THREE.Vector3();
    for (const mesh of rig.meshes) {
      const g = mesh.geometry,
        position = g.attributes.position,
        colors = g.attributes.color;
      const projected = new Float32Array(position.count * 3),
        world = new Float32Array(position.count * 3),
        v = this.vector;
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i);
        mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        world.set(v.toArray(), i * 3);
        v.project(camera);
        projected.set([(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, v.z], i * 3);
      }
      const count = g.index ? g.index.count : position.count;
      for (let i = 0; i < count; i += 3) {
        const i0 = g.index ? g.index.getX(i) : i,
          i1 = g.index ? g.index.getX(i + 1) : i + 1,
          i2 = g.index ? g.index.getX(i + 2) : i + 2;
        const x0 = projected[i0 * 3],
          y0 = projected[i0 * 3 + 1],
          x1 = projected[i1 * 3],
          y1 = projected[i1 * 3 + 1],
          x2 = projected[i2 * 3],
          y2 = projected[i2 * 3 + 1];
        const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        let material = mesh.material;
        if (Array.isArray(material)) {
          const group = g.groups.find((group) => i >= group.start && i < group.start + group.count);
          material = material[group?.materialIndex || 0] || material[0];
        }
        if (!material || (area >= 0 && material.side !== THREE.DoubleSide) || Math.abs(area) < 0.02)
          continue;
        if (
          (x0 < 0 && x1 < 0 && x2 < 0) ||
          (x0 > w && x1 > w && x2 > w) ||
          (y0 < 0 && y1 < 0 && y2 < 0) ||
          (y0 > h && y1 > h && y2 > h)
        )
          continue;
        const z = (projected[i0 * 3 + 2] + projected[i1 * 3 + 2] + projected[i2 * 3 + 2]) / 3;
        if (z > 1 || z < -1) continue;
        if (options.mode === 'weights' && colors) {
          color.setRGB(
            (colors.getX(i0) + colors.getX(i1) + colors.getX(i2)) / 3,
            (colors.getY(i0) + colors.getY(i1) + colors.getY(i2)) / 3,
            (colors.getZ(i0) + colors.getZ(i1) + colors.getZ(i2)) / 3,
          );
        } else {
          color.copy(material.color || new THREE.Color(0x99acb0));
          a.fromArray(world, i0 * 3);
          b.fromArray(world, i1 * 3);
          c.fromArray(world, i2 * 3);
          normal.copy(b).sub(a).cross(edge.copy(c).sub(a)).normalize();
          const light =
            0.38 + Math.max(0, normal.dot(this.light)) * 0.65 + Math.max(0, normal.y) * 0.13;
          color.multiplyScalar(light);
        }
        faces.push({
          x0,
          y0,
          x1,
          y1,
          x2,
          y2,
          z,
          color: color.getStyle(),
          opacity: material.opacity ?? 1,
        });
      }
    }
    // Canvas hat keinen Tiefenpuffer: entfernte Dreiecke zuerst zeichnen.
    faces.sort((a, b) => b.z - a.z);
    ctx.lineWidth = options.wireframe ? 0.45 : 0.3;
    for (const f of faces) {
      ctx.globalAlpha = f.opacity;
      ctx.beginPath();
      ctx.moveTo(f.x0, f.y0);
      ctx.lineTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.closePath();
      ctx.fillStyle = f.color;
      ctx.strokeStyle = options.wireframe ? '#c0dfbd' : f.color;
      if (!options.wireframe) ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (options.showBones) {
      for (const j of options.joints) {
        const bone = rig.boneMap.get(j.id),
          position = bone.getWorldPosition(new THREE.Vector3()),
          p = this.project(position, camera);
        if (p[2] > 1 || p[2] < -1) continue;
        const selected = j.id === options.selected;
        if (j.parent) {
          const pp = this.project(
            rig.boneMap.get(j.parent).getWorldPosition(new THREE.Vector3()),
            camera,
          );
          const dx = p[0] - pp[0],
            dy = p[1] - pp[1],
            len = Math.hypot(dx, dy) || 1;
          const midX = pp[0] + dx * 0.23,
            midY = pp[1] + dy * 0.23,
            r = selected ? 4 : 2.7;
          ctx.beginPath();
          ctx.moveTo(pp[0], pp[1]);
          ctx.lineTo(midX - (dy / len) * r, midY + (dx / len) * r);
          ctx.lineTo(p[0], p[1]);
          ctx.lineTo(midX + (dy / len) * r, midY - (dx / len) * r);
          ctx.closePath();
          ctx.fillStyle = selected ? '#ddffbad9' : '#a2f4c68c';
          ctx.fill();
          ctx.strokeStyle = selected ? '#e5ffb5' : '#b6e9c2';
          ctx.lineWidth = selected ? 1.3 : 0.7;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(p[0], p[1], selected ? 4 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = selected ? '#edffd0' : '#a1ebbd';
        ctx.fill();
        ctx.strokeStyle = '#294c36';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (selected) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#d7f6b8aa';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  }
}
