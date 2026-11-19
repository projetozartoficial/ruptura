// =====================================================================
//  fps/world.js : monta o mapa 3D a partir da grade e a navegação dos bots
// =====================================================================
const hex3 = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
const SOLID_CH = '#xhp';

function buildWorld(def) {
  const M = Object.assign({}, def);
  const C = M.cell = 2, R = M.rows, H = R.length, W = R[0].length, TH = M.theme;
  M.wallH = 5.2;
  const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W) ? '#' : R[r][c];
  const solids = [], render = [];
  const tint = (col, k) => col.map(v => Math.min(1, v * k));
  // paredes: junta células '#' em retângulos
  const used = R.map(r => [...r].map(() => false));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (at(c, r) !== '#' || used[r][c]) continue;
    let w = 1; while (c + w < W && at(c + w, r) === '#' && !used[r][c + w]) w++;
    let h = 1; outer: while (r + h < H) { for (let k = 0; k < w; k++) if (at(c + k, r + h) !== '#' || used[r + h][c + k]) break outer; h++; }
    for (let a = 0; a < h; a++) for (let k = 0; k < w; k++) used[r + a][c + k] = true;
    const border = r === 0 || c === 0 || r + h === H || c + w === W;
    const hh = border ? M.wallH + 3 : M.wallH + ((c * 13 + r * 7) % 3) * 0.6;
    solids.push({ x0: c * C, x1: (c + w) * C, y0: 0, y1: hh, z0: r * C, z1: (r + h) * C, k: 'wall' });
    render.push({ x: c * C, y: 0, z: r * C, w: w * C, h: hh, d: h * C, col: TH.wall, mat: 2 });
    render.push({ x: c * C - 0.08, y: hh - 0.4, z: r * C - 0.08, w: w * C + 0.16, h: 0.4, d: h * C + 0.16, col: TH.trim, mat: 4 });
    render.push({ x: c * C - 0.05, y: 0, z: r * C - 0.05, w: w * C + 0.1, h: 0.35, d: h * C + 0.1, col: tint(TH.wall, 0.7), mat: 4 });
  }
  // objetos por célula
  M.portals = {}; M.doorCells = []; M.levers = []; M.breakCells = []; M.bushes = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = at(c, r), cx = c * C + C / 2, cz = r * C + C / 2;
    if (ch === 'x') {
      const tall = (c * 7 + r * 3) % 3 === 0, s = 1.7, hh = tall ? 2.6 : 1.4;
      solids.push({ x0: cx - s / 2, x1: cx + s / 2, y0: 0, y1: hh, z0: cz - s / 2, z1: cz + s / 2, k: 'crate' });
      render.push({ x: cx - s / 2, y: 0, z: cz - s / 2, w: s, h: 1.4, d: s, col: [0.72, 0.5, 0.3], mat: 3 });
      if (tall) render.push({ x: cx - 0.6, y: 1.4, z: cz - 0.6, w: 1.2, h: 1.2, d: 1.2, col: [0.66, 0.46, 0.28], mat: 3 });
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) render.push({ x: cx + dx * s / 2 - 0.07, y: 0, z: cz + dz * s / 2 - 0.07, w: 0.14, h: 1.42, d: 0.14, col: [0.36, 0.25, 0.16], mat: 0 });
      render.push({ x: cx - s / 2 - 0.02, y: 0.62, z: cz - s / 2 - 0.02, w: s + 0.04, h: 0.16, d: s + 0.04, col: [0.36, 0.25, 0.16], mat: 0 });
    } else if (ch === 'h') {
      solids.push({ x0: cx - 0.95, x1: cx + 0.95, y0: 0, y1: 1.0, z0: cz - 0.95, z1: cz + 0.95, k: 'half' });
      render.push({ x: cx - 0.95, y: 0, z: cz - 0.95, w: 1.9, h: 1.0, d: 1.9, col: tint(TH.wall, 0.85), mat: 2 });
      render.push({ x: cx - 1.0, y: 0.95, z: cz - 1.0, w: 2.0, h: 0.1, d: 2.0, col: TH.trim, mat: 4 });
    } else if (ch === 'P' || ch === 'Q') (M.portals[ch] = M.portals[ch] || []).push({ c, r, x: cx, z: cz });
    else if (ch === '=') M.doorCells.push([c, r]);
    else if (ch === 'L') M.levers.push({ c, r, x: cx, z: cz });
    else if (ch === 'b') M.breakCells.push([c, r]);
    else if (ch === 'g') M.bushes.push({ x0: cx - 1, x1: cx + 1, y0: 0, y1: 1.75, z0: cz - 1, z1: cz + 1, c, r });
  }
  // piso (cor por tipo de chão); abismo não tem piso
  const floorCol = ch => ch === 'A' ? TH.floor.map((v, i) => Math.min(1, v * [1.18, 1.02, 0.9][i])) : ch === 'B' ? TH.floor.map((v, i) => Math.min(1, v * [0.92, 1.02, 1.16][i])) : ch === 'C' ? TH.floor.map((v, i) => Math.min(1, v * [0.98, 1.14, 0.94][i])) : ch === 'T' || ch === 'D' ? tint(TH.floor, 0.85) : ch === 'w' ? [0.16, 0.38, 0.46] : ch === 'i' ? [0.8, 0.92, 1] : ch === 'g' ? tint(TH.floor, 0.8) : TH.floor;
  const kind = ch => ch === 'o' ? 'o' : 'ABCTDwig'.includes(ch) ? ch : '.';
  for (let r = 0; r < H; r++) {
    let c = 0;
    while (c < W) {
      const k = kind(at(c, r)); let w = 1;
      while (c + w < W && kind(at(c + w, r)) === k) w++;
      if (k !== 'o') render.push({ x: c * C, y: -0.4, z: r * C, w: w * C, h: 0.4, d: C, col: floorCol(k), mat: k === 'i' ? 4 : k === 'w' ? 6 : 1, skipBottom: true });
      c += w;
    }
  }
  // letras dos sites no chão
  const LET = { A: ['01110', '10001', '11111', '10001', '10001'], B: ['11110', '10001', '11110', '10001', '11110'], C: ['01111', '10000', '10000', '10000', '01111'] };
  const SITE_COL = { A: [1, 0.55, 0.2], B: [0.3, 0.7, 1], C: [0.45, 1, 0.45] };
  M.sites = {}; M.siteIds = [];
  for (const s of ['A', 'B', 'C']) {
    const cells = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === s) cells.push([c, r]);
    if (!cells.length) continue;
    const mx = cells.reduce((a, p) => a + p[0], 0) / cells.length, mz = cells.reduce((a, p) => a + p[1], 0) / cells.length;
    const ox = (mx + 0.5) * C - 2.5 * 0.7, oz = (mz + 0.5) * C - 2.5 * 0.7;
    LET[s].forEach((row, i) => [...row].forEach((b, j) => { if (b === '1') render.push({ x: ox + j * 0.7, y: 0.004, z: oz + i * 0.7, w: 0.7, h: 0.01, d: 0.7, col: SITE_COL[s], mat: 0, flat: true }); }));
    M.sites[s] = { x: (mx + 0.5) * C, z: (mz + 0.5) * C, cells, col: SITE_COL[s] };
    M.siteIds.push(s);
  }
  const groups = ch => { // grupos de células vizinhas com a mesma letra
    const out = [], seen = new Set();
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (at(c, r) !== ch || seen.has(c + ',' + r)) continue;
      const grp = [], st = [[c, r]]; seen.add(c + ',' + r);
      while (st.length) { const [a, b] = st.pop(); grp.push([a, b]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (a + dx) + ',' + (b + dy); if (!seen.has(n) && at(a + dx, b + dy) === ch) { seen.add(n); st.push([a + dx, b + dy]); } } }
      const c0 = Math.min(...grp.map(g => g[0])), c1 = Math.max(...grp.map(g => g[0])) + 1, r0 = Math.min(...grp.map(g => g[1])), r1 = Math.max(...grp.map(g => g[1])) + 1;
      out.push({ cells: grp, c0, c1, r0, r1 });
    }
    return out;
  };
  // portões e alavancas (cada alavanca liga o portão mais perto)
  M.doors = groups('=').map((g, i) => ({ id: i, cells: g.cells, box: { x0: g.c0 * C + 0.15, x1: g.c1 * C - 0.15, y0: 0, y1: 4.2, z0: g.r0 * C + 0.15, z1: g.r1 * C - 0.15, k: 'door' }, open: true }));
  for (const L of M.levers) { let best = 0, bd = 1e9; M.doors.forEach((d, i) => { const dd = Math.hypot((d.box.x0 + d.box.x1) / 2 - L.x, (d.box.z0 + d.box.z1) / 2 - L.z); if (dd < bd) { bd = dd; best = i; } }); L.door = best; }
  // madeira quebrável
  M.breakables = groups('b').map((g, i) => ({ id: i, cells: g.cells, box: { x0: g.c0 * C + 0.3, x1: g.c1 * C - 0.3, y0: 0, y1: 3.6, z0: g.r0 * C + 0.3, z1: g.r1 * C - 0.3, k: 'wood', bid: i }, hp: 450, max: 450 }));
  // saída dos portais (célula andável ao lado)
  for (const k in M.portals) for (const P of M.portals[k]) {
    for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) { const ch = at(P.c + dx, P.r + dy); if (!SOLID_CH.includes(ch) && ch !== 'o' && ch !== 'P' && ch !== 'Q') { P.ex = (P.c + dx + 0.5) * C; P.ez = (P.r + dy + 0.5) * C; break; } }
  }
  const spawnCells = ch => { const o = []; for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === ch) o.push([c, r]); return o; };
  M.spawnT = spawnCells('T'); M.spawnD = spawnCells('D');
  // nomes de região (HUD): primeiro os nomes definidos no mapa, depois um nome automático
  const named = {};
  for (const [n, x0, y0, x1, y1] of (def.callouts || [])) for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) named[c + ',' + r] = n;
  M.callout = [];
  for (let r = 0; r < H; r++) { M.callout.push([]); for (let c = 0; c < W; c++) {
    const ch = at(c, r); let n = named[c + ',' + r] || '';
    if (n) { M.callout[r].push(n); continue; }
    if (M.sites[ch]) n = 'Site ' + ch; else if (ch === 'T') n = 'Spawn do Ataque'; else if (ch === 'D') n = 'Spawn da Defesa';
    else if (ch === 'P' || ch === 'Q') n = 'Portal';
    else { let best = null, bd = 1e9; for (const s of M.siteIds) { const d = Math.hypot(M.sites[s].x / C - c, M.sites[s].z / C - r); if (d < bd) { bd = d; best = s; } } n = bd > 9 ? 'Meio' : 'Lado ' + best; }
    M.callout[r].push(n);
  } }
  M.W = W; M.H = H; M.staticSolids = solids; M.renderBoxes = render; M.at = at;
  M.cellOf = (x, z) => [Math.floor(x / C), Math.floor(z / C)];
  M.chAt = (x, z) => { const [c, r] = M.cellOf(x, z); return at(c, r); };
  M.siteAt = (x, z) => { const ch = M.chAt(x, z); return M.sites[ch] ? ch : null; };
  M.calloutAt = (x, z) => { const [c, r] = M.cellOf(x, z); return (M.callout[r] && M.callout[r][c]) || ''; };
  M.breakAt = (c, r) => M.breakables.find(b => b.hp > 0 && b.cells.some(q => q[0] === c && q[1] === r));
  M.doorAt = (c, r) => M.doors.find(d => !d.open && d.cells.some(q => q[0] === c && q[1] === r));
  M.walk = (c, r) => { const ch = at(c, r); if (SOLID_CH.includes(ch) || ch === 'o') return false; if (ch === 'b' && M.breakAt(c, r)) return false; if (ch === '=' && M.doorAt(c, r)) return false; return true; };
  M.solidList = () => solids.concat(M.doors.filter(d => !d.open).map(d => d.box), M.breakables.filter(b => b.hp > 0).map(b => b.box));
  return M;
}
// estado inicial do mapa (portões abertos, madeira inteira) — a cada round
function resetWorld(M) { for (const d of M.doors) d.open = true; for (const b of M.breakables) b.hp = b.max; }

// A* na grade (8 direções, sem cortar quinas; portais contam como ligação)
function navPath(M, sx, sz, tx, tz) {
  const C = M.cell, W = M.W;
  let [a, b] = M.cellOf(sx, sz), [c, d] = M.cellOf(tx, tz);
  const near = (q0, r0, rad) => { let best = null, bd = 1e9; for (let r = r0 - rad; r <= r0 + rad; r++) for (let q = q0 - rad; q <= q0 + rad; q++) if (M.walk(q, r)) { const dd = (q - q0) ** 2 + (r - r0) ** 2; if (dd < bd) { bd = dd; best = [q, r]; } } return best; };
  if (!M.walk(c, d)) { const n = near(c, d, 3); if (!n) return null; [c, d] = n; }
  if (!M.walk(a, b)) { const n = near(a, b, 2); if (!n) return null; [a, b] = n; }
  const key = (q, r) => r * W + q, start = key(a, b), goal = key(c, d);
  const g = new Map([[start, 0]]), came = new Map(), closed = new Set();
  const hf = k => Math.hypot(k % W - c, Math.floor(k / W) - d);
  // fila de prioridade (heap binário)
  const hp = [[hf(start), start]];
  const push = it => { hp.push(it); let i = hp.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (hp[pi][0] <= hp[i][0]) break; [hp[pi], hp[i]] = [hp[i], hp[pi]]; i = pi; } };
  const pop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hp.length && hp[l][0] < hp[m][0]) m = l; if (r < hp.length && hp[r][0] < hp[m][0]) m = r; if (m === i) break; [hp[m], hp[i]] = [hp[i], hp[m]]; i = m; } } return top; };
  while (hp.length) {
    const [, cur] = pop();
    if (cur === goal) break;
    if (closed.has(cur)) continue; closed.add(cur);
    const q = cur % W, r = Math.floor(cur / W);
    const nb = [];
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nq = q + dq, nr = r + dr; if (!M.walk(nq, nr)) continue;
      if (dq && dr && (!M.walk(q + dq, r) || !M.walk(q, r + dr))) continue;
      nb.push([nq, nr, dq && dr ? 1.414 : 1]);
    }
    const ch = M.at(q, r);
    if (M.portals[ch]) for (const P of M.portals[ch]) if (P.c !== q || P.r !== r) nb.push([P.c, P.r, 1]);
    for (const [nq, nr, cost] of nb) {
      const nk = key(nq, nr), ng = g.get(cur) + cost;
      if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); came.set(nk, cur); push([ng + hf(nk), nk]); }
    }
  }
  if (!came.has(goal) && start !== goal) return null;
  const path = []; let k = goal;
  while (k !== start) { path.push([(k % W + 0.5) * C, (Math.floor(k / W) + 0.5) * C]); k = came.get(k); }
  path.reverse();
  return path;
}
