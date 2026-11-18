// =====================================================================
//  ai.js : bots (preenchem vagas vazias)
// =====================================================================

const NAV = (() => {
  const C = 40, GW = Math.ceil(WORLD_W / C), GH = Math.ceil(WORLD_H / C);
  const block = new Uint8Array(GW * GH);
  function rebuild() {
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * C + C / 2, y = gy * C + C / 2;
      let b = !inIsland(x, y, 26);
      if (!b) for (const o of MAP_OBS) if (pointInSolid(o, x, y, 28)) { b = true; break; }
      if (!b) for (const f of FEATURES) if (f.f === 'lava' && inFeature(f, x, y, 26)) { b = true; break; }
      block[gy * GW + gx] = b ? 1 : 0;
    }
  }
  rebuild();
  mapHooks.push(rebuild);
  function cell(x, y) { return [clamp(Math.floor(x / C), 0, GW - 1), clamp(Math.floor(y / C), 0, GH - 1)]; }
  function nearestFree(gx, gy) {
    if (!block[gy * GW + gx]) return [gx, gy];
    for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH && !block[y * GW + x]) return [x, y];
    }
    return [gx, gy];
  }
  function path(sx, sy, tx, ty) {
    let [ax, ay] = nearestFree(...cell(sx, sy));
    let [bx, by] = nearestFree(...cell(tx, ty));
    const N = GW * GH, start = ay * GW + ax, goal = by * GW + bx;
    const g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    g[start] = 0;
    const h = i => { const x = i % GW, y = (i / GW) | 0, dx = Math.abs(x - bx), dy = Math.abs(y - by); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    const f = new Float32Array(N).fill(1e9); f[start] = h(start);
    // fila de prioridade (heap binário)
    const heap = [start];
    const push = v => { heap.push(v); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let iter = 0;
    while (heap.length && iter++ < 3000) {
      const cur = pop();
      if (cur === goal) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % GW, cy = (cur / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (block[ni] || closed[ni]) continue;
        if (dx && dy && (block[cy * GW + nx] || block[ny * GW + cx])) continue;
        const ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; f[ni] = ng + h(ni); came[ni] = cur; push(ni); }
      }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const pts = [];
    for (let i = goal; i !== start && i >= 0; i = came[i]) pts.push({ x: (i % GW) * C + C / 2, y: ((i / GW) | 0) * C + C / 2 });
    pts.reverse();
    pts.push({ x: tx, y: ty });
    return pts;
  }
  return { path, C, rebuild };
})();

function clearLine(sim, ax, ay, bx, by, r) {
  const d = dist(ax, ay, bx, by); if (d < 1) return true;
  const ux = (bx - ax) / d, uy = (by - ay) / d, px = -uy * r, py = ux * r;
  for (const s of [0, 1, -1]) if (castRay(sim.solids, ax + px * s, ay + py * s, ux, uy, d, true) < d - 1) return false;
  for (const f of FEATURES) if (f.f === 'lava') for (let t = 0; t <= 1; t += 0.1) if (inFeature(f, ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false;
  return true;
}

const ROLE = {
  brasa: { range: 430, aggro: 0.8 },
  corvo: { range: 380, aggro: 1.0 },
  mare: { range: 560, aggro: 0.5 },
  lumi: { range: 540, aggro: 0.3 },
  rocha: { range: 110, aggro: 1.0 },
  lamina: { range: 200, aggro: 1.0 },
  trovao: { range: 380, aggro: 0.9 },
  vinha: { range: 560, aggro: 0.5 },
  sino: { range: 420, aggro: 0.4 },
  ancora: { range: 180, aggro: 1.0 },
  serra: { range: 680, aggro: 0.4 },
  fera: { range: 90, aggro: 1.0 },
  duna: { range: 560, aggro: 0.5 },
  elo: { range: 450, aggro: 0.4 },
  bisao: { range: 110, aggro: 1.0 },
  vespa: { range: 480, aggro: 0.7 },
  cometa: { range: 400, aggro: 0.9 },
  teia: { range: 540, aggro: 0.5 },
  brisa: { range: 470, aggro: 0.4 },
  egide: { range: 110, aggro: 1.0 },
};
const PROJ_SPEED = { brasa: 960, corvo: 1150, mare: 760, lumi: 980, rocha: 9999, lamina: 950, trovao: 1050, vinha: 850, sino: 850, ancora: 900, serra: 1700, fera: 9999, duna: 820, elo: 900, bisao: 9999, vespa: 1250, cometa: 1000, teia: 880, brisa: 960, egide: 9999 };
const MELEE = { rocha: 1, ancora: 1, lamina: 1, fera: 1, bisao: 1, egide: 1 };

function botThink(sim, p, dt) {
  const inp = p.input;
  inp.fire = inp.q = inp.e = inp.r = inp.dash = false;
  if (!p.alive) { inp.mx = inp.my = 0; return; }
  const B = p.brain || (p.brain = { path: null, pathT: 0, goal: null, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, lastX: p.x, lastY: p.y, stuckT: 0, reactT: 0, aimErr: 0, lastSeen: null });
  const role = ROLE[p.hunter];
  const allies = sim.players.filter(a => a.team === p.team && a.alive && a !== p);
  const deadAllies = sim.players.filter(a => a.team === p.team && !a.alive);

  // inimigo alvo: visível, mais perto e de vida baixa
  let target = null, tScore = 1e9;
  for (const e of sim.players) {
    if (e.team === p.team || !e.alive || !sim.canSee(p.team, e)) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    const s = d * (0.55 + 0.45 * e.hp / e.maxHp);
    if (s < tScore) { tScore = s; target = e; }
  }
  if (target) B.lastSeen = { x: target.x, y: target.y, t: sim.time };
  B.strafeT -= dt;
  if (B.strafeT <= 0) { B.strafe *= -1; B.strafeT = rnd(0.5, 1.4); }

  const hpF = p.hp / p.maxHp;
  const stormD = dist(p.x, p.y, sim.storm.x, sim.storm.y);
  const outStorm = stormD > sim.storm.r - 90;

  // ---------- decidir para onde ir ----------
  let goal = null, directMove = null;
  if (outStorm) goal = { x: sim.storm.x + (p.x - sim.storm.x) * 0.3, y: sim.storm.y + (p.y - sim.storm.y) * 0.3 };
  else if (target) {
    const d = dist(p.x, p.y, target.x, target.y);
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    let want = role.range;
    if (hpF < 0.3 && !MELEE[p.hunter]) want = role.range + 250;
    if (p.hunter === 'lumi' && allies.length) {
      const hurt = allies.reduce((m, a) => (a.hp / a.maxHp < m.hp / m.maxHp ? a : m), allies[0]);
      goal = { x: hurt.x - Math.cos(ang) * 120, y: hurt.y - Math.sin(ang) * 120 };
    }
    if (!goal) {
      const los = sim.los(p.x, p.y, target.x, target.y);
      if (!los) goal = { x: target.x, y: target.y };
      else {
        let fwd = d > want + 40 ? 1 : d < want - 60 ? -1 : 0;
        directMove = { x: Math.cos(ang) * fwd + Math.cos(ang + Math.PI / 2) * B.strafe * 0.75, y: Math.sin(ang) * fwd + Math.sin(ang + Math.PI / 2) * B.strafe * 0.75 };
      }
    }
  } else if (deadAllies.length && !outStorm) {
    const da = deadAllies.reduce((m, a) => dist(p.x, p.y, a.soulX, a.soulY) < dist(p.x, p.y, m.soulX, m.soulY) ? a : m, deadAllies[0]);
    if (dist(p.x, p.y, da.soulX, da.soulY) > 40) goal = { x: da.soulX, y: da.soulY };
  } else if (hpF < 0.55 && FEATURES.some(f => f.f === 'fountain')) { const f = FEATURES.find(f => f.f === 'fountain'); goal = { x: f.x, y: f.y }; }
  else if (FEATURES.some(f => f.f === 'bell') && sim.bell.cd <= 0 && p.slot % 4 < 2) { const f = FEATURES.find(f => f.f === 'bell'); goal = { x: f.x + (p.slot % 2 ? 30 : -30), y: f.y }; }
  else if (B.lastSeen && sim.time - B.lastSeen.t < 6) goal = { x: B.lastSeen.x, y: B.lastSeen.y };
  else {
    // avança em grupo rumo ao centro / lado inimigo
    const ex = p.team === 0 ? 1550 : 850;
    goal = { x: (sim.fightT < 8 ? ex : WORLD_W / 2) + (p.slot % 4 - 1.5) * 90, y: WORLD_H / 2 + (p.slot % 4 - 1.5) * 160 };
    if (stormD > sim.storm.r * 0.7) goal = { x: sim.storm.x, y: sim.storm.y };
  }

  let mx = 0, my = 0;
  if (directMove) { mx = directMove.x; my = directMove.y; B.path = null; }
  else if (goal) {
    if (dist(p.x, p.y, goal.x, goal.y) < 30) { mx = my = 0; }
    else if (clearLine(sim, p.x, p.y, goal.x, goal.y, p.r)) { mx = goal.x - p.x; my = goal.y - p.y; B.path = null; }
    else {
      B.pathT -= dt;
      if (!B.path || B.pathT <= 0 || !B.goal || dist(B.goal.x, B.goal.y, goal.x, goal.y) > 120) {
        B.path = NAV.path(p.x, p.y, goal.x, goal.y); B.pathT = 0.7; B.goal = goal;
      }
      if (B.path && B.path.length) {
        // pula para o ponto mais distante visível
        while (B.path.length > 1 && clearLine(sim, p.x, p.y, B.path[1].x, B.path[1].y, p.r * 0.8)) B.path.shift();
        const wp = B.path[0];
        if (dist(p.x, p.y, wp.x, wp.y) < 24 && B.path.length > 1) B.path.shift();
        mx = B.path[0].x - p.x; my = B.path[0].y - p.y;
      } else { mx = goal.x - p.x; my = goal.y - p.y; }
    }
  }
  // detecção de travamento
  if (dist(p.x, p.y, B.lastX, B.lastY) < 1.2 && (mx || my)) B.stuckT += dt; else B.stuckT = 0;
  B.lastX = p.x; B.lastY = p.y;
  if (B.stuckT > 0.5) { const a = Math.random() * Math.PI * 2; mx = Math.cos(a); my = Math.sin(a); B.path = null; B.stuckT = -0.3; }
  const ml = Math.hypot(mx, my);
  inp.mx = ml > 0.01 ? mx / ml : 0; inp.my = ml > 0.01 ? my / ml : 0;

  // ---------- mira ----------
  if (!target) {
    const lx = goal ? goal.x : p.x + Math.cos(p.aim) * 200, ly = goal ? goal.y : p.y + Math.sin(p.aim) * 200;
    inp.ax = lx; inp.ay = ly;
    // Lumi cura aliados machucados mesmo sem inimigo
    if (p.hunter === 'lumi') lumiSupport(sim, p, allies, null);
    return;
  }
  const d = dist(p.x, p.y, target.x, target.y);
  const lead = d / PROJ_SPEED[p.hunter];
  B.aimErr += (rnd(-1, 1) * 28 - B.aimErr) * 0.08;
  inp.ax = target.x + target.vx * lead * 0.85 + B.aimErr;
  inp.ay = target.y + target.vy * lead * 0.85 - B.aimErr;
  const los = sim.los(p.x, p.y, target.x, target.y);
  B.reactT -= dt;
  if (!los) return;
  if (B.reactT <= 0 && !B.engaged) { B.reactT = rnd(0.15, 0.35); B.engaged = true; return; }

  const range = { brasa: 740, corvo: 640, mare: 680, lumi: 700, rocha: 150, lamina: 320, trovao: 590, vinha: 660, sino: 500, ancora: 270, serra: 940, fera: 140, duna: 660, elo: 640, bisao: 150 }[p.hunter];
  if (d < range) inp.fire = true;
  const nearE = sim.players.filter(e => e.team !== p.team && e.alive && dist(e.x, e.y, target.x, target.y) < 220).length;

  switch (p.hunter) {
    case 'brasa':
      if (d < 360) inp.q = true;
      if (d > 300 && d < 600 && hpF > 0.5 && target.hp / target.maxHp < 0.5) inp.e = true;
      if (d < 780 && (nearE >= 2 || target.hp < 220)) inp.r = true;
      break;
    case 'corvo':
      if (d < 620 && d > 200) inp.q = true;
      if (d < 360 && target.hp / target.maxHp < 0.6) inp.e = true;
      if (d < 500 && hpF > 0.4) inp.r = true;
      break;
    case 'mare':
      if (d < 600) inp.q = true;
      if (hpF < 0.55 && d < 420) inp.e = true;
      if (d < 620 && (nearE >= 2 || hpF < 0.4)) inp.r = true;
      break;
    case 'lumi':
      lumiSupport(sim, p, allies, target);
      break;
    case 'rocha':
      if (d < 560 && d > 90) inp.q = true;
      if (hpF < 0.65 && d < 600) inp.e = true;
      if (d > 220 && d < 540 && (nearE >= 2 || hpF > 0.5)) { inp.r = true; }
      if (d > 260 && d < 700) inp.dash = Math.random() < 0.02;
      break;
  }
  switch (p.hunter) {
    case 'lamina':
      if (d < 300 && d > 80) inp.q = true;
      if (hpF < 0.6 && d < 400) inp.e = true;
      if (d < 220) inp.r = true;
      break;
    case 'trovao':
      if (d < 370 && d > 120) inp.q = true;
      if (d < 200) inp.e = true;
      if (d < 680 && (nearE >= 2 || target.hp < 260)) { inp.r = true; inp.ax = target.x + target.vx * 0.7; inp.ay = target.y + target.vy * 0.7; }
      break;
    case 'vinha':
      if (d < 600) inp.q = true;
      if (d < 580) { inp.e = true; }
      if (d < 600 && (nearE >= 2 || hpF < 0.5)) inp.r = true;
      break;
    case 'sino': {
      const hurt = allies.filter(a => a.hp / a.maxHp < 0.6 && dist(a.x, a.y, p.x, p.y) < 520).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (hurt.length && p.cd.q <= 0) { inp.ax = hurt[0].x; inp.ay = hurt[0].y; inp.q = true; inp.fire = false; }
      if (d < 180 || (hurt.length && dist(p.x, p.y, hurt[0].x, hurt[0].y) < 170)) inp.e = true;
      if (allies.concat([p]).filter(a => a.hp / a.maxHp < 0.6).length >= 2) inp.r = true;
      break;
    }
    case 'serra':
      if (d < 950) inp.q = true;
      if (d < 260) inp.e = true;
      if (d < 740 && (nearE >= 2 || target.hp < 200)) { inp.r = true; inp.ax = target.x; inp.ay = target.y; }
      break;
    case 'fera':
      if (d < 440 && d > 140) inp.q = true;
      if (d < 220) inp.e = true;
      if (d < 260 && hpF > 0.3) inp.r = true;
      break;
    case 'duna':
      if (d < 620) inp.q = true;
      if (hpF < 0.55 && d < 430) inp.e = true;
      if (d < 640 && nearE >= 2) inp.r = true;
      break;
    case 'elo': {
      const hurt = allies.filter(a => a.hp / a.maxHp < 0.65 && dist(a.x, a.y, p.x, p.y) < 600).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (hurt.length && p.cd.q <= 0) { inp.ax = hurt[0].x; inp.ay = hurt[0].y; inp.q = true; inp.fire = false; }
      if (allies.concat([p]).some(a => a.hp / a.maxHp < 0.55 && dist(a.x, a.y, p.x, p.y) < 230)) inp.e = true;
      const dead = sim.players.find(a => !a.alive && a.team === p.team && dist(a.soulX, a.soulY, p.x, p.y) < 700);
      if (dead && p.cd.r <= 0) { inp.ax = dead.soulX; inp.ay = dead.soulY; inp.r = true; inp.fire = false; }
      break;
    }
    case 'bisao':
      if (d < 450 && d > 120) inp.q = true;
      if (hpF < 0.65 && d < 400) inp.e = true;
      if (d < 240 && (nearE >= 2 || hpF > 0.4)) inp.r = true;
      break;
    case 'vespa':
      if (d < 600) inp.q = true;
      if (hpF < 0.4 && d < 280) { inp.e = true; inp.ax = p.x - (target.x - p.x); inp.ay = p.y - (target.y - p.y); }
      if (d < 680 && (nearE >= 2 || target.hp < 260)) { inp.r = true; inp.ax = target.x; inp.ay = target.y; }
      break;
    case 'cometa':
      if (d < 500 && d > 130) { inp.q = true; inp.ax = target.x; inp.ay = target.y; }
      if (hpF < 0.6 && d < 450) inp.e = true;
      if (d < 680 && (nearE >= 2 || target.hp < 300)) { inp.r = true; inp.ax = target.x; inp.ay = target.y; }
      break;
    case 'teia':
      if (d < 520 && Math.random() < 0.3) { inp.q = true; inp.ax = target.x + target.vx * 0.5; inp.ay = target.y + target.vy * 0.5; }
      if (hpF < 0.55 && (p.slowT > 0 || p.rootT > 0 || d < 300)) inp.e = true;
      if (d < 640 && nearE >= 2) inp.r = true;
      break;
    case 'brisa': {
      const near = allies.filter(a => dist(a.x, a.y, p.x, p.y) < 280);
      if (near.length >= 1 && d < 600) inp.q = true;
      if (d < 200) inp.e = true;
      if (allies.concat([p]).filter(a => a.hp / a.maxHp < 0.6 && dist(a.x, a.y, p.x, p.y) < 300).length >= 2) inp.r = true;
      break;
    }
    case 'egide':
      if (d < 420 && d > 120) inp.q = true;
      if (d < 270 && nearE >= 1) inp.e = true;
      if (d < 400 && (hpF < 0.6 || nearE >= 2)) inp.r = true;
      break;
    case 'ancora':
      if (d < 560 && d > 150) inp.q = true;
      if (hpF < 0.7 && d < 500) inp.e = true;
      if (d < 320 && (nearE >= 2 || hpF > 0.4)) inp.r = true;
      break;
  }
  if (hpF < 0.3 && d < 300 && !MELEE[p.hunter] && Math.random() < 0.05) {
    inp.dash = true; inp.mx = -Math.cos(Math.atan2(target.y - p.y, target.x - p.x)); inp.my = -Math.sin(Math.atan2(target.y - p.y, target.x - p.x));
  }
}

function lumiSupport(sim, p, allies, target) {
  const inp = p.input;
  const team = allies.concat([p]);
  const hurt = team.filter(a => a.hp / a.maxHp < 0.7).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  if (hurt.length && p.cd.q <= 0) { inp.ax = hurt[0].x; inp.ay = hurt[0].y; inp.q = true; return; }
  if (hurt.length && p.cd.e <= 0 && hurt[0].hp / hurt[0].maxHp < 0.6 && dist(p.x, p.y, hurt[0].x, hurt[0].y) < 520) { inp.ax = hurt[0].x; inp.ay = hurt[0].y; inp.e = true; return; }
  if (team.filter(a => a.hp / a.maxHp < 0.5).length >= 2) inp.r = true;
  // cura passando o raio por um aliado entre ela e o alvo
  if (!target && hurt.length && hurt[0] !== p) { inp.ax = hurt[0].x; inp.ay = hurt[0].y; inp.fire = true; }
}
