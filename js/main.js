// =====================================================================
//  main.js : menus, lobby, loop do jogo, entrada e HUD
// =====================================================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const BOT_NAMES = ['Eco', 'Vulto', 'Faísca', 'Garoa', 'Breu', 'Ônix', 'Sina', 'Lasca', 'Rajada', 'Cinza', 'Neblina', 'Trovo'];
const ICONS = {
  brasa: ['✹', '✺', '➤', '☄'], corvo: ['➶', '⛓', '✧', '☾'], mare: ['◉', '◌', '▥', '≋'], lumi: ['✦', '⛉', '✚', '☀'], rocha: ['⚒', '⚡', '⛨', '⛰'],
};

const App = {
  name: '', mode: 'online', role: 'none', code: '', myId: 0, slots: [], myHunter: 'brasa',
  sim: null, cs: null, tr: null, peers: new Map(), nextPid: 2, pending: [], remoteIn: new Map(),
  inGame: false, paused: false, ended: false, demo: null, demoMe: null, demoT: 0,
};

// ------------------------------------------------------------------
//  Canvas / renderer
// ------------------------------------------------------------------
const canvas = $('#bg');
const R = new Renderer(canvas);
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5, R.dpr || 9);
  R.dpr = dpr;
  canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr);
}
addEventListener('resize', resize); resize();

// ------------------------------------------------------------------
//  Telas
// ------------------------------------------------------------------
function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id)); App.screen = id; }
function msg(sel, t) { $(sel).textContent = t || ''; }
try { App.name = localStorage.getItem('ruptura-name') || ''; App.myHunter = localStorage.getItem('ruptura-hunter') || 'brasa'; } catch (e) { }
$('#in-name').value = App.name;
if (!hasWebRTC()) { /* preview sem WebRTC */ }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  SFX.init(); SFX.play('click');
  const act = b.dataset.act;
  ({
    solo: () => startSolo(), host: () => startHost(), join: () => startJoin(),
    codex: () => { buildCodex(); show('codex'); }, howto: () => show('howto'), back: () => show('menu'),
    leave: () => leaveRoom(), start: () => hostStart(), menu: () => leaveRoom(), again: () => playAgain(),
    resume: () => togglePause(false), quit: () => leaveRoom(),
    sound: () => { const on = SFX.toggle(); b.textContent = 'Som: ' + (on ? 'ligado' : 'desligado'); },
  })[act]?.();
});

function readName() {
  let n = $('#in-name').value.trim().slice(0, 14);
  if (!n) n = 'Caçador' + Math.floor(Math.random() * 90 + 10);
  App.name = n; $('#in-name').value = n;
  try { localStorage.setItem('ruptura-name', n); } catch (e) { }
  App.mode = document.querySelector('input[name=net]:checked').value;
}
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0]; return s; }

// ------------------------------------------------------------------
//  Lobby (host é a autoridade)
// ------------------------------------------------------------------
function emptySlots() { return Array.from({ length: 8 }, () => ({ kind: 'empty' })); }
function teamHunters(slots, team, exceptIdx) { const s = new Set(); for (let i = team * 4; i < team * 4 + 4; i++) if (i !== exceptIdx && slots[i].kind !== 'empty') s.add(slots[i].hunter); return s; }
function freeHunter(slots, team, pref) { const used = teamHunters(slots, team); if (pref && !used.has(pref)) return pref; return HUNTER_IDS.find(h => !used.has(h)); }
function placeHuman(id, name, pref) {
  const S = App.slots;
  const humans = t => S.slice(t * 4, t * 4 + 4).filter(s => s.kind === 'human').length;
  const order = humans(0) <= humans(1) ? [0, 1] : [1, 0];
  for (const t of order) for (let i = t * 4; i < t * 4 + 4; i++) if (S[i].kind === 'empty') { S[i] = { kind: 'human', id, name, hunter: freeHunter(S, t, pref) }; return true; }
  return false;
}
function slotOf(id) { return App.slots.findIndex(s => s.id === id); }

function startSolo() {
  readName(); App.role = 'solo'; App.myId = 1; App.slots = emptySlots();
  App.slots[0] = { kind: 'human', id: 1, name: App.name, hunter: App.myHunter };
  openLobby();
}
async function startHost() {
  readName();
  if (App.mode === 'online' && !hasWebRTC()) return msg('#menu-msg', 'Este navegador/preview bloqueia conexões online. Use o modo Local ou abra o site hospedado.');
  msg('#menu-msg', 'Criando sala...');
  const code = genCode();
  try {
    App.tr = await Transport.host(App.mode, code, { onJoin: hostOnJoin, onLeave: hostOnLeave, onMsg: hostOnMsg });
  } catch (e) { return msg('#menu-msg', e.message + (App.mode === 'online' ? ' — o modo online funciona no site hospedado (ex.: GitHub Pages).' : '')); }
  msg('#menu-msg', '');
  App.role = 'host'; App.code = code; App.myId = 1; App.slots = emptySlots(); App.peers.clear(); App.nextPid = 2;
  App.slots[0] = { kind: 'human', id: 1, name: App.name, hunter: App.myHunter };
  openLobby();
}
async function startJoin() {
  readName();
  const code = $('#in-code').value.trim().toUpperCase();
  if (code.length < 5) return msg('#menu-msg', 'Digite o código de 5 letras da sala.');
  if (App.mode === 'online' && !hasWebRTC()) return msg('#menu-msg', 'Este navegador/preview bloqueia conexões online. Use o modo Local ou abra o site hospedado.');
  msg('#menu-msg', 'Conectando...');
  try {
    App.tr = await Transport.join(App.mode, code, { onMsg: clientOnMsg, onClose: clientOnClose });
  } catch (e) { return msg('#menu-msg', e.message + (App.mode === 'online' ? ' — o modo online funciona no site hospedado (ex.: GitHub Pages).' : '')); }
  msg('#menu-msg', '');
  App.role = 'client'; App.code = code; App.myId = 0;
  App.tr.send({ t: 'hello', name: App.name, pref: App.myHunter });
  App.slots = emptySlots();
  openLobby();
}
function openLobby() {
  App.inGame = false; App.ended = false;
  $('#lob-code').textContent = App.role === 'solo' ? 'TREINO' : App.code;
  $('#lob-mode').textContent = App.role === 'solo' ? 'Você + bots' : App.mode === 'local' ? 'Modo local: abra outra aba e entre com este código' : 'Passe este código para seus amigos';
  $('#btn-start').style.display = App.role === 'client' ? 'none' : '';
  msg('#lob-msg', App.role === 'client' ? 'Aguardando o dono da sala começar...' : '');
  show('lobby'); renderLobby();
}
function broadcastLobby() { if (App.role === 'host') App.tr.broadcast({ t: 'lobby', slots: App.slots }); }

function hostOnJoin(pid) { /* espera o hello */ }
function hostOnLeave(pid) {
  const pe = App.peers.get(pid); if (!pe) return;
  App.peers.delete(pid); App.remoteIn.delete(pe.id);
  const i = slotOf(pe.id);
  if (App.inGame && App.sim) {
    const p = App.sim.byId(pe.id); if (p) { p.bot = true; p.name += ' (bot)'; }
    feed(`<span class="enemy">${esc(pe.name)}</span> saiu — um bot assumiu`);
  } else if (i >= 0) { App.slots[i] = { kind: 'empty' }; renderLobby(); broadcastLobby(); }
}
function hostOnMsg(pid, m) {
  if (m.t === 'hello') {
    if (App.peers.has(pid)) return;
    if (App.inGame) { App.tr.send(pid, { t: 'full', why: 'A partida já começou. Espere acabar.' }); return; }
    const id = App.nextPid++;
    if (!placeHuman(id, String(m.name || 'Caçador').slice(0, 14), m.pref)) { App.tr.send(pid, { t: 'full', why: 'Sala cheia (8 jogadores).' }); return; }
    App.peers.set(pid, { id, name: m.name });
    App.tr.send(pid, { t: 'welcome', id });
    renderLobby(); broadcastLobby();
    return;
  }
  const pe = App.peers.get(pid); if (!pe) return;
  if (m.t === 'in') { App.remoteIn.set(pe.id, m.i); return; }
  if (!App.inGame) lobbyAction(pe.id, m);
}
function lobbyAction(id, m) {
  const S = App.slots, i = slotOf(id); if (i < 0) return;
  if (m.t === 'slot' && S[m.slot] && S[m.slot].kind === 'empty') {
    const team = m.slot < 4 ? 0 : 1, cur = S[i];
    S[i] = { kind: 'empty' };
    S[m.slot] = { ...cur, hunter: freeHunter(S, team, cur.hunter) };
  } else if (m.t === 'pick' && HUNTERS[m.hunter]) {
    const team = i < 4 ? 0 : 1;
    if (!teamHunters(S, team, i).has(m.hunter)) S[i].hunter = m.hunter;
  } else return;
  renderLobby(); broadcastLobby();
}
function myAction(m) {
  if (App.role === 'client') App.tr.send(m);
  else lobbyAction(App.myId, m);
  if (m.t === 'pick') { App.myHunter = m.hunter; try { localStorage.setItem('ruptura-hunter', m.hunter); } catch (e) { } }
}

const portraitCache = new Map();
function portrait(h, size) { const k = h + size; if (!portraitCache.has(k)) portraitCache.set(k, hunterPortrait(h, size)); const src = portraitCache.get(k); const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(src, 0, 0); return c; }

function renderLobby() {
  const S = App.slots;
  for (const t of [0, 1]) {
    const box = $('#slots' + t); box.innerHTML = '';
    for (let i = t * 4; i < t * 4 + 4; i++) {
      const s = S[i], d = document.createElement('div');
      d.className = 'slot' + (s.kind !== 'empty' ? ' filled' : '') + (s.id === App.myId ? ' me' : '');
      if (s.kind === 'empty') { d.innerHTML = `<span class="empty">+ Vaga livre (bot) — clique para entrar</span>`; d.onclick = () => { SFX.play('click'); myAction({ t: 'slot', slot: i }); }; }
      else {
        d.appendChild(portrait(s.hunter, 88));
        const H = HUNTERS[s.hunter], C = CLASSES[H.classe];
        const info = document.createElement('div');
        info.innerHTML = `<div class="nm">${esc(s.name)}${s.id === App.myId ? ' (você)' : ''}</div><div class="hn" style="color:${C.cor}">${H.nome} · ${C.nome}</div>`;
        d.appendChild(info);
      }
      box.appendChild(d);
    }
  }
  const mi = slotOf(App.myId);
  const pk = $('#picker'); pk.innerHTML = '';
  for (const h of HUNTER_IDS) {
    const H = HUNTERS[h], C = CLASSES[H.classe];
    const used = mi >= 0 ? teamHunters(S, mi < 4 ? 0 : 1, mi) : new Set();
    const d = document.createElement('div');
    d.className = 'pcard' + (mi >= 0 && S[mi].hunter === h ? ' sel' : '') + (used.has(h) ? ' taken' : '');
    d.appendChild(portrait(h, 160));
    d.insertAdjacentHTML('beforeend', `<div class="pc-info"><div class="pc-name">${H.nome}</div><div class="pc-cls" style="color:${C.cor}">${C.icone} ${C.nome}</div></div>`);
    d.title = H.titulo + ' — ' + C.desc;
    d.onclick = () => { SFX.play('click'); myAction({ t: 'pick', hunter: h }); };
    pk.appendChild(d);
  }
}
function buildCodex() {
  $('#codex-lore').innerHTML = `<p>${LORE.mundo}</p><p style="margin-top:8px;color:var(--cyan)">${LORE.arena}</p>`;
  const L = $('#codex-list'); L.innerHTML = '';
  for (const h of HUNTER_IDS) {
    const H = HUNTERS[h], C = CLASSES[H.classe], A = H.habilidades;
    const d = document.createElement('div'); d.className = 'cx';
    d.appendChild(portrait(h, 220));
    const ab = [['ESQ', 'basico'], ['Q', 'q'], ['E', 'e'], ['R', 'r']].map(([k, key], i) =>
      `<div><b>${ICONS[h][i]} ${k} · ${A[key].nome}</b>${key !== 'basico' ? ` <span class="hint">(${A[key].cd}s)</span>` : ''}<br>${A[key].desc}</div>`).join('');
    d.insertAdjacentHTML('beforeend', `<div><h3>${H.nome}</h3><div class="tt">${H.titulo}</div><div class="cl" style="color:${C.cor}">${C.icone} ${C.nome} — ${C.desc}</div><div class="stats">Vida ${H.hp} · Velocidade ${H.speed}</div><p>${H.lore}</p><div class="abl">${ab}</div></div>`);
    L.appendChild(d);
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function fillBots(slots) {
  const S = slots.map(s => ({ ...s }));
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  let bid = 100;
  for (let i = 0; i < 8; i++) if (S[i].kind === 'empty') S[i] = { kind: 'bot', id: bid++, name: names.pop() + ' [bot]', hunter: freeHunter(S, i < 4 ? 0 : 1) };
  return S;
}
function hostStart() {
  if (App.role === 'client') return;
  const S = fillBots(App.slots);
  if (App.role === 'host') App.tr.broadcast({ t: 'start', slots: S });
  beginGame(S);
}
function leaveRoom() {
  if (App.tr) { try { App.tr.close(); } catch (e) { } }
  App.tr = null; App.role = 'none'; App.inGame = false; App.sim = null; App.cs = null; App.paused = false;
  $('#pause').classList.remove('show');
  show('menu');
}
function playAgain() {
  if (App.role === 'client') { show('lobby'); msg('#lob-msg', 'Aguardando o dono da sala...'); return; }
  App.inGame = false; App.sim = null;
  // remove bots que entraram no lugar de quem saiu
  App.slots = App.slots.map(s => s.kind === 'human' && (s.id === App.myId || [...App.peers.values()].some(p => p.id === s.id)) ? s : { kind: 'empty' });
  if (App.role === 'host') App.tr.broadcast({ t: 'tolobby', slots: App.slots });
  openLobby();
}

// ------------------------------------------------------------------
//  Cliente
// ------------------------------------------------------------------
function clientOnMsg(m) {
  switch (m.t) {
    case 'welcome': App.myId = m.id; renderLobby(); break;
    case 'full': leaveRoom(); msg('#menu-msg', m.why); break;
    case 'lobby': App.slots = m.slots; if (!App.inGame) renderLobby(); break;
    case 'tolobby': App.slots = m.slots; if (App.screen === 'end' || App.screen === 'game' || App.screen === 'lobby') openLobby(); break;
    case 'start': beginGame(m.slots); break;
    case 's':
      if (!App.cs) return;
      App.cs.apply(m, App.myId);
      handleEvents(m.E, App.cs);
      break;
  }
}
function clientOnClose() { if (App.role !== 'client') return; leaveRoom(); msg('#menu-msg', 'Conexão com a sala perdida (o dono saiu?).'); }

// ------------------------------------------------------------------
//  Partida
// ------------------------------------------------------------------
function beginGame(slots) {
  App.slots = slots.map(s => ({ ...s }));
  App.inGame = true; App.ended = false; App.paused = false; App.pending = []; App.acc = 0; App.ticks = 0; hostLast = 0;
  if (App.role === 'client') { App.sim = null; App.cs = new ClientState(slots); }
  else { App.sim = new Sim(slots); App.cs = null; handleEvents(App.sim.drainEvents(), App.sim); }
  buildHud();
  show('game');
  R.parts = []; R.anim.clear();
  const me = state().players.find(p => p.id === App.myId);
  if (me) { R.cam.x = SPAWNS[me.team][0].x; R.cam.y = 800; }
}
function state() { return App.sim || App.cs; }
function meP(S) { return S.players.find(p => p.id === App.myId); }

// ------------------------------------------------------------------
//  Entrada
// ------------------------------------------------------------------
const keys = {}; const mouse = { sx: 0, sy: 0, wx: 0, wy: 0, l: false, r: false };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter' && e.target.id === 'in-code') startJoin(); return; }
  const k = e.key.toLowerCase(); keys[k] = true;
  if (App.screen === 'game') {
    if (k === 'tab') { e.preventDefault(); $('#tabboard').classList.add('show'); buildTab(); }
    if (k === 'escape') togglePause();
    if (k === 'm') { const on = SFX.toggle(); flashBanner(on ? 'Som ligado' : 'Som desligado', '', 800); }
    if (k === ' ') e.preventDefault();
  }
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (k === 'tab') $('#tabboard').classList.remove('show'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('#scr-game').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { const d = R.dpr || 1; mouse.sx = e.clientX * d; mouse.sy = e.clientY * d; });
$('#scr-game').addEventListener('mousedown', e => { SFX.init(); if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
function togglePause(v) {
  App.paused = v ?? !App.paused;
  $('#pause').classList.toggle('show', App.paused);
}
function readInput() {
  const z = R.cam.z || 1;
  mouse.wx = R.cam.x + (mouse.sx - canvas.width / 2) / z;
  mouse.wy = R.cam.y + (mouse.sy - canvas.height / 2) / z;
  const blocked = App.paused;
  return {
    mx: blocked ? 0 : (keys.d ? 1 : 0) - (keys.a ? 1 : 0), my: blocked ? 0 : (keys.s ? 1 : 0) - (keys.w ? 1 : 0),
    ax: Math.round(mouse.wx), ay: Math.round(mouse.wy),
    fire: !blocked && mouse.l, q: !blocked && (!!keys.q || mouse.r), e: !blocked && !!keys.e, r: !blocked && !!keys.r, dash: !blocked && (!!keys[' '] || !!keys.shift),
  };
}

// ------------------------------------------------------------------
//  Eventos -> efeitos, sons, HUD
// ------------------------------------------------------------------
function handleEvents(evs, S) {
  if (!evs || !evs.length) return;
  const me = meP(S) || S.players[0];
  for (const e of evs) {
    R.onEvent(e, S, me);
    const near = (x, y) => dist(me.x, me.y, x, y) < 950;
    const pl = id => S.players.find(p => p.id === id);
    switch (e.k) {
      case 'shot': { const p = pl(e.id); if (p && near(p.x, p.y)) SFX.play('shot_' + e.h, p.id === me.id ? 30 : 70); break; }
      case 'hit': if (e.id === me.id && !e.tick) SFX.play('hurt', 90); else if (e.by === me.id) SFX.play('hit', 50); break;
      case 'heal': if (e.id === me.id) SFX.play('heal', 300); break;
      case 'boom': if (near(e.x, e.y)) SFX.play(e.c === 'fire' ? 'boom' : 'quake'); break;
      case 'dash': if (e.id === me.id) SFX.play('dash'); break;
      case 'blink': if (near(e.x2, e.y2)) SFX.play('blink'); break;
      case 'cast': { const p = pl(e.id); if (p && near(p.x, p.y)) SFX.play('cast', 60); break; }
      case 'swing': { const p = pl(e.id); if (p && near(p.x, p.y)) SFX.play('swing', 60); break; }
      case 'shield': if (e.id === me.id) SFX.play('shield'); break;
      case 'block': if (near(e.x, e.y)) SFX.play('block', 60); break;
      case 'hook': SFX.play('hook'); break;
      case 'aurora': if (near(e.x, e.y)) SFX.play('aurora'); break;
      case 'revive': { const p = pl(e.id); SFX.play('revive'); if (p) feed(`${nameTag(p, me)} foi revivido`); break; }
      case 'death': {
        const v = pl(e.id), k = pl(e.by);
        SFX.play('death', 0);
        if (v) feed(k ? `${nameTag(k, me)} <span style="color:#fff">✕</span> ${nameTag(v, me)}` : `${nameTag(v, me)} sucumbiu à Névoa`);
        break;
      }
      case 'round':
        SFX.play('round', 0);
        flashBanner('ROUND ' + e.n, e.night ? 'NOITE · a visão vira um cone' : 'DIA · visão aberta', 2200);
        break;
      case 'fight': flashBanner('LUTEM!', '', 900); SFX.play('tick', 0); break;
      case 'roundEnd': {
        const won = e.w === me.team;
        flashBanner(e.w < 0 ? 'EMPATE' : won ? 'ROUND VENCIDO' : 'ROUND PERDIDO', `${TEAMS[0].name} ${e.sc[0]} × ${e.sc[1]} ${TEAMS[1].name}`, 3000);
        break;
      }
      case 'match': {
        const won = e.w === me.team;
        SFX.play(won ? 'win' : 'lose', 0);
        flashBanner(won ? 'VITÓRIA' : 'DERROTA', '', 2600);
        App.ended = true;
        setTimeout(() => { if (App.inGame) showEnd(S, won); }, 2800);
        break;
      }
    }
  }
}
function nameTag(p, me) { const c = p.id === me.id ? 'self' : p.team === me.team ? 'ally' : 'enemy'; return `<span class="${c}">${esc(p.name)}</span>`; }
function feed(html) {
  const f = $('#feed'), d = document.createElement('div'); d.innerHTML = html; f.prepend(d);
  while (f.children.length > 6) f.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
let bannerTO = 0;
function flashBanner(t, sub, ms) {
  const b = $('#banner'); b.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); b.classList.add('show');
  clearTimeout(bannerTO); bannerTO = setTimeout(() => b.classList.remove('show'), ms);
}

// ------------------------------------------------------------------
//  HUD
// ------------------------------------------------------------------
function buildHud() {
  const S = state(), me = meP(S);
  $('#hud-code').textContent = App.role === 'host' || App.role === 'client' ? `Sala ${App.code} · ${App.mode === 'local' ? 'local' : 'online'}` : 'Treino';
  for (const t of [0, 1]) {
    const box = $('#ros' + t); box.innerHTML = '';
    for (const p of S.players.filter(q => q.team === t)) { const d = document.createElement('div'); d.dataset.id = p.id; d.title = p.name; d.appendChild(portrait(p.hunter, 60)); box.appendChild(d); }
  }
  $('#feed').innerHTML = '';
  if (!me) return;
  const H = HUNTERS[me.hunter];
  const mp = $('#me-port').getContext('2d'); mp.clearRect(0, 0, 84, 84); mp.drawImage(hunterPortrait(me.hunter, 84), 0, 0);
  $('#me-name').innerHTML = `${esc(me.name)} <span style="color:${CLASSES[H.classe].cor};font-size:13px">· ${H.nome}</span>`;
  const ab = $('#abil'); ab.innerHTML = '';
  const defs = [['basic', 'basico', 'ESQ'], ['q', 'q', 'Q'], ['e', 'e', 'E'], ['r', 'r', 'R'], ['dash', null, 'ESP']];
  defs.forEach(([key, hk, label], i) => {
    const d = document.createElement('div'); d.className = 'ab' + (key === 'r' ? ' ult' : ''); d.dataset.k = key;
    const col = key === 'dash' ? '#d8f0ff' : CLASSES[H.classe].cor;
    const name = hk ? H.habilidades[hk].nome : 'Esquiva';
    d.innerHTML = `<span class="ic" style="color:${col}">${key === 'dash' ? '»' : ICONS[me.hunter][i]}</span><span class="k">${label}</span><div class="cdv"></div><div class="cdt"></div>`;
    d.title = name + (hk ? ' — ' + H.habilidades[hk].desc : '');
    ab.appendChild(d);
  });
}
let hudT = 0;
function updateHud(S, me, dt) {
  hudT -= dt;
  if (me) {
    const H = HUNTERS[me.hunter];
    for (const el of $('#abil').children) {
      const k = el.dataset.k, cd = me.cd[k] || 0;
      const max = k === 'dash' ? DASH_CD : k === 'basic' ? H.habilidades.basico.cd : H.habilidades[k].cd;
      el.querySelector('.cdv').style.setProperty('--p', (cd > 0 ? Math.min(100, cd / max * 100) : 0) + '%');
      el.querySelector('.cdt').textContent = cd > 0.05 && k !== 'basic' ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
      el.classList.toggle('ready', cd <= 0);
    }
    const tot = Math.max(me.maxHp, me.hp + me.shield);
    $('#me-hp').style.width = (me.hp / tot * 100) + '%';
    $('#me-sh').style.left = (me.hp / tot * 100) + '%'; $('#me-sh').style.width = (me.shield / tot * 100) + '%';
    $('#me-hptxt').textContent = `${Math.ceil(me.hp)} / ${me.maxHp}` + (me.shield > 0 ? ` (+${Math.ceil(me.shield)})` : '');
    $('#spectate').textContent = !me.alive && S.phase === 'fight' ? (me.revive > 0 ? 'Um aliado está te revivendo...' : 'Você caiu! Um aliado pode te reviver na sua alma.') : '';
  }
  if (hudT > 0) return; hudT = 0.1;
  $('#sc0').textContent = S.score[0]; $('#sc1').textContent = S.score[1];
  $('#hud-round').textContent = 'ROUND ' + S.round + (S.night ? ' · NOITE' : ' · DIA');
  let tm = '';
  if (S.phase === 'countdown') tm = Math.ceil(S.phaseT) + '';
  else { const t = Math.floor(S.fightT); tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  $('#hud-timer').textContent = tm;
  if (S.phase === 'countdown' && S.phaseT < 3) {
    const n = Math.ceil(S.phaseT);
    if (n !== App.lastCount) { App.lastCount = n; if (n <= 3 && n > 0) SFX.play('tick', 0); }
  }
  for (const d of $$('.ros div')) { const p = S.players.find(q => q.id == d.dataset.id); if (p) d.classList.toggle('dead', !p.alive); }
}
function buildTab() {
  const S = state(); if (!S) return;
  const me = meP(S);
  let h = '<table><tr><th>Time</th><th>Jogador</th><th>Caçador</th><th>Abates</th><th>Mortes</th><th>Dano</th><th>Cura</th></tr>';
  for (const p of S.players.slice().sort((a, b) => a.team - b.team || b.kills - a.kills))
    h += `<tr style="${me && p.id === me.id ? 'color:var(--gold)' : ''}"><td style="color:${TEAMS[p.team].main}">${TEAMS[p.team].name}</td><td>${esc(p.name)}</td><td>${HUNTERS[p.hunter].nome}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg)}</td><td>${Math.round(p.heal)}</td></tr>`;
  $('#tabboard').innerHTML = h + '</table>';
}
function showEnd(S, won) {
  App.inGame = false;
  const t = $('#end-title'); t.textContent = won ? 'VITÓRIA' : 'DERROTA'; t.className = won ? 'win' : 'lose';
  $('#end-sub').textContent = `${TEAMS[0].name} ${S.score[0]} × ${S.score[1]} ${TEAMS[1].name}`;
  const me = meP(S);
  let h = '<tr><th>TIME</th><th>JOGADOR</th><th>CAÇADOR</th><th>ABATES</th><th>MORTES</th><th>DANO</th><th>CURA</th></tr>';
  for (const p of S.players.slice().sort((a, b) => a.team - b.team || b.dmg - a.dmg))
    h += `<tr class="${me && p.id === me.id ? 'mine' : ''}"><td class="tm${p.team}">${TEAMS[p.team].name}</td><td>${esc(p.name)}</td><td>${HUNTERS[p.hunter].nome}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg)}</td><td>${Math.round(p.heal)}</td></tr>`;
  $('#end-table').innerHTML = h;
  $('#btn-again').textContent = App.role === 'client' ? 'Voltar ao lobby' : 'Jogar de novo';
  show('end');
}

// ------------------------------------------------------------------
//  Partida de demonstração no fundo do menu
// ------------------------------------------------------------------
function newDemo() {
  const S = [];
  for (let i = 0; i < 8; i++) S.push({ kind: 'bot', id: 200 + i, name: BOT_NAMES[i], hunter: HUNTER_IDS[(i + (i >= 4 ? 2 : 0)) % 5] });
  App.demo = new Sim(S); App.demo.drainEvents(); App.demoT = 0;
}

// ------------------------------------------------------------------
//  Loop principal
// ------------------------------------------------------------------
let last = performance.now(), sendT = 0;
const perf = { acc: 0, n: 0 };
function autoQuality(rawDt) {
  // se o PC estiver sofrendo, reduz a resolução interna automaticamente
  perf.acc += rawDt; perf.n++;
  if (perf.acc < 2) return;
  const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
  if (avg > 0.024 && R.dpr > 0.6) {
    R.dpr = Math.max(0.6, +(R.dpr - 0.25).toFixed(2));
    canvas.width = Math.floor(innerWidth * R.dpr); canvas.height = Math.floor(innerHeight * R.dpr);
  }
}
function loop(ts) {
  const raw = (ts - last) / 1000;
  const dt = Math.min(0.05, raw); last = ts;
  if (raw < 0.5) autoQuality(raw);
  if (App.inGame || (App.screen === 'end' && state())) gameFrame(dt);
  else demoFrame(dt);
  requestAnimationFrame(loop);
}
function gameFrame(dt) {
  const S = state(); if (!S) return;
  const inp = readInput();
  if (App.sim) {
    const me = App.sim.byId(App.myId);
    if (me) me.input = inp;
    hostUpdate();
  } else if (App.cs) {
    const cs = App.cs, me = meP(cs);
    sendT -= dt;
    if (sendT <= 0 && App.tr) { App.tr.send({ t: 'in', i: inp }); sendT = 1 / 30; }
    let pred = false;
    if (me && me.alive && me.init) {
      me.aim = Math.atan2(inp.ay - me.y, inp.ax - me.x);
      if (cs.phase === 'fight' && me.stun <= 0 && !me.leap && !me.dashing) {
        pred = true;
        let mx = inp.mx, my = inp.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
        let sp = HUNTERS[me.hunter].speed;
        if (me.slowT) sp *= 0.7; if (me.spdT) sp *= 1.25; if (me.huntT) sp *= 1.35; if (me.bastionT) sp *= 0.8;
        me.pvx = me.pvx || 0; me.pvy = me.pvy || 0;
        const k = 1 - Math.exp(-dt * 18);
        me.pvx += (mx * sp - me.pvx) * k; me.pvy += (my * sp - me.pvy) * k;
        me.x += me.pvx * dt; me.y += me.pvy * dt;
        Sim.prototype.collide.call({ solids: MAP_OBS.concat(cs.walls) }, me);
        const err = dist(me.x, me.y, me.tx, me.ty);
        if (err > 120) { me.x = me.tx; me.y = me.ty; }
        else { const c = Math.min(1, dt * (err > 40 ? 6 : 2)); me.x += (me.tx - me.x) * c; me.y += (me.ty - me.y) * c; }
      }
    }
    cs.tick(dt, me, pred);
  }
  const me = meP(S) || S.players[0];
  // câmera segue aliado vivo se você caiu
  let camT = me;
  if (!me.alive) camT = { ...S.players.find(p => p.alive && p.team === me.team) || me, alive: false, team: me.team, id: me.id };
  const view = Object.assign({}, camT, { team: me.team, id: me.id, x: me.alive ? me.x : (camT.x || me.soulX), y: me.alive ? me.y : (camT.y || me.soulY) });
  R.frame(S, view, dt, App.screen === 'game' ? mouse : null);
  updateHud(S, me, dt);
  if ((App.mmT = (App.mmT || 0) - dt) <= 0) { App.mmT = 0.1; R.minimap($('#minimap'), S, me); }
}
// Simulação do host: chamada pelo quadro (rAF) e também por um relógio num
// Web Worker, para o jogo não congelar se o dono da sala minimizar a aba.
let hostLast = 0;
function hostUpdate() {
  if (!App.sim || !App.inGame && App.screen !== 'end') return;
  const now = performance.now();
  if (!hostLast) hostLast = now;
  let el = (now - hostLast) / 1000; hostLast = now;
  if (App.role === 'solo' && App.paused) return;
  App.acc += Math.min(el, 0.25);
  while (App.acc >= TICK) {
    App.acc -= TICK;
    for (const p of App.sim.players) {
      if (p.id === App.myId) continue;
      if (p.bot) botThink(App.sim, p, TICK);
      else { const ri = App.remoteIn.get(p.id); if (ri) p.input = ri; }
    }
    App.sim.step(TICK); App.ticks++;
    const ev = App.sim.drainEvents();
    handleEvents(ev, App.sim);
    if (App.role === 'host') {
      App.pending.push(...ev);
      if (App.ticks % 3 === 0) { App.tr.broadcast(encodeSnap(App.sim, App.pending)); App.pending = []; }
    }
  }
}
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'], { type: 'text/javascript' })));
  wk.onmessage = () => { if (App.role === 'host' || App.role === 'solo') hostUpdate(); };
} catch (e) { /* sem worker: segue só com o rAF */ }

function demoFrame(dt) {
  if (!App.demo || App.demo.phase === 'matchEnd') newDemo();
  const D = App.demo;
  App.demoT -= dt;
  if (!App.demoMe || App.demoT <= 0 || !App.demoMe.alive) {
    const alive = D.players.filter(p => p.alive);
    App.demoMe = alive[(Math.random() * alive.length) | 0] || D.players[0]; App.demoT = 9;
  }
  App.dacc = (App.dacc || 0) + dt;
  while (App.dacc >= TICK) { App.dacc -= TICK; for (const p of D.players) botThink(D, p, TICK); D.step(TICK); for (const e of D.drainEvents()) R.onEvent(e, D, App.demoMe); }
  R.frame(D, App.demoMe, dt, null);
}

show('menu');
newDemo();
requestAnimationFrame(loop);
