// =====================================================================
//  fps/game.js : simulação da partida (rounds, economia, Núcleo, tiros,
//  habilidades) — roda em passo fixo, independente do desenho
// =====================================================================
// TICK (1/60) vem de js/data.js
const PH = { R: 0.36, H: 1.8, HC: 1.25, EYE: 1.62, EYEC: 1.1 }; // raio, altura, agachado, olhos
const MOVE = { run: 6.4, walk: 3.2, crouch: 2.4, accel: 60, air: 8, jump: 5.4, grav: 15.5 };

function emptyIn() { return { mx: 0, mz: 0, jump: false, crouch: false, walk: false, fire: false, alt: false, reload: false, slot: 0, use: false, ab: null, yaw: 0, pitch: 0, drop: false, buy: null }; }

class Game {
  constructor(M, slots, opts = {}) {
    this.M = M; this.ev = []; this.t = 0;
    this.players = slots.map((s, i) => this.newPlayer(s, i));
    this.score = [0, 0]; this.round = 0; this.lossStreak = [0, 0];
    this.grenades = []; this.zones = []; this.smokes = []; this.temp = []; this.tracers = [];
    this.drops = []; this.nucleo = null; this.revealTeam = [0, 0];
    this.phase = 'pre'; this.phaseT = 0; this.winner = -1; this.ot = false;
    this.solids = M.solids.slice();
    this.startRound(true);
  }
  newPlayer(s, i) {
    return {
      id: s.id, pid: s.pid || null, name: s.name, bot: !!s.bot, team: i < RULES.teamSize ? 0 : 1, slot: i, hunter: s.hunter,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0, onGround: true,
      hp: 100, armor: 0, alive: true, creds: RULES.startCreds,
      guns: { 1: null, 2: { id: 'lasca', ammo: 12, res: 36 } }, cur: 2, reloadT: 0, fireCd: 0, recoil: 0, burst: 0, lastShot: -9, zoom: false, switchT: 0,
      ab: { c: 0, q: 0, e: 0 }, ult: 0, nucleo: false,
      blindT: 0, slowT: 0, slowAmt: 0, stunT: 0, revealT: 0, dashT: 0, healT: 0,
      kills: 0, deaths: 0, assists: 0, dmg: 0, plants: 0, defuses: 0, roundKills: 0,
      in: emptyIn(), useT: 0, brain: null, lastHitBy: null,
    };
  }
  emit(e) { this.ev.push(e); }
  drain() { const e = this.ev; this.ev = []; return e; }
  byId(id) { return this.players.find(p => p.id === id); }
  attackers() { return this.attTeam(); }
  attTeam() { if (!this.ot) return this.round <= RULES.half ? 0 : 1; return (this.round - RULES.half * 2) % 2 === 1 ? 0 : 1; }
  sideOf(p) { return p.team === this.attTeam() ? 'atk' : 'def'; }

  // ---------------- rounds ----------------
  startRound(first) {
    this.round++;
    const half = this.round === RULES.half + 1, otStart = this.round > RULES.half * 2;
    if (otStart) this.ot = true;
    const att = this.attTeam();
    if (half || first) for (const p of this.players) { p.creds = RULES.startCreds; p.guns = { 1: null, 2: { id: 'lasca', ammo: 12, res: 36 } }; p.armor = 0; p.ab = { c: 0, q: 0, e: 0 }; }
    if (half) this.lossStreak = [0, 0];
    if (this.ot) for (const p of this.players) p.creds = RULES.otCreds;
    // posições de nascimento
    const sp = { atk: this.M.spawnT.slice().sort(() => Math.random() - 0.5), def: this.M.spawnD.slice().sort(() => Math.random() - 0.5) };
    const used = { atk: 0, def: 0 };
    for (const p of this.players) {
      const side = p.team === att ? 'atk' : 'def', [c, r] = sp[side][used[side]++ % sp[side].length];
      if (!p.alive) { p.guns = { 1: null, 2: { id: 'lasca', ammo: 12, res: 36 } }; p.armor = 0; p.ab.c = 0; p.ab.q = 0; }
      Object.assign(p, { x: (c + 0.5) * this.M.cell + rnd(-0.4, 0.4), y: 0, z: (r + 0.5) * this.M.cell + rnd(-0.4, 0.4), vx: 0, vy: 0, vz: 0, hp: 100, alive: true, crouch: 0,
        yaw: side === 'atk' ? 0 : Math.PI, pitch: 0, blindT: 0, slowT: 0, stunT: 0, revealT: 0, dashT: 0, healT: 0, nucleo: false, reloadT: 0, recoil: 0, zoom: false, useT: 0, roundKills: 0, brain: null });
      p.ab.e = FPS_HUNTERS[p.hunter].e.free;
      for (const k of [1, 2]) { const g = p.guns[k]; if (g) { const W = WEAPONS[g.id]; g.ammo = W.mag; g.res = Math.max(g.res, W.res); } }
      p.cur = p.guns[1] ? 1 : 2;
    }
    // Núcleo para um atacante (humano tem preferência)
    const atks = this.players.filter(p => p.team === att);
    const carrier = atks.find(p => !p.bot) && Math.random() < 0.5 ? atks.find(p => !p.bot) : atks[(Math.random() * atks.length) | 0];
    if (carrier) carrier.nucleo = true;
    this.nucleo = null; this.drops = []; this.grenades = []; this.zones = []; this.smokes = []; this.temp = []; this.revealTeam = [0, 0];
    this.solids = this.M.solids.slice();
    this.phase = 'buy'; this.phaseT = RULES.buyTime; this.winner = -1; this.roundWinner = -1;
    this.plantSite = null; this.defuseProg = 0; this.defuseHalf = false;
    this.emit({ k: 'round', n: this.round, att, half, ot: this.ot });
  }
  endRound(w, why) {
    if (this.phase === 'end' || this.phase === 'matchEnd') return;
    this.roundWinner = w; this.score[w]++;
    const l = 1 - w;
    for (const p of this.players) {
      if (p.team === w) p.creds += RULES.win;
      else p.creds += RULES.loss[Math.min(this.lossStreak[l], 2)];
      p.creds = Math.min(RULES.maxCreds, p.creds);
    }
    this.lossStreak[w] = 0; this.lossStreak[l]++;
    this.phase = 'end'; this.phaseT = RULES.endTime;
    this.emit({ k: 'roundEnd', w, why, sc: this.score.slice() });
  }
  matchOver() {
    const [a, b] = this.score, W = RULES.winRounds;
    if (a >= W - 1 && b >= W - 1) return Math.abs(a - b) >= 2; // prorrogação: abrir 2
    return a >= W || b >= W;
  }

  // ---------------- passo da simulação ----------------
  step(dt) {
    this.t += dt;
    if (this.phase === 'matchEnd') return;
    this.phaseT -= dt;
    for (const p of this.players) if (p.bot && p.alive) botThink(this, p, dt);
    this.tick = (this.tick || 0) + 1;
    this.hist = this.hist || [];
    this.hist.push({ tk: this.tick, P: this.players.map(p => [p.x, p.y, p.z, p.crouch]) }); if (this.hist.length > 45) this.hist.shift();
    for (const p of this.players) this.updatePlayer(p, dt);
    this.updateGrenades(dt); this.updateZones(dt);
    this.revealTeam[0] = Math.max(0, this.revealTeam[0] - dt); this.revealTeam[1] = Math.max(0, this.revealTeam[1] - dt);
    for (const t of this.tracers) t.t -= dt; this.tracers = this.tracers.filter(t => t.t > 0);
    // pegar Núcleo caído
    if (this.nucleo && !this.nucleo.planted) for (const p of this.players) if (p.alive && p.team === this.attTeam() && Math.hypot(p.x - this.nucleo.x, p.z - this.nucleo.z) < 1.2) { p.nucleo = true; this.nucleo = null; this.emit({ k: 'pick', id: p.id }); break; }
    // fases
    if (this.phase === 'buy' && this.phaseT <= 0) { this.phase = 'live'; this.phaseT = RULES.roundTime; this.emit({ k: 'live' }); }
    else if (this.phase === 'live' || this.phase === 'planted') this.checkRound();
    else if (this.phase === 'end' && this.phaseT <= 0) {
      if (this.matchOver()) { this.phase = 'matchEnd'; this.winner = this.score[0] > this.score[1] ? 0 : 1; this.emit({ k: 'match', w: this.winner }); }
      else this.startRound(false);
    }
  }
  checkRound() {
    const att = this.attTeam(), def = 1 - att;
    const aliveA = this.players.filter(p => p.alive && p.team === att).length, aliveD = this.players.filter(p => p.alive && p.team === def).length;
    if (this.phase === 'live') {
      if (aliveD === 0) return this.endRound(att, 'elim');
      if (aliveA === 0) return this.endRound(def, 'elim');
      if (this.phaseT <= 0) return this.endRound(def, 'time');
    } else {
      if (aliveD === 0) return this.endRound(att, 'elim');
      if (this.phaseT <= 0) {
        // o Núcleo rompe
        const n = this.nucleo;
        this.emit({ k: 'explode', x: n.x, z: n.z });
        for (const p of this.players) if (p.alive && Math.hypot(p.x - n.x, p.z - n.z) < 14) this.hurt(p, 999, null, 'body', 'nucleo');
        return this.endRound(att, 'explode');
      }
    }
  }

  // ---------------- jogador ----------------
  updatePlayer(p, dt) {
    const I = p.in;
    p.blindT = Math.max(0, p.blindT - dt); p.slowT = Math.max(0, p.slowT - dt); p.stunT = Math.max(0, p.stunT - dt); p.revealT = Math.max(0, p.revealT - dt);
    p.fireCd = Math.max(0, p.fireCd - dt); p.switchT = Math.max(0, p.switchT - dt);
    if (!p.alive) return;
    if (p.healT > 0) { const h = Math.min(dt * 20, p.healT); p.healT -= h; p.hp = Math.min(100, p.hp + h); }
    p.yaw = I.yaw; p.pitch = clamp(I.pitch, -1.5, 1.5);
    // compra
    if (I.buy) { this.buy(p, I.buy); I.buy = null; }
    this.moveStep(p, I, dt);
    // passos
    const hs = Math.hypot(p.vx, p.vz);
    p.stepAcc = (p.stepAcc || 0) + (p.onGround && !I.walk && p.crouch < 0.5 && hs > 4 ? hs * dt : 0);
    if (p.stepAcc > 2.4) { p.stepAcc = 0; this.emit({ k: 'step', id: p.id, x: p.x, z: p.z }); }
    // troca de arma
    if (I.slot && I.slot !== p.cur && (I.slot === 3 || p.guns[I.slot]) && p.stunT <= 0) { p.cur = I.slot; p.reloadT = 0; p.switchT = 0.55; p.zoom = false; p.burst = 0; this.emit({ k: 'swap', id: p.id }); }
    I.slot = 0;
    if (I.drop && p.cur !== 3 && p.guns[p.cur] && !(p.cur === 2 && p.guns[p.cur].id === 'lasca' && false)) { this.dropGun(p, p.cur); I.drop = false; }
    I.drop = false;
    // recarga
    const G = p.cur === 3 ? null : p.guns[p.cur];
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0 && G) { const W2 = WEAPONS[G.id], need = W2.mag - G.ammo, take = Math.min(need, G.res); G.ammo += take; G.res -= take; }
    } else if (G && ((I.reload && G.ammo < WEAPONS[G.id].mag) || G.ammo === 0) && G.res > 0 && p.switchT <= 0) { p.reloadT = WEAPONS[G.id].reload; p.zoom = false; this.emit({ k: 'reload', id: p.id }); }
    I.reload = false;
    // mira (botão direito) para snipers
    const Wc = this.curW(p);
    if (I.alt && Wc && Wc.zoom && !I.altHeld && p.reloadT <= 0) { p.zoom = !p.zoom; }
    I.altHeld = I.alt;
    // tiro
    if (I.fire && p.stunT <= 0 && p.switchT <= 0 && p.reloadT <= 0 && p.fireCd <= 0 && this.phase !== 'buy' && this.phase !== 'end') {
      if (p.cur === 3) this.melee(p);
      else if (G && G.ammo > 0 && (Wc.auto || !I.fireHeld)) this.shoot(p, G);
    }
    if (!I.fire || this.t - p.lastShot > 0.25) { p.burst = Math.max(0, p.burst - dt * 12); }
    if (this.t - p.lastShot > 0.12) p.recoil = Math.max(0, p.recoil - dt * 14);
    I.fireHeld = I.fire;
    // habilidades
    if (I.ab) { this.useAbility(p, I.ab); I.ab = null; }
    // plantar / desarmar
    this.updateUse(p, dt);
  }
  // movimento (também usado pelo cliente para prever o próprio boneco)
  moveStep(p, I, dt, silent) {
    // agachar
    const wantC = I.crouch ? 1 : 0;
    if (wantC < p.crouch && this.headBlocked(p)) { } else p.crouch += (wantC - p.crouch) * Math.min(1, dt * 14);
    // movimento
    let sp = I.walk ? MOVE.walk : MOVE.run;
    if (p.crouch > 0.5) sp = MOVE.crouch;
    if (p.slowT > 0) sp *= 1 - p.slowAmt;
    if (p.stunT > 0) sp *= 0.35;
    const W = this.curW(p); if (W && W.cat === 'Pesadas') sp *= 0.92; if (W && W.zoom && p.zoom) sp *= 0.6;
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    let mx = I.mx, mz = I.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    // mz>0 = para frente
    const wx = sy * mz + cy * mx, wz = -cy * mz + sy * mx;
    const tx = wx * sp, tz = wz * sp;
    if (p.dashT > 0) { p.dashT -= dt; }
    else {
      const a = (p.onGround ? MOVE.accel : MOVE.air) * dt;
      const dvx = tx - p.vx, dvz = tz - p.vz, dl = Math.hypot(dvx, dvz);
      if (dl <= a) { p.vx = tx; p.vz = tz; } else { p.vx += dvx / dl * a; p.vz += dvz / dl * a; }
    }
    if (I.jump && p.onGround && p.stunT <= 0) { p.vy = MOVE.jump; p.onGround = false; if (!silent) this.emit({ k: 'jump', id: p.id }); }
    p.vy -= MOVE.grav * dt;
    // fase de compra: preso no spawn
    const lockSpawn = this.phase === 'buy';
    this.moveAxis(p, 'x', p.vx * dt, lockSpawn); this.moveAxis(p, 'z', p.vz * dt, lockSpawn); this.moveAxis(p, 'y', p.vy * dt);
  }
  curW(p) { if (p.cur === 3) return WEAPONS.faca; const g = p.guns[p.cur]; return g ? WEAPONS[g.id] : null; }
  height(p) { return PH.H - (PH.H - PH.HC) * p.crouch; }
  eye(p) { return p.y + PH.EYE - (PH.EYE - PH.EYEC) * p.crouch; }
  headBlocked(p) { for (const b of this.solids) if (aabbHit(b, p.x - PH.R, p.y + PH.HC, p.z - PH.R, p.x + PH.R, p.y + PH.H, p.z + PH.R)) return true; return false; }
  moveAxis(p, ax, d, lock) {
    if (!d) { if (ax === 'y') this.groundCheck(p); return; }
    p[ax] += d;
    const h = this.height(p);
    for (const b of this.solids) {
      if (b.team != null && b.ghost) continue;
      if (!aabbHit(b, p.x - PH.R, p.y, p.z - PH.R, p.x + PH.R, p.y + h, p.z + PH.R)) continue;
      if (ax === 'x') p.x = d > 0 ? b.x0 - PH.R - 1e-4 : b.x1 + PH.R + 1e-4;
      else if (ax === 'z') p.z = d > 0 ? b.z0 - PH.R - 1e-4 : b.z1 + PH.R + 1e-4;
      else { if (d < 0) { p.y = b.y1; p.vy = 0; p.onGround = true; } else { p.y = b.y0 - h - 1e-4; p.vy = 0; } }
    }
    if (ax === 'y') {
      if (p.y <= 0) { p.y = 0; p.vy = Math.max(0, p.vy); p.onGround = true; }
      else if (d > 0) p.onGround = false; else this.groundCheck(p);
    }
    if (lock && ax !== 'y') {
      const side = this.sideOf(p), ch = side === 'atk' ? 'T' : 'D';
      const ok = (x, z) => { const [c, r] = this.M.cellOf(x, z); return this.M.at(c, r) === ch; };
      if (!ok(p.x + (ax === 'x' ? Math.sign(d) * PH.R : 0), p.z + (ax === 'z' ? Math.sign(d) * PH.R : 0))) p[ax] -= d;
    }
  }
  groundCheck(p) {
    if (p.y <= 0.001) { p.onGround = true; return; }
    let g = false; for (const b of this.solids) if (aabbHit(b, p.x - PH.R, p.y - 0.05, p.z - PH.R, p.x + PH.R, p.y, p.z + PH.R) && b.y1 <= p.y + 0.01) { g = true; break; }
    p.onGround = g;
  }

  // ---------------- tiros ----------------
  spreadOf(p, W) {
    const hs = Math.hypot(p.vx, p.vz) / MOVE.run;
    let s = W.spread + W.mv * Math.max(0, hs - 0.25) + (p.onGround ? 0 : 7) + p.burst * (W.auto ? 0.16 : 0.5);
    if (W.unscoped && !p.zoom) s += W.unscoped;
    if (p.crouch > 0.5 && p.onGround) s *= 0.75;
    return s * Math.PI / 180;
  }
  shoot(p, G) {
    const W = WEAPONS[G.id];
    G.ammo--; p.fireCd = 1 / W.rps; p.lastShot = this.t;
    const sp = this.spreadOf(p, W);
    const ey = this.eye(p);
    const n = W.pellets || 1;
    const hits = [], trs = [];
    // compensação de atraso: volta os alvos para onde o atirador os via
    let restore = null;
    if (p.viewTick && this.hist && this.hist.length) {
      const h0 = this.hist.find(h => h.tk >= p.viewTick) || this.hist[this.hist.length - 1];
      const keep = this.players.map(q => [q.x, q.y, q.z, q.crouch]);
      this.players.forEach((q, i) => { if (q !== p && h0.P[i]) [q.x, q.y, q.z, q.crouch] = h0.P[i]; });
      restore = () => this.players.forEach((q, i) => { [q.x, q.y, q.z, q.crouch] = keep[i]; });
    }
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
      const yaw = p.yaw + Math.cos(a) * r, pitch = p.pitch + p.recoil * Math.PI / 180 + Math.sin(a) * r;
      const d = fwdVec(yaw, pitch);
      const h = this.trace(p.x, ey, p.z, d[0], d[1], d[2], 200, p);
      hits.push(h);
      if (k < 3) trs.push([+p.x.toFixed(2), +(ey - 0.12).toFixed(2), +p.z.toFixed(2), +(p.x + d[0] * h.t).toFixed(2), +(ey + d[1] * h.t).toFixed(2), +(p.z + d[2] * h.t).toFixed(2)]);
      if (h.p) {
        const zone = h.zone, dmg0 = W.dmg[zone === 'head' ? 0 : zone === 'body' ? 1 : 2];
        let dmg = dmg0; if (W.falloff && h.t > W.falloff) dmg *= Math.max(0.3, 1 - (h.t - W.falloff) / 20);
        this.hurt(h.p, dmg, p, zone, G.id);
      }
    }
    if (restore) restore();
    p.recoil = Math.min(p.recoil + W.rec * (0.6 + Math.random() * 0.5), 9);
    p.burst = Math.min(p.burst + 1, 12);
    if (W.zoom && p.zoom && W.rps < 1) p.zoom = false;
    for (const t of trs) this.tracers.push({ x0: t[0], y0: t[1], z0: t[2], x1: t[3], y1: t[4], z1: t[5], t: 0.06, owner: p.id });
    this.emit({ k: 'shot', id: p.id, w: G.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), tr: trs });
    this.alertBots(p, 40);
  }
  melee(p) {
    p.fireCd = 1 / WEAPONS.faca.rps; p.lastShot = this.t;
    const d = fwdVec(p.yaw, p.pitch), h = this.trace(p.x, this.eye(p), p.z, d[0], d[1], d[2], WEAPONS.faca.range, p);
    if (h.p) this.hurt(h.p, 50, p, 'body', 'faca');
    this.emit({ k: 'knife', id: p.id });
  }
  // raio contra paredes, barreiras e jogadores. vision=true também para em névoas
  trace(ox, oy, oz, dx, dy, dz, max, ignore, vision) {
    let best = max, bp = null, zone = null;
    for (const b of this.solids) { const t = rayBox(ox, oy, oz, dx, dy, dz, b, best); if (t >= 0 && t < best) best = t; }
    if (vision) {
      for (const s of this.smokes) { const t = raySphere(ox, oy, oz, dx, dy, dz, s.x, s.y, s.z, s.r, best); if (t >= 0 && t < best) best = t; }
      for (const w of this.temp) if (w.vis) { const t = rayBox(ox, oy, oz, dx, dy, dz, w, best); if (t >= 0 && t < best) best = t; }
    }
    if (vision !== 'walls') for (const q of this.players) {
      if (!q.alive || q === ignore) continue;
      for (const [z, hb] of this.hitboxes(q)) { const t = rayBox(ox, oy, oz, dx, dy, dz, hb, best); if (t >= 0 && t < best) { best = t; bp = q; zone = z; } }
    }
    return { t: best, p: bp, zone };
  }
  hitboxes(q) {
    const h = this.height(q), hx = 0.17, bx = 0.3;
    return [
      ['head', { x0: q.x - hx, x1: q.x + hx, y0: q.y + h - 0.34, y1: q.y + h, z0: q.z - hx, z1: q.z + hx }],
      ['body', { x0: q.x - bx, x1: q.x + bx, y0: q.y + h * 0.45, y1: q.y + h - 0.34, z0: q.z - bx * 0.7, z1: q.z + bx * 0.7 }],
      ['legs', { x0: q.x - 0.24, x1: q.x + 0.24, y0: q.y, y1: q.y + h * 0.45, z0: q.z - 0.18, z1: q.z + 0.18 }],
    ];
  }
  hurt(t, dmg, src, zone, wid, tick) {
    if (!t.alive || (this.phase === 'end' && wid !== 'nucleo')) return;
    if (src && src.team === t.team && src !== t && wid !== 'nucleo') return; // sem fogo amigo
    if (tick) { t.tickAcc = (t.tickAcc || 0) + dmg; if (t.tickAcc < 1) return; dmg = Math.floor(t.tickAcc); t.tickAcc -= dmg; }
    else dmg = Math.round(dmg);
    const a = Math.min(t.armor, dmg); t.armor -= a; const rest = dmg - a; t.hp -= rest;
    if (src && src !== t) { src.dmg += dmg; t.lastHitBy = src.id; }
    if (!tick || t.hp <= 0) this.emit({ k: 'hit', id: t.id, by: src ? src.id : 0, dmg, zone, x: t.x, y: t.y + (zone === 'head' ? 1.7 : 1.1), z: t.z, tick: !!tick });
    if (t.bot && src) { t.brain = t.brain || {}; t.brain.alert = { x: src.x, z: src.z, t: this.t }; }
    if (t.hp <= 0) this.kill(t, src, zone, wid);
  }
  kill(t, src, zone, wid) {
    t.alive = false; t.hp = 0; t.deaths++; t.zoom = false; t.useT = 0;
    let k = src && src !== t && src.team !== t.team ? src : null;
    if (!k && t.lastHitBy) { const q = this.byId(t.lastHitBy); if (q && q.team !== t.team) k = q; }
    if (k) { k.kills++; k.roundKills++; k.creds = Math.min(RULES.maxCreds, k.creds + RULES.kill); k.ult = Math.min(FPS_ULT[k.hunter], k.ult + 1); }
    t.ult = Math.min(FPS_ULT[t.hunter], t.ult + 1);
    // larga arma e Núcleo
    if (t.guns[1]) this.dropGun(t, 1); else if (t.guns[2] && t.guns[2].id !== 'lasca') this.dropGun(t, 2);
    if (t.nucleo) { t.nucleo = false; this.nucleo = { x: t.x, z: t.z, planted: false }; this.emit({ k: 'nucleoDrop', x: t.x, z: t.z }); }
    t.body = { x: t.x, z: t.z, yaw: t.yaw };
    this.emit({ k: 'kill', id: t.id, by: k ? k.id : 0, w: wid, hs: zone === 'head' });
  }
  dropGun(p, slot) {
    const g = p.guns[slot]; if (!g) return;
    p.guns[slot] = null;
    const d = fwdVec(p.yaw, 0);
    this.drops.push({ g, x: p.x + d[0] * 1.2, z: p.z + d[2] * 1.2, t: this.t });
    if (p.cur === slot) p.cur = p.guns[1] ? 1 : p.guns[2] ? 2 : 3;
  }
  pickupNear(p) {
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]; if (Math.hypot(d.x - p.x, d.z - p.z) > 1.6 || this.t - d.t < 0.6) continue;
      const slot = WEAPONS[d.g.id].slot;
      if (p.guns[slot]) this.dropGun(p, slot);
      p.guns[slot] = d.g; p.cur = slot; this.drops.splice(this.drops.indexOf(d), 1); this.emit({ k: 'pickup', id: p.id, w: d.g.id }); return true;
    }
    return false;
  }

  // ---------------- compra ----------------
  canBuy(p) { return this.phase === 'buy' && p.alive; }
  buy(p, item) {
    if (!this.canBuy(p)) return false;
    if (WEAPONS[item]) {
      const W = WEAPONS[item]; if (p.creds < W.preco) return false;
      const slot = W.slot, old = p.guns[slot];
      if (old && old.id === item) return false;
      p.creds -= W.preco; if (old && old.bought) p.creds += WEAPONS[old.id].preco; // devolve se comprou neste round
      p.guns[slot] = { id: item, ammo: W.mag, res: W.res, bought: this.round };
      p.cur = slot; this.emit({ k: 'buy', id: p.id, w: item }); return true;
    }
    if (SHIELDS[item]) {
      const S = SHIELDS[item]; if (p.armor >= S.val || p.creds < S.preco) return false;
      p.creds -= S.preco; p.armor = S.val; this.emit({ k: 'buy', id: p.id, w: item }); return true;
    }
    if (item === 'c' || item === 'q') {
      const A = FPS_HUNTERS[p.hunter][item]; if (p.ab[item] >= A.max || p.creds < A.preco) return false;
      p.creds -= A.preco; p.ab[item]++; this.emit({ k: 'buy', id: p.id, w: item }); return true;
    }
    return false;
  }

  // ---------------- Núcleo ----------------
  updateUse(p, dt) {
    const I = p.in, att = this.attTeam();
    let busy = false;
    if (I.use && p.onGround && p.stunT <= 0 && (this.phase === 'live' || this.phase === 'planted')) {
      if (p.team === att && p.nucleo && this.phase === 'live' && this.M.siteAt(p.x, p.z)) {
        busy = true; p.useT += dt; p.vx *= 0.5; p.vz *= 0.5;
        if (p.useT >= RULES.plantTime) {
          p.nucleo = false; p.plants++; p.ult = Math.min(FPS_ULT[p.hunter], p.ult + 1);
          this.nucleo = { x: p.x, z: p.z, planted: true, site: this.M.siteAt(p.x, p.z) };
          this.phase = 'planted'; this.phaseT = RULES.nucleoTime; this.plantSite = this.nucleo.site;
          for (const q of this.players) if (q.team === att) q.creds = Math.min(RULES.maxCreds, q.creds + RULES.plant);
          this.emit({ k: 'planted', id: p.id, site: this.nucleo.site, x: p.x, z: p.z }); p.useT = 0;
        }
      } else if (p.team !== att && this.phase === 'planted' && this.nucleo && Math.hypot(p.x - this.nucleo.x, p.z - this.nucleo.z) < 1.6) {
        busy = true; p.useT += dt; p.vx *= 0.5; p.vz *= 0.5;
        if (p.useT >= RULES.defuseTime / 2 && !p.halfDone) { p.halfDone = true; this.defuseHalf = true; }
        if (p.useT >= RULES.defuseTime) {
          p.defuses++; p.ult = Math.min(FPS_ULT[p.hunter], p.ult + 1); this.emit({ k: 'defused', id: p.id });
          this.nucleo.defused = true; p.useT = 0; this.endRound(1 - att, 'defuse');
        }
      } else if (!p.usedPick) { if (this.pickupNear(p)) p.usedPick = true; }
    } else p.usedPick = false;
    if (!busy) { if (p.useT > 0 && this.defuseHalf && p.team !== att && p.useT >= RULES.defuseTime / 2) p.useT = RULES.defuseTime / 2; else if (!(p.team !== att && p.useT >= RULES.defuseTime / 2 && this.defuseHalf)) p.useT = 0; }
  }

  // ---------------- habilidades ----------------
  useAbility(p, key) {
    if (!p.alive || p.stunT > 0 || this.phase === 'end') return;
    const HD = FPS_HUNTERS[p.hunter];
    if (key === 'x') { if (p.ult < FPS_ULT[p.hunter] || this.phase === 'buy') return; }
    else if (p.ab[key] <= 0) return;
    if (this.phase === 'buy' && !['e', 'c', 'q'].includes(key)) return;
    const ok = (ABILITY[p.hunter][key] || (() => false))(this, p);
    if (ok === false) return;
    if (key === 'x') p.ult = 0; else p.ab[key]--;
    this.emit({ k: 'ability', id: p.id, key, h: p.hunter, nome: HD[key].nome });
  }
  aimPoint(p, max) {
    const ey = this.eye(p), d = fwdVec(p.yaw, p.pitch);
    const h = this.trace(p.x, ey, p.z, d[0], d[1], d[2], max, p, 'walls');
    let t = h.t; if (d[1] < -0.01) { const tg = -ey / d[1]; if (tg < t) t = tg; }
    return [p.x + d[0] * (t - 0.3), Math.max(0, ey + d[1] * (t - 0.3)), p.z + d[2] * (t - 0.3), t];
  }
  throwG(p, kind, speed, opt = {}) {
    const d = fwdVec(p.yaw, p.pitch + (opt.lift ?? 0.12)), ey = this.eye(p);
    this.grenades.push(Object.assign({ kind, owner: p.id, team: p.team, x: p.x + d[0] * 0.5, y: ey - 0.1, z: p.z + d[2] * 0.5, vx: d[0] * speed + p.vx * 0.3, vy: d[1] * speed, vz: d[2] * speed + p.vz * 0.3, fuse: 2.5, grav: 12, bounce: true }, opt));
  }
  updateGrenades(dt) {
    const keep = [];
    for (const g of this.grenades) {
      g.fuse -= dt;
      g.vy -= g.grav * dt;
      let landed = false;
      for (const ax of ['x', 'y', 'z']) {
        const old = g[ax]; g[ax] += g['v' + ax] * dt;
        let hit = g.y < 0.08 && ax === 'y';
        if (!hit) for (const b of this.solids) if (g.x > b.x0 && g.x < b.x1 && g.y > b.y0 && g.y < b.y1 && g.z > b.z0 && g.z < b.z1) { hit = true; break; }
        if (hit) {
          g[ax] = old; if (ax === 'y') { landed = g.vy < 0; g.y = Math.max(g.y, 0.08); }
          if (g.onHit) { g.fuse = 0; break; }
          g['v' + ax] *= -0.35; if (ax === 'y') { g.vx *= 0.7; g.vz *= 0.7; }
        }
      }
      if (g.onLand && landed) g.fuse = 0;
      if (g.fuse <= 0) { GRENADE_END[g.kind](this, g); continue; }
      keep.push(g);
    }
    this.grenades = keep;
  }
  updateZones(dt) {
    for (const z of this.zones) {
      z.t -= dt;
      for (const p of this.players) {
        if (!p.alive || Math.hypot(p.x - z.x, p.z - z.z) > z.r || p.y > 2) continue;
        const enemy = p.team !== z.team;
        if (z.dps && (enemy || p.id === z.owner)) this.hurt(p, z.dps * dt, this.byId(z.owner), 'body', z.kind, true); // dano contínuo
        if (z.slow && enemy) { p.slowT = Math.max(p.slowT, 0.2); p.slowAmt = Math.max(p.slowAmt, z.slow); }
      }
    }
    this.zones = this.zones.filter(z => z.t > 0);
    for (const s of this.smokes) s.t -= dt; this.smokes = this.smokes.filter(s => s.t > 0);
    let ch = false; for (const w of this.temp) { w.t -= dt; if (w.t <= 0) ch = true; }
    if (ch) { this.temp = this.temp.filter(w => w.t > 0); this.solids = this.M.solids.concat(this.temp.filter(w => w.solid)); }
  }
  explode(x, y, z, r, dmg, src, kind) {
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.y + 1 - y, p.z - z); if (d > r) continue;
      if (p.team === src?.team && p !== src) continue;
      // precisa de linha livre até o alvo
      const dx = p.x - x, dy = p.y + 1 - y, dz = p.z - z, l = Math.hypot(dx, dy, dz) || 1;
      const h = this.trace(x, y + 0.2, z, dx / l, dy / l, dz / l, l, null, 'walls'); if (h.t < l - 0.4) continue;
      this.hurt(p, dmg * (1 - d / r * 0.65), src, 'body', kind);
    }
    this.emit({ k: 'boom', x, y, z, r, kind });
  }
  alertBots(p, r) { for (const q of this.players) if (q.bot && q.alive && q.team !== p.team && Math.hypot(q.x - p.x, q.z - p.z) < r) { q.brain = q.brain || {}; q.brain.alert = { x: p.x, z: p.z, t: this.t }; } }
  canSee(a, b) { // a vê b? (olhos até cabeça/peito)
    if (!b.alive) return false;
    const ey = this.eye(a);
    for (const ty of [b.y + this.height(b) - 0.15, b.y + 1.0]) {
      const dx = b.x - a.x, dy = ty - ey, dz = b.z - a.z, l = Math.hypot(dx, dy, dz);
      const h = this.trace(a.x, ey, a.z, dx / l, dy / l, dz / l, l, a, 'walls');
      if (h.t >= l - 0.05 && !this.smokeBlocks(a.x, ey, a.z, dx / l, dy / l, dz / l, l)) return true;
    }
    return false;
  }
  smokeBlocks(ox, oy, oz, dx, dy, dz, l) {
    for (const s of this.smokes) { const t = raySphere(ox, oy, oz, dx, dy, dz, s.x, s.y, s.z, s.r, l); if (t >= 0) return true; }
    for (const w of this.temp) if (w.vis) { const t = rayBox(ox, oy, oz, dx, dy, dz, w, l); if (t >= 0) return true; }
    return false;
  }
}

// ---------------- habilidades de cada caçador ----------------
const GRENADE_END = {
  molotov(G, g) { G.zones.push({ kind: 'fire', x: g.x, z: g.z, r: 3.4, t: 6, T: 6, dps: 32, team: g.team, owner: g.owner }); G.emit({ k: 'fire', x: g.x, z: g.z }); },
  frag(G, g) { G.explode(g.x, g.y, g.z, 5.5, 125, G.byId(g.owner), 'frag'); },
  rocket(G, g) { G.explode(g.x, g.y, g.z, 6.5, 190, G.byId(g.owner), 'rocket'); },
  dart(G, g) {
    for (const p of G.players) if (p.alive && p.team !== g.team && Math.hypot(p.x - g.x, p.z - g.z) < 13) p.revealT = 3;
    G.emit({ k: 'reveal', x: g.x, z: g.z, r: 13, team: g.team });
  },
  flash(G, g) {
    for (const p of G.players) {
      if (!p.alive) continue;
      const ey = G.eye(p), dx = g.x - p.x, dy = g.y - ey, dz = g.z - p.z, l = Math.hypot(dx, dy, dz);
      if (l > 30) continue;
      const h = G.trace(p.x, ey, p.z, dx / l, dy / l, dz / l, l, p, 'walls'); if (h.t < l - 0.3) continue;
      const f = fwdVec(p.yaw, p.pitch), dot = (f[0] * dx + f[1] * dy + f[2] * dz) / l;
      if (dot < 0.2) continue;
      p.blindT = Math.max(p.blindT, 0.6 + 1.6 * dot);
    }
    G.emit({ k: 'flash', x: g.x, y: g.y, z: g.z });
  },
  puddle(G, g) { G.zones.push({ kind: 'puddle', x: g.x, z: g.z, r: 4, t: 5, T: 5, slow: 0.5, team: g.team, owner: g.owner }); G.emit({ k: 'splash', x: g.x, z: g.z }); },
  slowOrb(G, g) { G.zones.push({ kind: 'slow', x: g.x, z: g.z, r: 5, t: 6, T: 6, slow: 0.6, team: g.team, owner: g.owner }); G.emit({ k: 'splash', x: g.x, z: g.z }); },
  boulder(G, g) {
    for (const p of G.players) if (p.alive && p.team !== g.team && Math.hypot(p.x - g.x, p.z - g.z) < 4.5) { p.stunT = Math.max(p.stunT, 1.4); G.hurt(p, 15, G.byId(g.owner), 'body', 'pedra'); }
    G.emit({ k: 'boom', x: g.x, y: g.y, z: g.z, r: 4.5, kind: 'stone' });
  },
  smoke(G, g) { G.smokes.push({ x: g.x, y: 1.6, z: g.z, r: 3.7, t: 15, T: 15, team: g.team }); G.emit({ k: 'smoke', x: g.x, z: g.z }); },
};
const ABILITY = {
  brasa: {
    c(G, p) { G.throwG(p, 'molotov', 14, { onLand: true }); },
    q(G, p) {
      const I = p.in, cy = Math.cos(p.yaw), sy = Math.sin(p.yaw); let mx = I.mx, mz = I.mz; if (!mx && !mz) mz = 1;
      const l = Math.hypot(mx, mz), wx = (sy * mz + cy * mx) / l, wz = (-cy * mz + sy * mx) / l;
      p.vx = wx * 17; p.vz = wz * 17; p.dashT = 0.22; G.emit({ k: 'dash', id: p.id });
    },
    e(G, p) { G.throwG(p, 'frag', 15, { fuse: 1.6 }); },
    x(G, p) { G.throwG(p, 'rocket', 32, { lift: 0, grav: 0, onHit: true, fuse: 4, bounce: false }); },
  },
  corvo: {
    c(G, p) { G.throwG(p, 'dart', 22, { onLand: true, lift: 0.08 }); },
    q(G, p) { G.throwG(p, 'flash', 16, { fuse: 0.7, lift: 0.1 }); },
    e(G, p) {
      const d = fwdVec(p.yaw, 0), ey = p.y + 0.9;
      const h = G.trace(p.x, ey, p.z, d[0], 0, d[2], 9, p, 'walls'); const t = Math.max(0, h.t - 0.7);
      p.x += d[0] * t; p.z += d[2] * t; G.emit({ k: 'blink', id: p.id });
    },
    x(G, p) { for (const q of G.players) if (q.alive && q.team !== p.team) q.revealT = 6; G.revealTeam[p.team] = 6; G.emit({ k: 'hunt', team: p.team }); },
  },
  mare: {
    c(G, p) {
      const d = fwdVec(p.yaw, 0), cx = p.x + d[0] * 3, cz = p.z + d[2] * 3, px = -d[2], pz = d[0];
      for (let i = -3; i <= 3; i++) { const x = cx + px * i * 1.8, z = cz + pz * i * 1.8; G.temp.push({ x0: x - 0.95, x1: x + 0.95, y0: 0, y1: 3.4, z0: z - 0.95, z1: z + 0.95, t: 10, T: 10, vis: true, solid: false, kind: 'water' }); }
      G.emit({ k: 'splash', x: cx, z: cz });
    },
    q(G, p) { G.throwG(p, 'puddle', 13, { onLand: true }); },
    e(G, p) { const [x, , z, t] = G.aimPoint(p, 38); G.grenades.push({ kind: 'smoke', owner: p.id, team: p.team, x, y: 1.6, z, vx: 0, vy: 0, vz: 0, fuse: Math.min(1, t / 40 + 0.2), grav: 0 }); },
    x(G, p) { const [x, , z] = G.aimPoint(p, 40); G.zones.push({ kind: 'flood', x, z, r: 9, t: 8, T: 8, slow: 0.6, dps: 12, team: p.team, owner: p.id }); G.emit({ k: 'splash', x, z, big: 1 }); },
  },
  lumi: {
    c(G, p) {
      const d = fwdVec(p.yaw, 0), cx = p.x + d[0] * 3.5, cz = p.z + d[2] * 3.5, px = -d[2], pz = d[0];
      for (let i = -2; i <= 2; i++) { const x = cx + px * i * 1.5, z = cz + pz * i * 1.5; G.temp.push({ x0: x - 0.8, x1: x + 0.8, y0: 0, y1: 3, z0: z - 0.8, z1: z + 0.8, t: 8, T: 8, vis: true, solid: true, kind: 'barrier' }); }
      G.solids = G.M.solids.concat(G.temp.filter(w => w.solid));
      for (const q of G.players) if (q.alive) for (const b of G.temp) if (b.solid && aabbHit(b, q.x - PH.R, q.y, q.z - PH.R, q.x + PH.R, q.y + 1.8, q.z + PH.R)) { q.x -= d[0] * 1.6; q.z -= d[2] * 1.6; }
      G.emit({ k: 'barrier', x: cx, z: cz });
    },
    q(G, p) { G.throwG(p, 'slowOrb', 14, { onLand: true }); },
    e(G, p) {
      const d = fwdVec(p.yaw, p.pitch), h = G.trace(p.x, G.eye(p), p.z, d[0], d[1], d[2], 15, p);
      const t = h.p && h.p.team === p.team ? h.p : p;
      if (t.hp >= 100) return false;
      t.healT = 60; G.emit({ k: 'heal', id: t.id, by: p.id });
    },
    x(G, p) {
      let best = null, bd = 1e9; const [ax, , az] = G.aimPoint(p, 25);
      for (const q of G.players) if (!q.alive && q.team === p.team && q.body) { const d = Math.hypot(q.body.x - ax, q.body.z - az); if (d < bd && Math.hypot(q.body.x - p.x, q.body.z - p.z) < 25) { bd = d; best = q; } }
      if (!best) return false;
      Object.assign(best, { alive: true, hp: 100, x: best.body.x, z: best.body.z, y: 0, vx: 0, vz: 0, vy: 0, guns: { 1: null, 2: { id: 'lasca', ammo: 12, res: 36 } }, cur: 2 });
      G.emit({ k: 'revive', id: best.id });
    },
  },
  rocha: {
    c(G, p) { if (p.armor >= 100) return false; p.armor = Math.min(100, p.armor + 50); G.emit({ k: 'shieldUp', id: p.id }); },
    q(G, p) {
      for (const q of G.players) {
        if (!q.alive || q.team === p.team) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > 11) continue;
        const f = fwdVec(p.yaw, 0); if ((dx * f[0] + dz * f[2]) / d < 0.8) continue;
        q.stunT = Math.max(q.stunT, 1.5);
      }
      G.emit({ k: 'quake', id: p.id, x: p.x, z: p.z, yaw: p.yaw });
    },
    e(G, p) { G.throwG(p, 'boulder', 15, { onLand: true }); },
    x(G, p) { for (const q of G.players) if (q.alive && q.team !== p.team && Math.hypot(q.x - p.x, q.z - p.z) < 17) q.stunT = Math.max(q.stunT, 2.5); G.emit({ k: 'boom', x: p.x, y: 0.5, z: p.z, r: 17, kind: 'quake' }); },
  },
};

// ---------------- bots ----------------
function botThink(G, p, dt) {
  const B = p.brain = p.brain || {};
  const I = p.in, att = G.attTeam(), atk = p.team === att, M = G.M;
  I.fire = false; I.use = false; I.jump = false; I.crouch = false; I.walk = false; I.mx = 0; I.mz = 0;
  B.skill = B.skill || (0.6 + Math.random() * 0.4);
  // compra
  if (G.phase === 'buy') {
    if (!B.bought && G.phaseT < RULES.buyTime - 1.5 - Math.random()) { botBuy(G, p); B.bought = true; }
    I.yaw = p.yaw; I.pitch = 0; return;
  }
  B.bought = false;
  // alvo visível
  B.scanT = (B.scanT || 0) - dt;
  if (B.scanT <= 0) {
    B.scanT = 0.12;
    let best = null, bd = 1e9;
    for (const q of G.players) {
      if (!q.alive || q.team === p.team) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z); if (d > 70) continue;
      const rel = Math.abs(angWrap(Math.atan2(q.x - p.x, -(q.z - p.z)) - p.yaw));
      const known = q.revealT > 0 || (B.target === q);
      if (rel > 1.3 && !known && d > 6) continue;
      if (p.blindT > 0.3) continue;
      if (G.canSee(p, q) && d < bd) { bd = d; best = q; }
    }
    if (best !== B.target) { B.target = best; B.react = best ? (0.22 + Math.random() * 0.25) / B.skill + (p.blindT > 0 ? 0.6 : 0) : 0; B.aimErr = 0.06 + Math.random() * 0.05; }
    if (best) B.lastSeen = { x: best.x, z: best.z, t: G.t };
  }
  const T = B.target;
  // decide para onde ir
  if (G.phase === 'planted' && B.mode !== 'planted') { B.mode = 'planted'; B.goal = null; }
  if (G.phase !== 'planted') B.mode = 'live';
  if (!B.goal || G.t > (B.goalT || 0)) planBot(G, p, B);
  let moving = true;
  if (T) {
    B.react -= dt;
    const ey = G.eye(p), ty = T.y + G.height(T) - (Math.random() < 0.35 * B.skill ? 0.15 : 0.6);
    const dx = T.x - p.x, dz = T.z - p.z, d = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, -dz), wantPitch = Math.atan2(ty - ey, d);
    B.aimErr = Math.max(0.004, B.aimErr - dt * 0.09 * B.skill);
    const ey2 = angWrap(wantYaw - p.yaw), ep = wantPitch - p.pitch;
    const turn = 9 * dt;
    I.yaw = p.yaw + clamp(ey2, -turn, turn) + (Math.random() - 0.5) * B.aimErr * 0.4;
    I.pitch = p.pitch + clamp(ep, -turn, turn);
    const W = G.curW(p), onT = Math.abs(ey2) < B.aimErr + 0.02 && Math.abs(ep) < 0.06;
    if (B.react <= 0 && onT) {
      if (W && W.zoom && !p.zoom) I.alt = !I.alt; else I.alt = false;
      if (!W.auto) I.fire = !p.in.fireHeld && Math.random() < 0.6;
      else { B.burstT = (B.burstT || 0) - dt; if (B.burstT > -0.25) I.fire = true; if (B.burstT < -0.25 - 0.2 * Math.random()) B.burstT = d > 18 ? 0.18 : 0.45; }
      moving = d < 6 || W.melee; // para para atirar (mais precisão)
      if (W.melee) moving = true;
    }
    // habilidades contra o alvo
    B.abT = (B.abT || 1) - dt;
    if (B.abT <= 0 && d > 6 && d < 28) { B.abT = 3 + Math.random() * 4; botAbility(G, p, T, d); }
    if (p.ult >= FPS_ULT[p.hunter] && Math.random() < dt * 0.4) botUlt(G, p, T);
    if (W && W.melee && p.guns[2]) I.slot = 2;
    // sem munição -> troca
    const G2 = p.guns[p.cur]; if (G2 && G2.ammo === 0 && G2.res === 0) I.slot = p.cur === 1 ? 2 : 3;
  } else {
    // sem alvo: olhar para onde anda / alerta
    if (B.alert && G.t - B.alert.t < 3) { const a = Math.atan2(B.alert.x - p.x, -(B.alert.z - p.z)); I.yaw = p.yaw + clamp(angWrap(a - p.yaw), -5 * dt, 5 * dt); }
    I.pitch = p.pitch * 0.9;
    const G2 = p.guns[p.cur]; if (G2 && G2.ammo < WEAPONS[G2.id].mag * 0.5) I.reload = true;
    if (p.cur === 3 && (p.guns[1] || p.guns[2])) I.slot = p.guns[1] ? 1 : 2;
    if (p.hunter === 'lumi' && p.hp < 55 && p.ab.e > 0) { I.pitch = -1.4; I.ab = 'e'; }
  }
  // Núcleo: plantar / desarmar
  if (atk && p.nucleo && M.siteAt(p.x, p.z) && !T && G.phase === 'live') { const c = B.plantSpot; if (!c || Math.hypot(c[0] - p.x, c[1] - p.z) < 1.5 || B.atSite) { moving = false; I.use = true; } }
  if (!atk && G.phase === 'planted' && G.nucleo && Math.hypot(G.nucleo.x - p.x, G.nucleo.z - p.z) < 1.4 && (!T || p.useT > 1.5)) { moving = false; I.use = true; }
  if (G.nucleo && !G.nucleo.planted && atk && Math.hypot(G.nucleo.x - p.x, G.nucleo.z - p.z) < 25 && !B.toNucleo) { B.toNucleo = true; B.goal = [G.nucleo.x, G.nucleo.z]; B.path = null; }
  // anda pelo caminho
  if (moving && B.goal) {
    if (!B.path || G.t > (B.repath || 0)) { B.path = navPath(M, p.x, p.z, B.goal[0], B.goal[1]) || []; B.repath = G.t + 2.5; }
    while (B.path.length && Math.hypot(B.path[0][0] - p.x, B.path[0][1] - p.z) < 0.7) B.path.shift();
    const wp = B.path[0];
    if (wp) {
      const a = Math.atan2(wp[0] - p.x, -(wp[1] - p.z));
      if (!T) { I.yaw = p.yaw + clamp(angWrap(a - p.yaw), -6 * dt, 6 * dt); }
      const rel = a - (T ? I.yaw : I.yaw);
      I.mz = Math.cos(rel); I.mx = Math.sin(rel);
      // preso? pula
      B.stuckT = (Math.hypot(p.vx, p.vz) < 0.5) ? (B.stuckT || 0) + dt : 0;
      if (B.stuckT > 0.8) { I.jump = true; B.stuckT = 0; B.path = null; }
    } else if (B.hold) { // chegou: segura posição olhando para a direção marcada
      B.atSite = true;
      if (!T) I.yaw = p.yaw + clamp(angWrap(B.hold - p.yaw), -3 * dt, 3 * dt);
      if (Math.random() < dt * 0.3) I.crouch = Math.random() < 0.3;
    }
  }
}
function botBuy(G, p) {
  const c = () => p.creds;
  const team = G.players.filter(q => q.team === p.team), avg = team.reduce((a, q) => a + q.creds, 0) / team.length;
  const eco = avg < 2500 && G.round !== 1 && G.round !== RULES.half + 1 && !G.ot;
  if (!eco || c() > 4200) {
    if (!p.guns[1]) {
      if (c() >= 3900) G.buy(p, Math.random() < 0.5 ? 'rompante' : 'corisco');
      else if (c() >= 4700 + 1000 && Math.random() < 0.2) G.buy(p, 'arauto');
      else if (c() >= 2900) G.buy(p, Math.random() < 0.6 ? 'rompante' : 'corisco');
      else if (c() >= 2000) G.buy(p, 'zumbido');
      else if (c() >= 950 && Math.random() < 0.3) G.buy(p, 'gaviao');
    }
    if (c() >= 1000 && p.armor < 50) G.buy(p, 'pesado'); else if (c() >= 400 && p.armor < 25) G.buy(p, 'leve');
  } else if (c() >= 800 && Math.random() < 0.5 && G.round !== 1) G.buy(p, 'brado');
  if (G.round === 1 || G.round === RULES.half + 1) { if (Math.random() < 0.5) G.buy(p, 'leve'); else if (Math.random() < 0.5) G.buy(p, 'brado'); }
  for (const k of ['c', 'q', 'q']) if (c() >= 300 + (eco ? 0 : 0)) G.buy(p, k);
}
function planBot(G, p, B) {
  const M = G.M, att = G.attTeam(), atk = p.team === att;
  B.goalT = G.t + 8 + Math.random() * 6; B.path = null; B.atSite = false;
  const rndCell = cells => { const c = cells[(Math.random() * cells.length) | 0]; return [(c[0] + 0.5) * M.cell + rnd(-0.5, 0.5), (c[1] + 0.5) * M.cell + rnd(-0.5, 0.5)]; };
  if (G.phase === 'planted' && G.nucleo) {
    const n = G.nucleo;
    if (atk) { B.goal = [n.x + rnd(-6, 6), n.z + rnd(-6, 6)]; B.hold = Math.random() * Math.PI * 2; B.goalT = G.t + 999; }
    else { B.goal = [n.x, n.z]; B.goalT = G.t + 999; }
    return;
  }
  if (atk) {
    if (!G.attackSite || G.attackSiteRound !== G.round) { G.attackSite = Math.random() < 0.5 ? 'A' : 'B'; G.attackSiteRound = G.round; }
    const site = M['site' + G.attackSite];
    if (p.nucleo) { B.plantSpot = rndCell(site.cells); B.goal = B.plantSpot; }
    else B.goal = rndCell(site.cells);
    B.hold = Math.PI; // olha para o lado da defesa (norte)
  } else {
    // defesa: 2 no A, 2 no B, 1 no meio (pela ordem do slot)
    const k = p.slot % RULES.teamSize;
    const spot = k < 2 ? M.siteA : k < 4 ? M.siteB : null;
    if (spot) B.goal = rndCell(spot.cells); else B.goal = [20 * M.cell + rnd(-2, 2), 9 * M.cell + rnd(-2, 2)];
    B.hold = 0; // olha para o sul (ataque)
    B.goalT = G.t + 999;
  }
}
function botAbility(G, p, T, d) {
  const I = p.in; const k = Math.random() < 0.5 ? 'e' : (Math.random() < 0.5 ? 'q' : 'c');
  if (k !== 'e' && p.ab[k] <= 0) return;
  if (p.hunter === 'lumi' && k === 'e') return;
  if (p.hunter === 'mare' && k === 'c') return;
  if (p.hunter === 'brasa' && k === 'q') return;
  if (p.hunter === 'corvo' && k === 'e') return;
  I.ab = k;
}
function botUlt(G, p, T) {
  const I = p.in;
  if (p.hunter === 'lumi') { const dead = G.players.find(q => !q.alive && q.team === p.team && q.body && Math.hypot(q.body.x - p.x, q.body.z - p.z) < 20); if (dead) { I.ab = 'x'; } return; }
  if (p.hunter === 'rocha' && (!T || Math.hypot(T.x - p.x, T.z - p.z) > 15)) return;
  if (T) I.ab = 'x';
}
