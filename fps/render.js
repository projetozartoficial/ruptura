// =====================================================================
//  fps/render.js : desenho do mundo (mapa, objetos, personagens, arma)
// =====================================================================
const hash2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
// gira um ponto local (x,y,z) pelo yaw/pitch do modelo (frente = -z)
function rotYX(ry, rx, x, y, z) {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
  return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
}
// junta várias peças (caixas e esferas) num único desenho estático
function bakeMesh(boxes, balls) {
  const a = boxGeo(boxes), parts = [a];
  if (balls && balls.length) {
    const base = sphereGeo(8, 6), out = new Float32Array(base.length * balls.length);
    balls.forEach((b, k) => {
      for (let i = 0; i < base.length; i += 10) {
        const o = k * base.length + i;
        out[o] = base[i] * b.sx + b.x; out[o + 1] = base[i + 1] * b.sy + b.y; out[o + 2] = base[i + 2] * b.sz + b.z;
        out[o + 3] = base[i + 3]; out[o + 4] = base[i + 4]; out[o + 5] = base[i + 5];
        const sh = 0.75 + 0.25 * (base[i + 4] * 0.5 + 0.5);
        out[o + 6] = b.col[0] * sh; out[o + 7] = b.col[1] * sh; out[o + 8] = b.col[2] * sh; out[o + 9] = b.mat || 0;
      }
    });
    parts.push(out);
  }
  const n = parts.reduce((s, p) => s + p.length, 0), all = new Float32Array(n); let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return all;
}

// ---------------- carregar mapa: geometria, enfeites e luzes ----------------
function loadMap(id) {
  const def = FPS_MAPS[id] || FPS_MAPS.vesper;
  const M = App.M = buildWorld(def);
  const TH = def.theme, C = M.cell, boxes = M.renderBoxes.slice(), balls = [], lamps = [], glows = [];
  const at = M.at, wall = (c, r) => at(c, r) === '#';
  const floorish = (c, r) => !'#o'.includes(at(c, r));
  // paredes que dão para o chão: luminárias e enfeites
  let k = 0;
  for (let r = 1; r < M.H - 1; r++) for (let c = 1; c < M.W - 1; c++) {
    if (!floorish(c, r)) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!wall(c + dc, r + dr)) continue;
      const h = hash2(c * 3 + dc, r * 5 + dr); k++;
      const wx = (c + 0.5) * C + dc * (C / 2 - 0.02), wz = (r + 0.5) * C + dr * (C / 2 - 0.02);
      if (h < 0.09) { // luminária
        lamps.push({ x: wx - dc * 0.12, y: 3.1, z: wz - dr * 0.12, col: id === 'forja' ? [1, 0.55, 0.25] : id === 'zenite' ? [0.5, 0.95, 1] : id === 'mosteiro' ? [0.8, 0.6, 1] : [1, 0.85, 0.55] });
        boxes.push({ x: wx - dc * 0.12 - 0.08, y: 2.9, z: wz - dr * 0.12 - 0.08, w: 0.16, h: 0.12, d: 0.16, col: [0.15, 0.14, 0.14], mat: 4 });
      } else if (h < 0.17 && (id === 'vesper' || id === 'mosteiro')) { // estandarte
        const col = id === 'vesper' ? [0.62, 0.14, 0.12] : [0.36, 0.22, 0.6];
        boxes.push({ x: wx - (dc ? dc * 0.06 : 0.45), y: 1.6, z: wz - (dr ? dr * 0.06 : 0.45), w: dc ? 0.06 : 0.9, h: 2.4, d: dr ? 0.06 : 0.9, col, mat: 0 });
        boxes.push({ x: wx - (dc ? dc * 0.07 : 0.3), y: 2.6, z: wz - (dr ? dr * 0.07 : 0.3), w: dc ? 0.06 : 0.6, h: 0.5, d: dr ? 0.06 : 0.6, col: [0.95, 0.8, 0.35], mat: 0 });
      } else if (h < 0.3 && id === 'jardim') { // trepadeiras
        boxes.push({ x: wx - (dc ? dc * 0.05 : 0.6), y: 0.3 + h * 4, z: wz - (dr ? dr * 0.05 : 0.6), w: dc ? 0.1 : 1.2, h: 2.5, d: dr ? 0.1 : 1.2, col: [0.22, 0.45, 0.16], mat: 5 });
      } else if (h < 0.22 && id === 'forja') { // canos
        boxes.push({ x: wx - (dc ? dc * 0.15 : 1), y: 3.8, z: wz - (dr ? dr * 0.15 : 1), w: dc ? 0.25 : 2, h: 0.25, d: dr ? 0.25 : 2, col: [0.35, 0.3, 0.28], mat: 4 });
        glows.push({ x: wx - dc * 0.3, y: 0.02, z: wz - dr * 0.3, w: dc ? 0.15 : 1.6, h: 0.02, d: dr ? 0.15 : 1.6, col: [1, 0.4, 0.1] });
      }
    }
  }
  // enfeites no topo das paredes
  for (const s of M.staticSolids) {
    if (s.k !== 'wall') continue;
    if (id === 'picos') boxes.push({ x: s.x0 + 0.05, y: s.y1 - 0.05, z: s.z0 + 0.05, w: s.x1 - s.x0 - 0.1, h: 0.35, d: s.z1 - s.z0 - 0.1, col: [0.96, 0.98, 1], mat: 0 });
    if (id === 'jardim') for (let i = 0; i < 3; i++) balls.push({ x: s.x0 + hash2(s.x0, i) * (s.x1 - s.x0), y: s.y1 + 0.2, z: s.z0 + hash2(s.z0, i + 4) * (s.z1 - s.z0), sx: 1.6, sy: 1.0, sz: 1.6, col: [0.24, 0.45, 0.2], mat: 5 });
  }
  // moitas (Jardim)
  for (const b of M.bushes) for (let i = 0; i < 3; i++) {
    const h = hash2(b.c + i, b.r * 3 + i);
    balls.push({ x: (b.x0 + b.x1) / 2 + (h - 0.5) * 1.1, y: 0.75 + i * 0.12, z: (b.z0 + b.z1) / 2 + (hash2(b.r, i) - 0.5) * 1.1, sx: 1.6 + h * 0.5, sy: 1.9, sz: 1.6 + h * 0.4, col: [0.2 + h * 0.08, 0.42 + h * 0.1, 0.16], mat: 5 });
  }
  // vitórias-régias e juncos (Lagos)
  if (id === 'lagos') for (let r = 0; r < M.H; r++) for (let c = 0; c < M.W; c++) if (at(c, r) === 'w') {
    const h = hash2(c, r); if (h < 0.35) boxes.push({ x: c * C + h * 1.4, y: 0.01, z: r * C + hash2(r, c) * 1.4, w: 0.55, h: 0.03, d: 0.55, col: [0.3, 0.55, 0.22], mat: 0 });
  }
  // bordas do abismo brilhando (Zênite)
  for (let r = 0; r < M.H; r++) for (let c = 0; c < M.W; c++) if (at(c, r) === 'o') {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (floorish(c + dc, r + dr) && at(c + dc, r + dr) !== 'o') glows.push({ x: (c + 0.5) * C + dc * C / 2 - (dc ? 0.05 : C / 2), y: -0.05, z: (r + 0.5) * C + dr * C / 2 - (dr ? 0.05 : C / 2), w: dc ? 0.1 : C, h: 0.06, d: dr ? 0.1 : C, col: [0.4, 0.95, 1] });
  }
  // portais: arco de pedra
  for (const k2 in M.portals) for (const P of M.portals[k2]) {
    boxes.push({ x: P.x - 1.0, y: 0, z: P.z - 1.0, w: 0.3, h: 3.4, d: 2.0, col: TH.trim, mat: 2 }, { x: P.x + 0.7, y: 0, z: P.z - 1.0, w: 0.3, h: 3.4, d: 2.0, col: TH.trim, mat: 2 }, { x: P.x - 1.0, y: 3.4, z: P.z - 1.0, w: 2.0, h: 0.3, d: 2.0, col: TH.trim, mat: 2 });
  }
  App.mapMesh = gl.mesh(bakeMesh(boxes, balls));
  App.lamps = lamps; App.glows = glows;
  // cristais flutuando (Zênite) e brasas (Forja)
  App.floaters = [];
  if (id === 'zenite') for (let r = 0; r < M.H; r++) for (let c = 0; c < M.W; c++) if (at(c, r) === 'o' && hash2(c, r) < 0.25) App.floaters.push({ x: (c + 0.5) * C, y: -2 - hash2(r, c) * 6, z: (r + 0.5) * C, s: 0.5 + hash2(c * 2, r) * 0.8, ph: hash2(c, r * 2) * 6 });
  gl.setTheme(TH, M.W * C, M.H * C);
  gl.fogD = id === 'lagos' ? 0.007 : id === 'forja' ? 0.014 : 0.010;
  App.mapId = def.id;
  return M;
}

// ---------------- personagens ----------------
function drawPlayer(p, T) {
  const HC = HUNTERS[p.hunter], C = HC.cores, col = k => hex3(C[k]), cls = HC.classe;
  const h = App.G.height(p), k = h / PH.H, ry = -p.yaw, cy = Math.cos(ry), sy = Math.sin(ry);
  const L = (lx, ly, lz) => [p.x + cy * lx + sy * lz, p.y + ly, p.z - sy * lx + cy * lz];
  const part = (lx, ly, lz, sx, sy_, sz, c, rx = 0, o = {}) => { const [x, y, z] = L(lx, ly, lz); gl.box(x, y, z, sx, sy_, sz, c, Object.assign({ ry, rx }, o)); };
  const mv = Math.hypot(p.vx, p.vz), ph = T * 10 + p.id, sw = mv > 0.8 ? Math.sin(ph) * Math.min(0.6, mv / 8) : 0;
  const legH = 0.84 * k, hip = legH;
  // pernas (coxa + canela + bota)
  for (const sd of [-1, 1]) {
    const a = sw * sd;
    const [kx, ky, kz] = [sd * 0.12, hip - 0.22 * Math.cos(a), Math.sin(a) * 0.22];
    part(sd * 0.12, hip - 0.2, Math.sin(a) * 0.1, 0.17, 0.42 * k, 0.19, col('roupa2'), a);
    part(kx, (ky - 0.03) / 2 + 0.02, kz * 1.4, 0.15, Math.max(0.1, ky - 0.05), 0.17, col('roupa2'), a * 0.4);
    part(sd * 0.12, 0.06, kz * 1.4 - 0.03, 0.17, 0.12, 0.27, [0.12, 0.11, 0.12]);
  }
  // quadril, tronco e peito
  part(0, hip + 0.04, 0, 0.42, 0.14, 0.24, [0.15, 0.14, 0.15]);
  part(0, hip + 0.37, 0, 0.48, 0.52, 0.28, col('roupa'));
  part(0, hip + 0.45, -0.145, 0.36, 0.3, 0.02, col('detalhe'));
  part(0, hip + 0.12, -0.13, 0.46, 0.05, 0.03, col('detalhe'));
  // ombros (vanguarda tem ombreiras grandes)
  const big = cls === 'vanguarda';
  for (const sd of [-1, 1]) part(sd * (big ? 0.31 : 0.27), hip + 0.6, 0, big ? 0.26 : 0.18, big ? 0.16 : 0.12, big ? 0.34 : 0.26, big ? [0.55, 0.56, 0.6] : col('roupa2'), 0, big ? { mat: 4 } : {});
  // capa/cachecol por classe
  if (cls === 'controlador') part(0, hip + 0.2, 0.18, 0.46, 0.8, 0.04, col('roupa2'), 0.12 + Math.sin(T * 3 + p.id) * 0.05);
  if (cls === 'lutador') part(0.12, hip + 0.45, 0.17, 0.12, 0.5, 0.04, col('detalhe'), 0.3 + sw * 0.3);
  // cabeça
  part(0, h - 0.33, 0, 0.12, 0.08, 0.12, col('pele'));
  part(0, h - 0.17, 0, 0.27, 0.29, 0.28, col('pele'));
  part(0, h - 0.04, 0.03, 0.31, 0.12, 0.32, col('cabelo'));
  part(0, h - 0.12, 0.13, 0.29, 0.2, 0.06, col('cabelo'));
  if (cls === 'iniciador') part(0, h - 0.08, 0.05, 0.34, 0.3, 0.34, col('roupa2'));
  part(0, h - 0.16, -0.145, 0.22, 0.05, 0.02, cls === 'protetor' ? col('detalhe') : [0.08, 0.08, 0.1], 0, cls === 'protetor' ? { emis: 0.8 } : {});
  if (cls === 'protetor') part(0, h + 0.12, 0, 0.36, 0.03, 0.36, col('detalhe'), 0, { emis: 0.9, cast: false });
  // braços apontando para a mira
  const ap = p.pitch, W = App.G.curW(p);
  const sh = [0.27, hip + 0.55, -0.02];
  const arm = (sd, reach) => {
    const ux = sd * 0.27, uy = hip + 0.52;
    const o = rotYX(0, ap, 0, 0, -reach / 2);
    part(ux + (sd > 0 ? -0.02 : 0.12), uy + o[1], o[2], 0.12, 0.12, reach, col('roupa'), ap);
    const e = rotYX(0, ap, 0, 0, -reach);
    part(ux + (sd > 0 ? -0.02 : 0.12), uy + e[1], e[2], 0.11, 0.11, 0.1, col('roupa2'), ap);
  };
  arm(1, 0.42); arm(-1, 0.5);
  // arma
  if (W) {
    const gx = 0.13, gy = hip + 0.5, gz = -0.4;
    for (const q of W.parts) {
      const [ox, oy, oz] = rotYX(0, ap, q[0] * 1.15, q[1] * 1.15, q[2] * 1.15);
      part(gx + ox, gy + oy, gz + oz, q[3] * 1.15, q[4] * 1.15, q[5] * 1.15, q[6], ap);
    }
  }
  if (p.nucleo) part(0, hip + 0.35, 0.24, 0.28, 0.32, 0.16, [0.4, 0.95, 1], 0, { emis: 0.6 });
}

// ---------------- mundo ----------------
function drawWorld(T, dt) {
  const G = App.G, me = App.me, M = G.M;
  gl.draw(App.mapMesh);
  // portões (sobem quando abertos)
  for (const d of M.doors) {
    d.anim = d.anim ?? (d.open ? 1 : 0); d.anim += ((d.open ? 1 : 0) - d.anim) * Math.min(1, dt * 4);
    const b = d.box, hgt = b.y1 - b.y0, y = (b.y0 + b.y1) / 2 + d.anim * (hgt - 0.3);
    gl.box((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2, b.x1 - b.x0, hgt, b.z1 - b.z0, [0.42, 0.45, 0.5], { mat: 4 });
    gl.box((b.x0 + b.x1) / 2, y - hgt / 2 + 0.1, (b.z0 + b.z1) / 2, b.x1 - b.x0 + 0.04, 0.12, b.z1 - b.z0 + 0.04, [1, 0.75, 0.2], { emis: 0.7 });
  }
  for (const L of M.levers) {
    const d = M.doors[L.door], on = d && d.open;
    gl.box(L.x, 0.5, L.z, 0.25, 1.0, 0.25, [0.3, 0.3, 0.32], { mat: 4 });
    gl.box(L.x, 1.1, L.z, 0.08, 0.5, 0.08, on ? [0.3, 1, 0.4] : [1, 0.3, 0.3], { emis: 0.8, rx: on ? 0.6 : -0.6 });
  }
  // madeira quebrável
  for (const b of M.breakables) if (b.hp > 0) {
    const B = b.box, f = 0.55 + 0.45 * b.hp / b.max;
    gl.box((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2, B.x1 - B.x0, B.y1 - B.y0, B.z1 - B.z0, [0.62 * f, 0.42 * f, 0.24 * f], { mat: 3 });
  }
  // luminárias
  for (const l of App.lamps) gl.box(l.x, l.y, l.z, 0.14, 0.2, 0.14, l.col, { emis: 1, cast: false });
  for (const l of App.glows) gl.box(l.x + l.w / 2, l.y, l.z + l.d / 2, l.w, l.h, l.d, l.col, { emis: 1, cast: false });
  for (const f of App.floaters) gl.box(f.x, f.y + Math.sin(T + f.ph) * 0.5, f.z, f.s * 0.6, f.s * 1.4, f.s * 0.6, [0.45, 0.95, 1], { emis: 0.85, ry: T * 0.4 + f.ph, cast: false });
  // jogadores (inimigos só se visíveis)
  App.vis = new Set();
  for (const p of G.players) {
    if (p === me && me.alive) continue;
    if (!p.alive) { if (p.body) { const c = hex3(HUNTERS[p.hunter].cores.roupa); gl.box(p.body.x, 0.14, p.body.z, 0.55, 0.26, 1.5, c, { ry: -p.body.yaw }); gl.box(p.body.x - Math.sin(p.body.yaw) * 0.85, 0.15, p.body.z + Math.cos(p.body.yaw) * 0.85, 0.28, 0.28, 0.28, hex3(HUNTERS[p.hunter].cores.pele), { ry: -p.body.yaw }); } continue; }
    const ally = p.team === me.team;
    if (!ally && !(G.canSee(me.alive ? me : (App.spec || me), p) || p.revealT > 0 || G.revealTeam[me.team] > 0)) continue;
    App.vis.add(p.id);
    drawPlayer(p, T);
  }
  // Núcleo
  if (G.nucleo) {
    const n = G.nucleo, pl = n.planted, pulse = pl ? (Math.sin(T * (6 + (RULES.nucleoTime - G.phaseT) * 0.4)) * 0.5 + 0.5) : 0.4;
    gl.box(n.x, 0.2, n.z, 0.6, 0.4, 0.6, [0.2, 0.22, 0.28], { ry: 0.6, mat: 4 });
    for (let i = 0; i < 4; i++) gl.box(n.x + Math.cos(T + i * 1.57) * 0.32, 0.45, n.z + Math.sin(T + i * 1.57) * 0.32, 0.08, 0.3, 0.08, [0.3, 0.9, 1], { emis: 0.8 });
    gl.box(n.x, 0.68, n.z, 0.3, 0.36, 0.3, [0.4, 0.95, 1], { emis: 0.6 + pulse * 0.4, ry: -T * 2, cast: false });
  }
  // armas no chão
  for (const d of G.drops) { const W = WEAPONS[d.g.id]; for (const q of W.parts) { const [ox, oy, oz] = rotYX(d.t * 2, 0, q[0], q[1], q[2]); gl.box(d.x + ox, 0.1 + oy * 0.4, d.z + oz, q[3], q[4], q[5], q[6], { ry: d.t * 2 }); } }
  // granadas
  for (const g of G.grenades) gl.box(g.x, g.y, g.z, 0.2, 0.2, 0.2, g.kind === 'rocket' || g.kind === 'meteor' ? [1, 0.5, 0.2] : g.kind === 'flash' ? [1, 1, 0.9] : [0.35, 0.36, 0.4], { emis: ['rocket', 'flash', 'meteor', 'flare'].includes(g.kind) ? 1 : 0, ry: T * 8, cast: false });
  // barreiras sólidas
  for (const w of G.temp) if (w.solid) {
    const c = { iron: [0.45, 0.48, 0.52], sand: [0.85, 0.7, 0.45], shield: [0.65, 0.75, 0.95], barrier: [1, 0.88, 0.5] }[w.kind] || [1, 0.88, 0.5];
    gl.box((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2, w.x1 - w.x0, w.y1 - w.y0, w.z1 - w.z0, c, { emis: w.kind === 'barrier' || w.kind === 'shield' ? 0.35 : 0, mat: w.kind === 'iron' ? 4 : w.kind === 'sand' ? 2 : undefined });
  }
  // efeitos transparentes
  gl.blend(true);
  for (const k2 in M.portals) for (const P of M.portals[k2]) {
    const c = k2 === 'P' ? [0.6, 0.4, 1] : [0.3, 0.9, 1];
    gl.box(P.x, 1.7, P.z, 1.35, 3.3, 1.35, c, { a: 0.35 + Math.sin(T * 3) * 0.08, emis: 1, ry: T * 0.5 });
  }
  for (const z of G.zones) {
    if ((z.kind === 'alarm' || z.kind === 'web') && z.team !== me.team) continue; // armadilhas escondidas do inimigo
    if (z.kind === 'alarm') { gl.box(z.x, 0.25, z.z, 0.35, 0.5, 0.35, [1, 0.85, 0.3], { emis: 0.6 }); continue; }
    if (z.kind === 'web') { gl.box(z.x, 0.05, z.z, z.r * 2, 0.04, 0.06, [0.85, 0.6, 1], { emis: 0.8, a: 0.7 }); continue; }
    const c = { fire: [1, 0.45, 0.1], flood: [0.2, 0.5, 0.9], slow: [1, 0.9, 0.4], storm: [0.6, 0.4, 1], roots: [0.3, 0.7, 0.2], spores: [0.6, 0.9, 0.2], sand: [0.85, 0.7, 0.4], vortex: [0.9, 0.75, 0.45], swarm: [0.75, 0.85, 0.2], bigweb: [0.85, 0.65, 1], eye: [0.5, 1, 0.9], puddle: [0.2, 0.6, 1] }[z.kind] || [0.2, 0.6, 1];
    gl.ball(z.x, 0.02, z.z, z.r * 2, 0.12, z.r * 2, c, { a: 0.4, emis: 0.6 });
    if ((z.kind === 'storm' || z.kind === 'vortex') && Math.random() < 0.4) App.parts.push({ x: z.x + rnd(-z.r, z.r) * 0.7, y: rnd(0.5, 4), z: z.z + rnd(-z.r, z.r) * 0.7, vx: rnd(-2, 2), vy: z.kind === 'storm' ? -6 : 2, vz: rnd(-2, 2), t: 0.5, T: 0.5, col: c, s: 0.08, glow: 1 });
    if (z.kind === 'fire' && Math.random() < 0.6) App.parts.push({ x: z.x + rnd(-z.r, z.r) * 0.7, y: 0.1, z: z.z + rnd(-z.r, z.r) * 0.7, vx: 0, vy: rnd(1, 3), vz: 0, t: 0.6, T: 0.6, col: [1, 0.6, 0.15], s: 0.15, glow: 1 });
  }
  for (const w of G.temp) if (!w.solid) gl.box((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2, w.x1 - w.x0, w.y1 - w.y0, w.z1 - w.z0, [0.25, 0.55, 0.85], { a: 0.75, emis: 0.3 });
  for (const s of G.smokes) {
    const f = Math.min(1, (s.T - s.t) / 0.6, s.t / 0.8);
    const c = [[0.72, 0.8, 0.9], [0.85, 0.9, 0.95], [0.35, 0.6, 0.3], [0.85, 0.72, 0.5], [0.55, 0.38, 0.75]][s.col || 0];
    for (let i = 0; i < 3; i++) gl.ball(s.x + Math.sin(T * 0.3 + i * 2) * 0.3, s.y - i * 0.2, s.z + Math.cos(T * 0.3 + i * 2) * 0.3, s.r * 2 * f * (1 - i * 0.1), s.r * 1.8 * f * (1 - i * 0.1), s.r * 2 * f * (1 - i * 0.1), c, { a: 0.6 + i * 0.15, ry: i * 0.5 + T * 0.1 });
  }
  gl.blend(false);
  // traçantes e partículas (aditivo)
  gl.additive(true);
  for (const t of G.tracers) {
    const dx = t.x1 - t.x0, dy = t.y1 - t.y0, dz = t.z1 - t.z0, l = Math.hypot(dx, dy, dz);
    if (l < 0.5) continue;
    const tw = t.bolt ? 0.09 : t.chain ? 0.06 : 0.02;
    gl.boxM(M4.trs((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, (t.z0 + t.z1) / 2, Math.atan2(dx, dz), -Math.asin(dy / l), 0, tw, tw, l), t.bolt ? [0.7, 0.6, 1] : t.chain ? [0.6, 0.65, 0.7] : [1, 0.85, 0.5], { emis: 1, a: 0.75 });
  }
  for (const q of App.parts) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= (q.glow ? -1 : 9) * dt; if (q.y < 0 && M.chAt(q.x, q.z) !== 'o') { q.y = 0; q.vy *= -0.3; } gl.box(q.x, q.y, q.z, q.s, q.s, q.s, q.col, { emis: 1, a: Math.max(0, q.t / q.T) }); }
  App.parts = App.parts.filter(q => q.t > 0);
  gl.additive(false);
}

// ---------------- arma em primeira pessoa ----------------
function drawViewmodel(T, dt) {
  const me = App.me, G = App.G; if (!me.alive) return;
  const W = G.curW(me); if (W && W.zoom && me.zoom) return;
  gl.viewmodel(68 * Math.PI / 180);
  const mv = Math.min(1, Math.hypot(me.vx, me.vz) / MOVE.run);
  App.bobT += dt * mv * 9;
  App.kick = Math.max(0, App.kick - dt * 10);
  const bx = Math.sin(App.bobT) * 0.01 * mv, by = -Math.abs(Math.cos(App.bobT)) * 0.012 * mv + Math.sin(T * 1.6) * 0.002;
  const id = me.cur === 3 ? 'faca' : me.guns[me.cur] ? me.guns[me.cur].id : 'lasca', WW = WEAPONS[id];
  const sw = me.switchT > 0 ? me.switchT * 0.45 : 0;
  const rf = me.reloadT > 0 && WW.reload ? Math.sin(Math.min(1, 1 - me.reloadT / WW.reload) * Math.PI) : 0;
  const VS = 0.42, ox = 0.12 + bx, oy = -0.105 + by - sw - rf * 0.05, oz = -0.24 + App.kick * 0.02;
  const rx = App.kick * 0.09 + rf * 0.35, rz = rf * 0.5, ryy = -0.04;
  const C = HUNTERS[me.hunter].cores, glove = hex3(C.roupa2), sleeve = hex3(C.roupa);
  const put = (x, y, z, sx, sy, sz, col, o = {}) => {
    const [px, py, pz] = rotYX(ryy, rx, x * VS, y * VS, z * VS);
    gl.box(ox + px, oy + py, oz + pz, sx * VS, sy * VS, sz * VS, col, Object.assign({ ry: ryy, rx, rz }, o));
  };
  for (const q of WW.parts) put(q[0], q[1], q[2], q[3], q[4], q[5], q[6]);
  // mãos e mangas
  put(0.0, -0.075, 0.02, 0.06, 0.07, 0.09, glove);
  put(0.02, -0.1, 0.12, 0.065, 0.065, 0.16, sleeve);
  if (id !== 'faca') {
    const fz = WW.cat === 'Pistolas' ? -0.04 : -WW.len * 0.45;
    put(-0.035, -0.035, fz, 0.06, 0.06, 0.09, glove);
    put(-0.08, -0.085, fz + 0.14, 0.065, 0.065, 0.2, sleeve);
  }
  if (App.flash > 0 && id !== 'faca') {
    App.flash -= dt; gl.additive(true);
    const L = WW.len; put(0, 0.02, -L - 0.06, 0.1, 0.1, 0.12, [1, 0.8, 0.4], { emis: 1, a: 0.9 });
    gl.additive(false);
  }
}
