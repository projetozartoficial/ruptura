// =====================================================================
//  fps/world.js : monta o mapa 3D a partir da grade, navegação dos bots
// =====================================================================
const hex3 = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };

function buildWorld(M) {
  const C = M.cell, R = M.rows, H = R.length, W = R[0].length;
  const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W) ? '#' : R[r][c];
  const solids = [], render = [];
  // paredes: junta células '#' em retângulos (linhas e depois colunas)
  const used = R.map(r => [...r].map(() => false));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (at(c, r) !== '#' || used[r][c]) continue;
    let w = 1; while (c + w < W && at(c + w, r) === '#' && !used[r][c + w]) w++;
    let h = 1; outer: while (r + h < H) { for (let k = 0; k < w; k++) if (at(c + k, r + h) !== '#' || used[r + h][c + k]) break outer; h++; }
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) used[r + a][c + k] = true;
    const border = r === 0 || c === 0 || r + h === H || c + w === W;
    const hh = border ? M.wallH + 3 : M.wallH;
    solids.push({ x0: c * C, x1: (c + w) * C, y0: 0, y1: hh, z0: r * C, z1: (r + h) * C, k: 'wall' });
    render.push({ x: c * C, y: 0, z: r * C, w: w * C, h: hh, d: h * C, col: [0.80, 0.70, 0.56], mat: 2 });
    // faixa decorativa no topo
    render.push({ x: c * C - 0.06, y: hh - 0.35, z: r * C - 0.06, w: w * C + 0.12, h: 0.35, d: h * C + 0.12, col: [0.58, 0.48, 0.38], mat: 0 });
  }
  // caixas e meias-paredes
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = at(c, r), cx = c * C + C / 2, cz = r * C + C / 2;
    if (ch === 'x') {
      const tall = (c * 7 + r * 3) % 3 === 0, s = 1.7, hh = tall ? 2.6 : 1.4;
      solids.push({ x0: cx - s / 2, x1: cx + s / 2, y0: 0, y1: hh, z0: cz - s / 2, z1: cz + s / 2, k: 'crate' });
      render.push({ x: cx - s / 2, y: 0, z: cz - s / 2, w: s, h: 1.4, d: s, col: [0.72, 0.5, 0.3], mat: 3 });
      if (tall) render.push({ x: cx - 0.6, y: 1.4, z: cz - 0.6, w: 1.2, h: 1.2, d: 1.2, col: [0.66, 0.46, 0.28], mat: 3 });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) render.push({ x: cx + dx * s / 2 - 0.06, y: 0, z: cz + dz * s / 2 - 0.06, w: 0.12, h: 1.42, d: 0.12, col: [0.4, 0.28, 0.18], mat: 0 });
    } else if (ch === 'h') {
      solids.push({ x0: cx - 0.9, x1: cx + 0.9, y0: 0, y1: 1.0, z0: cz - 0.9, z1: cz + 0.9, k: 'half' });
      render.push({ x: cx - 0.9, y: 0, z: cz - 0.9, w: 1.8, h: 1.0, d: 1.8, col: [0.62, 0.62, 0.64], mat: 4 });
    }
  }
  // piso por trechos (cor por região)
  const floorCol = ch => ch === 'A' ? [0.74, 0.58, 0.42] : ch === 'B' ? [0.56, 0.62, 0.7] : ch === 'T' ? [0.58, 0.5, 0.48] : ch === 'D' ? [0.5, 0.55, 0.6] : [0.66, 0.62, 0.56];
  const kind = ch => 'ABTD'.includes(ch) ? ch : '.';
  for (let r = 0; r < H; r++) {
    let c = 0;
    while (c < W) {
      const k = kind(at(c, r)); let w = 1;
      while (c + w < W && kind(at(c + w, r)) === k) w++;
      render.push({ x: c * C, y: -0.4, z: r * C, w: w * C, h: 0.4, d: C, col: floorCol(k), mat: 1, skipBottom: true });
      c += w;
    }
  }
  // letras pintadas no chão dos bombsites
  const LET = { A: ['01110', '10001', '11111', '10001', '10001'], B: ['11110', '10001', '11110', '10001', '11110'] };
  for (const s of ['A', 'B']) {
    const cells = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === s) cells.push([c, r]);
    const mx = cells.reduce((a, p) => a + p[0], 0) / cells.length, mz = cells.reduce((a, p) => a + p[1], 0) / cells.length;
    const ox = (mx + 0.5) * C - 2.5 * 0.7, oz = (mz + 0.5) * C - 2.5 * 0.7;
    LET[s].forEach((row, i) => [...row].forEach((b, j) => { if (b === '1') render.push({ x: ox + j * 0.7, y: 0.003, z: oz + i * 0.7, w: 0.7, h: 0.01, d: 0.7, col: s === 'A' ? [1, 0.55, 0.2] : [0.3, 0.7, 1], mat: 0, flat: true }); }));
    M['site' + s] = { x: (mx + 0.5) * C, z: (mz + 0.5) * C, cells };
  }
  // spawns
  const spawnCells = ch => { const o = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === ch) o.push([c, r]); return o; };
  M.spawnT = spawnCells('T'); M.spawnD = spawnCells('D');
  M.W = W; M.H = H; M.solids = solids; M.renderBoxes = render;
  M.at = at;
  M.cellOf = (x, z) => [Math.floor(x / C), Math.floor(z / C)];
  M.siteAt = (x, z) => { const [c, r] = M.cellOf(x, z), ch = at(c, r); return ch === 'A' || ch === 'B' ? ch : null; };
  M.calloutAt = (x, z) => { const [c, r] = M.cellOf(x, z); for (const k of M.callouts) if (c >= k.x0 && c < k.x1 && r >= k.y0 && r < k.y1) return k.n; return ''; };
  // grade de navegação
  M.walk = (c, r) => { const ch = at(c, r); return ch !== '#' && ch !== 'x' && ch !== 'h'; };
  return M;
}

// A* na grade (8 direções, sem cortar quinas)
function navPath(M, sx, sz, tx, tz) {
  const C = M.cell, W = M.W, H = M.H;
  let [a, b] = M.cellOf(sx, sz), [c, d] = M.cellOf(tx, tz);
  if (!M.walk(c, d)) { // alvo bloqueado: célula livre mais próxima
    let best = null, bd = 1e9;
    for (let r = d - 3; r <= d + 3; r++) for (let q = c - 3; q <= c + 3; q++) if (M.walk(q, r)) { const dd = (q - c) ** 2 + (r - d) ** 2; if (dd < bd) { bd = dd; best = [q, r]; } }
    if (!best) return null; [c, d] = best;
  }
  if (!M.walk(a, b)) {
    let best = null, bd = 1e9;
    for (let r = b - 2; r <= b + 2; r++) for (let q = a - 2; q <= a + 2; q++) if (M.walk(q, r)) { const dd = (q - a) ** 2 + (r - b) ** 2; if (dd < bd) { bd = dd; best = [q, r]; } }
    if (!best) return null; [a, b] = best;
  }
  const key = (q, r) => r * W + q, start = key(a, b), goal = key(c, d);
  const g = new Map([[start, 0]]), came = new Map(), open = [[0, start]], closed = new Set();
  const hf = k => Math.hypot(k % W - c, Math.floor(k / W) - d);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
    if (cur === goal) break;
    if (closed.has(cur)) continue; closed.add(cur);
    const q = cur % W, r = Math.floor(cur / W);
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nq = q + dq, nr = r + dr; if (!M.walk(nq, nr)) continue;
      if (dq && dr && (!M.walk(q + dq, r) || !M.walk(q, r + dr))) continue;
      const nk = key(nq, nr), ng = g.get(cur) + (dq && dr ? 1.414 : 1);
      if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); came.set(nk, cur); open.push([ng + hf(nk), nk]); }
    }
  }
  if (!came.has(goal) && start !== goal) return null;
  const path = []; let k = goal;
  while (k !== start) { path.push([(k % W + 0.5) * C, (Math.floor(k / W) + 0.5) * C]); k = came.get(k); }
  path.reverse();
  return path;
}
