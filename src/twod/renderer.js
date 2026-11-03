// Diese Funktion wird auch im einzelnen OBS-Player eingebettet. Alle Helfer
// bleiben deshalb in ihrem Funktionsumfang und benötigen keine Imports.
export function create2DRenderer(canvas, project, images) {
  const ctx = canvas.getContext('2d');
  function points(layer, values) {
    return layer.mesh.points.map((point, i) => {
      let [x, y] = point;
      for (const [key, form] of Object.entries(layer.forms)) {
        const value = Number(values[key] || 0),
          d = form[value < 0 ? 'negative' : 'positive']?.[i];
        if (d) {
          x += d[0] * Math.abs(value);
          y += d[1] * Math.abs(value);
        }
        const zero = form.zero?.[i];
        if (zero) {
          x += zero[0] * (1 - Math.abs(value));
          y += zero[1] * (1 - Math.abs(value));
        }
      }
      return [x, y];
    });
  }
  function transform(layer, values = {}) {
    const head = ['head', 'eyeLeft', 'eyeRight', 'mouth'].includes(layer.role),
      breath = Number(values.breath || 0);
    const x = layer.x + (head ? Number(values.angleX || 0) * 22 : 0),
      y = layer.y + (head ? Number(values.angleY || 0) * 14 : 0) - breath * 3;
    let sx = layer.scale,
      sy = layer.scale;
    if (layer.role === 'eyeLeft' || layer.role === 'eyeRight')
      sy *= Math.max(0.04, Number(values[layer.role] ?? 1));
    if (layer.role === 'mouth') sy *= 1 + Number(values.mouthOpen || 0) * 4;
    if (layer.role === 'body') sy *= 1 + breath * 0.012;
    const r = (layer.rotation * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r),
      px = layer.pivot[0] * layer.width,
      py = layer.pivot[1] * layer.height;
    const matrix = [
      c * sx,
      s * sx,
      -s * sy,
      c * sy,
      x + px * layer.scale - c * sx * px + s * sy * py,
      y + py * layer.scale - s * sx * px - c * sy * py,
    ];
    if (!head) return matrix;
    const angle = (Number(values.angleZ || 0) * Math.PI) / 15;
    const ca = Math.cos(angle),
      sa = Math.sin(angle),
      ax = project.width * 0.5,
      ay = project.height * 0.38;
    const [a, b, mc, d, e, f] = matrix;
    return [
      ca * a - sa * b,
      sa * a + ca * b,
      ca * mc - sa * d,
      sa * mc + ca * d,
      ca * (e - ax) - sa * (f - ay) + ax,
      sa * (e - ax) + ca * (f - ay) + ay,
    ];
  }
  function world(layer, point, values) {
    const [a, b, c, d, e, f] = transform(layer, values),
      x = point[0] * layer.width,
      y = point[1] * layer.height;
    return [a * x + c * y + e, b * x + d * y + f];
  }
  function local(layer, point, values) {
    const [a, b, c, d, e, f] = transform(layer, values),
      det = a * d - b * c,
      x = point[0] - e,
      y = point[1] - f;
    return [(d * x - c * y) / det / layer.width, (-b * x + a * y) / det / layer.height];
  }
  function triangle(image, source, target) {
    const [p0, p1, p2] = source,
      [q0, q1, q2] = target;
    const sx1 = p1[0] - p0[0],
      sy1 = p1[1] - p0[1],
      sx2 = p2[0] - p0[0],
      sy2 = p2[1] - p0[1],
      det = sx1 * sy2 - sx2 * sy1;
    if (Math.abs(det) < 1e-9) return;
    const dx1 = q1[0] - q0[0],
      dy1 = q1[1] - q0[1],
      dx2 = q2[0] - q0[0],
      dy2 = q2[1] - q0[1];
    const a = (dx1 * sy2 - dx2 * sy1) / det,
      b = (dy1 * sy2 - dy2 * sy1) / det,
      c = (dx2 * sx1 - dx1 * sx2) / det,
      d = (dy2 * sx1 - dy1 * sx2) / det;
    ctx.save();
    ctx.beginPath();
    const center = [(q0[0] + q1[0] + q2[0]) / 3, (q0[1] + q1[1] + q2[1]) / 3];
    const clip = target.map((point) => {
      const x = point[0] - center[0],
        y = point[1] - center[1],
        length = Math.hypot(x, y) || 1;
      return [point[0] + (x / length) * 0.6, point[1] + (y / length) * 0.6];
    });
    ctx.moveTo(...clip[0]);
    ctx.lineTo(...clip[1]);
    ctx.lineTo(...clip[2]);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, q0[0] - a * p0[0] - c * p0[1], q0[1] - b * p0[0] - d * p0[1]);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
  function draw(values = {}, selected = null, showMesh = false) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(canvas.width / project.width, canvas.height / project.height);
    for (const layer of project.layers) {
      const image = images.get(layer.id);
      if (!layer.visible || !image) continue;
      ctx.globalAlpha = layer.opacity;
      const deformed = points(layer, values),
        mapped = deformed.map((p) => world(layer, p, values)),
        { cols, rows } = layer.mesh;
      const regular = deformed.every(
        (p, i) =>
          Math.abs(p[0] - (i % (cols + 1)) / cols) < 1e-8 &&
          Math.abs(p[1] - Math.floor(i / (cols + 1)) / rows) < 1e-8,
      );
      if (regular) {
        ctx.save();
        ctx.transform(...transform(layer, values));
        ctx.drawImage(image, 0, 0);
        ctx.restore();
      } else
        for (let row = 0; row < rows; row++)
          for (let col = 0; col < cols; col++) {
            const a = row * (cols + 1) + col,
              b = a + 1,
              c = a + cols + 1,
              d = c + 1;
            const source = (i) => [
              ((i % (cols + 1)) / cols) * layer.width,
              (Math.floor(i / (cols + 1)) / rows) * layer.height,
            ];
            triangle(image, [source(a), source(b), source(d)], [mapped[a], mapped[b], mapped[d]]);
            triangle(image, [source(a), source(d), source(c)], [mapped[a], mapped[d], mapped[c]]);
          }
      if (showMesh && layer.id === selected) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#9ef5d0';
        ctx.lineWidth = 1.5;
        for (let row = 0; row <= rows; row++)
          for (let col = 0; col <= cols; col++) {
            const i = row * (cols + 1) + col,
              p = mapped[i];
            if (col < cols) {
              ctx.beginPath();
              ctx.moveTo(...p);
              ctx.lineTo(...mapped[i + 1]);
              ctx.stroke();
            }
            if (row < rows) {
              ctx.beginPath();
              ctx.moveTo(...p);
              ctx.lineTo(...mapped[i + cols + 1]);
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(...p, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#e8fff3';
            ctx.fill();
          }
      }
    }
    ctx.restore();
  }
  return { draw, points, world, local };
}
