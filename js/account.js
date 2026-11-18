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
function drawRankEmblem(c, idx, size) {
  c.save(); c.translate(size / 2, size / 2); c.scale(size / 100, size / 100);
  if (idx < 0) {
    c.strokeStyle = '#6b7290'; c.lineWidth = 5; c.fillStyle = 'rgba(40,44,70,0.8)';
    poly(c, 6, 38, Math.PI / 6); c.fill(); c.stroke();
    c.fillStyle = '#9aa3c7'; c.font = '800 40px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 2);
    c.restore(); return;
  }
  const t = rankTier(idx), T = RANK_TIERS[t];
  const gr = c.createLinearGradient(0, -45, 0, 45); gr.addColorStop(0, T.a); gr.addColorStop(1, T.b);
  // brilho de fundo
  const gl = c.createRadialGradient(0, 0, 10, 0, 0, 55); gl.addColorStop(0, T.g + '55'); gl.addColorStop(1, T.g + '00');
  c.fillStyle = gl; c.fillRect(-55, -55, 110, 110);
  // asas (Gold+, Master+)
  if (t === 2 || t >= 6) {
    c.fillStyle = T.b;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 18, -10); c.quadraticCurveTo(s * 48, -30, s * 50, -2); c.lineTo(s * 40, -4); c.lineTo(s * 44, 8); c.lineTo(s * 32, 6); c.lineTo(s * 34, 18); c.lineTo(s * 20, 14); c.closePath(); c.fill(); }
  }
  // raios do Champion
  if (t === 8) {
    c.fillStyle = 'rgba(255,230,140,0.7)';
    for (let i = 0; i < 12; i++) { c.save(); c.rotate(i * Math.PI / 6); c.beginPath(); c.moveTo(-4, -30); c.lineTo(0, -52); c.lineTo(4, -30); c.fill(); c.restore(); }
  }
  c.fillStyle = gr; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3;
  c.beginPath();
  if (t <= 2 || t === 6) { // escudo
    c.moveTo(0, -38); c.lineTo(30, -28); c.lineTo(28, 8); c.quadraticCurveTo(22, 30, 0, 40); c.quadraticCurveTo(-22, 30, -28, 8); c.lineTo(-30, -28); c.closePath();
  } else if (t === 3) poly(c, 6, 38, Math.PI / 6);
  else if (t === 4) { c.moveTo(0, -42); c.lineTo(32, -6); c.lineTo(0, 42); c.lineTo(-32, -6); c.closePath(); }
  else if (t === 5) star(c, 6, 42, 22);
  else { // coroa (GrandMaster / Champion)
    c.moveTo(-32, 30); c.lineTo(-36, -18); c.lineTo(-18, 0); c.lineTo(0, -34); c.lineTo(18, 0); c.lineTo(36, -18); c.lineTo(32, 30); c.closePath();
  }
  c.fill(); c.stroke();
  // detalhes internos
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2;
  if (t <= 2 || t === 6) { c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 30); c.stroke(); }
  if (t === 4) { c.beginPath(); c.moveTo(-32, -6); c.lineTo(32, -6); c.moveTo(0, -42); c.lineTo(-12, -6); c.lineTo(0, 42); c.lineTo(12, -6); c.closePath(); c.stroke(); }
  if (t === 6) { c.fillStyle = T.a; for (const x of [-18, 0, 18]) { c.beginPath(); c.moveTo(x - 6, -30); c.lineTo(x, -46); c.lineTo(x + 6, -30); c.fill(); } }
  // gema central de Éter
  const gg = c.createRadialGradient(-3, -3, 1, 0, 0, 11); gg.addColorStop(0, '#ffffff'); gg.addColorStop(1, t === 8 ? '#7ff5ff' : T.g);
  c.fillStyle = gg; c.beginPath(); c.moveTo(0, -11); c.lineTo(9, 0); c.lineTo(0, 11); c.lineTo(-9, 0); c.closePath(); c.fill();
  // divisão (I–III)
  if (idx < RANK_MAX) {
    const n = idx % 3 + 1;
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 14; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, 42); c.lineTo(x + 5, 48); c.lineTo(x, 54); c.lineTo(x - 5, 48); c.closePath(); c.fill(); }
  }
  c.restore();
  function poly(c, n, r, rot) { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
  function star(c, n, R1, R2) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i / (n * 2) * Math.PI * 2, r = i % 2 ? R2 : R1; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
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
    if (snap.exists) this.profile = fixProfile(snap.data(), this.user.displayName);
    else {
      this.profile = newProfile((this.user.displayName || 'Caçador').split(' ')[0].replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 14));
      await this.save();
    }
  },
  async save() {
    const p = this.profile; p.updated = Date.now();
    if (this.user && this.db) { await this.ref().set(JSON.parse(JSON.stringify(p))); }
    else { this.local = p; try { localStorage.setItem('ruptura-profile', JSON.stringify(p)); } catch (e) { } }
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
