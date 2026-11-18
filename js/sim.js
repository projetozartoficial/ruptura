// =====================================================================
//  sim.js : simulação autoritativa (roda no host / modo treino)
// =====================================================================

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const rnd = (a, b) => a + Math.random() * (b - a);

function rayRect(ox, oy, dx, dy, r) {
  let tmin = -Infinity, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < r.x || ox > r.x + r.w) return Infinity; }
  else { let t1 = (r.x - ox) / dx, t2 = (r.x + r.w - ox) / dx; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
  if (Math.abs(dy) < 1e-9) { if (oy < r.y || oy > r.y + r.h) return Infinity; }
  else { let t1 = (r.y - oy) / dy, t2 = (r.y + r.h - oy) / dy; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); }
  if (tmax < tmin || tmax < 0) return Infinity;
  return tmin >= 0 ? tmin : 0;
}
function rayCirc(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r;
  if (c < 0) return 0;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}
// primeira colisão de um raio com sólidos (obstáculos + muralhas)
function castRay(solids, ox, oy, dx, dy, maxD) {
  let best = maxD;
  for (const o of solids) {
    // descarte rápido por distância
    const cx = o.t === 'rect' ? o.x + o.w / 2 : o.x, cy = o.t === 'rect' ? o.y + o.h / 2 : o.y;
    const rad = o.t === 'rect' ? (o.w + o.h) * 0.75 : o.r;
    const px = cx - ox, py = cy - oy;
    const along = px * dx + py * dy;
    if (along < -rad || along - rad > best) continue;
    const perp = Math.abs(px * dy - py * dx);
    if (perp > rad) continue;
    const t = o.t === 'rect' ? rayRect(ox, oy, dx, dy, o) : rayCirc(ox, oy, dx, dy, o.x, o.y, o.r);
    if (t < best) best = t;
  }
  return best;
}
function pointInSolid(o, x, y, pad) {
  if (o.t === 'rect') return x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad;
  return dist(x, y, o.x, o.y) < o.r + pad;
}
function clampToIsland(x, y, pr) {
  const I = ISLAND, R = I.r;
  const cx = clamp(x, I.x + R, I.x + I.w - R), cy = clamp(y, I.y + R, I.y + I.h - R);
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), lim = R - pr;
  if (d > lim) return [cx + dx / d * lim, cy + dy / d * lim];
  return [x, y];
}
function inIsland(x, y, pr) { const [a, b] = clampToIsland(x, y, pr); return Math.abs(a - x) < 0.5 && Math.abs(b - y) < 0.5; }

function emptyInput() { return { mx: 0, my: 0, ax: 0, ay: 0, fire: false, q: false, e: false, r: false, dash: false }; }

// ------------------------------------------------------------------
class Sim {
  constructor(slots, opts = {}) {
    this.mode = opts.mode || 'standard'; // 'standard' | 'ranked' | 'training'
    this.players = [];
    slots.forEach((s, i) => {
      if (!s || s.kind === 'empty') return;
      const team = i < 4 ? 0 : 1;
      const H = HUNTERS[s.hunter];
      this.players.push({
        id: s.id, name: s.name, team, hunter: s.hunter, bot: s.kind === 'bot', slot: i,
        x: 0, y: 0, vx: 0, vy: 0, z: 0, aim: team ? Math.PI : 0, r: H.r,
        hp: H.hp, maxHp: H.hp, shield: 0, shieldT: 0, alive: true,
        cd: { basic: 0, q: 0, e: 0, r: 0, dash: 0 },
        stun: 0, slowT: 0, slowAmt: 0, spdT: 0, spdAmt: 0, huntT: 0, bastionT: 0, rootT: 0, parryT: 0, wardT: 0, spinT: 0, spinAcc: 0, dashHit: null,
        dashT: 0, dvx: 0, dvy: 0, trail: false, trailAcc: 0, leap: null, invuln: 0,
        kills: 0, deaths: 0, dmg: 0, heal: 0, revive: 0, soulX: 0, soulY: 0,
        lastHitBy: null, lastHitT: -99, tickDmg: 0, tickHeal: 0, tickT: 0,
        input: emptyInput(),
      });
    });
    this.projectiles = []; this.zones = []; this.walls = [];
    this.events = [];
    this.nextId = 1;
    this.time = 0;
    this.score = [0, 0];
    this.round = 0;
    this.phase = 'countdown'; this.phaseT = 3;
    this.fightT = 0;
    this.storm = { x: WORLD_W / 2, y: WORLD_H / 2, r: 1500 };
    this.night = false;
    this.winner = -1;
    this.staticSolids = MAP_OBS;
    this.solids = MAP_OBS.slice();
    this.visCache = new Map();
    this.startRound();
  }

  ev(e) { this.events.push(e); }
  // Padrão: primeiro a 5 (4x4 vira round decisivo). Ranqueada: 4x4 vai pra prorrogação, vence quem abrir 2.
  matchDecided() {
    const [a, b] = this.score, top = Math.max(a, b);
    if (top < WIN_ROUNDS) return false;
    if (this.mode === 'ranked') return Math.abs(a - b) >= 2;
    return true;
  }
  byId(id) { return this.players.find(p => p.id === id); }

  // ---------- troca de caçador entre rounds ----------
  canSwap() { return this.phase === 'roundEnd' || this.phase === 'countdown'; }
  requestSwap(id, hid) {
    const p = this.byId(id);
    if (!p || !HUNTERS[hid] || !this.canSwap() || p.hunter === hid) return false;
    if (this.players.some(q => q.team === p.team && q !== p && q.hunter === hid)) return false;
    const H = HUNTERS[hid];
    p.hunter = hid; p.maxHp = H.hp; p.r = H.r; p.hp = H.hp; p.shield = 0;
    p.cd = { basic: 0, q: 0, e: 0, r: this.phase === 'countdown' ? Math.max(p.cd.r, 18) : 18, dash: 0 };
    p.brain = null;
    this.ev({ k: 'swap', id, h: hid });
    return true;
  }
  botSwaps(winner) {
    for (const p of this.players) {
      if (!p.bot) continue;
      const lost = winner >= 0 && p.team !== winner;
      if (Math.random() > (lost ? 0.3 : 0.1)) continue;
      const used = new Set(this.players.filter(q => q.team === p.team).map(q => q.hunter));
      const free = HUNTER_IDS.filter(h => !used.has(h));
      if (free.length) this.requestSwap(p.id, free[(Math.random() * free.length) | 0]);
    }
  }
  startRound() {
    this.round++;
    this.night = this.round % 2 === 0;
    this.projectiles = []; this.zones = []; this.walls = [];
    this.solids = this.staticSolids.slice();
    const cnt = [0, 0];
    for (const p of this.players) {
      const sp = SPAWNS[p.team][cnt[p.team]++ % 4];
      Object.assign(p, {
        x: sp.x, y: sp.y, vx: 0, vy: 0, z: 0, aim: p.team ? Math.PI : 0, hp: p.maxHp, shield: 0, shieldT: 0, alive: true,
        stun: 0, slowT: 0, spdT: 0, huntT: 0, bastionT: 0, dashT: 0, leap: null, invuln: 0, revive: 0, trail: false,
        rootT: 0, parryT: 0, wardT: 0, spinT: 0, dashHit: null,
      });
      p.cd = { basic: 0, q: 0, e: 0, r: 18, dash: 0 }; p.dashHit = null; p.spinAcc = 0;
    }
    this.storm.r = 1500;
    this.phase = 'countdown'; this.phaseT = 3; this.fightT = 0;
    const [a, b] = this.score;
    this.ev({ k: 'round', n: this.round, night: this.night, ot: this.mode === 'ranked' && a >= WIN_ROUNDS - 1 && b >= WIN_ROUNDS - 1, dec: this.mode !== 'ranked' && a === WIN_ROUNDS - 1 && b === WIN_ROUNDS - 1 });
  }

  // ---------- visão (usada pelos bots) ----------
  canSee(team, t) {
    const key = team * 100000 + t.id;
    if (this.visCache.has(key)) return this.visCache.get(key);
    let v = false;
    if (t.alive) {
      if (t.team === team) v = true;
      else for (const a of this.players) {
        if (!a.alive || a.team !== team) continue;
        const d = dist(a.x, a.y, t.x, t.y);
        if (d < 120) { v = true; break; }
        if (this.night) {
          if (d > 1050) continue;
          if (d > 300 && Math.abs(angDiff(a.aim, Math.atan2(t.y - a.y, t.x - a.x))) > 1.0) continue;
        } else if (d > 1150) continue;
        if (this.los(a.x, a.y, t.x, t.y)) { v = true; break; }
      }
    }
    this.visCache.set(key, v);
    return v;
  }
  los(ax, ay, bx, by) {
    const d = dist(ax, ay, bx, by); if (d < 1) return true;
    return castRay(this.solids, ax, ay, (bx - ax) / d, (by - ay) / d, d) >= d - 1;
  }

  // ---------- passo de simulação ----------
  step(dt) {
    this.time += dt;
    this.visCache.clear();
    if (this.phase === 'countdown') {
      this.phaseT -= dt;
      for (const p of this.players) { p.aim = Math.atan2(p.input.ay - p.y, p.input.ax - p.x) || p.aim; }
      if (this.phaseT <= 0) { this.phase = 'fight'; this.ev({ k: 'fight' }); }
      return;
    }
    if (this.phase === 'matchEnd') return;
    if (this.phase === 'roundEnd') {
      this.phaseT -= dt;
      this.updateEffects(dt);
      if (this.phaseT <= 0) {
        if (this.matchDecided()) {
          this.phase = 'matchEnd'; this.winner = this.score[0] > this.score[1] ? 0 : 1;
          this.ev({ k: 'match', w: this.winner });
        } else this.startRound();
      }
      return;
    }
    this.fightT += dt;
    // tempestade (Névoa Rubra)
    const s0 = 28, s1 = 78;
    if (this.fightT > s0) this.storm.r = 1500 - (1500 - 230) * clamp((this.fightT - s0) / (s1 - s0), 0, 1);

    for (const p of this.players) this.updatePlayer(p, dt);
    this.separate();
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.updateRevives(dt);

    // fim do round
    const alive = [0, 0];
    for (const p of this.players) if (p.alive) alive[p.team]++;
    const hasT = [0, 1].map(t => this.players.some(p => p.team === t));
    if ((hasT[0] && alive[0] === 0) || (hasT[1] && alive[1] === 0)) {
      let w = -1;
      if (alive[0] > 0) w = 0; else if (alive[1] > 0) w = 1;
      if (w >= 0) this.score[w]++;
      this.phase = 'roundEnd'; this.phaseT = SWAP_TIME;
      this.ev({ k: 'roundEnd', w, sc: this.score.slice() });
      this.botSwaps(w);
    }
  }

  updateEffects(dt) {
    // zonas
    for (const z of this.zones) {
      z.t -= dt;
      for (const p of this.players) {
        if (!p.alive || dist(p.x, p.y, z.x, z.y) > z.r + p.r * 0.5) continue;
        const ally = p.team === z.team;
        if (z.heal && ally) this.heal(p, z.heal * dt, this.byId(z.owner), true);
        if (z.dps && !ally) this.damage(p, z.dps * dt, this.byId(z.owner), true);
        if (z.slow && !ally) { p.slowT = Math.max(p.slowT, 0.15); p.slowAmt = Math.max(p.slowAmt, z.slow); }
        if (z.root && !ally) { z.rooted = z.rooted || new Set(); if (!z.rooted.has(p.id)) { z.rooted.add(p.id); p.rootT = Math.max(p.rootT, z.root); this.ev({ k: 'root', id: p.id }); } }
      }
      if (z.t <= 0 && z.onEnd) ZONE_END[z.onEnd](this, z);
    }
    this.zones = this.zones.filter(z => z.t > 0);
    let wallsChanged = false;
    for (const w of this.walls) { w.life -= dt; if (w.life <= 0) wallsChanged = true; }
    if (wallsChanged) {
      this.walls = this.walls.filter(w => w.life > 0);
      this.solids = this.staticSolids.concat(this.walls);
    }
  }

  updatePlayer(p, dt) {
    const H = HUNTERS[p.hunter];
    for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.slowT = Math.max(0, p.slowT - dt); if (p.slowT === 0) p.slowAmt = 0;
    p.spdT = Math.max(0, p.spdT - dt);
    p.huntT = Math.max(0, p.huntT - dt);
    p.bastionT = Math.max(0, p.bastionT - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.rootT = Math.max(0, p.rootT - dt); p.parryT = Math.max(0, p.parryT - dt);
    if (p.wardT > 0) { p.wardT -= dt; if (p.alive) this.heal(p, 18 * dt, null, true); }
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    // emite números acumulados de dano/cura contínuos
    p.tickT -= dt;
    if (p.tickT <= 0) {
      if (p.tickDmg >= 1) this.ev({ k: 'hit', id: p.id, x: p.x, y: p.y, a: Math.round(p.tickDmg), tick: 1 });
      if (p.tickHeal >= 1) this.ev({ k: 'heal', id: p.id, x: p.x, y: p.y, a: Math.round(p.tickHeal) });
      p.tickDmg = 0; p.tickHeal = 0; p.tickT = 0.5;
    }
    if (!p.alive) return;

    // dano da tempestade
    if (dist(p.x, p.y, this.storm.x, this.storm.y) > this.storm.r) {
      const dps = this.storm.r <= 231 ? 70 : 22;
      this.damage(p, dps * dt, null, true);
      if (!p.alive) return;
    }

    const inp = p.input;
    if (!p.stun && !p.leap) {
      const a = Math.atan2(inp.ay - p.y, inp.ax - p.x);
      if (isFinite(a)) p.aim = a;
    }

    // movimento
    if (p.leap) {
      const L = p.leap; L.t += dt;
      const f = clamp(L.t / L.T, 0, 1);
      p.x = L.sx + (L.tx - L.sx) * f; p.y = L.sy + (L.ty - L.sy) * f;
      p.z = Math.sin(f * Math.PI) * 130;
      p.invuln = 0.05;
      if (f >= 1) { p.leap = null; p.z = 0; this.rochaLand(p); }
    } else if (p.dashT > 0) {
      p.dashT -= dt;
      const ox = p.x, oy = p.y;
      p.x += p.dvx * dt; p.y += p.dvy * dt;
      if (p.dashHit) {
        for (const t of this.players) {
          if (!t.alive || t.team === p.team || p.dashHit.hit.has(t.id) || dist(p.x, p.y, t.x, t.y) > p.r + t.r + 8) continue;
          p.dashHit.hit.add(t.id); this.damage(t, p.dashHit.dmg, p);
          if (p.dashHit.stun) t.stun = Math.max(t.stun, p.dashHit.stun);
          if (p.dashHit.stop) { p.dashT = 0; break; }
        }
      }
      if (p.trail) {
        p.trailAcc += dist(ox, oy, p.x, p.y);
        if (p.trailAcc > 42) { p.trailAcc = 0; this.zones.push({ id: this.nextId++, type: 'fire', x: p.x, y: p.y, r: 44, t: 2.6, T: 2.6, team: p.team, owner: p.id, dps: 42 }); }
      }
      if (p.dashT <= 0) { p.trail = false; p.dvx = p.dvy = 0; p.dashHit = null; }
    } else if (p.stun <= 0 && this.phase === 'fight') {
      let mx = inp.mx, my = inp.my;
      const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      let sp = H.speed;
      if (p.slowT > 0) sp *= 1 - p.slowAmt;
      if (p.spdT > 0) sp *= 1 + p.spdAmt;
      if (p.huntT > 0) sp *= 1.35;
      if (p.bastionT > 0) sp *= 0.8;
      if (p.spinT > 0) sp *= 1.2;
      if (p.rootT > 0) { mx = 0; my = 0; }
      const k = 1 - Math.exp(-dt * 18);
      p.vx += (mx * sp - p.vx) * k; p.vy += (my * sp - p.vy) * k;
      p.x += p.vx * dt; p.y += p.vy * dt;
    } else { p.vx *= 0.8; p.vy *= 0.8; }
    if (!p.leap) this.collide(p);
    if (p.spinT > 0) {
      p.spinT -= dt; p.spinAcc += dt;
      if (p.spinAcc >= 0.25) { p.spinAcc -= 0.25; for (const t of this.enemiesIn(p.x, p.y, 170, p.team)) this.damage(t, 30, p); this.ev({ k: 'spin', id: p.id }); }
    }

    // ações
    if (p.stun > 0 || p.leap || this.phase !== 'fight') return;
    if (inp.fire && p.cd.basic <= 0) { HUNTER_LOGIC[p.hunter].basic(this, p); p.cd.basic = H.habilidades.basico.cd; }
    for (const key of ['q', 'e', 'r']) {
      if (inp[key] && p.cd[key] <= 0) {
        const ok = HUNTER_LOGIC[p.hunter][key](this, p);
        if (ok !== false) { p.cd[key] = H.habilidades[key].cd; this.ev({ k: 'cast', id: p.id, ab: key, h: p.hunter }); }
      }
    }
    if (inp.dash && p.cd.dash <= 0 && p.dashT <= 0) {
      let dx = inp.mx, dy = inp.my, l = Math.hypot(dx, dy);
      if (l < 0.1) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); l = 1; }
      p.dvx = dx / l * 1350; p.dvy = dy / l * 1350; p.dashT = 0.16; p.cd.dash = DASH_CD;
      this.ev({ k: 'dash', id: p.id, x: p.x, y: p.y, a: Math.atan2(dy, dx) });
    }
  }

  collide(p) {
    for (const o of this.solids) {
      if (o.t === 'rect') {
        const nx = clamp(p.x, o.x, o.x + o.w), ny = clamp(p.y, o.y, o.y + o.h);
        let dx = p.x - nx, dy = p.y - ny, d = Math.hypot(dx, dy);
        if (d < p.r) {
          if (d < 0.001) { // centro dentro do retângulo
            const l = p.x - o.x, r = o.x + o.w - p.x, t = p.y - o.y, b = o.y + o.h - p.y, m = Math.min(l, r, t, b);
            if (m === l) p.x = o.x - p.r; else if (m === r) p.x = o.x + o.w + p.r; else if (m === t) p.y = o.y - p.r; else p.y = o.y + o.h + p.r;
          } else { p.x = nx + dx / d * p.r; p.y = ny + dy / d * p.r; }
        }
      } else {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), m = o.r + p.r;
        if (d < m) { if (d < 0.001) { p.x += m; } else { p.x = o.x + dx / d * m; p.y = o.y + dy / d * m; } }
      }
    }
    [p.x, p.y] = clampToIsland(p.x, p.y, p.r);
  }
  separate() {
    const L = this.players;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (!a.alive || !b.alive || a.leap || b.leap) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d < m && d > 0.01) { const push = (m - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
    }
  }
  freeSpot(x, y, r) {
    if (!inIsland(x, y, r)) return false;
    for (const o of this.solids) if (pointInSolid(o, x, y, r)) return false;
    return true;
  }
  // ponto mais distante livre ao longo da linha (para teleporte / salto)
  reachPoint(p, maxD) {
    const a = p.aim;
    let d = Math.min(maxD, dist(p.x, p.y, p.input.ax, p.input.ay));
    for (; d > 0; d -= 12) {
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (this.freeSpot(x, y, p.r)) return [x, y];
    }
    return [p.x, p.y];
  }
  aimPoint(p, maxD) {
    const d = Math.min(maxD, dist(p.x, p.y, p.input.ax, p.input.ay));
    return [p.x + Math.cos(p.aim) * d, p.y + Math.sin(p.aim) * d];
  }

  // ---------- projéteis ----------
  shoot(p, o) {
    const a = o.ang ?? p.aim;
    const off = p.r + 8;
    const pr = Object.assign({
      id: this.nextId++, owner: p.id, team: p.team, kind: 'ember', x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off,
      vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, r: 6, dmg: 0, range: 600, trav: 0, hit: new Set(), ang: a,
    }, o);
    pr.ang = a;
    this.projectiles.push(pr);
    return pr;
  }
  updateProjectiles(dt) {
    const keep = [];
    for (const pr of this.projectiles) {
      const sp = Math.hypot(pr.vx, pr.vy);
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.trav += sp * dt;
      let dead = false;
      const owner = this.byId(pr.owner);
      // colisão com cenário
      if (!pr.passWalls) {
        for (const o of this.solids) if (pointInSolid(o, pr.x, pr.y, -1)) { dead = true; break; }
        if (dead) { this.projEnd(pr, owner, true); continue; }
      }
      // colisão com jogadores
      for (const t of this.players) {
        if (!t.alive || t.invuln > 0 || pr.hit.has(t.id) || t.id === pr.owner) continue;
        const ally = t.team === pr.team;
        if (ally && !pr.healAlly) continue;
        let hitIt;
        if (pr.kind === 'wave') {
          const ux = pr.vx / sp, uy = pr.vy / sp, dx = t.x - pr.x, dy = t.y - pr.y;
          hitIt = Math.abs(dx * ux + dy * uy) < 40 + t.r && Math.abs(-dx * uy + dy * ux) < 160;
        } else hitIt = dist(pr.x, pr.y, t.x, t.y) < pr.r + t.r;
        if (!hitIt) continue;
        pr.hit.add(t.id);
        if (ally) { this.heal(t, pr.healAlly, owner); this.ev({ k: 'spark', x: t.x, y: t.y, c: 'light' }); continue; }
        // bastião bloqueia tiros vindos da frente
        if (t.bastionT > 0 && pr.kind !== 'wave' && Math.abs(angDiff(t.aim, Math.atan2(-pr.vy, -pr.vx))) < 1.1) {
          this.ev({ k: 'block', x: pr.x, y: pr.y }); dead = true; break;
        }
        this.projHit(pr, owner, t);
        if (!pr.pierce) { dead = true; break; }
      }
      if (dead) { this.projEnd(pr, owner, false); continue; }
      if (pr.trav >= pr.range) { this.projEnd(pr, owner, false, true); continue; }
      keep.push(pr);
    }
    this.projectiles = keep;
  }
  projHit(pr, owner, t) {
    const L = PROJ_HIT[pr.kind];
    if (L) L(this, pr, owner, t); else this.damage(t, pr.dmg, owner);
  }
  projEnd(pr, owner, wall, expire) {
    if (pr.kind === 'fireball') { this.brasaBoom(pr.x, pr.y, owner, pr.team); return; }
    if (pr.kind === 'grapple' && wall && owner && owner.alive) { dashTo(owner, pr.x - Math.cos(pr.ang) * (owner.r + 6), pr.y - Math.sin(pr.ang) * (owner.r + 6), 0.25); this.ev({ k: 'spark', x: pr.x, y: pr.y, c: 'hook' }); return; }
    if (wall || !expire) this.ev({ k: 'spark', x: pr.x, y: pr.y, c: pr.kind });
  }

  // ---------- dano e cura ----------
  damage(t, amt, src, tick) {
    if (!t.alive || t.invuln > 0 || this.phase !== 'fight') return 0;
    if (t.parryT > 0 && !tick && src) {
      t.spdT = 1.5; t.spdAmt = 0.3; this.ev({ k: 'parry', id: t.id, x: t.x, y: t.y }); return 0;
    }
    if (src && src.huntT > 0 && !tick) amt *= 1.4;
    if (t.bastionT > 0) amt *= 0.5;
    if (t.wardT > 0) amt *= 0.6;
    if (!tick) amt = Math.round(amt);
    let a = amt;
    if (t.shield > 0) { const s = Math.min(t.shield, a); t.shield -= s; a -= s; }
    t.hp -= a;
    if (src && src.id !== t.id) {
      src.dmg += amt; t.lastHitBy = src.id; t.lastHitT = this.time;
      if (src.huntT > 0) this.heal(src, amt * 0.3, src, true);
    }
    if (tick) t.tickDmg += amt; else this.ev({ k: 'hit', id: t.id, x: t.x, y: t.y, a: Math.round(amt), by: src ? src.id : 0 });
    if (t.hp <= 0) this.kill(t, src);
    return amt;
  }
  heal(t, amt, src, tick) {
    if (!t.alive) return 0;
    const a = Math.min(t.maxHp - t.hp, amt);
    if (a <= 0) return 0;
    t.hp += a;
    if (src) src.heal += a;
    if (tick) t.tickHeal += a; else if (a >= 1) this.ev({ k: 'heal', id: t.id, x: t.x, y: t.y, a: Math.round(a) });
    return a;
  }
  kill(t, src) {
    t.alive = false; t.hp = 0; t.shield = 0; t.deaths++; t.revive = 0;
    t.soulX = t.x; t.soulY = t.y; t.dashT = 0; t.leap = null; t.z = 0;
    let killer = src && src.team !== t.team ? src : null;
    if (!killer && t.lastHitBy && this.time - t.lastHitT < 6) killer = this.byId(t.lastHitBy);
    if (killer) killer.kills++;
    this.ev({ k: 'death', id: t.id, by: killer ? killer.id : 0, x: t.x, y: t.y });
  }
  updateRevives(dt) {
    for (const p of this.players) {
      if (p.alive) continue;
      const helper = this.players.some(a => a.alive && a.team === p.team && dist(a.x, a.y, p.soulX, p.soulY) < 85);
      if (helper) p.revive += dt; else p.revive = Math.max(0, p.revive - dt * 0.6);
      if (p.revive >= 3.5) {
        p.alive = true; p.hp = Math.round(p.maxHp * 0.4); p.x = p.soulX; p.y = p.soulY; p.revive = 0;
        p.stun = 0; p.slowT = 0; p.invuln = 1; this.collide(p);
        this.ev({ k: 'revive', id: p.id, x: p.x, y: p.y });
      }
    }
  }
  enemiesIn(x, y, r, team) { return this.players.filter(p => p.alive && p.team !== team && dist(x, y, p.x, p.y) < r + p.r); }

  brasaBoom(x, y, owner, team) {
    for (const t of this.enemiesIn(x, y, 190, team)) this.damage(t, 150, owner);
    this.zones.push({ id: this.nextId++, type: 'burn', x, y, r: 150, t: 3.2, T: 3.2, team, owner: owner ? owner.id : 0, dps: 45 });
    this.ev({ k: 'boom', x, y, r: 190, c: 'fire' });
  }
  rochaLand(p) {
    for (const t of this.enemiesIn(p.x, p.y, 210, p.team)) { this.damage(t, 110, p); t.stun = Math.max(t.stun, 1.2); }
    this.collide(p);
    this.ev({ k: 'boom', x: p.x, y: p.y, r: 210, c: 'quake' });
  }

  // ---------- snapshot p/ rede ----------
  drainEvents() { const e = this.events; this.events = []; return e; }
}

// ------------------------------------------------------------------
//  Lógica das habilidades
// ------------------------------------------------------------------
const PROJ_HIT = {
  orb(sim, pr, o, t) { sim.damage(t, pr.dmg, o); t.slowT = Math.max(t.slowT, 0.9); t.slowAmt = Math.max(t.slowAmt, 0.22); },
  hook(sim, pr, o, t) {
    sim.damage(t, pr.dmg, o);
    if (!o) return;
    const d = dist(t.x, t.y, o.x, o.y), pull = Math.max(0, d - (o.r + t.r + 30));
    const a = Math.atan2(o.y - t.y, o.x - t.x);
    t.dashT = 0.24; t.dvx = Math.cos(a) * pull / 0.24; t.dvy = Math.sin(a) * pull / 0.24; t.trail = false;
    t.stun = Math.max(t.stun, 0.75);
    sim.ev({ k: 'hook', id: t.id, by: o.id });
  },
  fissure(sim, pr, o, t) { sim.damage(t, pr.dmg, o); t.stun = Math.max(t.stun, 0.85); },
  wave(sim, pr, o, t) {
    sim.damage(t, pr.dmg, o);
    const a = Math.atan2(pr.vy, pr.vx);
    t.dashT = 0.3; t.dvx = Math.cos(a) * 900; t.dvy = Math.sin(a) * 900; t.trail = false;
    t.stun = Math.max(t.stun, 1.0);
  },
  fireball(sim, pr, o, t) { /* explode no fim */ },
};

const HUNTER_LOGIC = {
  brasa: {
    basic(sim, p) { sim.shoot(p, { kind: 'ember', ang: p.aim + rnd(-0.03, 0.03), speed: 960, range: 760, r: 6, dmg: 34 }); sim.ev({ k: 'shot', id: p.id, h: 'brasa' }); },
    q(sim, p) { for (let i = -2; i <= 2; i++) sim.shoot(p, { kind: 'ember', ang: p.aim + i * 0.17, speed: 900, range: 430, r: 7, dmg: 28 }); },
    e(sim, p) { p.dashT = 0.22; p.dvx = Math.cos(p.aim) * 1450; p.dvy = Math.sin(p.aim) * 1450; p.trail = true; p.trailAcc = 99; },
    r(sim, p) { sim.shoot(p, { kind: 'fireball', speed: 620, range: 900, r: 22, dmg: 0 }); },
  },
  corvo: {
    basic(sim, p) {
      if (p.huntT > 0) { for (const s of [-0.07, 0.07]) sim.shoot(p, { kind: 'dagger', ang: p.aim + s, speed: 1150, range: 660, r: 5, dmg: 30 }); }
      else sim.shoot(p, { kind: 'dagger', speed: 1150, range: 660, r: 5, dmg: 30 });
      sim.ev({ k: 'shot', id: p.id, h: 'corvo' });
    },
    q(sim, p) { sim.shoot(p, { kind: 'hook', speed: 1300, range: 700, r: 11, dmg: 40 }); },
    e(sim, p) {
      const [x, y] = sim.reachPoint(p, 360);
      const ox = p.x, oy = p.y; p.x = x; p.y = y; p.dashT = 0; p.vx = p.vy = 0;
      for (const t of sim.enemiesIn(x, y, 100, p.team)) { sim.damage(t, 50, p); t.slowT = Math.max(t.slowT, 1.5); t.slowAmt = Math.max(t.slowAmt, 0.4); }
      sim.ev({ k: 'blink', x1: ox, y1: oy, x2: x, y2: y });
    },
    r(sim, p) { p.huntT = 5; },
  },
  mare: {
    basic(sim, p) { sim.shoot(p, { kind: 'orb', speed: 760, range: 700, r: 9, dmg: 36 }); sim.ev({ k: 'shot', id: p.id, h: 'mare' }); },
    q(sim, p) {
      const [x, y] = sim.aimPoint(p, 650);
      sim.zones.push({ id: sim.nextId++, type: 'pool', x, y, r: 140, t: 3.2, T: 3.2, team: p.team, owner: p.id, dps: 26, slow: 0.45 });
    },
    e(sim, p) {
      const d = clamp(dist(p.x, p.y, p.input.ax, p.input.ay), 110, 420);
      const cx = p.x + Math.cos(p.aim) * d, cy = p.y + Math.sin(p.aim) * d, pa = p.aim + Math.PI / 2;
      for (let i = -3; i <= 3; i++) {
        const x = cx + Math.cos(pa) * i * 38, y = cy + Math.sin(pa) * i * 38;
        if (!inIsland(x, y, 0)) continue;
        sim.walls.push({ t: 'circ', k: 'ice', x, y, r: 23, hh: 70, life: 4.2, T: 4.2, id: sim.nextId++ });
      }
      sim.solids = sim.staticSolids.concat(sim.walls);
      for (const t of sim.players) if (t.alive) sim.collide(t);
    },
    r(sim, p) { sim.shoot(p, { kind: 'wave', speed: 720, range: 950, r: 40, dmg: 90, pierce: true, passWalls: true }); },
  },
  lumi: {
    basic(sim, p) { sim.shoot(p, { kind: 'light', speed: 980, range: 720, r: 7, dmg: 26, healAlly: 32 }); sim.ev({ k: 'shot', id: p.id, h: 'lumi' }); },
    q(sim, p) {
      let best = p, bd = dist(p.input.ax, p.input.ay, p.x, p.y);
      for (const a of sim.players) {
        if (!a.alive || a.team !== p.team || dist(a.x, a.y, p.x, p.y) > 650) continue;
        const d = dist(a.x, a.y, p.input.ax, p.input.ay);
        if (d < bd) { bd = d; best = a; }
      }
      best.shield = 150; best.shieldT = 3.5;
      sim.ev({ k: 'shield', id: best.id, from: p.id });
    },
    e(sim, p) {
      const [x, y] = sim.aimPoint(p, 550);
      sim.zones.push({ id: sim.nextId++, type: 'sanct', x, y, r: 160, t: 4, T: 4, team: p.team, owner: p.id, heal: 48 });
    },
    r(sim, p) {
      for (const a of sim.players) {
        if (!a.alive || a.team !== p.team || dist(a.x, a.y, p.x, p.y) > 1000) continue;
        sim.heal(a, 200, p); a.stun = 0; a.slowT = 0; a.spdT = 3; a.spdAmt = 0.25;
      }
      sim.ev({ k: 'aurora', x: p.x, y: p.y, team: p.team });
    },
  },
  rocha: {
    basic(sim, p) {
      for (const t of sim.players) {
        if (!t.alive || t.team === p.team) continue;
        const d = dist(p.x, p.y, t.x, t.y);
        if (d < 140 + t.r && Math.abs(angDiff(p.aim, Math.atan2(t.y - p.y, t.x - p.x))) < 1.05) sim.damage(t, 48, p);
      }
      sim.ev({ k: 'swing', id: p.id, a: p.aim });
    },
    q(sim, p) { sim.shoot(p, { kind: 'fissure', speed: 950, range: 620, r: 26, dmg: 50, pierce: true }); },
    e(sim, p) { p.bastionT = 3; },
    r(sim, p) {
      const [x, y] = sim.reachPoint(p, 560);
      if (dist(x, y, p.x, p.y) < 40) return false;
      p.leap = { sx: p.x, sy: p.y, tx: x, ty: y, t: 0, T: 0.6 }; p.dashT = 0;
    },
  },
};


// ------------------------------------------------------------------
//  Caçadores novos (v0.3)
// ------------------------------------------------------------------
function dashTo(p, x, y, T) {
  const d = dist(p.x, p.y, x, y); if (d < 4) return;
  p.dashT = T; p.dvx = (x - p.x) / T; p.dvy = (y - p.y) / T; p.trail = false;
}
const ZONE_END = {
  strike(sim, z) {
    const o = sim.byId(z.owner);
    for (const t of sim.enemiesIn(z.x, z.y, z.r, z.team)) { sim.damage(t, 130, o); t.stun = Math.max(t.stun, 1.2); }
    sim.ev({ k: 'boom', x: z.x, y: z.y, r: z.r, c: 'lightning' });
  },
  seed(sim, z) {
    const o = sim.byId(z.owner);
    for (const t of sim.enemiesIn(z.x, z.y, z.r, z.team)) { sim.damage(t, 75, o); t.slowT = Math.max(t.slowT, 2); t.slowAmt = Math.max(t.slowAmt, 0.4); }
    sim.ev({ k: 'boom', x: z.x, y: z.y, r: z.r, c: 'bloom' });
  },
};
Object.assign(PROJ_HIT, {
  bolt(sim, pr, o, t) {
    sim.damage(t, pr.dmg, o);
    let best = null, bd = 230;
    for (const e of sim.players) { if (!e.alive || e.team === pr.team || e === t) continue; const d = dist(e.x, e.y, t.x, t.y); if (d < bd) { bd = d; best = e; } }
    if (best) { sim.damage(best, 14, o); sim.ev({ k: 'zap', x1: t.x, y1: t.y, x2: best.x, y2: best.y }); }
  },
  roots(sim, pr, o, t) { sim.damage(t, pr.dmg, o); t.rootT = Math.max(t.rootT, 1.4); sim.ev({ k: 'root', id: t.id }); },
  anchor(sim, pr, o, t) { sim.damage(t, pr.dmg, o); t.slowT = Math.max(t.slowT, 1); t.slowAmt = Math.max(t.slowAmt, 0.3); },
  grapple(sim, pr, o, t) {
    sim.damage(t, pr.dmg, o); t.stun = Math.max(t.stun, 0.6);
    if (o && o.alive) { const a = Math.atan2(t.y - o.y, t.x - o.x), d = dist(o.x, o.y, t.x, t.y) - (o.r + t.r + 8); if (d > 0) dashTo(o, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, 0.25); }
    sim.ev({ k: 'hook', id: t.id, by: o ? o.id : 0 });
  },
});
Object.assign(HUNTER_LOGIC, {
  lamina: {
    basic(sim, p) { sim.shoot(p, { kind: 'wind', speed: 950, range: 330, r: 16, dmg: 40, pierce: true }); sim.ev({ k: 'shot', id: p.id, h: 'lamina' }); },
    q(sim, p) { p.dashT = 0.2; p.dvx = Math.cos(p.aim) * 1400; p.dvy = Math.sin(p.aim) * 1400; p.dashHit = { dmg: 55, hit: new Set() }; },
    e(sim, p) { p.parryT = 1.0; },
    r(sim, p) { p.spinT = 2.5; p.spinAcc = 0.2; },
  },
  trovao: {
    basic(sim, p) { sim.shoot(p, { kind: 'bolt', speed: 1050, range: 600, r: 7, dmg: 28 }); sim.ev({ k: 'shot', id: p.id, h: 'trovao' }); },
    q(sim, p) { p.dashT = 0.28; p.dvx = Math.cos(p.aim) * 1350; p.dvy = Math.sin(p.aim) * 1350; p.dashHit = { dmg: 60, stun: 0.8, stop: true, hit: new Set() }; },
    e(sim, p) { sim.zones.push({ id: sim.nextId++, type: 'static', x: p.x, y: p.y, r: 180, t: 3, T: 3, team: p.team, owner: p.id, dps: 22, slow: 0.3 }); },
    r(sim, p) { const [x, y] = sim.aimPoint(p, 700); sim.zones.push({ id: sim.nextId++, type: 'strike', x, y, r: 220, t: 0.9, T: 0.9, team: p.team, owner: p.id, onEnd: 'strike' }); },
  },
  vinha: {
    basic(sim, p) { sim.shoot(p, { kind: 'thorn', speed: 850, range: 680, r: 6, dmg: 32 }); sim.ev({ k: 'shot', id: p.id, h: 'vinha' }); },
    q(sim, p) { sim.shoot(p, { kind: 'roots', speed: 950, range: 620, r: 18, dmg: 40 }); },
    e(sim, p) { const [x, y] = sim.aimPoint(p, 600); sim.zones.push({ id: sim.nextId++, type: 'seed', x, y, r: 150, t: 1, T: 1, team: p.team, owner: p.id, onEnd: 'seed' }); },
    r(sim, p) { const [x, y] = sim.aimPoint(p, 600); sim.zones.push({ id: sim.nextId++, type: 'grove', x, y, r: 260, t: 4.5, T: 4.5, team: p.team, owner: p.id, heal: 25, dps: 20, root: 1.0 }); },
  },
  sino: {
    basic(sim, p) { sim.shoot(p, { kind: 'sound', speed: 850, range: 520, r: 16, dmg: 26, pierce: true }); sim.ev({ k: 'shot', id: p.id, h: 'sino' }); },
    q(sim, p) {
      let best = null, bd = 1e9;
      for (const a of sim.players) { if (!a.alive || a.team !== p.team || a === p || dist(a.x, a.y, p.x, p.y) > 520) continue; const d = dist(a.x, a.y, p.input.ax, p.input.ay); if (d < bd) { bd = d; best = a; } }
      if (!best) return false;
      const a0 = Math.atan2(p.y - best.y, p.x - best.x);
      let tx = best.x, ty = best.y;
      for (let k = 0; k < 8; k++) { const a = a0 + k * 0.8, x = best.x + Math.cos(a) * (best.r + p.r + 6), y = best.y + Math.sin(a) * (best.r + p.r + 6); if (sim.freeSpot(x, y, p.r)) { tx = x; ty = y; break; } }
      const ox = p.x, oy = p.y; p.x = tx; p.y = ty; p.dashT = 0; p.vx = p.vy = 0;
      best.shield = Math.max(best.shield, 110); best.shieldT = 3;
      sim.ev({ k: 'blink', x1: ox, y1: oy, x2: tx, y2: ty, c: 'gold' }); sim.ev({ k: 'shield', id: best.id, from: p.id });
    },
    e(sim, p) {
      for (const t of sim.enemiesIn(p.x, p.y, 180, p.team)) { sim.damage(t, 30, p); const a = Math.atan2(t.y - p.y, t.x - p.x); t.dashT = 0.22; t.dvx = Math.cos(a) * 1000; t.dvy = Math.sin(a) * 1000; t.trail = false; t.dashHit = null; }
      for (const a of sim.players) if (a.alive && a.team === p.team && dist(a.x, a.y, p.x, p.y) < 180 + a.r) sim.heal(a, 45, p);
      sim.ev({ k: 'bell', x: p.x, y: p.y });
    },
    r(sim, p) {
      for (const a of sim.players) if (a.alive && a.team === p.team && dist(a.x, a.y, p.x, p.y) < 650) a.wardT = 4;
      sim.ev({ k: 'ward', x: p.x, y: p.y });
    },
  },
  ancora: {
    basic(sim, p) { sim.shoot(p, { kind: 'anchor', speed: 900, range: 280, r: 14, dmg: 44 }); sim.ev({ k: 'swing', id: p.id, a: p.aim, soft: 1 }); },
    q(sim, p) { sim.shoot(p, { kind: 'grapple', speed: 1400, range: 600, r: 12, dmg: 40 }); },
    e(sim, p) { p.shield = Math.max(p.shield, 230); p.shieldT = 3; sim.ev({ k: 'shield', id: p.id, from: p.id }); },
    r(sim, p) {
      for (const t of sim.enemiesIn(p.x, p.y, 340, p.team)) {
        sim.damage(t, 70, p); t.stun = Math.max(t.stun, 1.0);
        const a = Math.atan2(p.y - t.y, p.x - t.x), d = dist(p.x, p.y, t.x, t.y) - (p.r + t.r + 10);
        if (d > 0) { t.dashT = 0.22; t.dvx = Math.cos(a) * d / 0.22; t.dvy = Math.sin(a) * d / 0.22; t.trail = false; t.dashHit = null; }
      }
      sim.ev({ k: 'pull', x: p.x, y: p.y });
    },
  },
});

if (typeof module !== 'undefined') module.exports = { Sim };
