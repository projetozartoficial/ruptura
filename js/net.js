// =====================================================================
//  net.js : transporte de rede
//   - Online: PeerJS (WebRTC P2P, servidor de sinalização gratuito)
//   - Local:  BroadcastChannel (várias abas no mesmo PC, para testes)
// =====================================================================

const NET_PREFIX = 'ruptura-vesper-';

function loadPeerJS() {
  return new Promise((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('Não consegui carregar o PeerJS (sem internet?)'));
    document.head.appendChild(s);
  });
}
function hasWebRTC() { return typeof RTCPeerConnection !== 'undefined'; }

// ---------------- PeerJS ----------------
async function peerHost(code, h) {
  await loadPeerJS();
  return new Promise((resolve, reject) => {
    const peer = new Peer(NET_PREFIX + code, { debug: 0 });
    const conns = new Map();
    let opened = false;
    peer.on('open', () => {
      opened = true;
      resolve({
        send(pid, m) { const c = conns.get(pid); if (c && c.open) c.send(m); },
        broadcast(m) { for (const c of conns.values()) if (c.open) c.send(m); },
        close() { try { peer.destroy(); } catch (e) { } },
      });
    });
    peer.on('connection', conn => {
      conn.on('open', () => { conns.set(conn.peer, conn); h.onJoin(conn.peer); });
      conn.on('data', d => h.onMsg(conn.peer, d));
      conn.on('close', () => { conns.delete(conn.peer); h.onLeave(conn.peer); });
      conn.on('error', () => { conns.delete(conn.peer); h.onLeave(conn.peer); });
    });
    peer.on('error', e => {
      if (!opened) reject(new Error(e.type === 'unavailable-id' ? 'Esse código de sala já está em uso.' : 'Erro de conexão: ' + e.type));
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    setTimeout(() => { if (!opened) reject(new Error('Tempo esgotado ao criar a sala.')); }, 12000);
  });
}
async function peerJoin(code, h) {
  await loadPeerJS();
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 });
    let ok = false;
    peer.on('open', () => {
      const conn = peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' });
      conn.on('open', () => {
        ok = true;
        resolve({ send(m) { if (conn.open) conn.send(m); }, close() { try { peer.destroy(); } catch (e) { } } });
      });
      conn.on('data', d => h.onMsg(d));
      conn.on('close', () => h.onClose());
    });
    peer.on('error', e => {
      if (!ok) reject(new Error(e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : 'Erro de conexão: ' + e.type));
      else h.onClose();
    });
    setTimeout(() => { if (!ok) reject(new Error('Tempo esgotado ao entrar na sala.')); }, 12000);
  });
}

// ---------------- BroadcastChannel (local) ----------------
function localHost(code, h) {
  return new Promise((resolve, reject) => {
    if (typeof BroadcastChannel === 'undefined') return reject(new Error('Seu navegador não suporta o modo local.'));
    const ch = new BroadcastChannel(NET_PREFIX + code);
    const seen = new Map();
    // checa se já existe host com esse código
    let taken = false;
    const probe = Math.random().toString(36).slice(2);
    ch.onmessage = ev => { const m = ev.data; if (m.probeReply === probe) taken = true; };
    ch.postMessage({ probe });
    setTimeout(() => {
      if (taken) { ch.close(); return reject(new Error('Esse código de sala já está em uso.')); }
      ch.onmessage = ev => {
        const m = ev.data;
        if (m.probe) { ch.postMessage({ probeReply: m.probe }); return; }
        if (m.to !== 'host') return;
        if (m.join) { seen.set(m.from, performance.now()); h.onJoin(m.from); ch.postMessage({ to: m.from, accepted: 1 }); return; }
        if (m.leave) { if (seen.delete(m.from)) h.onLeave(m.from); return; }
        if (!seen.has(m.from)) return;
        seen.set(m.from, performance.now());
        h.onMsg(m.from, m.d);
      };
      const iv = setInterval(() => {
        const now = performance.now();
        for (const [id, t] of seen) if (now - t > 6000) { seen.delete(id); h.onLeave(id); }
        ch.postMessage({ to: '*', ping: 1 });
      }, 1000);
      resolve({
        send(pid, d) { ch.postMessage({ to: pid, d }); },
        broadcast(d) { ch.postMessage({ to: '*', d }); },
        close() { clearInterval(iv); ch.postMessage({ to: '*', hostGone: 1 }); ch.close(); },
      });
    }, 300);
  });
}
function localJoin(code, h) {
  return new Promise((resolve, reject) => {
    if (typeof BroadcastChannel === 'undefined') return reject(new Error('Seu navegador não suporta o modo local.'));
    const ch = new BroadcastChannel(NET_PREFIX + code);
    const me = 'c' + Math.random().toString(36).slice(2, 9);
    let ok = false, lastPing = performance.now();
    ch.onmessage = ev => {
      const m = ev.data;
      if (m.to !== me && m.to !== '*') return;
      if (m.ping) { lastPing = performance.now(); return; }
      if (m.hostGone) { h.onClose(); return; }
      if (m.accepted && !ok) {
        ok = true;
        const iv = setInterval(() => { if (performance.now() - lastPing > 6000) { clearInterval(iv); h.onClose(); } }, 1000);
        window.addEventListener('beforeunload', () => ch.postMessage({ to: 'host', from: me, leave: 1 }));
        resolve({ send(d) { ch.postMessage({ to: 'host', from: me, d }); }, close() { clearInterval(iv); ch.postMessage({ to: 'host', from: me, leave: 1 }); ch.close(); } });
        return;
      }
      if (m.d !== undefined) { lastPing = performance.now(); h.onMsg(m.d); }
    };
    ch.postMessage({ to: 'host', from: me, join: 1 });
    setTimeout(() => { if (!ok) { ch.close(); reject(new Error('Sala local não encontrada. Abra a sala em outra aba primeiro.')); } }, 1500);
  });
}

const Transport = {
  host(mode, code, h) { return mode === 'local' ? localHost(code, h) : peerHost(code, h); },
  join(mode, code, h) { return mode === 'local' ? localJoin(code, h) : peerJoin(code, h); },
};

// ------------------------------------------------------------------
//  Codificação dos snapshots
// ------------------------------------------------------------------
const PKINDS = ['ember', 'dagger', 'orb', 'light', 'fireball', 'hook', 'fissure', 'wave'];
const ZKINDS = ['fire', 'burn', 'pool', 'sanct'];
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

function encodeSnap(sim, events) {
  return {
    t: 's', ph: sim.phase, pt: r2(sim.phaseT), rd: sim.round, sc: sim.score, ng: sim.night ? 1 : 0, ft: r2(sim.fightT), st: Math.round(sim.storm.r), w: sim.winner,
    P: sim.players.map(p => [p.id, r1(p.x), r1(p.y), r2(p.aim), Math.round(p.hp), Math.round(p.shield), p.alive ? 1 : 0,
      (p.slowT > 0 ? 1 : 0) | (p.huntT > 0 ? 2 : 0) | (p.bastionT > 0 ? 4 : 0) | (p.spdT > 0 ? 8 : 0) | (p.invuln > 0 ? 16 : 0) | (p.leap ? 32 : 0) | (p.dashT > 0 ? 64 : 0),
      Math.round(p.z), r2(p.stun), r1(p.cd.q), r1(p.cd.e), r1(p.cd.r), r1(p.cd.dash), r2(p.cd.basic),
      p.kills, p.deaths, Math.round(p.dmg), Math.round(p.heal), r2(p.revive), Math.round(p.soulX), Math.round(p.soulY), Math.round(p.vx), Math.round(p.vy)]),
    J: sim.projectiles.map(pr => [pr.id, PKINDS.indexOf(pr.kind), r1(pr.x), r1(pr.y), Math.round(pr.vx), Math.round(pr.vy), pr.team, pr.owner, Math.round(pr.trav)]),
    Z: sim.zones.map(z => [z.id, ZKINDS.indexOf(z.type), Math.round(z.x), Math.round(z.y), z.r, r2(z.t), z.T, z.team]),
    L: sim.walls.map(w => [w.id, r1(w.x), r1(w.y), w.r, r2(w.life), w.T]),
    E: events,
  };
}

// Estado espelhado no cliente (mesmos campos que o Sim, para o renderer)
class ClientState {
  constructor(slots) {
    this.players = [];
    slots.forEach((s, i) => {
      if (!s || s.kind === 'empty') return;
      const H = HUNTERS[s.hunter];
      this.players.push({ id: s.id, name: s.name, team: i < 4 ? 0 : 1, hunter: s.hunter, bot: s.kind === 'bot', maxHp: H.hp, r: H.r,
        x: 0, y: 0, tx: 0, ty: 0, aim: 0, hp: H.hp, shield: 0, alive: true, z: 0, stun: 0, cd: { q: 0, e: 0, r: 0, dash: 0, basic: 0 },
        kills: 0, deaths: 0, dmg: 0, heal: 0, revive: 0, soulX: 0, soulY: 0, vx: 0, vy: 0, slowT: 0, huntT: 0, bastionT: 0, spdT: 0, invuln: 0, leap: null, init: false });
    });
    this.projectiles = []; this.zones = []; this.walls = [];
    this.phase = 'countdown'; this.phaseT = 3; this.round = 1; this.score = [0, 0]; this.night = false; this.fightT = 0;
    this.storm = { x: WORLD_W / 2, y: WORLD_H / 2, r: 1500 }; this.winner = -1;
    this.snapT = 0;
  }
  apply(s, myId) {
    this.phase = s.ph; this.phaseT = s.pt; this.round = s.rd; this.score = s.sc; this.night = !!s.ng; this.fightT = s.ft; this.storm.r = s.st; this.winner = s.w;
    for (const a of s.P) {
      const p = this.players.find(q => q.id === a[0]); if (!p) continue;
      p.tx = a[1]; p.ty = a[2];
      if (!p.init || dist(p.x, p.y, p.tx, p.ty) > 250) { p.x = p.tx; p.y = p.ty; p.init = true; }
      if (p.id !== myId) p.aim = a[3];
      p.hp = a[4]; p.shield = a[5]; p.alive = !!a[6];
      const f = a[7];
      p.slowT = f & 1 ? 1 : 0; p.huntT = f & 2 ? 1 : 0; p.bastionT = f & 4 ? 1 : 0; p.spdT = f & 8 ? 1 : 0; p.invuln = f & 16 ? 1 : 0; p.leap = f & 32 ? {} : null; p.dashing = !!(f & 64);
      p.z = a[8]; p.stun = a[9];
      p.cd = { q: a[10], e: a[11], r: a[12], dash: a[13], basic: a[14] };
      p.kills = a[15]; p.deaths = a[16]; p.dmg = a[17]; p.heal = a[18]; p.revive = a[19]; p.soulX = a[20]; p.soulY = a[21]; p.vx = a[22]; p.vy = a[23];
    }
    this.snapT = performance.now();
    this.projectiles = s.J.map(j => ({ id: j[0], kind: PKINDS[j[1]], sx: j[2], sy: j[3], x: j[2], y: j[3], vx: j[4], vy: j[5], team: j[6], owner: j[7], trav0: j[8], trav: j[8] }));
    this.zones = s.Z.map(z => ({ id: z[0], type: ZKINDS[z[1]], x: z[2], y: z[3], r: z[4], t: z[5], T: z[6], team: z[7] }));
    this.walls = s.L.map(w => ({ t: 'circ', k: 'ice', id: w[0], x: w[1], y: w[2], r: w[3], life: w[4], T: w[5] }));
  }
  // suavização entre snapshots
  tick(dt, me, pred) {
    const k = 1 - Math.exp(-dt * 16);
    const age = (performance.now() - this.snapT) / 1000;
    for (const p of this.players) {
      if (p === me && pred) continue;
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    }
    for (const pr of this.projectiles) { const a = Math.min(age, 0.15); pr.x = pr.sx + pr.vx * a; pr.y = pr.sy + pr.vy * a; pr.trav = pr.trav0 + Math.hypot(pr.vx, pr.vy) * a; }
    for (const z of this.zones) z.t -= dt;
    for (const w of this.walls) w.life -= dt;
  }
}
