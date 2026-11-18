// =====================================================================
//  fps/net.js : multiplayer do modo tático
//  - o dono da sala roda a partida (autoritativo)
//  - os outros mandam os comandos e recebem "fotos" da partida 30x/s
//  - o cliente prevê o próprio movimento e interpola os outros
// =====================================================================
// r1/r2 (arredondar) vêm de js/net.js
const G_IDS = Object.keys(WEAPONS);
const gEnc = g => g ? [G_IDS.indexOf(g.id), g.ammo, g.res] : 0;
const gDec = a => a ? { id: G_IDS[a[0]], ammo: a[1], res: a[2] } : null;
const NEV_SKIP = new Set(['step']);

// ---------------- foto da partida (dono -> todos) ----------------
function packSnap(G, events, acks) {
  return {
    t: 's', tk: G.tick || 0, ph: G.phase, pt: r1(G.phaseT), rd: G.round, ot: G.ot ? 1 : 0, sc: G.score, ps: G.plantSite, dh: G.defuseHalf ? 1 : 0, rv: [r1(G.revealTeam[0]), r1(G.revealTeam[1])], w: G.winner,
    P: G.players.map(p => [p.id, r2(p.x), r2(p.y), r2(p.z), r1(p.vx), r1(p.vy), r1(p.vz), r2(p.yaw), r2(p.pitch), r2(p.crouch), Math.ceil(p.hp), Math.ceil(p.armor), p.alive ? 1 : 0, p.cur, gEnc(p.guns[1]), gEnc(p.guns[2]),
      p.creds, p.ab.c, p.ab.q, p.ab.e, p.ult, p.nucleo ? 1 : 0, r2(p.useT), p.zoom ? 1 : 0, r1(p.blindT), r1(p.stunT), r1(p.slowT), r1(p.slowAmt), r1(p.revealT), p.kills, p.deaths, Math.round(p.dmg),
      r1(p.recoil), r2(p.reloadT), r2(p.switchT), p.onGround ? 1 : 0, r2(p.dashT), r2(p.fireCd), p.hunter, p.body ? [r1(p.body.x), r1(p.body.z), r1(p.body.yaw)] : 0, p.bot ? 1 : 0]),
    N: G.nucleo ? [r2(G.nucleo.x), r2(G.nucleo.z), G.nucleo.planted ? 1 : 0, G.nucleo.site || '', G.nucleo.defused ? 1 : 0] : 0,
    GR: G.grenades.map(g => [g.kind, r2(g.x), r2(g.y), r2(g.z)]),
    Z: G.zones.map(z => [z.kind, r1(z.x), r1(z.z), z.r, r1(z.t), z.T, z.team, z.slow || 0, z.dps || 0, z.owner]),
    SM: G.smokes.map(s => [r1(s.x), r1(s.y), r1(s.z), s.r, r1(s.t), s.T, s.team]),
    TW: G.temp.map(w => [r2(w.x0), r2(w.x1), w.y0, w.y1, r2(w.z0), r2(w.z1), r1(w.t), w.T, w.vis ? 1 : 0, w.solid ? 1 : 0, w.kind]),
    D: G.drops.map(d => [gEnc(d.g), r2(d.x), r2(d.z), r1(d.t)]),
    E: events.filter(e => !NEV_SKIP.has(e.k)), A: acks,
  };
}
function applySnap(G, S, myId) {
  G.tick = S.tk; G.phase = S.ph; G.phaseT = S.pt; G.round = S.rd; G.ot = !!S.ot; G.score = S.sc; G.plantSite = S.ps; G.defuseHalf = !!S.dh; G.revealTeam = S.rv; G.winner = S.w;
  for (const a of S.P) {
    const p = G.byId(a[0]); if (!p) continue;
    const mine = p.id === myId;
    const pos = { tk: S.tk, x: a[1], y: a[2], z: a[3], yaw: a[7], pitch: a[8], crouch: a[9], vx: a[4], vy: a[5], vz: a[6] };
    if (mine) p.server = pos;
    else { (p.buf = p.buf || []).push(pos); if (p.buf.length > 30) p.buf.shift(); p.vx = a[4]; p.vy = a[5]; p.vz = a[6]; }
    const wasAlive = p.alive;
    Object.assign(p, {
      hp: a[10], armor: a[11], alive: !!a[12], cur: a[13], guns: { 1: gDec(a[14]), 2: gDec(a[15]) }, creds: a[16], ab: { c: a[17], q: a[18], e: a[19] }, ult: a[20], nucleo: !!a[21], useT: a[22],
      blindT: a[24], stunT: a[25], slowT: a[26], slowAmt: a[27], revealT: a[28], kills: a[29], deaths: a[30], dmg: a[31], hunter: a[38], body: a[39] ? { x: a[39][0], z: a[39][1], yaw: a[39][2] } : null, bot: !!a[40],
    });
    if (!mine) Object.assign(p, { recoil: a[32], reloadT: a[33], switchT: a[34], zoom: !!a[23] });
    else { p.netReload = a[33]; p.netSwitch = a[34]; p.netZoom = !!a[23]; p.dashT = a[36]; p.reloadT = a[33]; p.switchT = a[34]; p.zoom = !!a[23]; }
    p.onGroundNet = !!a[35];
    if (!wasAlive && p.alive) { p.x = a[1]; p.y = a[2]; p.z = a[3]; p.buf = []; }
  }
  G.nucleo = S.N ? { x: S.N[0], z: S.N[1], planted: !!S.N[2], site: S.N[3] || null, defused: !!S.N[4] } : null;
  G.grenades = S.GR.map(g => ({ kind: g[0], x: g[1], y: g[2], z: g[3] }));
  G.zones = S.Z.map(z => ({ kind: z[0], x: z[1], z: z[2], r: z[3], t: z[4], T: z[5], team: z[6], slow: z[7], dps: z[8], owner: z[9] }));
  G.smokes = S.SM.map(s => ({ x: s[0], y: s[1], z: s[2], r: s[3], t: s[4], T: s[5], team: s[6] }));
  G.temp = S.TW.map(w => ({ x0: w[0], x1: w[1], y0: w[2], y1: w[3], z0: w[4], z1: w[5], t: w[6], T: w[7], vis: !!w[8], solid: !!w[9], kind: w[10] }));
  G.solids = G.M.solids.concat(G.temp.filter(w => w.solid));
  G.drops = S.D.map(d => ({ g: gDec(d[0]), x: d[1], z: d[2], t: d[3] }));
}
// posição interpolada dos outros jogadores (atraso de ~100ms)
function interpOthers(G, myId, rtk) {
  for (const p of G.players) {
    if (p.id === myId || !p.buf || !p.buf.length) continue;
    const B = p.buf; let a = B[0], b = B[B.length - 1];
    for (let i = 0; i < B.length - 1; i++) if (B[i].tk <= rtk && B[i + 1].tk >= rtk) { a = B[i]; b = B[i + 1]; break; }
    if (rtk > b.tk) { a = b; }
    const f = b.tk === a.tk ? 1 : clamp((rtk - a.tk) / (b.tk - a.tk), 0, 1);
    p.x = lerp(a.x, b.x, f); p.y = lerp(a.y, b.y, f); p.z = lerp(a.z, b.z, f); p.crouch = lerp(a.crouch, b.crouch, f);
    p.yaw = a.yaw + angWrap(b.yaw - a.yaw) * f; p.pitch = lerp(a.pitch, b.pitch, f);
  }
}

// ---------------- comandos (cliente -> dono) ----------------
const BIT = { jump: 1, crouch: 2, walk: 4, fire: 8, alt: 16, use: 32 };
function packIn(I) { let b = 0; for (const k in BIT) if (I[k]) b |= BIT[k]; return [r2(I.mx), r2(I.mz), Math.round(I.yaw * 1000) / 1000, Math.round(I.pitch * 1000) / 1000, b]; }
function unpackIn(I, a) { I.mx = a[0]; I.mz = a[1]; I.yaw = a[2]; I.pitch = a[3]; for (const k in BIT) I[k] = !!(a[4] & BIT[k]); }
