// =====================================================================
//  account.js : contas (Firebase + Google), progressão, ranque e fila
// =====================================================================

// ---------------- Ranques ----------------
const RANK_TIERS = [
  { name: 'Bronze', a: '#e0a070', b: '#7a4524', g: '#ffb27a' },
  { name: 'Silver', a: '#e8eef5', b: '#7d8896', g: '#d9e6ff' },
  { name: 'Gold', a: '#ffe08a', b: '#b07a12', g: '#ffd65a' },
  { name: 'Platinum', a: '#9ff0e6', b: '#1d7f80', g: '#7ff5e6' },
  { name: 'Diamond', a: '#b9d6ff', b: '#3b5fd8', g: '#8fb8ff' },
  { name: 'Elite', a: '#e2b8ff', b: '#6a2ab8', g: '#c58bff' },
  { name: 'Master', a: '#ffb48a', b: '#c2361e', g: '#ff8a5a' },
  { name: 'GrandMaster', a: '#ff8aa8', b: '#8a1235', g: '#ff5a86' },
  { name: 'Champion', a: '#fff3c0', b: '#e09a1a', g: '#ffe27a' },
];
const DIV = ['I', 'II', 'III'];
const RANK_MAX = 24; // índice do Champion
function rankTier(i) { return i < 0 ? -1 : i >= RANK_MAX ? 8 : Math.floor(i / 3); }
function rankName(i) { if (i < 0) return 'Sem ranque'; if (i >= RANK_MAX) return 'Champion'; return RANK_TIERS[rankTier(i)].name + ' ' + DIV[i % 3]; }
function rankMMR(i) { return 640 + i * 55; }
function rankFromMMR(m) { return clamp(Math.round((m - 640) / 55), 0, RANK_MAX); }
function xpNeed(level) { return 400 + 50 * level; }

function newProfile(name) {
  return { name: name || 'Caçador', tag: '', nickSet: false, level: 1, xp: 0, mmr: 1000, rank: -1, rr: 0, placements: 0, peak: -1,
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, heal: 0 }, hunters: {}, history: [], created: Date.now() };
}
function fixProfile(p, name) {
  const d = newProfile(name);
  p = Object.assign(d, p || {});
  p.stats = Object.assign(newProfile().stats, p.stats || {});
  p.hunters = p.hunters || {}; p.history = p.history || [];
  return p;
}

// Aplica o resultado de uma partida no perfil. Retorna o resumo para a tela final.
// r = { mode, won, my, opp, hunter, kills, deaths, dmg, heal, perf, oppMMR, vsBots }
function applyMatchResult(prof, r) {
  const out = { xp: 0, levels: 0, rr: 0, mmr: 0, rankBefore: prof.rank, rankAfter: prof.rank, placed: false, placement: null };
  // XP
  let xp = 100 + (r.won ? 150 : 0) + r.kills * 15 + r.my * 10;
  if (r.mode === 'training') xp = Math.round(xp * 0.5);
  out.xp = xp; prof.xp += xp;
  while (prof.xp >= xpNeed(prof.level)) { prof.xp -= xpNeed(prof.level); prof.level++; out.levels++; }
  // estatísticas
  const s = prof.stats; s.matches++; if (r.won) s.wins++; s.kills += r.kills; s.deaths += r.deaths; s.dmg += Math.round(r.dmg); s.heal += Math.round(r.heal);
  const h = prof.hunters[r.hunter] || (prof.hunters[r.hunter] = { m: 0, w: 0, k: 0 }); h.m++; if (r.won) h.w++; h.k += r.kills;
  // ranqueada
  if (r.mode === 'ranked') {
    const exp = 1 / (1 + Math.pow(10, (r.oppMMR - prof.mmr) / 400));
    const K = prof.placements < 5 ? 60 : 32;
    let dm = K * ((r.won ? 1 : 0) - exp) + clamp((r.perf - 1) * 10, -6, 6);
    if (r.vsBots) dm *= 0.5;
    prof.mmr = Math.round(prof.mmr + dm); out.mmr = Math.round(dm);
    if (prof.placements < 5) {
      prof.placements++;
      out.placement = prof.placements;
      if (prof.placements >= 5) { prof.rank = Math.min(14, rankFromMMR(prof.mmr)); prof.rr = 0; out.placed = true; }
    } else {
      const diff = Math.min(5, Math.abs(r.my - r.opp));
      let d = r.won ? 18 + diff * 2 : -(14 + diff * 2);
      const tier = rankTier(prof.rank);
      const perfW = Math.max(0, 1 - tier * 0.25); // pesa mais nos elos baixos
      d += clamp((r.perf - 1) * 8, -6, 6) * perfW;
      d += clamp((prof.mmr - rankMMR(prof.rank)) / 50, -6, 6);
      if (r.vsBots) d *= 0.5;
      d = Math.round(d); out.rr = d;
      prof.rr += d;
      while (prof.rr >= 100 && prof.rank < RANK_MAX) { prof.rr -= 100; prof.rank++; }
      while (prof.rr < 0 && prof.rank > 0) { prof.rank--; prof.rr += 100; }
      if (prof.rr < 0) prof.rr = 0;
    }
    prof.peak = Math.max(prof.peak, prof.rank);
    out.rankAfter = prof.rank;
  }
  prof.history.unshift({ t: Date.now(), mode: r.mode, won: r.won, sc: [r.my, r.opp], h: r.hunter, k: r.kills, d: r.deaths, rr: out.rr, pl: out.placement });
  prof.history = prof.history.slice(0, 12);
  return out;
}

// Regras de grupo: o grupo pode ter no máximo 1 elo de diferença (ex.: Bronze com Silver).
function partyAllowed(members) {
  const tiers = members.map(m => rankTier(m.rank >= 0 ? m.rank : rankFromMMR(m.mmr || 1000)));
  return Math.max(...tiers) - Math.min(...tiers) <= 1;
}

// ---------------- Emblema do ranque (desenhado) ----------------
// Cada elo fica mais elaborado: Bronze é um escudo simples; Champion é uma coroa radiante
// sobre um cristal de Éter, com asas e raios. A divisão aparece numa faixa com I, II ou III.
function drawRankEmblem(c, idx, size) {
  const P = Math.PI;
  c.save(); c.translate(size / 2, size / 2); c.scale(size / 100 * 0.82, size / 100 * 0.82);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const lg = (y0, y1, a, b, m) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); if (m) g.addColorStop(0.5, m); g.addColorStop(1, b); return g; };
  const glow = (r, col, a) => { const g = c.createRadialGradient(0, 0, 2, 0, 0, r); g.addColorStop(0, col + a); g.addColorStop(1, col + '00'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, P * 2); c.fill(); };
  const path = pts => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const gem = (r, inner, outer) => {
    const g = c.createRadialGradient(-r * 0.3, -r * 0.35, 0.5, 0, 0, r * 1.1); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, inner); g.addColorStop(1, outer);
    c.fillStyle = g; path([[0, -r], [r * 0.85, 0], [0, r], [-r * 0.85, 0]]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8; c.stroke();
    c.beginPath(); c.moveTo(0, -r); c.lineTo(0, r); c.moveTo(-r * 0.85, 0); c.lineTo(r * 0.85, 0); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.stroke();
  };
  const wing = (s, col, dark, span, rows) => {
    for (let k = rows - 1; k >= 0; k--) {
      c.save(); c.scale(s, 1);
      c.fillStyle = k % 2 ? dark : col; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8;
      const y0 = -16 + k * 7, len = span - k * 6;
      c.beginPath(); c.moveTo(14, y0); c.quadraticCurveTo(14 + len * 0.6, y0 - 16 + k * 2, 14 + len, y0 - 6 + k * 3);
      c.lineTo(14 + len - 7, y0 + 2); c.lineTo(14 + len - 11, y0 + 9 - k); c.quadraticCurveTo(14 + len * 0.4, y0 + 8, 14, y0 + 10); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  };
  const shield = (w, top, bot) => { c.beginPath(); c.moveTo(0, top); c.quadraticCurveTo(w * 0.6, top + 2, w, top + 8); c.lineTo(w - 1, bot - 26); c.quadraticCurveTo(w - 4, bot - 8, 0, bot); c.quadraticCurveTo(-w + 4, bot - 8, -w + 1, bot - 26); c.lineTo(-w, top + 8); c.quadraticCurveTo(-w * 0.6, top + 2, 0, top); c.closePath(); };
  const rays = (n, r0, r1, col, rot = 0) => { c.save(); c.rotate(rot); c.fillStyle = col; for (let i = 0; i < n; i++) { c.rotate(P * 2 / n); c.beginPath(); c.moveTo(-3, -r0); c.lineTo(0, -r1); c.lineTo(3, -r0); c.fill(); } c.restore(); };
  const shine = (x0, y0, x1, y1) => { c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 10, y0); c.lineTo(x1 + 10, y1); c.lineTo(x1, y1); c.fill(); c.restore(); };

  if (idx < 0) {
    c.strokeStyle = '#6b7290'; c.lineWidth = 4; c.fillStyle = 'rgba(40,44,70,0.85)';
    path([[0, -38], [33, -19], [33, 19], [0, 38], [-33, 19], [-33, -19]]); c.fill(); c.stroke();
    c.fillStyle = '#9aa3c7'; c.font = '800 38px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 2);
    c.restore(); return;
  }
  const t = rankTier(idx), div = idx >= RANK_MAX ? -1 : idx % 3;
  // brilho de fundo cresce com o elo e a divisão
  glow(46 + t * 1.5, RANK_TIERS[t].g, ['22', '30', '3a', '44', '50', '5a', '66', '70', '88'][t]);

  switch (t) {
    case 0: { // BRONZE: escudo redondo de cobre com rebites
      shield(26, -36, 34); c.fillStyle = lg(-36, 34, '#e9a878', '#6a3818', '#b56a38'); c.fill();
      c.lineWidth = 3; c.strokeStyle = '#4a240e'; c.stroke();
      shield(20, -29, 26); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,220,180,0.35)'; c.stroke();
      c.fillStyle = '#ffd0a0'; for (const [x, y] of [[-17, -24], [17, -24], [-15, 10], [15, 10]]) { c.beginPath(); c.arc(x, y, 1.8, 0, P * 2); c.fill(); }
      shield(26, -36, 34); shine(-18, -36, -32, 20);
      gem(8, '#ffcfa0', '#a0522d');
      break;
    }
    case 1: { // SILVER: escudo pontudo com espadas cruzadas atrás
      c.save(); for (const r of [-0.7, 0.7]) { c.save(); c.rotate(r); c.fillStyle = '#c9d2de'; c.fillRect(-2, -46, 4, 70); c.fillStyle = '#6b7684'; c.fillRect(-7, 20, 14, 4); c.fillRect(-1.5, 24, 3, 10); c.restore(); } c.restore();
      shield(27, -38, 36); c.fillStyle = lg(-38, 36, '#ffffff', '#6f7c8c', '#c3ccd8'); c.fill();
      c.lineWidth = 3.5; c.strokeStyle = '#3d4654'; c.stroke();
      shield(21, -31, 28); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
      c.strokeStyle = 'rgba(60,70,84,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -31); c.lineTo(0, 28); c.moveTo(-21, -6); c.lineTo(21, -6); c.stroke();
      shield(27, -38, 36); shine(-18, -38, -32, 22);
      gem(9, '#e8f0ff', '#5b6b8a');
      break;
    }
    case 2: { // GOLD: escudo nobre com asas de louro e estrela
      wing(1, '#f5c84a', '#b88415', 30, 3); wing(-1, '#f5c84a', '#b88415', 30, 3);
      shield(26, -36, 36); c.fillStyle = lg(-36, 36, '#fff3b0', '#9a6406', '#f2b632'); c.fill();
      c.lineWidth = 3.5; c.strokeStyle = '#5c3a02'; c.stroke();
      shield(20, -29, 28); c.lineWidth = 2; c.strokeStyle = '#fff3c4'; c.stroke();
      shield(26, -36, 36); shine(-18, -36, -32, 22);
      c.save(); c.translate(0, -44); c.fillStyle = '#fff1a8'; c.strokeStyle = '#8a5a04'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -P / 2 + i * P / 5, r = i % 2 ? 3.2 : 7.5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); c.restore();
      gem(10, '#fff6c0', '#c8860a');
      break;
    }
    case 3: { // PLATINUM: hexágono lapidado com aletas laterais
      c.fillStyle = '#1f8f8a'; for (const s of [-1, 1]) { c.save(); c.scale(s, 1); path([[30, -14], [46, -24], [42, -6], [48, 4], [30, 10]]); c.fill(); c.restore(); }
      path([[0, -42], [36, -21], [36, 21], [0, 42], [-36, 21], [-36, -21]]); c.fillStyle = lg(-42, 42, '#d8fff8', '#16706c', '#55c9bc'); c.fill();
      c.lineWidth = 3.5; c.strokeStyle = '#0c3f3d'; c.stroke();
      path([[0, -33], [28, -16], [28, 16], [0, 33], [-28, 16], [-28, -16]]); c.lineWidth = 1.8; c.strokeStyle = 'rgba(230,255,252,0.85)'; c.stroke();
      c.strokeStyle = 'rgba(230,255,252,0.25)'; c.lineWidth = 1; c.beginPath(); for (const [x, y] of [[0, -33], [28, -16], [28, 16], [0, 33], [-28, 16], [-28, -16]]) { c.moveTo(0, 0); c.lineTo(x, y); } c.stroke();
      path([[0, -42], [36, -21], [36, 21], [0, 42], [-36, 21], [-36, -21]]); shine(-20, -42, -36, 22);
      gem(11, '#e8fffb', '#1a9c95');
      break;
    }
    case 4: { // DIAMOND: grande diamante lapidado com moldura e brilhos
      rays(8, 30, 48, 'rgba(160,200,255,0.35)', P / 8);
      path([[-30, -18], [-16, -36], [16, -36], [30, -18], [0, 42]]); c.fillStyle = lg(-36, 42, '#e8f2ff', '#2442b8', '#6f98ff'); c.fill();
      c.lineWidth = 3; c.strokeStyle = '#13235f'; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.3; c.beginPath();
      c.moveTo(-30, -18); c.lineTo(30, -18); c.moveTo(-16, -36); c.lineTo(-8, -18); c.lineTo(0, -36); c.lineTo(8, -18); c.lineTo(16, -36);
      c.moveTo(-8, -18); c.lineTo(0, 42); c.lineTo(8, -18); c.moveTo(-30, -18); c.lineTo(0, 42); c.lineTo(30, -18); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)'; path([[-16, -36], [-8, -18], [-30, -18]]); c.fill();
      c.fillStyle = '#ffffff'; for (const [x, y, r] of [[22, -34, 3.2], [-26, 8, 2.4], [30, 14, 2]]) { c.beginPath(); c.moveTo(x, y - r * 2); c.lineTo(x + r * 0.5, y - r * 0.5); c.lineTo(x + r * 2, y); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x, y + r * 2); c.lineTo(x - r * 0.5, y + r * 0.5); c.lineTo(x - r * 2, y); c.lineTo(x - r * 0.5, y - r * 0.5); c.fill(); }
      break;
    }
    case 5: { // ELITE: estrela de cristal violeta com anel orbital e fragmentos
      c.strokeStyle = 'rgba(214,170,255,0.75)'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, 0, 46, 15, -0.35, 0, P * 2); c.stroke();
      c.fillStyle = '#e8ccff'; for (const [x, y] of [[-40, 6], [38, -14], [12, -44], [-14, 44]]) { c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 2.5, y); c.lineTo(x, y + 4); c.lineTo(x - 2.5, y); c.fill(); }
      c.beginPath(); for (let i = 0; i < 12; i++) { const a = -P / 2 + i * P / 6, r = i % 2 ? 19 : 42; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath();
      c.fillStyle = lg(-42, 42, '#f6e6ff', '#4a1290', '#a35cff'); c.fill(); c.lineWidth = 3; c.strokeStyle = '#2a0a55'; c.stroke();
      c.beginPath(); for (let i = 0; i < 12; i++) { const a = -P / 2 + i * P / 6, r = i % 2 ? 13 : 30; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,240,255,0.7)'; c.stroke();
      c.strokeStyle = 'rgba(214,170,255,0.9)'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, 0, 46, 15, -0.35, P * 1.05, P * 1.95); c.stroke();
      gem(11, '#ffe8ff', '#7b2bd6');
      break;
    }
    case 6: { // MASTER: escudo flamejante com chifres e asas
      for (let i = 0; i < 7; i++) { const a = -P / 2 + (i - 3) * 0.32, r = 44 + (i % 2) * 6; c.fillStyle = i % 2 ? '#ff8a3a' : '#ffbf5a'; c.beginPath(); c.moveTo(Math.cos(a - 0.15) * 26, Math.sin(a - 0.15) * 26); c.quadraticCurveTo(Math.cos(a) * r * 0.8 + 4, Math.sin(a) * r * 0.8, Math.cos(a) * r, Math.sin(a) * r); c.quadraticCurveTo(Math.cos(a) * r * 0.8 - 4, Math.sin(a) * r * 0.8, Math.cos(a + 0.15) * 26, Math.sin(a + 0.15) * 26); c.fill(); }
      wing(1, '#ff6a3a', '#a8240e', 34, 4); wing(-1, '#ff6a3a', '#a8240e', 34, 4);
      c.fillStyle = '#ffe2c0'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 12, -30); c.quadraticCurveTo(s * 26, -40, s * 22, -54); c.quadraticCurveTo(s * 18, -40, s * 6, -34); c.fill(); }
      shield(27, -36, 38); c.fillStyle = lg(-36, 38, '#ffd2a8', '#7a1a08', '#e0502a'); c.fill();
      c.lineWidth = 3.5; c.strokeStyle = '#3c0a02'; c.stroke();
      shield(21, -29, 30); c.lineWidth = 2; c.strokeStyle = '#ffd08a'; c.stroke();
      shield(27, -36, 38); shine(-18, -36, -32, 22);
      gem(11, '#fff0d0', '#d0401a');
      break;
    }
    case 7: { // GRANDMASTER: coroa carmesim sobre escudo, asas grandes e auréola
      c.strokeStyle = 'rgba(255,120,160,0.7)'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, -4, 44, P * 1.1, P * 1.9); c.stroke();
      wing(1, '#ff5a86', '#7a0d2c', 40, 5); wing(-1, '#ff5a86', '#7a0d2c', 40, 5);
      shield(25, -18, 40); c.fillStyle = lg(-18, 40, '#ff9ab4', '#4a0418', '#c21c4a'); c.fill();
      c.lineWidth = 3.5; c.strokeStyle = '#2a0210'; c.stroke();
      shield(19, -12, 32); c.lineWidth = 1.8; c.strokeStyle = '#ffc0d0'; c.stroke();
      // coroa
      path([[-28, -12], [-32, -38], [-17, -26], [0, -46], [17, -26], [32, -38], [28, -12]]); c.fillStyle = lg(-46, -12, '#fff0c0', '#b0700a', '#ffcf5a'); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = '#5a3200'; c.stroke();
      c.fillStyle = '#ff4a7a'; for (const [x, y] of [[-32, -38], [0, -46], [32, -38]]) { c.beginPath(); c.arc(x, y, 3.5, 0, P * 2); c.fill(); }
      c.save(); c.translate(0, 12); gem(10, '#ffe0ea', '#c21c4a'); c.restore();
      break;
    }
    default: { // CHAMPION: coroa radiante sobre cristal de Éter, asas douradas e raios
      rays(16, 34, 54, 'rgba(255,226,122,0.55)');
      rays(8, 30, 50, 'rgba(127,245,255,0.5)', P / 16);
      wing(1, '#ffe27a', '#c88a10', 44, 5); wing(-1, '#ffe27a', '#c88a10', 44, 5);
      // cristal de Éter
      path([[0, -24], [20, -2], [12, 40], [-12, 40], [-20, -2]]); c.fillStyle = lg(-24, 40, '#ffffff', '#1a7fb0', '#7ff5ff'); c.fill();
      c.lineWidth = 3; c.strokeStyle = '#0a3a55'; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, -24); c.lineTo(0, 40); c.moveTo(-20, -2); c.lineTo(20, -2); c.moveTo(-12, 40); c.lineTo(0, -2); c.lineTo(12, 40); c.stroke();
      // coroa
      path([[-30, -14], [-36, -42], [-19, -28], [-9, -50], [0, -34], [9, -50], [19, -28], [36, -42], [30, -14]]); c.fillStyle = lg(-50, -14, '#fffbe0', '#c27a08', '#ffd34a'); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = '#6a3c00'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-28, -20, 56, 3);
      for (const [x, y, col] of [[-36, -42, '#7ff5ff'], [-9, -50, '#ff5a86'], [9, -50, '#ff5a86'], [36, -42, '#7ff5ff'], [0, -24, '#7ff5ff']]) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 3.2, 0, P * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 1, y - 1, 1, 0, P * 2); c.fill(); }
      break;
    }
  }
  // faixa com a divisão (I, II, III) ou CAMPEÃO
  const T = RANK_TIERS[t];
  const label = div < 0 ? 'CHAMPION' : DIV[div];
  const bw = div < 0 ? 64 : 34, by = 38;
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.moveTo(-bw / 2 - 6, by + 1); c.lineTo(-bw / 2, by + 6); c.lineTo(-bw / 2 - 6, by + 12); c.lineTo(bw / 2 + 6, by + 12); c.lineTo(bw / 2, by + 6); c.lineTo(bw / 2 + 6, by + 1); c.closePath(); c.fill();
  c.fillStyle = lg(by, by + 12, T.a, T.b); c.beginPath(); c.roundRect(-bw / 2, by, bw, 12, 2); c.fill();
  c.lineWidth = 1.2; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.stroke();
  c.fillStyle = t === 1 || t === 8 || t === 2 ? '#2a1a08' : '#ffffff';
  c.font = `800 ${div < 0 ? 8.5 : 10.5}px Cinzel, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, 0, by + 6.6);
  c.restore();
}
function rankCanvas(idx, size) { const cv = document.createElement('canvas'); cv.width = cv.height = size; drawRankEmblem(cv.getContext('2d'), idx, size); return cv; }

// ---------------- Conta ----------------
const NICK_RE = /^[\p{L}\p{N}_]{3,14}$/u, TAG_RE = /^[A-Za-z0-9]{3,5}$/;
function nickKey(name, tag) { return (String(name).trim() + '#' + String(tag).trim()).toLowerCase(); }
function randomTag() { return String(1000 + Math.floor(Math.random() * 9000)); }
const FB_VER = '10.12.2';
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); }); }

const Account = {
  enabled: !!window.FIREBASE_CONFIG, user: null, profile: null, local: null, db: null, error: '', subs: [],
  on(fn) { this.subs.push(fn); }, emit() { for (const f of this.subs) try { f(this); } catch (e) { console.error(e); } },
  get logged() { return !!this.user; },
  async init() {
    try { this.local = fixProfile(JSON.parse(localStorage.getItem('ruptura-profile') || 'null'), localStorage.getItem('ruptura-name') || ''); }
    catch (e) { this.local = newProfile(); }
    this.profile = this.local;
    this.emit();
    if (!this.enabled) return;
    try {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await loadScript(base + 'firebase-auth-compat.js');
      await loadScript(base + 'firebase-firestore-compat.js');
      firebase.initializeApp(window.FIREBASE_CONFIG);
      this.db = firebase.firestore();
      firebase.auth().onAuthStateChanged(async u => {
        this.user = u;
        if (u) { try { await this.loadRemote(); this.startSocial(); } catch (e) { this.error = 'Erro ao carregar perfil: ' + e.message; this.profile = this.local; } }
        else { this.stopSocial(); this.profile = this.local; }
        this.emit();
      });
    } catch (e) { this.enabled = false; this.error = 'Login indisponível aqui (' + e.message + ')'; this.emit(); }
  },
  async login() {
    if (!this.enabled) throw new Error('Login ainda não configurado (veja js/firebase-config.js).');
    const prov = new firebase.auth.GoogleAuthProvider();
    try { await firebase.auth().signInWithPopup(prov); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await firebase.auth().signInWithRedirect(prov);
      else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
    }
  },
  async logout() { if (this.enabled) { try { await this.db.collection('presence').doc(this.user.uid).delete(); } catch (e) { } await firebase.auth().signOut(); } },
  ref() { return this.db.collection('users').doc(this.user.uid); },
  async loadRemote() {
    const snap = await this.ref().get();
    // o nome da conta Google não é usado: o jogador escolhe o próprio ID (Nome#TAG)
    if (snap.exists) {
      this.profile = fixProfile(snap.data());
      const c = this.pendingConsent; // aceitou os termos na janela de entrada agora
      if (c && !(this.profile.consent && this.profile.consent.v === c.v)) { this.profile.consent = c; await this.save(); }
    }
    else {
      this.profile = newProfile();
      const c = this.pendingConsent; if (c) this.profile.consent = c;
      await this.save();
    }
  },
  async save() {
    const p = this.profile; p.updated = Date.now();
    if (this.user && this.db) { await this.ref().set(JSON.parse(JSON.stringify(p))); }
    else { this.local = p; try { localStorage.setItem('ruptura-profile', JSON.stringify(p)); } catch (e) { } }
  },
  // ---------- LGPD: consentimento, baixar dados e excluir conta ----------
  get needsConsent() { return this.logged && !(this.profile.consent && this.profile.consent.v === window.TERMS_VERSION); },
  async giveConsent() {
    const c = { v: window.TERMS_VERSION, t: Date.now() };
    this.pendingConsent = c;
    if (this.logged) { this.profile.consent = c; await this.save(); this.emit(); }
  },
  async exportData() {
    const P = JSON.parse(JSON.stringify(this.profile)), uid = this.user.uid;
    const reqs = async (f, v) => (await this.db.collection('friendReqs').where(f, '==', v).get()).docs.map(d => d.data());
    const sent = await reqs('from', uid), got = await reqs('to', uid);
    const pres = await this.db.collection('presence').doc(uid).get();
    return {
      gerado_em: new Date().toISOString(), jogo: 'Ruptura (Zart Jogos)', id_da_conta: uid,
      conta_google_usada_no_login: { email: this.user.email || null, observacao: 'Guardado pelo serviço de login (Firebase Authentication). O jogo não mostra esse dado.' },
      perfil: P, presenca: pres.exists ? pres.data() : null,
      amigos: sent.filter(r => r.status === 'accepted').map(r => r.toName + '#' + r.toTag).concat(got.filter(r => r.status === 'accepted').map(r => r.fromName + '#' + r.fromTag)),
      pedidos_enviados: sent.filter(r => r.status === 'pending').map(r => r.toName + '#' + r.toTag),
      pedidos_recebidos: got.filter(r => r.status === 'pending').map(r => r.fromName + '#' + r.fromTag),
    };
  },
  // apaga tudo do jogador no banco e depois a conta de login
  async deleteAccount() {
    const db = this.db, uid = this.user.uid, P = this.profile;
    this.stopSocial();
    const del = async q => { const s = await q.get(); await Promise.all(s.docs.map(d => d.ref.delete().catch(() => { }))); };
    await del(db.collection('friendReqs').where('from', '==', uid));
    await del(db.collection('friendReqs').where('to', '==', uid));
    await del(db.collection('invites').where('from', '==', uid));
    await del(db.collection('invites').where('to', '==', uid));
    if (P.nickSet && P.tag) await db.collection('nicks').doc(nickKey(P.name, P.tag)).delete().catch(() => { });
    await db.collection('presence').doc(uid).delete().catch(() => { });
    await this.ref().delete();
    const u = firebase.auth().currentUser;
    try { await u.delete(); }
    catch (e) {
      if (e.code !== 'auth/requires-recent-login') throw e;
      await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      await u.delete();
    }
    try { localStorage.removeItem('ruptura-profile'); localStorage.removeItem('ruptura-name'); } catch (e) { }
  },
  async setName(n) { if (!n || this.profile.name === n) return; this.profile.name = n; try { await this.save(); } catch (e) { } this.emit(); },
  summary() { const p = this.profile; return { uid: this.user ? this.user.uid : null, tag: p.tag || '', level: p.level, rank: p.rank, mmr: p.mmr, placements: p.placements }; },
  get needsNick() { return this.logged && !this.profile.nickSet; },
  get fullId() { const p = this.profile; return p.tag ? `${p.name}#${p.tag}` : p.name; },
  // reserva o ID Nome#TAG (único, sem diferenciar maiúsculas)
  async claimNick(name, tag) {
    name = String(name || '').trim(); tag = String(tag || '').trim();
    if (!NICK_RE.test(name)) throw new Error('O nome precisa ter de 3 a 14 caracteres (letras, números ou _).');
    if (!TAG_RE.test(tag)) throw new Error('A TAG precisa ter de 3 a 5 letras ou números.');
    const key = nickKey(name, tag), uid = this.user.uid, P = this.profile;
    const oldKey = P.nickSet && P.tag ? nickKey(P.name, P.tag) : null;
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection('nicks').doc(key);
      const snap = await tx.get(ref);
      if (snap.exists && snap.data().uid !== uid) throw new Error(`${name}#${tag} já está em uso. Tente outra TAG.`);
      tx.set(ref, { uid, name, tag });
      if (oldKey && oldKey !== key) tx.delete(this.db.collection('nicks').doc(oldKey));
    });
    P.name = name; P.tag = tag; P.nickSet = true;
    await this.save(); this.presence(); this.emit();
  },
  // ---------- presença (online / em sala / em partida) ----------
  pres: { status: 'menu', room: null },
  presence(patch) {
    if (patch) Object.assign(this.pres, patch);
    if (!this.logged || !this.db || !this.profile.nickSet) return;
    const P = this.profile;
    this.db.collection('presence').doc(this.user.uid).set({ name: P.name, tag: P.tag, rank: P.rank, level: P.level, t: Date.now(), status: this.pres.status, room: this.pres.room || null }).catch(() => { });
  },
  // ---------- amigos ----------
  friends: [], incoming: [], outgoing: [], invites: [], _unsubs: [],
  startSocial() {
    this.stopSocial();
    const uid = this.user.uid, R = this.db.collection('friendReqs');
    const refresh = () => this.emitSocial();
    let a = [], b = [];
    const merge = () => {
      this.incoming = a.filter(r => r.status === 'pending');
      this.outgoing = b.filter(r => r.status === 'pending');
      this.friends = a.filter(r => r.status === 'accepted').map(r => ({ uid: r.from, name: r.fromName, tag: r.fromTag, req: r.id }))
        .concat(b.filter(r => r.status === 'accepted').map(r => ({ uid: r.to, name: r.toName, tag: r.toTag, req: r.id })));
      this.loadPresence().then(refresh); refresh();
    };
    this._unsubs.push(R.where('to', '==', uid).onSnapshot(q => { a = q.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }, () => { }));
    this._unsubs.push(R.where('from', '==', uid).onSnapshot(q => { b = q.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }, () => { }));
    this._unsubs.push(this.db.collection('invites').where('to', '==', uid).onSnapshot(q => {
      this.invites = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => Date.now() - i.t < 120000);
      refresh();
    }, () => { }));
    this._presIv = setInterval(() => { this.presence(); this.loadPresence().then(refresh); }, 30000);
    this.presence();
  },
  stopSocial() { for (const u of this._unsubs) try { u(); } catch (e) { } this._unsubs = []; clearInterval(this._presIv); this.friends = []; this.incoming = []; this.outgoing = []; this.invites = []; },
  socialSubs: [], onSocial(fn) { this.socialSubs.push(fn); }, emitSocial() { for (const f of this.socialSubs) try { f(this); } catch (e) { console.error(e); } },
  async loadPresence() {
    await Promise.all(this.friends.map(async f => {
      try { const d = await this.db.collection('presence').doc(f.uid).get(); f.pres = d.exists ? d.data() : null; if (f.pres) { f.name = f.pres.name; f.tag = f.pres.tag; } } catch (e) { }
    }));
  },
  async addFriend(id) {
    const m = String(id || '').trim().match(/^(.+?)\s*#\s*([A-Za-z0-9]{3,5})$/);
    if (!m) throw new Error('Digite o ID completo, no formato Nome#TAG.');
    const snap = await this.db.collection('nicks').doc(nickKey(m[1], m[2])).get();
    if (!snap.exists) throw new Error('Ninguém encontrado com esse ID.');
    const to = snap.data(), uid = this.user.uid;
    if (to.uid === uid) throw new Error('Esse é você!');
    if (this.friends.some(f => f.uid === to.uid)) throw new Error('Vocês já são amigos.');
    const back = this.incoming.find(r => r.from === to.uid);
    if (back) { await this.respond(back.id, true); return 'Pedido aceito! Agora vocês são amigos.'; }
    const P = this.profile;
    await this.db.collection('friendReqs').doc(uid + '_' + to.uid).set({ from: uid, to: to.uid, fromName: P.name, fromTag: P.tag, toName: to.name, toTag: to.tag, status: 'pending', t: Date.now() });
    return `Pedido enviado para ${to.name}#${to.tag}.`;
  },
  async respond(reqId, accept) {
    const ref = this.db.collection('friendReqs').doc(reqId);
    if (accept) await ref.update({ status: 'accepted' }); else await ref.delete();
  },
  async removeFriend(f) { await this.db.collection('friendReqs').doc(f.req).delete(); },
  async invite(f, code) {
    const P = this.profile;
    await this.db.collection('invites').doc(this.user.uid + '_' + f.uid).set({ from: this.user.uid, to: f.uid, fromName: P.name, fromTag: P.tag, code, t: Date.now() });
  },
  async dropInvite(inv) { try { await this.db.collection('invites').doc(inv.id).delete(); } catch (e) { } },
  // registra uma partida terminada
  async record(r) {
    if (this.user && this.db) { try { await this.loadRemote(); } catch (e) { } }
    const out = applyMatchResult(this.profile, r);
    try { await this.save(); out.saved = true; } catch (e) { out.saved = false; out.err = e.message; }
    this.emit();
    return out;
  },
};

// ---------------- Fila da Ranqueada (Firestore) ----------------
const Queue = {
  col() { return Account.db.collection('queue'); },
  async enter(code, party) {
    const mmr = Math.round(party.reduce((a, m) => a + (m.mmr || 1000), 0) / party.length);
    await this.col().doc(code).set({ code, size: party.length, mmr, ts: Date.now(), state: 'waiting', guest: null, guestSize: 0 });
  },
  async cancel(code) { try { await this.col().doc(code).delete(); } catch (e) { } },
  // procura uma partida compatível. Quem tem o código "maior" reivindica o outro (evita os dois se reivindicarem).
  async tryMatch(code, waited) {
    const snap = await this.col().where('state', '==', 'waiting').get();
    const me = snap.docs.find(d => d.id === code); if (!me) return null;
    const my = me.data(), now = Date.now();
    const cands = snap.docs.map(d => d.data()).filter(q => q.code !== code && now - q.ts < 120000 && q.code < code &&
      Math.abs(q.mmr - my.mmr) <= 200 + waited * 6).sort((a, b) => a.ts - b.ts);
    for (const q of cands) {
      const ok = await Account.db.runTransaction(async tx => {
        const theirRef = this.col().doc(q.code), myRef = this.col().doc(code);
        const [t, m] = [await tx.get(theirRef), await tx.get(myRef)];
        if (!t.exists || !m.exists || t.data().state !== 'waiting' || m.data().state !== 'waiting') return false;
        tx.update(theirRef, { state: 'matched', guest: code, guestSize: my.size });
        tx.update(myRef, { state: 'matched', guest: q.code });
        return true;
      });
      if (ok) return q.code;
    }
    return null;
  },
  watch(code, fn) { return this.col().doc(code).onSnapshot(d => fn(d.exists ? d.data() : null)); },
  async heartbeat(code) { try { await this.col().doc(code).update({ ts: Date.now() }); } catch (e) { } },
};
