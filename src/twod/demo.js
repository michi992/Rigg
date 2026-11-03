import { create2DProject, createLayer } from './model.js';
export function demo2DProject() {
  const project = create2DProject();
  project.name = 'Mika · 2D-Demo';
  const shape = (name, w, h, x, y, role, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    draw(ctx);
    const layer = createLayer(name, canvas.toDataURL('image/png'), w, h, project);
    Object.assign(layer, { x, y, role });
    project.layers.push(layer);
  };
  const ellipse = (ctx, x, y, rx, ry, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  shape('Haare hinten', 620, 660, 190, 100, 'head', (c) => {
    ellipse(c, 310, 310, 286, 305, '#243e4b');
    c.fillStyle = '#243e4b';
    c.fillRect(24, 300, 572, 300);
    ellipse(c, 310, 575, 286, 75, '#243e4b');
  });
  shape('Jacke', 540, 490, 230, 495, 'body', (c) => {
    c.fillStyle = '#203e3c';
    c.beginPath();
    c.moveTo(140, 25);
    c.quadraticCurveTo(50, 50, 5, 270);
    c.lineTo(0, 490);
    c.lineTo(540, 490);
    c.lineTo(535, 270);
    c.quadraticCurveTo(490, 50, 400, 25);
    c.closePath();
    c.fill();
    c.fillStyle = '#9de4c8';
    c.beginPath();
    c.moveTo(170, 10);
    c.lineTo(270, 190);
    c.lineTo(370, 10);
    c.lineTo(340, 0);
    c.lineTo(270, 75);
    c.lineTo(200, 0);
    c.fill();
    c.strokeStyle = '#4e7770';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(270, 190);
    c.lineTo(270, 490);
    c.stroke();
    ellipse(c, 270, 230, 7, 7, '#b0ead4');
    ellipse(c, 270, 290, 7, 7, '#b0ead4');
  });
  shape('Hals', 120, 140, 440, 450, 'head', (c) => {
    c.fillStyle = '#efb9aa';
    c.fillRect(8, 0, 104, 100);
    ellipse(c, 60, 95, 52, 28, '#efb9aa');
  });
  shape('Gesicht', 430, 420, 285, 165, 'head', (c) => {
    ellipse(c, 215, 198, 207, 195, '#ffddc8');
    ellipse(c, 35, 238, 28, 44, '#ffddc8');
    ellipse(c, 395, 238, 28, 44, '#ffddc8');
    ellipse(c, 111, 267, 39, 15, '#edaaa3');
    ellipse(c, 319, 267, 39, 15, '#edaaa3');
    c.strokeStyle = '#d79788';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(215, 222);
    c.lineTo(205, 251);
    c.lineTo(218, 252);
    c.stroke();
  });
  for (const [role, x] of [
    ['eyeRight', 363],
    ['eyeLeft', 557],
  ])
    shape(role === 'eyeLeft' ? 'Auge links' : 'Auge rechts', 82, 54, x, 345, role, (c) => {
      ellipse(c, 41, 27, 39, 25, '#fbfff8');
      ellipse(c, 41, 28, 22, 25, '#416a79');
      ellipse(c, 41, 29, 11, 22, '#1a323e');
      ellipse(c, 47, 17, 7, 8, '#f8fffd');
      c.strokeStyle = '#203e4b';
      c.lineWidth = 7;
      c.beginPath();
      c.ellipse(41, 26, 39, 23, 0, Math.PI, Math.PI * 2);
      c.stroke();
    });
  shape('Mund', 64, 13, 468, 452, 'mouth', (c) => {
    ellipse(c, 32, 6.5, 30, 5, '#a65064');
    ellipse(c, 32, 4, 21, 2, '#f4adac');
  });
  shape('Pony', 530, 270, 235, 100, 'head', (c) => {
    c.fillStyle = '#305361';
    c.beginPath();
    c.moveTo(0, 210);
    c.bezierCurveTo(0, -45, 530, -45, 530, 210);
    c.lineTo(488, 265);
    c.lineTo(435, 118);
    c.lineTo(377, 245);
    c.lineTo(308, 140);
    c.lineTo(249, 250);
    c.lineTo(195, 123);
    c.lineTo(100, 253);
    c.lineTo(70, 130);
    c.closePath();
    c.fill();
    c.strokeStyle = '#4d7481';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(90, 117);
    c.quadraticCurveTo(190, 30, 330, 65);
    c.stroke();
  });
  shape('Haarspange', 58, 58, 680, 260, 'head', (c) => {
    c.translate(29, 29);
    c.rotate(Math.PI / 4);
    c.fillStyle = '#b1f4d2';
    c.fillRect(-18, -18, 36, 36);
    c.fillStyle = '#315b5c';
    c.fillRect(-7, -7, 14, 14);
  });
  return project;
}
