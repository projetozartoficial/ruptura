// =====================================================================
//  render.js : gráficos (canvas 2D, visão 3/4, partículas, névoa de guerra)
// =====================================================================

function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function islandPath(ctx, I, dy = 0) {
  const { x, y, w, h, r } = I;
  ctx.beginPath();
  ctx.moveTo(x + r, y + dy); ctx.lineTo(x + w - r, y + dy); ctx.arcTo(x + w, y + dy, x + w, y + r + dy, r);
  ctx.lineTo(x + w, y + h - r + dy); ctx.arcTo(x + w, y + h + dy, x + w - r, y + h + dy, r);
  ctx.lineTo(x + r, y + h + dy); ctx.arcTo(x, y + h + dy, x, y + h - r + dy, r);
  ctx.lineTo(x, y + r + dy); ctx.arcTo(x, y + dy, x + r, y + dy, r); ctx.closePath();
}
function shade(hex, amt) {
  let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(s => s + s).join('');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// ------------------------------------------------------------------
//  Desenho dos caçadores (também usado nos retratos do menu)
// ------------------------------------------------------------------
function drawHunter(ctx, hid, x, y, aim, t, moving, o = {}) {
  const H = HUNTERS[hid], C = H.cores;
  const S = (o.scale || 1) * (HUNTERS[hid].big || 1);
  const z = o.z || 0;
  const face = Math.cos(aim) >= 0 ? 1 : -1;
  const walk = moving ? Math.sin(t * 13) : 0;
  const bob = moving ? Math.abs(Math.sin(t * 13)) * 2.2 : Math.sin(t * 2.4) * 0.8;
  ctx.save();
  ctx.translate(x, y);
  // sombra
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(0, 3, 20 * S * (1 - z / 400), 8 * S * (1 - z / 400), 0, 0, Math.PI * 2); ctx.fill();
  }
  if (o.ring) {
    ctx.strokeStyle = o.ring; ctx.globalAlpha = 0.3; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(0, 3, 25 * S, 10 * S, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.stroke();
    // seta de mira
    if (o.arrow) {
      ctx.save(); ctx.scale(1, 0.42); ctx.rotate(aim);
      ctx.fillStyle = o.ring; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(34 * S, 0); ctx.lineTo(26 * S, -6); ctx.lineTo(26 * S, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.translate(0, -z - bob);
  ctx.scale(S, S);
  const aimUp = Math.sin(aim) < -0.25;
  const local = face === 1 ? aim : Math.PI - aim; // ângulo da arma no espaço espelhado
  const hy = -47;

  ctx.save(); ctx.scale(face, 1);
  if (aimUp) drawWeapon(ctx, hid, C, local, t);
  if (o.fast) { const sp = bodySprite(hid, moving ? (Math.floor(t * 13 / (Math.PI * 2) * 8) % 8 + 8) % 8 : 8); ctx.drawImage(sp, -SPR_OX, -SPR_OY, SPR_W, SPR_H); }
  else drawBody(ctx, hid, C, walk, t);
  if (!aimUp) drawWeapon(ctx, hid, C, local, t);
  ctx.restore();

  // auréola da Lumi (fora do espelhamento)
  if (hid === 'lumi') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.ellipse(1 * face, hy - 16 + Math.sin(t * 2) * 1.5, 9, 3, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,214,90,0.35)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  // orbe flutuante da Maré
  if (hid === 'mare') {
    const oa = t * 2.2;
    const ox = Math.cos(oa) * 18, oy = -30 + Math.sin(oa) * 6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 9);
    gg.addColorStop(0, 'rgba(220,255,255,0.95)'); gg.addColorStop(0.5, 'rgba(60,220,240,0.6)'); gg.addColorStop(1, 'rgba(20,120,180,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// corpo do caçador (sem a arma), no espaço já espelhado
function drawBody(ctx, hid, C, walk, t) {
  // --- costas / capa ---
  if (hid === 'corvo') {
    ctx.fillStyle = C.roupa2;
    ctx.beginPath(); ctx.moveTo(-6, -38); ctx.quadraticCurveTo(-22, -20, -20 - walk * 2, 0); ctx.lineTo(-14, -4); ctx.lineTo(-10, 2); ctx.lineTo(-4, -4); ctx.lineTo(4, -30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.detalhe; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 - i * 3, -30 + i * 4); ctx.lineTo(-16 - i * 2, -6 + i * 3); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (hid === 'brasa') {
    ctx.fillStyle = C.roupa2;
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(-15 - walk * 2, -4); ctx.lineTo(-4, -8); ctx.closePath(); ctx.fill();
  }
  if (hid === 'rocha') {
    ctx.fillStyle = '#6b7380';
    ctx.beginPath(); ctx.moveTo(-16, -40); ctx.lineTo(-24, -30); ctx.lineTo(-22, -14); ctx.lineTo(-10, -12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.globalAlpha = 0.7; ctx.fillRect(-21, -28, 4, 4); ctx.globalAlpha = 1;
  }
  if (hid === 'mare') {
    ctx.fillStyle = C.roupa2;
    ctx.beginPath(); ctx.moveTo(-9, -32); ctx.quadraticCurveTo(-18, -14, -14 - walk * 3, 2); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
  }

  // arma atrás do corpo quando mira para cima

  if (hid === 'lamina') { // rabo de cavalo e faixa
    ctx.fillStyle = C.cabelo; ctx.beginPath(); ctx.moveTo(-6, -52); ctx.quadraticCurveTo(-20 - walk * 3, -44, -18 - walk * 4, -28); ctx.lineTo(-12, -32); ctx.quadraticCurveTo(-12, -44, -4, -50); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-16 - walk * 3, -12); ctx.lineTo(-12 - walk * 3, -9); ctx.lineTo(-3, -20); ctx.fill();
  }
  if (hid === 'trovao') { // capa curta em zigue-zague
    ctx.fillStyle = C.roupa2; ctx.beginPath(); ctx.moveTo(-8, -36); ctx.lineTo(-16 - walk * 2, -10); ctx.lineTo(-11, -14); ctx.lineTo(-9, -6); ctx.lineTo(-3, -14); ctx.closePath(); ctx.fill();
  }
  if (hid === 'vinha') { // capa de folhas
    ctx.fillStyle = '#2f6a2a';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-10 - i * 1.5 - walk * 1.5, -32 + i * 7, 7, 4, 0.8, 0, Math.PI * 2); ctx.fill(); }
  }
  if (hid === 'sino') { // sino nas costas
    ctx.fillStyle = '#a8842c'; ctx.beginPath(); ctx.moveTo(-18, -22); ctx.quadraticCurveTo(-18, -40, -10, -40); ctx.quadraticCurveTo(-4, -40, -4, -22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd65a'; ctx.fillRect(-19, -24, 16, 3);
  }
  if (hid === 'ancora') { // correntes enroladas
    ctx.strokeStyle = '#7d8892'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-15, -34 + i * 7, 7, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
  }

  // --- pernas ---
  ctx.fillStyle = hid === 'lumi' ? '#d9cfa8' : shade(C.roupa2, -0.2);
  const big = !!HUNTERS[hid].big;
  const lw = big ? 7 : 5.5;
  ctx.beginPath(); ctx.roundRect(-7 + walk * 3, -14, lw, 14, 2); ctx.fill();
  ctx.beginPath(); ctx.roundRect(2 - walk * 3, -14, lw, 14, 2); ctx.fill();
  ctx.fillStyle = '#1d1a1f';
  ctx.fillRect(-8 + walk * 3, -3, lw + 2, 3.5); ctx.fillRect(1 - walk * 3, -3, lw + 2, 3.5);

  // --- tronco ---
  const tw = big ? 26 : 19, th = 24;
  const g = ctx.createLinearGradient(-tw / 2, -40, tw / 2, -12);
  g.addColorStop(0, shade(C.roupa, 0.18)); g.addColorStop(1, shade(C.roupa, -0.28));
  ctx.fillStyle = g;
  ctx.beginPath();
  if (hid === 'mare' || hid === 'lumi' || hid === 'vinha' || hid === 'sino') { // túnica
    ctx.moveTo(-tw / 2 + 2, -38); ctx.lineTo(tw / 2 - 2, -38); ctx.lineTo(tw / 2 + 3, -8); ctx.lineTo(-tw / 2 - 3, -8); ctx.closePath();
  } else ctx.roundRect(-tw / 2, -38, tw, th, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  // detalhes do tronco
  ctx.fillStyle = C.detalhe;
  if (hid === 'brasa') { ctx.fillRect(-tw / 2, -20, tw, 3); ctx.fillStyle = '#ffcf6a'; ctx.fillRect(-2, -21, 4, 5); }
  if (hid === 'corvo') { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(-6, -36); ctx.lineTo(0, -26); ctx.lineTo(6, -36); ctx.lineWidth = 1.5; ctx.strokeStyle = C.detalhe; ctx.stroke(); ctx.globalAlpha = 1; }
  if (hid === 'mare') { ctx.globalAlpha = 0.85; ctx.fillRect(-tw / 2 - 1, -24, tw + 2, 2.5); ctx.beginPath(); ctx.arc(0, -30, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  if (hid === 'lumi') { ctx.fillRect(-1.5, -38, 3, 30); ctx.fillRect(-tw / 2 - 2, -22, tw + 4, 2.5); }
  if (hid === 'lamina') { ctx.fillStyle = C.detalhe; ctx.fillRect(-tw / 2, -22, tw, 3); ctx.strokeStyle = shade(C.roupa, 0.35); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -38); ctx.lineTo(4, -24); ctx.stroke(); }
  if (hid === 'trovao') { ctx.strokeStyle = C.detalhe; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-3, -37); ctx.lineTo(3, -30); ctx.lineTo(-2, -27); ctx.lineTo(4, -19); ctx.stroke(); ctx.fillStyle = '#ffe14a'; ctx.fillRect(-tw / 2, -17, tw, 2); }
  if (hid === 'vinha') { ctx.fillStyle = C.detalhe; for (const [x, y] of [[-4, -34], [5, -28], [-2, -18]]) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = '#8fd46a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-7, -38); ctx.quadraticCurveTo(4, -30, -5, -12); ctx.stroke(); }
  if (hid === 'sino') { ctx.fillStyle = C.roupa2; ctx.beginPath(); ctx.moveTo(-tw / 2, -38); ctx.lineTo(-tw / 2 + 6, -38); ctx.lineTo(tw / 2 + 2, -10); ctx.lineTo(tw / 2 - 4, -10); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.detalhe; ctx.fillRect(-tw / 2 - 2, -22, tw + 4, 2.5); }
  if (hid === 'ancora') {
    ctx.fillStyle = '#5d6d72'; ctx.beginPath(); ctx.ellipse(-12, -36, 8, 6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(12, -36, 8, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, -28, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a3438'; ctx.lineWidth = 1; for (const y of [-32, -24, -18]) { ctx.beginPath(); ctx.moveTo(-tw / 2, y); ctx.lineTo(tw / 2, y); ctx.stroke(); }
  }
  if (hid === 'rocha') {
    ctx.fillStyle = '#7d8592';
    ctx.beginPath(); ctx.ellipse(-12, -36, 9, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, -36, 9, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.detalhe; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(-6, -32); ctx.lineTo(-2, -26); ctx.lineTo(-5, -20); ctx.moveTo(5, -30); ctx.lineTo(2, -22); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // --- cabeça ---
  const hy = big ? -48 : -47, hr = big ? 10 : 9;
  ctx.fillStyle = C.pele;
  ctx.beginPath(); ctx.arc(1, hy, hr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  // cabelo / capacete
  ctx.fillStyle = C.cabelo;
  if (hid === 'brasa') {
    ctx.beginPath(); ctx.moveTo(-9, hy - 1); ctx.lineTo(-11, hy - 13); ctx.lineTo(-5, hy - 9); ctx.lineTo(-3, hy - 17); ctx.lineTo(1, hy - 10); ctx.lineTo(5, hy - 16); ctx.lineTo(7, hy - 8); ctx.lineTo(11, hy - 9); ctx.lineTo(9, hy - 2); ctx.quadraticCurveTo(0, hy - 7, -9, hy - 1); ctx.fill();
    ctx.fillStyle = '#ffd36b'; ctx.globalAlpha = 0.55 + Math.sin(t * 9) * 0.2;
    ctx.beginPath(); ctx.moveTo(-3, hy - 11); ctx.lineTo(-2, hy - 17 - Math.sin(t * 11) * 2); ctx.lineTo(1, hy - 10); ctx.fill(); ctx.globalAlpha = 1;
  } else if (hid === 'corvo') {
    ctx.fillStyle = C.roupa;
    ctx.beginPath(); ctx.arc(0, hy - 1, hr + 3, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(hr + 2, hy + 6); ctx.lineTo(-hr - 4, hy + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0c0812'; ctx.beginPath(); ctx.ellipse(3, hy + 1, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.shadowColor = C.detalhe; ctx.shadowBlur = 6;
    ctx.fillRect(4, hy, 3, 1.6); ctx.fillRect(0, hy, 2.4, 1.6); ctx.shadowBlur = 0;
  } else if (hid === 'mare') {
    ctx.beginPath(); ctx.moveTo(-10, hy); ctx.quadraticCurveTo(-2, hy - 16, 10, hy - 4); ctx.lineTo(9, hy - 1); ctx.quadraticCurveTo(-1, hy - 8, -4, hy); ctx.quadraticCurveTo(-14, hy + 10 + Math.sin(t * 3) * 2, -15, hy + 16); ctx.quadraticCurveTo(-13, hy + 4, -10, hy); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.beginPath(); ctx.arc(-3, hy - 9, 2, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'lumi') {
    ctx.beginPath(); ctx.arc(1, hy - 3, hr, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(-8, hy - 3, 4, 7);
  } else if (hid === 'lamina') {
    ctx.beginPath(); ctx.moveTo(-9, hy + 1); ctx.quadraticCurveTo(-8, hy - 14, 4, hy - 11); ctx.lineTo(11, hy - 6); ctx.lineTo(6, hy - 6); ctx.lineTo(9, hy - 1); ctx.quadraticCurveTo(2, hy - 6, -4, hy - 3); ctx.lineTo(-9, hy + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.fillRect(-9, hy - 6, 18, 2);
  } else if (hid === 'trovao') {
    ctx.beginPath(); ctx.moveTo(-10, hy); ctx.lineTo(-13, hy - 9); ctx.lineTo(-6, hy - 8); ctx.lineTo(-7, hy - 17); ctx.lineTo(0, hy - 10); ctx.lineTo(3, hy - 18); ctx.lineTo(6, hy - 9); ctx.lineTo(13, hy - 12); ctx.lineTo(10, hy - 2); ctx.quadraticCurveTo(0, hy - 7, -10, hy); ctx.fill();
  } else if (hid === 'vinha') {
    ctx.beginPath(); ctx.arc(1, hy - 2, hr + 1, Math.PI * 0.9, Math.PI * 2.1); ctx.quadraticCurveTo(12, hy + 10, 9, hy + 14); ctx.lineTo(-11, hy + 14); ctx.quadraticCurveTo(-13, hy + 6, -9, hy - 1); ctx.fill();
    ctx.fillStyle = '#5fae4a'; for (const [x, y, a] of [[-6, hy - 9, -0.6], [4, hy - 11, 0.3], [9, hy - 5, 1]]) { ctx.beginPath(); ctx.ellipse(x, y, 4, 2, a, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = C.detalhe; ctx.beginPath(); ctx.arc(-7, hy - 6, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(-7, hy - 6, 1.2, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'sino') {
    ctx.fillStyle = 'rgba(60,40,30,0.25)'; ctx.beginPath(); ctx.arc(1, hy - 2, hr, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.fillRect(-8, hy - 4, 18, 2.4);
    ctx.fillStyle = '#8a5a2a'; for (const x of [-4, 1, 6]) { ctx.beginPath(); ctx.arc(x, hy - 7, 0.9, 0, Math.PI * 2); ctx.fill(); }
  } else if (hid === 'ancora') {
    const hg = ctx.createRadialGradient(-2, hy - 4, 2, 1, hy, hr + 4); hg.addColorStop(0, '#a9b6bc'); hg.addColorStop(1, '#4a5a5f');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(1, hy, hr + 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a3438'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#0f2a2c'; ctx.beginPath(); ctx.arc(5, hy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(5, hy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#c9d4da'; for (const a of [0, 1.57, 3.14, 4.71]) { ctx.beginPath(); ctx.arc(5 + Math.cos(a) * 6.5, hy + Math.sin(a) * 6.5, 1.1, 0, Math.PI * 2); ctx.fill(); }
  } else if (hid === 'rocha') {
    ctx.fillStyle = '#5c6470';
    ctx.beginPath(); ctx.arc(1, hy - 2, hr + 1, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(hr + 2, hy + 1); ctx.lineTo(-hr, hy + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.detalhe; ctx.shadowColor = C.detalhe; ctx.shadowBlur = 8; ctx.fillRect(2, hy - 1, 8, 2); ctx.shadowBlur = 0;
  }
  if (hid !== 'corvo' && hid !== 'rocha' && hid !== 'ancora') { // olhos
    ctx.fillStyle = hid === 'mare' ? '#0b3d4a' : '#1d1520';
    ctx.fillRect(4, hy - 1, 2, 2.6); ctx.fillRect(7.5, hy - 1, 2, 2.6);
  }
}

// sprites pré-renderizados do corpo (8 quadros de caminhada + 1 parado)
const SPR_W = 90, SPR_H = 110, SPR_OX = 45, SPR_OY = 96, SPR_RES = 2.5;
const _bodyCache = new Map();
function bodySprite(hid, f) {
  const k = hid + f; let c = _bodyCache.get(k); if (c) return c;
  c = document.createElement('canvas'); c.width = SPR_W * SPR_RES; c.height = SPR_H * SPR_RES;
  const g = c.getContext('2d'); g.scale(SPR_RES, SPR_RES); g.translate(SPR_OX, SPR_OY);
  drawBody(g, hid, HUNTERS[hid].cores, f === 8 ? 0 : Math.sin(f / 8 * Math.PI * 2), f * 0.37);
  _bodyCache.set(k, c); return c;
}

function drawWeapon(ctx, hid, C, a, t) {
  ctx.save();
  const sx = 2, sy = -28;
  ctx.translate(sx, sy); ctx.rotate(a);
  // braço
  ctx.strokeStyle = C.pele; ctx.lineWidth = HUNTERS[hid].big ? 6 : 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke();
  if (hid === 'brasa') {
    for (const off of [0, -5]) {
      ctx.fillStyle = C.arma; ctx.fillRect(9, -3 + off, 15, 5); ctx.fillRect(9, -1 + off, 4, 8);
      ctx.fillStyle = 'rgba(255,122,26,0.4)'; ctx.fillRect(19, -4.5 + off, 8, 8); ctx.fillStyle = '#ff9a2e'; ctx.fillRect(21, -2.5 + off, 4, 4);
    }
  } else if (hid === 'corvo') {
    ctx.fillStyle = '#3a2352'; ctx.fillRect(9, -2, 5, 4);
    const g = ctx.createLinearGradient(14, 0, 30, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9aa0b8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(14, -3); ctx.lineTo(31, 0); ctx.lineTo(14, 3); ctx.closePath(); ctx.fill();
  } else if (hid === 'mare') {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(15, 0, 0, 15, 0, 8); g.addColorStop(0, 'rgba(200,255,255,0.9)'); g.addColorStop(1, 'rgba(40,200,230,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(15, 0, 8, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'lumi') {
    ctx.strokeStyle = '#b99a4a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(30, -2); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,214,90,0.35)'; ctx.beginPath(); ctx.arc(30, -2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(30, -9); ctx.lineTo(35, -2); ctx.lineTo(30, 4); ctx.lineTo(25, -2); ctx.closePath(); ctx.fill();
  } else if (hid === 'lamina') {
    ctx.fillStyle = '#1b2f45'; ctx.fillRect(8, -2, 8, 4); ctx.fillStyle = '#9fe3ff'; ctx.fillRect(15, -4, 2, 8);
    const g = ctx.createLinearGradient(17, -2, 44, 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a9b8cc');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(17, -2); ctx.lineTo(42, -3); ctx.lineTo(46, 0); ctx.lineTo(17, 1.5); ctx.closePath(); ctx.fill();
  } else if (hid === 'trovao') {
    ctx.fillStyle = '#2b2e5a'; ctx.beginPath(); ctx.roundRect(8, -5, 10, 10, 3); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,225,74,0.45)'; ctx.beginPath(); ctx.arc(19, 0, 7 + Math.sin(t * 30) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(19, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'vinha') {
    ctx.strokeStyle = '#7a5a2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(32, -4); ctx.stroke();
    ctx.strokeStyle = '#6fbf4a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(6, 5); ctx.quadraticCurveTo(14, -4, 20, 2); ctx.quadraticCurveTo(26, 6, 31, -3); ctx.stroke();
    ctx.fillStyle = '#ff7fb6'; ctx.beginPath(); ctx.arc(33, -5, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(33, -5, 1.6, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'sino') {
    ctx.strokeStyle = '#7a3a10'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(18, 0); ctx.stroke();
    const g = ctx.createLinearGradient(16, -8, 28, 8); g.addColorStop(0, '#ffe9a0'); g.addColorStop(1, '#a8842c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(17, -7); ctx.quadraticCurveTo(28, -7, 29, 7); ctx.lineTo(16, 7); ctx.quadraticCurveTo(16, -2, 17, -7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a3a10'; ctx.beginPath(); ctx.arc(22, 8, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'ancora') {
    ctx.strokeStyle = '#6a7680'; ctx.lineWidth = 2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(22, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#8a96a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(40, 0); ctx.moveTo(26, -7); ctx.lineTo(26, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(36, 0, 9, -1.9, 1.9); ctx.stroke();
    ctx.fillStyle = '#3fd4c0'; ctx.beginPath(); ctx.arc(22, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (hid === 'rocha') {
    ctx.strokeStyle = '#5a3e2b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(32, 0); ctx.stroke();
    const g = ctx.createLinearGradient(28, -12, 42, 12); g.addColorStop(0, '#a5adb9'); g.addColorStop(1, '#4b525d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(27, -12, 16, 24, 3); ctx.fill();
    ctx.strokeStyle = C.detalhe; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(30, -8); ctx.lineTo(35, 0); ctx.lineTo(31, 7); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------
//  Visão (polígonos de visibilidade + quem pode ser visto)
// ------------------------------------------------------------------
function visionPoly(solids, p, night) {
  const pts = [];
  const N = night ? 150 : 170;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let R = 1150;
    if (night) { R = Math.abs(angDiff(p.aim, a)) < 1.0 ? 1050 : 300; }
    const dx = Math.cos(a), dy = Math.sin(a);
    const d = castRay(solids, p.x, p.y, dx, dy, R);
    pts.push(p.x + dx * Math.min(R, d + 10), p.y + dy * Math.min(R, d + 10));
  }
  let cone = null;
  if (night) { // cone com mais detalhe
    cone = [p.x, p.y];
    for (let i = 0; i <= 50; i++) {
      const a = p.aim - 1.0 + (i / 50) * 2.0, dx = Math.cos(a), dy = Math.sin(a);
      const d = castRay(solids, p.x, p.y, dx, dy, 1050);
      cone.push(p.x + dx * Math.min(1050, d + 10), p.y + dy * Math.min(1050, d + 10));
    }
  }
  return { pts, cone };
}
function seesTarget(players, solids, night, team, t) {
  if (t.team === team) return true;
  for (const a of players) {
    if (!a.alive || a.team !== team) continue;
    const d = dist(a.x, a.y, t.x, t.y);
    if (d < 120) return true;
    if (night) { if (d > 1050) continue; if (d > 300 && Math.abs(angDiff(a.aim, Math.atan2(t.y - a.y, t.x - a.x))) > 1.0) continue; }
    else if (d > 1150) continue;
    if (castRay(solids, a.x, a.y, (t.x - a.x) / d, (t.y - a.y) / d, d) >= d - 1) return true;
  }
  return false;
}

// sprites de brilho (substituem gradientes e sombras desenhados a cada quadro)
const _glow = new Map();
function glowSprite(color) {
  let c = _glow.get(color); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, color); gr.addColorStop(0.5, color + '66'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glow.set(color, c); return c;
}
const QUALITY = {
  alta:  { dpr: 1.5, fog: 0.5, parts: 1, sky: true, xray: true, name: 'Alta' },
  media: { dpr: 1, fog: 0.4, parts: 0.6, sky: true, xray: true, name: 'Média' },
  baixa: { dpr: 0.7, fog: 0.3, parts: 0.3, sky: false, xray: false, name: 'Baixa' },
};

// ------------------------------------------------------------------
class Renderer {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: WORLD_W / 2, y: WORLD_H / 2, z: 1 };
    this.shake = 0;
    this.parts = [];
    this.anim = new Map();
    this.time = 0;
    this.Q = QUALITY.alta;
    this.fog = document.createElement('canvas');
    this.fctx = this.fog.getContext('2d');
    this.buildGround();
    this.buildObstacles();
    this.buildStars();
  }

  // ---------- chão pré-renderizado ----------
  buildGround() {
    const g = document.createElement('canvas'); g.width = WORLD_W; g.height = WORLD_H + 160;
    const c = g.getContext('2d'), R = mulberry(1337);
    // penhasco (camadas)
    for (let i = 14; i >= 1; i--) {
      islandPath(c, ISLAND, i * 8);
      c.fillStyle = i > 10 ? '#1c1720' : i > 5 ? '#2c2430' : '#3d3238'; c.fill();
    }
    // estalactites de pedra sob a ilha
    c.fillStyle = '#16121a';
    for (let x = ISLAND.x + 120; x < ISLAND.x + ISLAND.w - 120; x += 26 + R() * 40) {
      const y0 = ISLAND.y + ISLAND.h + 100, l = 20 + R() * 55;
      c.beginPath(); c.moveTo(x - 14, y0 - 4); c.lineTo(x + R() * 8 - 4, y0 + l); c.lineTo(x + 14, y0 - 4); c.fill();
    }
    // estratos no penhasco
    c.save(); islandPath(c, ISLAND, 110); c.clip();
    c.strokeStyle = 'rgba(255,200,170,0.05)'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { islandPath(c, ISLAND, 20 + i * 15); c.stroke(); }
    c.restore();
    // topo de grama
    c.save(); islandPath(c, ISLAND); c.clip();
    const gg = c.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 100, WORLD_W / 2, WORLD_H / 2, 1400);
    gg.addColorStop(0, '#4b7a49'); gg.addColorStop(1, '#2d5236');
    c.fillStyle = gg; c.fillRect(0, 0, WORLD_W, WORLD_H);
    for (let i = 0; i < 900; i++) { // manchas
      const x = R() * WORLD_W, y = R() * WORLD_H, r = 20 + R() * 90;
      c.fillStyle = R() < 0.5 ? 'rgba(20,45,25,0.10)' : 'rgba(120,160,90,0.07)';
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 26000; i++) { // folhas de grama
      const x = R() * WORLD_W, y = R() * WORLD_H, l = 3 + R() * 6;
      c.strokeStyle = `hsla(${95 + R() * 40},${35 + R() * 25}%,${22 + R() * 25}%,0.8)`; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + R() * 3 - 1.5, y - l); c.stroke();
    }
    // caminhos de terra das bases ao centro
    const path = (pts, w) => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(92,72,52,0.85)'; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
      c.strokeStyle = 'rgba(130,104,74,0.6)'; c.lineWidth = w * 0.6; c.stroke();
    };
    for (const m of [1, -1]) {
      const X = x => m === 1 ? x : WORLD_W - x;
      path([X(220), 800, X(500), 800, X(660), 800, X(900), 800, X(1100), 800], 70);
      path([X(500), 800, X(700), 520, X(1000), 450, X(1200), 450], 46);
      path([X(500), 800, X(700), 1080, X(1000), 1150, X(1200), 1150], 46);
    }
    // seixos nos caminhos
    for (let i = 0; i < 1600; i++) {
      const x = R() * WORLD_W, y = 700 + R() * 200;
      c.fillStyle = `rgba(${150 + R() * 50},${130 + R() * 40},${100 + R() * 30},0.5)`;
      c.beginPath(); c.ellipse(x, y, 1.5 + R() * 3, 1 + R() * 2, R() * 3, 0, Math.PI * 2); c.fill();
    }
    // praça central de pedra
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    for (let ring = 0; ring < 6; ring++) {
      const r0 = 90 + ring * 40, n = 10 + ring * 6;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2 + ring * 0.2, a1 = ((k + 1) / n) * Math.PI * 2 + ring * 0.2 - 0.025;
        c.beginPath(); c.arc(cx, cy, r0 + 38, a0, a1); c.arc(cx, cy, r0 + 2, a1, a0, true); c.closePath();
        const l = 52 + R() * 14; c.fillStyle = `hsl(35,${10 + R() * 8}%,${l}%)`; c.fill();
        c.strokeStyle = 'rgba(40,30,25,0.5)'; c.lineWidth = 1.5; c.stroke();
      }
    }
    c.strokeStyle = 'rgba(127,245,255,0.35)'; c.lineWidth = 3;
    for (const r of [96, 330]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
    // runas da praça
    c.fillStyle = 'rgba(127,245,255,0.45)'; c.font = 'bold 22px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const runes = 'ᚱᚢᛈᛏᚢᚱᚨᚡᛖᛋᛈᛖᚱ';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.save(); c.translate(cx + Math.cos(a) * 345, cy + Math.sin(a) * 345); c.rotate(a + Math.PI / 2); c.fillText(runes[i], 0, 0); c.restore(); }
    // plataformas de spawn
    for (let tm = 0; tm < 2; tm++) {
      const x = tm ? WORLD_W - 235 : 235, y = 800;
      const pg = c.createRadialGradient(x, y, 10, x, y, 190);
      pg.addColorStop(0, '#7d7a76'); pg.addColorStop(1, '#4c4a48');
      c.fillStyle = pg; c.beginPath(); c.ellipse(x, y, 130, 210, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 4; c.stroke();
      c.strokeStyle = TEAMS[tm].main; c.globalAlpha = 0.6; c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, y, 112, 190, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.35; c.fillStyle = TEAMS[tm].main; c.font = 'bold 34px serif';
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.fillText(runes[i], x + Math.cos(a) * 80, y + Math.sin(a) * 150); }
      c.globalAlpha = 1;
    }
    // flores
    for (let i = 0; i < 1400; i++) {
      const x = R() * WORLD_W, y = R() * WORLD_H;
      if (dist(x, y, cx, cy) < 400 || Math.abs(y - 800) < 60) continue;
      c.fillStyle = ['#ffe7a3', '#ff9fc4', '#b9a6ff', '#ffffff', '#8ff0ff'][(R() * 5) | 0];
      c.globalAlpha = 0.75; c.beginPath(); c.arc(x, y, 1.6 + R() * 1.4, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    // rachaduras
    c.strokeStyle = 'rgba(15,25,15,0.35)'; c.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      let x = R() * WORLD_W, y = R() * WORLD_H; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += R() * 40 - 20; y += R() * 40 - 20; c.lineTo(x, y); } c.stroke();
    }
    // sombras estáticas dos obstáculos
    c.fillStyle = 'rgba(0,0,0,0.30)';
    for (const o of MAP_OBS) {
      if (o.t === 'rect') { c.beginPath(); c.moveTo(o.x, o.y + o.h); c.lineTo(o.x + o.w, o.y + o.h); c.lineTo(o.x + o.w + o.hh * 0.5, o.y + o.h + o.hh * 0.35); c.lineTo(o.x + o.hh * 0.5, o.y + o.h + o.hh * 0.35); c.fill(); }
      else { c.beginPath(); c.ellipse(o.x + o.hh * 0.18, o.y + o.r * 0.35 + o.hh * 0.1, o.r * 1.15, o.r * 0.6, 0.2, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
    // borda da ilha (luz)
    islandPath(c, ISLAND); c.strokeStyle = 'rgba(190,240,170,0.35)'; c.lineWidth = 4; c.stroke();
    c.save(); islandPath(c, ISLAND); c.clip();
    islandPath(c, ISLAND); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 30; c.stroke();
    c.restore();
    this.ground = g;
  }

  // ---------- sprites dos obstáculos ----------
  buildObstacles() {
    this.obsSprites = new Map();
    for (const o of MAP_OBS) {
      const R = mulberry(o.seed + 7);
      const pad = 40;
      const cv = document.createElement('canvas');
      if (o.t === 'rect') { cv.width = o.w + pad * 2; cv.height = o.h + o.hh + pad * 2; }
      else { const ex = o.k === 'tree' ? 2.0 : 1.4; cv.width = o.r * 2 * ex + pad * 2; cv.height = o.r * 2 * ex + o.hh + pad * 2; }
      const c = cv.getContext('2d');
      if (o.t === 'rect') this.drawBlock(c, o, pad, R);
      else if (o.k === 'tree') this.drawTree(c, o, pad, R, cv);
      else if (o.k === 'pillar') this.drawPillar(c, o, pad, R, cv);
      else if (o.k === 'crystal') this.drawCrystal(c, o, pad, R, cv);
      this.obsSprites.set(o.id, { cv, ox: o.t === 'rect' ? o.x - pad : o.x - cv.width / 2, oy: o.t === 'rect' ? o.y - o.hh - pad : o.y - (cv.height - pad - o.r * 0.6) });
    }
  }
  drawBlock(c, o, pad, R) {
    const ruin = o.k === 'ruin';
    const top = ruin ? '#c9b48c' : '#8a95a3', side = ruin ? '#8c7656' : '#596372', dark = ruin ? '#5e4d37' : '#3b4350';
    const x = pad, y = pad, w = o.w, h = o.h, hh = o.hh;
    // face frontal
    const fg = c.createLinearGradient(0, y + h, 0, y + h + hh);
    fg.addColorStop(0, side); fg.addColorStop(1, dark);
    c.fillStyle = fg; c.fillRect(x, y + h, w, hh);
    if (ruin) { // tijolos
      c.strokeStyle = 'rgba(40,28,15,0.45)'; c.lineWidth = 1.2;
      for (let yy = y + h + 12; yy < y + h + hh; yy += 13) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
      for (let yy = y + h, row = 0; yy < y + h + hh; yy += 13, row++) for (let xx = x + (row % 2) * 13; xx < x + w; xx += 26) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, Math.min(yy + 13, y + h + hh)); c.stroke(); }
    } else {
      c.strokeStyle = 'rgba(20,25,35,0.4)'; c.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { let xx = x + R() * w; c.beginPath(); c.moveTo(xx, y + h); for (let k = 0; k < 4; k++) { xx += R() * 10 - 5; c.lineTo(xx, y + h + (k + 1) * hh / 4); } c.stroke(); }
    }
    // topo
    const tg = c.createLinearGradient(x, y, x + w, y + h);
    tg.addColorStop(0, shade(top, 0.15)); tg.addColorStop(1, shade(top, -0.12));
    c.fillStyle = tg; c.beginPath(); c.roundRect(x, y, w, h, 4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 2, y + h - 1); c.lineTo(x + 2, y + 2); c.lineTo(x + w - 2, y + 2); c.stroke();
    // musgo
    if (ruin) for (let i = 0; i < (w * h) / 300; i++) {
      c.fillStyle = `rgba(${70 + R() * 30},${110 + R() * 40},${60},${0.35 + R() * 0.3})`;
      c.beginPath(); c.arc(x + R() * w, y + R() * h, 2 + R() * 6, 0, Math.PI * 2); c.fill();
    }
    // lascas nos cantos
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 3; i++) { const cx = R() < 0.5 ? x : x + w, cy = y + R() * (h + hh); c.beginPath(); c.arc(cx, cy, 3 + R() * 6, 0, Math.PI * 2); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, w - 1, h + hh - 1);
  }
  drawTree(c, o, pad, R, cv) {
    const cx = cv.width / 2, by = cv.height - pad - o.r * 0.6;
    // tronco
    const tg = c.createLinearGradient(cx - 10, 0, cx + 10, 0); tg.addColorStop(0, '#3d2a1c'); tg.addColorStop(1, '#6b4a30');
    c.fillStyle = tg; c.beginPath(); c.moveTo(cx - 12, by); c.lineTo(cx - 8, by - o.hh * 0.5); c.lineTo(cx + 8, by - o.hh * 0.5); c.lineTo(cx + 13, by); c.closePath(); c.fill();
    // copa
    const top = by - o.hh * 0.62;
    const blobs = [];
    for (let i = 0; i < 16; i++) { const a = R() * Math.PI * 2, d = R() * o.r * 0.9; blobs.push([cx + Math.cos(a) * d * 1.2, top + Math.sin(a) * d * 0.8, o.r * (0.45 + R() * 0.35)]); }
    blobs.sort((a, b) => a[1] - b[1]);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx, top + o.r * 0.55, o.r * 1.35, o.r * 0.7, 0, 0, Math.PI * 2); c.fill();
    for (const [x, y, r] of blobs) {
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#6fae5b'); g.addColorStop(0.6, '#2f6d3a'); g.addColorStop(1, '#1b4026');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(180,230,140,0.25)'; c.beginPath(); c.arc(cx + (R() - 0.5) * o.r * 2, top + (R() - 0.7) * o.r * 1.3, 1 + R() * 2.5, 0, Math.PI * 2); c.fill(); }
    // frutos de éter
    for (let i = 0; i < 4; i++) { c.fillStyle = '#9ff6ff'; c.shadowColor = '#5ef'; c.shadowBlur = 8; c.beginPath(); c.arc(cx + (R() - 0.5) * o.r * 1.6, top + (R() - 0.3) * o.r, 2.5, 0, Math.PI * 2); c.fill(); }
    c.shadowBlur = 0;
  }
  drawPillar(c, o, pad, R, cv) {
    const cx = cv.width / 2, by = cv.height - pad - o.r * 0.6, r = o.r * 0.85, hh = o.hh;
    const g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, '#6f6658'); g.addColorStop(0.45, '#c8bba0'); g.addColorStop(1, '#5a5246');
    c.fillStyle = g; c.fillRect(cx - r, by - hh, r * 2, hh);
    c.beginPath(); c.ellipse(cx, by, r, r * 0.45, 0, 0, Math.PI); c.fill();
    c.strokeStyle = 'rgba(40,30,20,0.35)'; c.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(cx + i * r / 4, by - hh); c.lineTo(cx + i * r / 4, by); c.stroke(); }
    // anéis
    for (const yy of [by - hh * 0.25, by - hh * 0.8]) { c.fillStyle = '#7d7262'; c.fillRect(cx - r - 3, yy, r * 2 + 6, 7); }
    // topo
    const tg = c.createRadialGradient(cx - r * 0.3, by - hh - 4, 2, cx, by - hh, r + 4);
    tg.addColorStop(0, '#e6dcc4'); tg.addColorStop(1, '#8e8370');
    c.fillStyle = tg; c.beginPath(); c.ellipse(cx, by - hh, r + 4, (r + 4) * 0.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.stroke();
    c.fillStyle = '#7ff5ff'; c.shadowColor = '#7ff5ff'; c.shadowBlur = 10; c.font = 'bold 18px serif'; c.textAlign = 'center';
    c.fillText('ᚱ', cx, by - hh * 0.5); c.shadowBlur = 0;
  }
  drawCrystal(c, o, pad, R, cv) {
    const cx = cv.width / 2, by = cv.height - pad - o.r * 0.6;
    // base de pedra
    c.fillStyle = '#4a4552'; c.beginPath(); c.ellipse(cx, by, o.r * 1.15, o.r * 0.55, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#625c6b'; c.beginPath(); c.ellipse(cx, by - 6, o.r * 1.05, o.r * 0.48, 0, 0, Math.PI * 2); c.fill();
    const shards = [[0, 1, 0.42], [-0.55, 0.62, 0.26], [0.55, 0.7, 0.26], [-0.3, 0.45, 0.2], [0.32, 0.5, 0.2]];
    for (const [ox, hf, wf] of shards.sort((a, b) => a[1] - b[1])) {
      const x = cx + ox * o.r, w = o.r * wf * 1.4, top = by - 6 - o.hh * hf;
      const g = c.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, '#2a8fb0'); g.addColorStop(0.5, '#bff9ff'); g.addColorStop(1, '#1c5d86');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - w, by - 8); c.lineTo(x - w * 0.8, top + w); c.lineTo(x, top); c.lineTo(x + w * 0.8, top + w); c.lineTo(x + w, by - 8); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(220,255,255,0.7)'; c.lineWidth = 1.2; c.stroke();
      c.beginPath(); c.moveTo(x, top); c.lineTo(x, by - 8); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
    }
  }
  buildStars() {
    const R = mulberry(99); this.stars = [];
    for (let i = 0; i < 220; i++) this.stars.push({ x: R() * 4000 - 800, y: R() * 3000 - 700, s: R() * 1.8 + 0.3, p: R() * 0.5 + 0.15, tw: R() * 6 });
    this.clouds = [];
    for (let i = 0; i < 10; i++) this.clouds.push({ x: R() * 4000 - 800, y: R() * 3000 - 700, r: 160 + R() * 280, p: 0.3 + R() * 0.3, v: 6 + R() * 12 });
    const mk = (col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; };
    this.cloudDay = mk('rgba(255,150,170,0.16)'); this.cloudNight = mk('rgba(60,30,80,0.22)');
    // textura da névoa rubra
    const m = document.createElement('canvas'); m.width = m.height = 256; const g = m.getContext('2d');
    g.fillStyle = 'rgba(140,15,55,0.38)'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      const x = R() * 256, y = R() * 256, r = 20 + R() * 60;
      for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, `rgba(255,${60 + R() * 60 | 0},${100 + R() * 50 | 0},0.12)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
    this.mistTex = m; this.mistPat = null;
    // brilho dos cristais
    const cg = document.createElement('canvas'); cg.width = cg.height = 256; const c2 = cg.getContext('2d');
    const gr2 = c2.createRadialGradient(128, 128, 0, 128, 128, 128); gr2.addColorStop(0, 'rgba(120,240,255,0.45)'); gr2.addColorStop(1, 'rgba(0,80,120,0)');
    c2.fillStyle = gr2; c2.fillRect(0, 0, 256, 256); this.crystalGlow = cg;
  }

  // ---------- partículas ----------
  emit(p) { if (this.parts.length < 900 * this.Q.parts && (this.Q.parts >= 1 || p.type === 'text' || p.type === 'ring' || Math.random() < this.Q.parts + 0.15)) this.parts.push(p); }
  burst(x, y, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (o.speed || 160) * (0.3 + Math.random() * 0.7);
      this.emit({ x, y, z: o.z || 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: (o.up || 60) * Math.random(), life: 0, max: (o.life || 0.5) * (0.6 + Math.random() * 0.6), size: (o.size || 3) * (0.5 + Math.random()), color, add: o.add !== false, grav: o.grav ?? 200, type: o.type || 'glow' });
    }
  }
  ring(x, y, r, color, life = 0.45, w = 6) { this.emit({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: life, size: r, color, add: true, grav: 0, type: 'ring', w }); }
  text(x, y, str, color, big) { this.emit({ x: x + rnd(-10, 10), y, z: 60, vx: rnd(-20, 20), vy: 0, vz: 80, life: 0, max: 0.9, size: big ? 22 : 16, color, add: false, grav: 120, type: 'text', str }); }

  onEvent(e, S, me) {
    const P = id => S.players.find(p => p.id === id);
    switch (e.k) {
      case 'hit': {
        const t = P(e.id); if (!t) break;
        const mine = e.by === me.id, onMe = e.id === me.id;
        if (mine || onMe || e.tick) this.text(e.x, e.y, String(e.a), onMe ? '#ff6b6b' : mine ? '#ffffff' : '#ffb0b0', e.a >= 80);
        this.burst(e.x, e.y, 6, '#ffdcc8', { speed: 120, life: 0.3, size: 2.5 });
        const a = this.anim.get(e.id); if (a) a.flash = 0.08;
        if (onMe) this.shake = Math.max(this.shake, Math.min(10, e.a / 8));
        break;
      }
      case 'heal': this.text(e.x, e.y, '+' + e.a, '#6dff8a'); this.burst(e.x, e.y, 5, '#9dffa8', { speed: 50, life: 0.7, up: 120, grav: -40 }); break;
      case 'spark': {
        const col = { ember: '#ff9a3c', dagger: '#d8c8ff', orb: '#7ff5ff', light: '#fff3b0', hook: '#cccccc', fissure: '#b49a7a', wave: '#7ff5ff', wind: '#bff0ff', bolt: '#ffe14a', thorn: '#8fd46a', roots: '#6fbf4a', sound: '#ffd65a', anchor: '#b8c4cc', grapple: '#b8c4cc' }[e.c] || '#ffffff';
        this.burst(e.x, e.y, 8, col, { speed: 180, life: 0.35, size: 2.5 }); break;
      }
      case 'boom': {
        if (e.c === 'lightning') {
          this.ring(e.x, e.y, e.r, '#ffe14a', 0.45, 14); this.burst(e.x, e.y, 50, '#fff6b0', { speed: 380, life: 0.5, size: 4, up: 260 });
          for (let i = 0; i < 12; i++) this.emit({ x: e.x + rnd(-6, 6), y: e.y, z: i * 40, vx: 0, vy: 0, vz: 0, life: 0, max: 0.3, size: 9, color: '#fff6b0', add: true, grav: 0, type: 'glow' });
        } else if (e.c === 'bloom') {
          this.ring(e.x, e.y, e.r, '#ff7fb6', 0.5, 10); this.burst(e.x, e.y, 36, '#ff9fc4', { speed: 260, life: 0.8, size: 3.5, up: 160 }); this.burst(e.x, e.y, 24, '#6fbf4a', { speed: 220, life: 0.9, size: 4, add: false, type: 'debris', up: 220, grav: 600 });
        } else if (e.c === 'fire') {
          this.ring(e.x, e.y, e.r, '#ffb040', 0.5, 14); this.burst(e.x, e.y, 70, '#ff7a1a', { speed: 420, life: 0.8, size: 6, up: 200 });
          this.burst(e.x, e.y, 30, '#3a2a28', { speed: 150, life: 1.4, size: 16, add: false, type: 'smoke', grav: -30 });
        } else {
          this.ring(e.x, e.y, e.r, '#f2c27a', 0.5, 16); this.burst(e.x, e.y, 50, '#8a7a66', { speed: 320, life: 0.9, size: 5, add: false, type: 'debris', up: 300, grav: 900 });
          this.burst(e.x, e.y, 26, '#c9b89a', { speed: 120, life: 1.2, size: 18, add: false, type: 'smoke', grav: -20 });
        }
        if (dist(me.x, me.y, e.x, e.y) < 900) this.shake = Math.max(this.shake, 14);
        break;
      }
      case 'death': {
        this.burst(e.x, e.y, 40, '#ffffff', { speed: 260, life: 0.8, size: 4 });
        this.ring(e.x, e.y, 90, '#ffffff', 0.6, 8); break;
      }
      case 'revive': this.ring(e.x, e.y, 110, '#9dffa8', 0.7, 10); this.burst(e.x, e.y, 40, '#bfffcb', { speed: 160, life: 1, up: 220, grav: -80 }); break;
      case 'blink': {
        const bc = e.c === 'gold' ? '#ffd65a' : '#8a4dff';
        for (let i = 0; i <= 10; i++) { const f = i / 10; this.burst(e.x1 + (e.x2 - e.x1) * f, e.y1 + (e.y2 - e.y1) * f, 3, bc, { speed: 40, life: 0.5, size: 5 }); }
        this.ring(e.x2, e.y2, 100, e.c === 'gold' ? '#fff3b0' : '#b46bff', 0.4, 8);
        if (e.c === 'gold') break; this.burst(e.x2, e.y2, 20, '#1a1026', { speed: 200, life: 0.6, size: 6, add: false, type: 'debris', grav: 300 });
        break;
      }
      case 'dash': this.burst(e.x, e.y, 10, '#d8f0ff', { speed: 90, life: 0.4, size: 3 }); break;
      case 'shield': { const t = P(e.id); if (t) this.ring(t.x, t.y, 50, '#ffe27a', 0.5, 6); break; }
      case 'aurora': this.ring(e.x, e.y, 1000, '#ffe9a0', 0.9, 30); this.burst(e.x, e.y, 60, '#fff3b0', { speed: 500, life: 1, size: 4 }); break;
      case 'block': this.burst(e.x, e.y, 12, '#f2a33a', { speed: 220, life: 0.3, size: 3 }); break;
      case 'zap': { const n = 8; for (let i = 0; i <= n; i++) { const f = i / n; this.emit({ x: e.x1 + (e.x2 - e.x1) * f + rnd(-8, 8), y: e.y1 + (e.y2 - e.y1) * f + rnd(-8, 8), z: 26, vx: 0, vy: 0, vz: 0, life: 0, max: 0.25, size: 3, color: '#ffe14a', add: true, grav: 0, type: 'glow' }); } break; }
      case 'root': { const t = P(e.id); if (t) this.burst(t.x, t.y, 12, '#6fbf4a', { speed: 90, life: 0.5, size: 3, add: false, type: 'debris', grav: 300, z: 2 }); break; }
      case 'parry': this.ring(e.x, e.y, 60, '#d8f6ff', 0.35, 6); this.burst(e.x, e.y - 26, 14, '#ffffff', { speed: 260, life: 0.25, size: 2.5 }); break;
      case 'bell': this.ring(e.x, e.y, 180, '#ffd65a', 0.5, 12); this.ring(e.x, e.y, 120, '#fff3b0', 0.4, 6); break;
      case 'ward': this.ring(e.x, e.y, 650, '#ffd65a', 0.8, 20); this.burst(e.x, e.y, 40, '#fff3b0', { speed: 300, life: 0.9, size: 4, up: 200, grav: -50 }); break;
      case 'pull': this.ring(e.x, e.y, 340, '#3fd4c0', 0.45, 14); this.burst(e.x, e.y, 30, '#9aa7b8', { speed: 300, life: 0.4, size: 3, add: false, type: 'debris', grav: 400 }); break;
      case 'spin': { const t = P(e.id); if (t) this.burst(t.x, t.y, 6, '#bff0ff', { speed: 340, life: 0.25, size: 2.5 }); break; }
      case 'swing': {
        const t = P(e.id); if (!t || e.soft) break;
        this.emit({ x: t.x, y: t.y, z: 26, vx: 0, vy: 0, vz: 0, life: 0, max: 0.22, size: 140, color: '#ffe6b8', add: true, grav: 0, type: 'arc', a: e.a });
        break;
      }
      case 'hook': { const t = P(e.id); if (t) this.burst(t.x, t.y, 14, '#cfcfcf', { speed: 160, life: 0.4 }); break; }
      case 'cast': {
        const t = P(e.id); if (!t) break;
        const col = CLASSES[HUNTERS[t.hunter].classe].cor;
        this.ring(t.x, t.y, 46, col, 0.3, 4);
        if (t.hunter === 'brasa' && e.ab === 'q') this.burst(t.x + Math.cos(t.aim) * 30, t.y + Math.sin(t.aim) * 30 - 26, 16, '#ffb040', { speed: 260, life: 0.25 });
        break;
      }
    }
  }

  updateParts(dt) {
    for (const p of this.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
      if (p.z < 0 && p.type !== 'smoke') { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      p.vx *= 0.97; p.vy *= 0.97;
    }
    this.parts = this.parts.filter(p => p.life < p.max);
  }

  // ---------- quadro ----------
  frame(S, me, dt, mouse) {
    const ctx = this.ctx, W = this.c.width, Hh = this.c.height;
    this.time += dt;
    const T = this.time;
    // câmera
    const dp = this.dpr || 1;
    const z = Math.min(1.25, Math.max(0.55, Math.min(W / dp / 1500, Hh / dp / 900))) * dp;
    this.cam.z = z;
    let fx = me.x, fy = me.y;
    if (mouse && me.alive) { fx += (mouse.wx - me.x) * 0.18; fy += (mouse.wy - me.y) * 0.18; }
    const k = 1 - Math.exp(-dt * 8);
    this.cam.x += (fx - this.cam.x) * k; this.cam.y += (fy - this.cam.y) * k;
    this.shake *= Math.exp(-dt * 8);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;

    // fundo: abismo
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, Hh);
    if (S.night) { bg.addColorStop(0, '#05060f'); bg.addColorStop(1, '#120a1c'); }
    else { bg.addColorStop(0, '#1b2350'); bg.addColorStop(0.6, '#3a2554'); bg.addColorStop(1, '#5a2638'); }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    if (this.Q.sky) {
      ctx.fillStyle = '#fff';
      for (const s of this.stars) {
        const x = (s.x - this.cam.x * s.p) * z * 0.6 + W / 2, y = (s.y - this.cam.y * s.p) * z * 0.6 + Hh / 2;
        if (x < -5 || y < -5 || x > W + 5 || y > Hh + 5) continue;
        ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(T * 0.8 + s.tw));
        ctx.fillRect(x, y, s.s * dp, s.s * dp);
      }
      ctx.globalAlpha = 1;
      const cs = S.night ? this.cloudNight : this.cloudDay;
      for (const cl of this.clouds) {
        const x = ((cl.x + T * cl.v) % 4000 - 800 - this.cam.x * cl.p) * z * 0.7 + W / 2, y = (cl.y - this.cam.y * cl.p) * z * 0.7 + Hh / 2, r = cl.r * z;
        if (x + r < 0 || y + r < 0 || x - r > W || y - r > Hh) continue;
        ctx.drawImage(cs, x - r, y - r, r * 2, r * 2);
      }
    }

    // mundo
    const ox = W / 2 - this.cam.x * z + sx, oy = Hh / 2 - this.cam.y * z + sy;
    ctx.setTransform(z, 0, 0, z, ox, oy);
    this.view = { x0: this.cam.x - W / 2 / z - 200, y0: this.cam.y - Hh / 2 / z - 250, x1: this.cam.x + W / 2 / z + 200, y1: this.cam.y + Hh / 2 / z + 250 };
    {
      const gx0 = Math.max(0, Math.floor(this.cam.x - W / 2 / z - 20)), gy0 = Math.max(0, Math.floor(this.cam.y - Hh / 2 / z - 20));
      const gx1 = Math.min(this.ground.width, Math.ceil(this.cam.x + W / 2 / z + 20)), gy1 = Math.min(this.ground.height, Math.ceil(this.cam.y + Hh / 2 / z + 20));
      if (gx1 > gx0 && gy1 > gy0) ctx.drawImage(this.ground, gx0, gy0, gx1 - gx0, gy1 - gy0, gx0, gy0, gx1 - gx0, gy1 - gy0);
    }
    // brilho pulsante da praça
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 + Math.sin(T * 1.5) * 0.25;
    ctx.drawImage(this.crystalGlow, WORLD_W / 2 - 360, WORLD_H / 2 - 360, 720, 720);
    ctx.restore();

    // almas de aliados caídos
    for (const p of S.players) if (!p.alive && p.team === me.team) this.drawSoul(ctx, p, T);
    // zonas
    for (const zn of S.zones) this.drawZone(ctx, zn, T, me);

    // visibilidade de inimigos
    const solids = MAP_OBS.concat(S.walls || []);
    const vis = new Set();
    for (const p of S.players) if (p.alive && seesTarget(S.players, solids, S.night, me.team, p)) vis.add(p.id);
    this.visible = vis;

    // lista ordenada por profundidade
    const items = [];
    for (const o of MAP_OBS) {
      const bottom = o.t === 'rect' ? o.y + o.h : o.y + o.r * 0.5;
      const sp = this.obsSprites.get(o.id);
      if (sp.ox > this.view.x1 || sp.ox + sp.cv.width < this.view.x0 || sp.oy > this.view.y1 || sp.oy + sp.cv.height < this.view.y0) continue;
      items.push({ y: bottom, f: () => this.drawObstacle(ctx, o, T) });
    }
    for (const w of S.walls || []) items.push({ y: w.y + 4, f: () => this.drawIce(ctx, w, T) });
    for (const p of S.players) {
      let a = this.anim.get(p.id);
      if (!a) { a = { px: p.x, py: p.y, t: Math.random() * 9, moving: false, flash: 0, ember: 0 }; this.anim.set(p.id, a); }
      const mv = dist(a.px, a.py, p.x, p.y) / Math.max(dt, 0.001);
      a.moving = mv > 30 && p.alive; a.px = p.x; a.py = p.y; a.t += dt; a.flash = Math.max(0, a.flash - dt);
      if (!p.alive || !vis.has(p.id)) continue;
      items.push({ y: p.y, f: () => this.drawPlayer(ctx, p, a, me, T) });
      // partículas de personagem
      a.ember -= dt;
      if (a.ember <= 0) {
        a.ember = 0.06;
        if (p.hunter === 'brasa') this.emit({ x: p.x + rnd(-6, 6), y: p.y, z: 58 + rnd(0, 6), vx: rnd(-10, 10), vy: 0, vz: 50, life: 0, max: 0.6, size: 2, color: '#ff8a2a', add: true, grav: -20, type: 'glow' });
        if (p.huntT > 0) this.emit({ x: p.x + rnd(-14, 14), y: p.y, z: rnd(0, 50), vx: 0, vy: 0, vz: 40, life: 0, max: 0.5, size: 5, color: '#8a4dff', add: true, grav: -30, type: 'glow' });
        if (p.spdT > 0) this.emit({ x: p.x + rnd(-14, 14), y: p.y, z: rnd(0, 40), vx: -p.vx * 0.2, vy: -p.vy * 0.2, vz: 20, life: 0, max: 0.4, size: 3, color: '#fff3b0', add: true, grav: 0, type: 'glow' });
      }
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();

    // projéteis
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const pr of S.projectiles) this.drawProj(ctx, pr, S, T);
    ctx.restore();

    // partículas
    this.updateParts(dt);
    this.drawParts(ctx);

    // aliados atrás de paredes (raio-x)
    if (this.Q.xray) {
      ctx.save(); ctx.globalAlpha = 0.25;
      for (const p of S.players) if (p.alive && p.team === me.team) {
        const a = this.anim.get(p.id); drawHunter(ctx, p.hunter, p.x, p.y, p.aim, a.t, a.moving, { z: p.z, noShadow: true, fast: true });
      }
      ctx.restore();
    }

    // tempestade
    this.drawStorm(ctx, S, T);

    // névoa de guerra
    this.drawFog(S, me, z, ox, oy);

    // barras de vida por cima da névoa
    ctx.setTransform(z, 0, 0, z, ox, oy);
    for (const p of S.players) if (p.alive && vis.has(p.id)) this.drawBars(ctx, p, me);
    for (const p of S.players) if (!p.alive && p.team === me.team && p.revive > 0) this.drawReviveBar(ctx, p);

    // mira
    if (mouse && me.alive) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      const mx = mouse.sx, my = mouse.sy;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 15, my); ctx.lineTo(mx - 5, my); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 15, my); ctx.moveTo(mx, my - 15); ctx.lineTo(mx, my - 5); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 15); ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawObstacle(ctx, o, T) {
    const sp = this.obsSprites.get(o.id);
    ctx.drawImage(sp.cv, sp.ox, sp.oy);
    if (o.k === 'crystal') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 + Math.sin(T * 2 + o.id) * 0.2;
      const cy = o.y - o.hh * 0.45, R = o.r * 2.4;
      ctx.drawImage(this.crystalGlow, o.x - R, cy - R, R * 2, R * 2);
      ctx.restore();
      if (Math.random() < 0.2) this.emit({ x: o.x + rnd(-o.r, o.r), y: o.y, z: rnd(20, o.hh), vx: 0, vy: 0, vz: 30, life: 0, max: 1.4, size: 2.2, color: '#9ff6ff', add: true, grav: -10, type: 'glow' });
    }
  }
  drawIce(ctx, w, T) {
    const f = Math.min(1, (w.T - w.life) / 0.2, w.life / 0.3);
    ctx.save(); ctx.globalAlpha = Math.max(0, f);
    const h = 70 * f;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(w.x, w.y + 4, w.r * 1.1, w.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(w.x - w.r, 0, w.x + w.r, 0);
    g.addColorStop(0, '#5fb7d6'); g.addColorStop(0.5, '#e8fdff'); g.addColorStop(1, '#3a86b0');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(w.x - w.r, w.y); ctx.lineTo(w.x - w.r * 0.7, w.y - h * 0.8); ctx.lineTo(w.x - w.r * 0.1, w.y - h); ctx.lineTo(w.x + w.r * 0.6, w.y - h * 0.75); ctx.lineTo(w.x + w.r, w.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  drawSoul(ctx, p, T) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const y = p.soulY - 30 + Math.sin(T * 3) * 5;
    const g = ctx.createRadialGradient(p.soulX, y, 0, p.soulX, y, 26);
    g.addColorStop(0, 'rgba(220,255,240,0.9)'); g.addColorStop(0.4, 'rgba(120,255,190,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.soulX, y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(140,255,200,0.4)'; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -T * 20;
    ctx.beginPath(); ctx.ellipse(p.soulX, p.soulY, 85, 36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  drawZone(ctx, zn, T, me) {
    const f = Math.min(1, zn.t / 0.4, (zn.T - zn.t) / 0.2 + 0.2);
    ctx.save(); ctx.globalAlpha = Math.max(0, f);
    const ally = zn.team === me.team;
    if (zn.type === 'fire' || zn.type === 'burn') {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(zn.x, zn.y, 0, zn.x, zn.y, zn.r);
      g.addColorStop(0, 'rgba(255,140,40,0.45)'); g.addColorStop(0.7, 'rgba(200,50,10,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      if (Math.random() < (zn.type === 'burn' ? 0.9 : 0.3)) this.emit({ x: zn.x + rnd(-zn.r, zn.r) * 0.7, y: zn.y + rnd(-zn.r, zn.r) * 0.55, z: 0, vx: 0, vy: 0, vz: 70, life: 0, max: 0.6, size: 5, color: '#ff8a2a', add: true, grav: -40, type: 'glow' });
      if (zn.type === 'burn') { ctx.strokeStyle = ally ? 'rgba(120,200,255,0.5)' : 'rgba(255,90,40,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (zn.type === 'pool') {
      const g = ctx.createRadialGradient(zn.x, zn.y, 0, zn.x, zn.y, zn.r);
      g.addColorStop(0, 'rgba(10,50,90,0.65)'); g.addColorStop(1, 'rgba(20,120,160,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(127,245,255,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const r = ((T * 60 + i * 50) % 150) / 150 * zn.r; ctx.globalAlpha = f * (1 - r / zn.r); ctx.beginPath(); ctx.ellipse(zn.x, zn.y, r, r * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = f; ctx.strokeStyle = ally ? 'rgba(120,200,255,0.8)' : 'rgba(255,110,110,0.8)'; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (zn.type === 'static') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(90,110,255,0.12)'; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ally ? 'rgba(120,200,255,0.7)' : 'rgba(255,225,74,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const a0 = Math.random() * 6.28, r0 = Math.random() * zn.r * 0.9; let x = zn.x + Math.cos(a0) * r0, y = zn.y + Math.sin(a0) * r0 * 0.8; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd(-18, 18); y += rnd(-14, 14); ctx.lineTo(x, y); } ctx.stroke(); }
    } else if (zn.type === 'strike') {
      const f2 = 1 - zn.t / zn.T;
      ctx.fillStyle = `rgba(255,225,74,${0.1 + f2 * 0.2})`; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r * f2, zn.r * 0.8 * f2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (zn.type === 'seed') {
      const f2 = 1 - zn.t / zn.T;
      ctx.strokeStyle = 'rgba(255,127,182,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5a3a1f'; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6fbf4a'; ctx.beginPath(); ctx.ellipse(zn.x - 5, zn.y - 6 - f2 * 8, 6, 3, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(zn.x + 5, zn.y - 6 - f2 * 8, 6, 3, 0.6, 0, Math.PI * 2); ctx.fill();
    } else if (zn.type === 'grove') {
      ctx.fillStyle = 'rgba(40,110,40,0.28)'; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ally ? 'rgba(120,200,255,0.7)' : 'rgba(143,212,106,0.9)'; ctx.lineWidth = 4; ctx.stroke();
      const R = mulberry(zn.id);
      for (let i = 0; i < 14; i++) { const a0 = R() * 6.28, r0 = Math.sqrt(R()) * zn.r * 0.9, x = zn.x + Math.cos(a0) * r0, y = zn.y + Math.sin(a0) * r0 * 0.8, h = 10 + R() * 14;
        ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(T * 2 + i) * 4, y - h / 2, x + 3, y - h); ctx.stroke();
        ctx.fillStyle = i % 3 ? '#6fbf4a' : '#ff7fb6'; ctx.beginPath(); ctx.arc(x + 3, y - h, 3, 0, Math.PI * 2); ctx.fill(); }
      if (Math.random() < 0.4) this.emit({ x: zn.x + rnd(-zn.r, zn.r) * 0.7, y: zn.y + rnd(-zn.r, zn.r) * 0.55, z: 0, vx: 0, vy: 0, vz: 40, life: 0, max: 1, size: 2.5, color: '#bfffa0', add: true, grav: -10, type: 'glow' });
    } else if (zn.type === 'sanct') {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(zn.x, zn.y, 0, zn.x, zn.y, zn.r);
      g.addColorStop(0, 'rgba(255,230,140,0.35)'); g.addColorStop(1, 'rgba(255,200,80,0.08)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,140,0.85)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.translate(zn.x, zn.y); ctx.scale(1, 0.8); ctx.rotate(T * 0.8);
      ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(0, 0, zn.r * 0.75, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      if (Math.random() < 0.6) this.emit({ x: zn.x + rnd(-zn.r, zn.r) * 0.7, y: zn.y + rnd(-zn.r, zn.r) * 0.55, z: 0, vx: 0, vy: 0, vz: 60, life: 0, max: 1, size: 3, color: '#fff3b0', add: true, grav: -20, type: 'glow' });
    }
    ctx.restore();
  }
  drawPlayer(ctx, p, a, me, T) {
    const rel = p.id === me.id ? '#5dff7a' : p.team === me.team ? '#4fb3ff' : '#ff4848';
    if (p.leap) ctx.globalAlpha = 1;
    drawHunter(ctx, p.hunter, p.x, p.y, p.aim, a.t, a.moving, { ring: rel, arrow: p.id === me.id, z: p.z, fast: true });
    if (a.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; const S0 = HUNTERS[p.hunter].big ? 70 : 56; ctx.drawImage(glowSprite('#ffffff'), p.x - S0 / 2, p.y - 30 - p.z - S0 / 2, S0, S0); ctx.restore(); }
    const S = HUNTERS[p.hunter].big || 1;
    // efeitos de status
    if (p.shield > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y - 28 * S - p.z, 10, p.x, p.y - 28 * S - p.z, 38 * S);
      g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(0.8, 'rgba(255,230,140,0.25)'); g.addColorStop(1, 'rgba(255,240,180,0.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 28 * S - p.z, 38 * S, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (p.bastionT > 0) {
      ctx.save(); ctx.translate(p.x, p.y - 22); ctx.scale(1, 0.6);
      ctx.beginPath(); ctx.arc(0, 0, 44, p.aim - 1.1, p.aim + 1.1);
      ctx.strokeStyle = 'rgba(242,163,58,0.3)'; ctx.lineWidth = 16; ctx.stroke();
      ctx.strokeStyle = '#f2a33a'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
    }
    if (p.stun > 0) {
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 3; i++) { const an = T * 6 + i * 2.09; ctx.beginPath(); ctx.arc(p.x + Math.cos(an) * 14, p.y - 66 * S - p.z + Math.sin(an) * 4, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    if (p.rootT > 0) { ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const a0 = i * 1.26; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a0) * 20, p.y + Math.sin(a0) * 8); ctx.quadraticCurveTo(p.x + Math.cos(a0) * 8, p.y - 10, p.x + Math.cos(a0 + 0.5) * 6, p.y - 20); ctx.stroke(); } ctx.strokeStyle = '#6fbf4a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(p.x, p.y, 20, 8, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (p.parryT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(200,240,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 28 - p.z, 30 + Math.sin(T * 30) * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (p.wardT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,214,90,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 28, 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.5 + Math.sin(T * 6) * 0.2; ctx.drawImage(glowSprite('#ffd65a'), p.x - 6, p.y - 70 - p.z, 12, 12); ctx.restore(); }
    if (p.spinT > 0) { ctx.save(); ctx.translate(p.x, p.y - 20); ctx.scale(1, 0.55); ctx.globalCompositeOperation = 'lighter'; const r0 = T * 22;
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(190,240,255,${0.7 - i * 0.2})`; ctx.lineWidth = 5 - i; ctx.beginPath(); ctx.arc(0, 0, 150 - i * 25, r0 + i, r0 + i + 1.6); ctx.stroke(); } ctx.restore(); }
    if (p.slowT > 0) { ctx.fillStyle = 'rgba(127,245,255,0.7)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    if (p.invuln > 0 && !p.leap) { ctx.strokeStyle = 'rgba(160,255,200,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 28, 34, 0, Math.PI * 2); ctx.stroke(); }
  }
  drawBars(ctx, p, me) {
    const S = HUNTERS[p.hunter].big || 1;
    const y = p.y - 78 * S - p.z, w = 64, x = p.x - w / 2;
    const col = p.id === me.id ? '#5dff7a' : p.team === me.team ? '#4fb3ff' : '#ff4848';
    ctx.fillStyle = 'rgba(8,10,18,0.8)'; ctx.fillRect(x - 2, y - 2, w + 4, 11);
    const tot = Math.max(p.maxHp, p.hp + p.shield);
    ctx.fillStyle = col; ctx.fillRect(x, y, w * p.hp / tot, 7);
    if (p.shield > 0) { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x + w * p.hp / tot, y, w * p.shield / tot, 7); }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let i = 100; i < p.maxHp; i += 100) ctx.fillRect(x + w * i / tot, y, 1, 7);
    ctx.font = '600 11px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(p.name, p.x, y - 5);
    ctx.fillText(p.name, p.x, y - 5);
  }
  drawReviveBar(ctx, p) {
    const f = Math.min(1, p.revive / 3.5);
    ctx.strokeStyle = '#6dff8a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.soulX, p.soulY - 30, 22, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
  }
  drawProj(ctx, pr, S, T) {
    const a = Math.atan2(pr.vy, pr.vx);
    const x = pr.x, y = pr.y - 26;
    const glow = (col, r, al = 1) => { ctx.globalAlpha = al; ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; };
    switch (pr.kind) {
      case 'ember': {
        ctx.strokeStyle = 'rgba(255,110,30,0.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - pr.vx * 0.045, y - pr.vy * 0.045); ctx.lineTo(x, y); ctx.stroke();
        glow('#ff8a2a', 12);
        break;
      }
      case 'dagger': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.strokeStyle = 'rgba(160,90,255,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill();
        ctx.restore(); break;
      }
      case 'orb': {
        glow('#3fd4f0', 18);
        if (Math.random() < 0.4) this.emit({ x: pr.x, y: pr.y, z: 26, vx: rnd(-30, 30), vy: rnd(-30, 30), vz: 0, life: 0, max: 0.35, size: 2.5, color: '#7ff5ff', add: true, grav: 100, type: 'glow' });
        break;
      }
      case 'light': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(255,230,140,0.45)'; ctx.beginPath(); ctx.ellipse(-22, 0, 30, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        glow('#ffe27a', 12);
        break;
      }
      case 'fireball': {
        glow('#ff6a1a', 46 + Math.sin(T * 30) * 3);
        glow('#ffd080', 22);
        for (let i = 0; i < 2; i++) this.emit({ x: pr.x + rnd(-10, 10), y: pr.y + rnd(-10, 10), z: 26, vx: -pr.vx * 0.15 + rnd(-40, 40), vy: -pr.vy * 0.15 + rnd(-40, 40), vz: 30, life: 0, max: 0.5, size: 7, color: '#ff7a1a', add: true, grav: -30, type: 'glow' });
        break;
      }
      case 'hook': {
        const o = S.players.find(p => p.id === pr.owner);
        ctx.globalCompositeOperation = 'source-over';
        if (o) {
          ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 3; ctx.setLineDash([7, 4]);
          ctx.beginPath(); ctx.moveTo(o.x, o.y - 28); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.strokeStyle = '#e6e8ef'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 9, -1.4, 1.4); ctx.stroke();
        ctx.restore(); ctx.globalCompositeOperation = 'lighter';
        break;
      }
      case 'fissure': {
        ctx.globalCompositeOperation = 'source-over';
        const sx = pr.x - Math.cos(a) * pr.trav, sy = pr.y - Math.sin(a) * pr.trav;
        ctx.strokeStyle = '#2b1e14'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(sx, sy);
        const R = mulberry(pr.id);
        for (let d = 20; d < pr.trav; d += 20) { const j = (R() - 0.5) * 16; ctx.lineTo(sx + Math.cos(a) * d - Math.sin(a) * j, sy + Math.sin(a) * d + Math.cos(a) * j); }
        ctx.lineTo(pr.x, pr.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(242,163,58,0.85)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        if (Math.random() < 0.6) this.emit({ x: pr.x + rnd(-15, 15), y: pr.y + rnd(-15, 15), z: 0, vx: rnd(-50, 50), vy: rnd(-50, 50), vz: rnd(150, 300), life: 0, max: 0.6, size: 4, color: '#8a7a66', add: false, grav: 900, type: 'debris' });
        break;
      }
      case 'wind': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.strokeStyle = 'rgba(190,240,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-6, 0, 20, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = 'rgba(159,227,255,0.4)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(-12, 0, 20, -1, 1); ctx.stroke();
        ctx.restore(); break;
      }
      case 'bolt': {
        ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 1; i <= 4; i++) { const d = i * 9; ctx.lineTo(x - Math.cos(a) * d + rnd(-5, 5), y - Math.sin(a) * d + rnd(-5, 5)); } ctx.stroke();
        glow('#ffe14a', 14); break;
      }
      case 'thorn': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#7fd46a'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, -3); ctx.lineTo(-8, 3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(120,220,100,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-26, 0); ctx.stroke();
        ctx.restore(); break;
      }
      case 'roots': {
        ctx.globalCompositeOperation = 'source-over';
        const sx = pr.x - Math.cos(a) * pr.trav, sy = pr.y - Math.sin(a) * pr.trav, R = mulberry(pr.id);
        ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx, sy);
        for (let d = 18; d < pr.trav; d += 18) { const j = Math.sin(d * 0.08 + pr.id) * 10; ctx.lineTo(sx + Math.cos(a) * d - Math.sin(a) * j, sy + Math.sin(a) * d + Math.cos(a) * j); }
        ctx.lineTo(pr.x, pr.y); ctx.stroke(); ctx.strokeStyle = '#6fbf4a'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#8fd46a'; for (let d = 30; d < pr.trav; d += 45) { ctx.beginPath(); ctx.ellipse(sx + Math.cos(a) * d, sy + Math.sin(a) * d - 4, 5, 2.5, a + R(), 0, Math.PI * 2); ctx.fill(); }
        ctx.globalCompositeOperation = 'lighter'; break;
      }
      case 'sound': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(255,214,90,${0.8 - i * 0.25})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-i * 9, 0, 14 + i * 3, -0.9, 0.9); ctx.stroke(); }
        ctx.restore(); break;
      }
      case 'anchor': case 'grapple': {
        const o = S.players.find(p => p.id === pr.owner);
        ctx.globalCompositeOperation = 'source-over';
        if (o) { ctx.strokeStyle = '#7d8892'; ctx.lineWidth = 3; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(o.x, o.y - 28); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.strokeStyle = '#b8c4cc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.moveTo(-6, -7); ctx.lineTo(-6, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(4, 0, pr.kind === 'grapple' ? 7 : 10, -1.9, 1.9); ctx.stroke();
        ctx.restore(); ctx.globalCompositeOperation = 'lighter';
        break;
      }
      case 'wave': {
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(30,170,220,0.6)'; ctx.beginPath();
        ctx.moveTo(-70, -160); ctx.quadraticCurveTo(50, 0, -70, 160); ctx.lineTo(-20, 160); ctx.quadraticCurveTo(40, 0, -20, -160); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -160); ctx.quadraticCurveTo(40, 0, -20, 160); ctx.stroke();
        ctx.restore(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) { const l = rnd(-150, 150); this.emit({ x: pr.x - Math.sin(a) * l, y: pr.y + Math.cos(a) * l, z: rnd(10, 40), vx: pr.vx * 0.3, vy: pr.vy * 0.3, vz: 80, life: 0, max: 0.5, size: 3, color: '#bff9ff', add: true, grav: 300, type: 'glow' }); }
        break;
      }
    }
  }
  drawParts(ctx) {
    // 1ª passada: partículas normais; 2ª: aditivas (brilho), sem trocar o modo a cada partícula
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.parts) {
      if (p.add) continue;
      const f = p.life / p.max, y = p.y - p.z;
      if (p.type === 'text') {
        ctx.globalAlpha = 1 - f * f; ctx.font = `800 ${p.size}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(p.str, p.x, y); ctx.fillStyle = p.color; ctx.fillText(p.str, p.x, y);
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = (1 - f) * 0.45; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, y, p.size * (0.6 + f), 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = 1 - f; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (!p.add) continue;
      const f = p.life / p.max, y = p.y - p.z;
      if (p.type === 'ring') {
        ctx.globalAlpha = 1 - f; ctx.strokeStyle = p.color; ctx.lineWidth = p.w * (1 - f);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (0.3 + 0.7 * f), p.size * (0.3 + 0.7 * f) * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === 'arc') {
        ctx.globalAlpha = 1 - f; ctx.strokeStyle = p.color; ctx.lineWidth = 16 * (1 - f);
        ctx.save(); ctx.translate(p.x, p.y - 20); ctx.scale(1, 0.7);
        ctx.beginPath(); ctx.arc(0, 0, p.size * (0.6 + f * 0.4), p.a - 1.05 + f * 0.5, p.a + 1.05); ctx.stroke(); ctx.restore();
      } else {
        const r = p.size * (1 - f * 0.5) * 2.4;
        ctx.globalAlpha = 1 - f; ctx.drawImage(glowSprite(p.color), p.x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  drawStorm(ctx, S, T) {
    const st = S.storm; if (st.r >= 1490) return;
    if (!this.mistPat) this.mistPat = ctx.createPattern(this.mistTex, 'repeat');
    ctx.save();
    ctx.beginPath(); ctx.rect(-1000, -1000, WORLD_W + 2000, WORLD_H + 2000); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2, true);
    ctx.translate(T * 14, T * 6);
    ctx.fillStyle = this.mistPat; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,50,100,0.25)'; ctx.lineWidth = 26; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,110,150,0.95)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  }
  drawFog(S, me, z, ox, oy) {
    const W = this.c.width, Hh = this.c.height, q = this.Q.fog;
    const fw = Math.ceil(W * q), fh = Math.ceil(Hh * q);
    if (this.fog.width !== fw || this.fog.height !== fh) { this.fog.width = fw; this.fog.height = fh; }
    const f = this.fctx;
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'copy';
    f.fillStyle = S.night ? 'rgba(3,5,18,0.88)' : 'rgba(6,10,28,0.55)'; f.fillRect(0, 0, fw, fh);
    f.setTransform(z * q, 0, 0, z * q, ox * q, oy * q);
    f.globalCompositeOperation = 'destination-out'; f.fillStyle = '#fff';
    const solids = MAP_OBS.concat(S.walls || []);
    for (const p of S.players) {
      if (!p.alive || p.team !== me.team) continue;
      const { pts, cone } = visionPoly(solids, p, S.night);
      for (const L of cone ? [pts, cone] : [pts]) {
        f.beginPath(); f.moveTo(L[0], L[1]);
        for (let i = 2; i < L.length; i += 2) f.lineTo(L[i], L[i + 1]);
        f.closePath(); f.fill();
      }
      f.beginPath(); f.arc(p.x, p.y, 120, 0, Math.PI * 2); f.fill();
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.fog, 0, 0, W, Hh);
  }
  minimap(mc, S, me) {
    const c = mc.getContext('2d'), w = mc.width, h = mc.height, k = w / WORLD_W;
    c.clearRect(0, 0, w, h);
    c.save(); c.scale(k, k);
    islandPath(c, ISLAND); c.fillStyle = '#2f5236'; c.fill();
    c.fillStyle = '#8b8b80';
    for (const o of MAP_OBS) { if (o.t === 'rect') c.fillRect(o.x, o.y, o.w, o.h); else { c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill(); } }
    if (S.storm.r < 1490) { c.strokeStyle = '#ff4f80'; c.lineWidth = 14; c.beginPath(); c.arc(S.storm.x, S.storm.y, S.storm.r, 0, Math.PI * 2); c.stroke(); }
    for (const p of S.players) {
      if (!p.alive) { if (p.team === me.team) { c.fillStyle = '#9dffc8'; c.beginPath(); c.arc(p.soulX, p.soulY, 26, 0, Math.PI * 2); c.fill(); } continue; }
      if (p.team !== me.team && !(this.visible && this.visible.has(p.id))) continue;
      c.fillStyle = p.id === me.id ? '#5dff7a' : p.team === me.team ? '#4fb3ff' : '#ff4848';
      c.beginPath(); c.arc(p.x, p.y, p.id === me.id ? 44 : 34, 0, Math.PI * 2); c.fill();
      if (p.id === me.id) { c.strokeStyle = '#fff'; c.lineWidth = 10; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(p.aim) * 110, p.y + Math.sin(p.aim) * 110); c.stroke(); }
    }
    if (this.view) { c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 8; c.strokeRect(this.view.x0 + 200, this.view.y0 + 250, this.view.x1 - this.view.x0 - 400, this.view.y1 - this.view.y0 - 500); }
    c.restore();
  }
}

// retrato para menus
function hunterPortrait(hid, size = 140, team) {
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const c = cv.getContext('2d');
  const cl = CLASSES[HUNTERS[hid].classe].cor;
  const g = c.createRadialGradient(size / 2, size * 0.45, 4, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, shade(cl, -0.35)); g.addColorStop(1, '#0b0d18');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  c.globalCompositeOperation = 'lighter';
  const g2 = c.createRadialGradient(size / 2, size * 0.9, 0, size / 2, size * 0.9, size * 0.5);
  g2.addColorStop(0, cl + '66'); g2.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g2; c.fillRect(0, 0, size, size);
  c.globalCompositeOperation = 'source-over';
  const s = size / (HUNTERS[hid].big ? 92 : 84);
  drawHunter(c, hid, size / 2, size * 0.9, -0.35, 0.6, false, { scale: s });
  return cv;
}
