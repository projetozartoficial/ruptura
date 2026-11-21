// =====================================================================
//  fps/main.js : tela, controles, HUD, loja, sons e laço do jogo
// =====================================================================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TEAM_NAME = ['Alvorada', 'Crepúsculo'], TEAM_COL = ['#3fa9ff', '#ff5a4a'];
const BOT_NAMES_F = ['Eco', 'Vulto', 'Faísca', 'Garoa', 'Breu', 'Ônix', 'Sina', 'Musgo', 'Rajada', 'Cinza', 'Neblina', 'Trovo'];
const FPSET_DEF = { sens: 0.35, fov: 103, scale: 1, xcol: '#5dff9a', vol: 70, shadows: 1, quality: 'alta', autoRes: 1, showFps: 0 };
let FS = Object.assign({}, FPSET_DEF); try { Object.assign(FS, JSON.parse(localStorage.getItem('ruptura-fps') || '{}')); } catch (e) { }
const saveFS = () => { try { localStorage.setItem('ruptura-fps', JSON.stringify(FS)); } catch (e) { } };

const App = { G: null, me: null, gl: null, M: null, running: false, paused: true, buyOpen: false, hunter: 'brasa', parts: [], hitMark: 0, dmgTxt: [], feed: [], acc: 0, last: 0, bobT: 0, kick: 0 };

// ---------------- sons (sintetizados) ----------------
const AU = {
  ctx: null,
  init() { if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } },
  noise(dur, freq, vol, q = 1, type = 'lowpass') {
    const c = this.ctx; if (!c || vol <= 0.001) return;
    const n = c.createBufferSource(), b = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    n.buffer = b; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol * FS.vol / 100; n.connect(f); f.connect(g); g.connect(c.destination); n.start();
  },
  tone(f0, f1, dur, vol, type = 'sine') {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + dur);
    g.gain.setValueAtTime(vol * FS.vol / 100, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  },
  at(x, z) { const me = App.me; if (!me) return 1; const d = Math.hypot(x - me.x, z - me.z); return Math.max(0, 1 - d / 60); },
};

// ---------------- início ----------------
let gl;
const HQ = FS.quality !== 'desempenho';
try { gl = App.gl = new GL($('#cv'), { hq: HQ, aa: HQ }); } catch (e) { $('#gate').innerHTML = `<h2>Não deu para abrir o modo FPS</h2><p>${esc(e.message)}</p><a class="btn" href="index.html">Tentar de novo</a>`; throw e; }
App.mapSel = 'random'; try { App.mapSel = localStorage.getItem('ruptura-fps-map') || 'random'; } catch (e) { }
loadMap(FPS_MAP_IDS.includes(App.mapSel) ? App.mapSel : 'vesper'); gl.shadows = !!FS.shadows;

function buildMenu() {
  const box = $('#pick'); box.innerHTML = '';
  for (const h of HUNTERS_BY_ROLE) {
    if (h === HUNTERS_BY_ROLE.find(x => HUNTERS[x].classe === HUNTERS[h].classe)) { const C = CLASSES[HUNTERS[h].classe]; box.insertAdjacentHTML('beforeend', `<div class="rolehd"><b style="color:${C.cor}">${C.icone} ${C.nome}</b><small>${C.desc}</small></div>`); }
    const H = HUNTERS[h], C = CLASSES[H.classe], F = FPS_HUNTERS[h];
    const d = document.createElement('div'); d.className = 'hcard' + (App.hunter === h ? ' sel' : '');
    const cv = hunterPortraitFPS(h); d.appendChild(cv);
    d.insertAdjacentHTML('beforeend', `<div class="hn">${H.nome}</div><div class="hc" style="color:${C.cor}">${C.icone} ${C.nome}</div>
      <div class="hab">${['c', 'q', 'e', 'x'].map(k => `<div><b>${k.toUpperCase()}</b> ${F[k].nome}<small>${k === 'x' ? FPS_ULT[h] + ' pontos' : F[k].free ? 'grátis · ' + F[k].free + ' por round' : F[k].preco + ' créditos'} — ${F[k].desc}</small></div>`).join('')}</div>`);
    d.onclick = () => { App.hunter = h; try { localStorage.setItem('ruptura-fps-h', h); } catch (e) { } buildMenu(); };
    box.appendChild(d);
  }
}
const _mapPrev = {};
function mapPreview(id) {
  if (_mapPrev[id]) return _mapPrev[id];
  const R = FPS_MAPS[id].rows, s = 4, c = document.createElement('canvas'); c.width = R[0].length * s; c.height = R.length * s;
  const g = c.getContext('2d'), col = { '#': null, 'o': '#05070d', 'A': '#b07a48', 'B': '#4c7eaa', 'C': '#5aa05a', 'x': '#6a5038', 'h': '#777', 'T': '#8a6d6a', 'D': '#6a7c8e', 'w': '#2c6a80', 'i': '#d8eefa', 'g': '#3a6a2a', 'b': '#a0703a', '=': '#e0a030', 'L': '#ffd060', 'P': '#a070ff', 'Q': '#50e0ff' };
  g.fillStyle = '#1a1d28'; g.fillRect(0, 0, c.width, c.height);
  R.forEach((row, r) => [...row].forEach((ch, k) => { const f = ch in col ? col[ch] : '#a8a294'; if (f) { g.fillStyle = f; g.fillRect(k * s, r * s, s, s); } }));
  return (_mapPrev[id] = c.toDataURL());
}
function mapCards(clickable) {
  const sel = App.mapSel;
  return `<div class="mcard${sel === 'random' ? ' sel' : ''}" ${clickable ? 'data-map="random"' : ''}><div class="mprev rnd">?</div><b>Aleatório</b><small>Sorteia um dos 7 mapas</small></div>` +
    FPS_MAP_IDS.map(id => { const m = FPS_MAPS[id]; return `<div class="mcard${sel === id ? ' sel' : ''}" ${clickable ? `data-map="${id}"` : ''} title="${esc(m.mec)}"><img class="mprev" src="${mapPreview(id)}" alt=""><b>${m.nome}</b><em>${m.tag}</em><small>${m.mec}</small></div>`; }).join('');
}
function buildMaps() {
  $('#mpick').innerHTML = mapCards(true);
  $('#mpick').querySelectorAll('[data-map]').forEach(d => d.onclick = () => { App.mapSel = d.dataset.map; try { localStorage.setItem('ruptura-fps-map', App.mapSel); } catch (e) { } buildMaps(); if (App.mapSel !== 'random') loadMap(App.mapSel); });
}
function hunterPortraitFPS(h) {
  const c = document.createElement('canvas'); c.width = c.height = 90; const g = c.getContext('2d');
  const C = HUNTERS[h].cores; g.fillStyle = '#10131f'; g.fillRect(0, 0, 90, 90);
  g.fillStyle = C.roupa; g.fillRect(28, 46, 34, 40); g.fillStyle = C.pele; g.fillRect(33, 16, 24, 26); g.fillStyle = C.cabelo; g.fillRect(31, 12, 28, 10);
  g.fillStyle = C.detalhe; g.fillRect(28, 60, 34, 4); g.fillStyle = '#111'; g.fillRect(48, 26, 4, 4);
  return c;
}
try { App.hunter = localStorage.getItem('ruptura-fps-h') || 'brasa'; if (!FPS_HUNTERS[App.hunter]) App.hunter = 'brasa'; } catch (e) { }

const myName = () => (Account.profile && Account.profile.name) || 'Você';
// dados da conta que vão junto com o jogador para a sala (nível e ranque para a Ranqueada)
function myInfo() {
  const P = Account.profile, u = Account.user;
  return P ? { uid: u ? u.uid : null, tag: P.tag || '', lvl: P.level, rank: P.rank, mmr: P.mmr, pl: P.placements } : { lvl: 1, rank: -1, mmr: 1000, pl: 0 };
}
// caçadores agrupados pela função (Desafiante, Dominador, Batedor, Guardião)
const ROLE_ORDER = Object.keys(CLASSES);
const HUNTERS_BY_ROLE = FPS_HUNTER_IDS.slice().sort((a, b) => ROLE_ORDER.indexOf(HUNTERS[a].classe) - ROLE_ORDER.indexOf(HUNTERS[b].classe));
const KIND_NAME = { solo: 'Contra bots', custom: 'Sala personalizada', ranked: 'Ranqueada' };
App.kind = 'solo';
App.role = 'solo'; App.net = new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'online';
function botSlots(slots) {
  const names = BOT_NAMES_F.slice().sort(() => Math.random() - 0.5);
  const used = [0, 1].map(t => slots.filter((x, j) => x.kind !== 'empty' && (j < RULES.teamSize ? 0 : 1) === t).map(x => x.hunter));
  return slots.map((s, i) => {
    if (s.kind !== 'empty') return s;
    const U = used[i < RULES.teamSize ? 0 : 1], free = FPS_HUNTER_IDS.filter(h => !U.includes(h));
    // bots montam um time equilibrado: primeiro as funções que ainda faltam
    const roles = U.map(x => HUNTERS[x].classe), need = free.filter(h => !roles.includes(HUNTERS[h].classe));
    const pool = need.length ? need : free;
    const h = pool[(Math.random() * pool.length) | 0] || FPS_HUNTER_IDS[(Math.random() * 5) | 0];
    U.push(h); return { kind: 'bot', name: names.pop() + ' [bot]', hunter: h };
  });
}
const pickMap = sel => FPS_MAP_IDS.includes(sel) ? sel : FPS_MAP_IDS[(Math.random() * FPS_MAP_IDS.length) | 0];
function startMatch(slotsIn, mapId) {
  AU.init();
  let slots = slotsIn;
  loadMap(mapId || pickMap(App.mapSel));
  if (!slots) { App.role = 'solo'; App.kind = 'solo'; App.vsBots = true; const S = Array.from({ length: RULES.teamSize * 2 }, () => ({ kind: 'empty' })); S[0] = Object.assign({ kind: 'human', pid: 'me', name: myName(), hunter: App.hunter }, myInfo()); slots = botSlots(S); App.myPid = 'me'; }
  App.slots = slots;
  App.G = new Game(App.M, slots.map((s, i) => ({ id: i + 1, pid: s.pid, name: s.name, bot: s.kind === 'bot', hunter: s.hunter })));
  App.me = App.G.players.find(p => p.pid === App.myPid) || App.G.players[0];
  App.yaw = App.me.yaw; App.pitch = 0;
  App.feed = []; App.parts = []; App.evBuf = []; App.seq = 0; App.pend = []; App.outQ = []; App.evOut = []; App.snaps = []; App.estTick = 0; App.ended = false;
  const ev = App.G.drain(); if (App.role !== 'client') handleEvents(ev);
  $('#menu').style.display = 'none'; $('#room').classList.remove('show'); $('#end').classList.remove('show'); $('#hud').style.display = '';
  App.running = true; App.lastSim = performance.now(); App.recorded = null; lockPointer();
  if (typeof Social !== "undefined") Social.presence('game');
}
function quitMatch() {
  if ((FS.quality !== 'desempenho') !== HQ) setTimeout(() => location.reload(), 50);
  // sair de uma ranqueada no meio conta como derrota
  if (App.kind === 'ranked' && App.G && !App.ended && !App.recorded) recordMatch(false, true);
  App.running = false; App.G = null; App.me = null;
  $('#pause').classList.remove('show'); $('#hud').style.display = 'none'; $('#end').classList.remove('show'); document.exitPointerLock?.();
  if (App.role === 'host' || App.role === 'client') leaveRoom(); else $('#menu').style.display = '';
}
// manda um comando pontual (trocar arma, recarregar, comprar, habilidade...)
function sendEv(o) { if (App.role === 'client') { App.evOut.push(o); if (o.buy) App.me.in.buyLocal = o.buy; } else Object.assign(App.me.in, o); }
$('#btn-resume').onclick = () => { $('#pause').classList.remove('show'); lockPointer(); };
$('#btn-quit').onclick = () => quitMatch();

// ---------------- salas online ----------------
const emptySlots = () => Array.from({ length: RULES.teamSize * 2 }, () => ({ kind: 'empty' }));
function roomMsg(t) { $('#rmsg').textContent = t || ''; }
async function hostRoom(kind = 'custom') {
  AU.init(); App.kind = kind; App.expect = 0; App.search = null; App.vsBots = false;
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 31) | 0]).join('');
  App.code = code; App.role = 'host'; App.myPid = 'host';
  App.slots = emptySlots(); App.slots[0] = Object.assign({ kind: 'human', pid: 'host', name: myName(), hunter: App.hunter }, myInfo());
  try { App.tr = await Transport.host(App.net, 'T' + code, { onJoin() { }, onLeave: hostLeave, onMsg: hostMsg }); }
  catch (e) { App.role = 'solo'; $('#acctmsg').textContent = e.message; return; }
  openRoom();
}
async function joinRoom(code, opt = {}) {
  code = (code || '').trim().toUpperCase(); if (code.length < 4) { $('#acctmsg').textContent = 'Digite o código da sala.'; return; }
  AU.init(); $('#acctmsg').textContent = 'Conectando...';
  const gen = App.gen = (App.gen || 0) + 1; // conexões antigas (ex.: ao trocar de sala na Ranqueada) são ignoradas
  try { App.tr = await Transport.join(App.net, 'T' + code, { onMsg: m => gen === App.gen && clientMsg(m), onClose: () => gen === App.gen && clientClose() }); }
  catch (e) { $('#acctmsg').textContent = e.message; return; }
  App.role = 'client'; App.code = code; App.myPid = null; App.slots = emptySlots(); App.kind = opt.kind || 'custom'; App.moving = false; App.ended = false;
  App.tr.send(Object.assign({ t: 'hello', name: myName(), hunter: App.hunter, team: opt.team ?? -1 }, myInfo()));
  $('#acctmsg').textContent = ''; openRoom();
}
function leaveRoom() {
  if (App.search) stopSearch(true);
  App.gen = (App.gen || 0) + 1;
  try { App.tr && App.tr.close(); } catch (e) { }
  App.tr = null; App.role = 'solo'; App.G = null; App.running = false;
  $('#room').classList.remove('show'); $('#hud').style.display = 'none'; $('#end').classList.remove('show'); $('#menu').style.display = '';
  App.kind = 'solo'; App.expect = 0; if (typeof Social !== "undefined") Social.presence('menu');
}
function freeSlot(team) {
  const hum = t => App.slots.slice(t * RULES.teamSize, (t + 1) * RULES.teamSize).filter(x => x.kind === 'human').length;
  const order = team === 0 || team === 1 ? [team] : hum(0) <= hum(1) ? [0, 1] : [1, 0];
  for (const t of order) for (let i = t * RULES.teamSize; i < (t + 1) * RULES.teamSize; i++) if (App.slots[i].kind === 'empty') return i;
  return -1;
}
function hostMsg(pid, m) {
  if (m.t === 'hello') {
    if (App.G) { App.tr.send(pid, { t: 'full', why: 'A partida já começou. Espere acabar.' }); return; }
    const info = { uid: m.uid || null, tag: String(m.tag || '').slice(0, 5), lvl: +m.lvl || 1, rank: m.rank ?? -1, mmr: +m.mmr || 1000, pl: +m.pl || 0 };
    let team = -1;
    if (App.kind === 'ranked') {
      const no = why => App.tr.send(pid, { t: 'full', why });
      if (App.net !== 'local' && info.lvl < (window.RANKED_MIN_LEVEL || 15)) return no(`A Ranqueada libera no nível ${window.RANKED_MIN_LEVEL || 15} de conta.`);
      if (m.team === 1 && App.expect) team = 1; // grupo adversário chegando da fila
      else {
        if (App.search || App.expect) return no('Esse grupo já está na fila. Peça para cancelarem a busca.');
        team = 0;
        const party = App.slots.slice(0, RULES.teamSize).filter(x => x.kind === 'human');
        if (!partyAllowed(party.concat([info]))) return no('Diferença de elo grande demais: o grupo pode ter no máximo 1 elo de diferença.');
      }
    }
    const i = freeSlot(team); if (i < 0) { App.tr.send(pid, { t: 'full', why: App.kind === 'ranked' ? 'O grupo está cheio (máx. 5).' : 'A sala está cheia.' }); return; }
    App.slots[i] = Object.assign({ kind: 'human', pid, name: String(m.name || 'Jogador').slice(0, 16), hunter: FPS_HUNTERS[m.hunter] ? m.hunter : 'brasa' }, info);
    App.tr.send(pid, { t: 'welcome', pid, kind: App.kind }); syncRoom();
    if (App.kind === 'ranked' && App.expect && App.slots.filter(x => x.kind === 'human').length >= App.expect) setTimeout(hostStart, 1500);
    return;
  }
  if (m.t === 'hunter') { const sl = App.slots.find(x => x.pid === pid); if (sl && FPS_HUNTERS[m.h] && !App.G) { sl.hunter = m.h; syncRoom(); } return; }
  if (m.t === 'move') { if (App.kind !== 'ranked') moveSlot(pid, m.i); return; }
  if (m.t === 'in' && App.G) {
    const p = App.G.players.find(q => q.pid === pid); if (!p || p.bot) return;
    p.netQ = p.netQ || []; for (const a of m.L) p.netQ.push(a);
    if (p.netQ.length > 60) p.netQ.splice(0, p.netQ.length - 30);
    p.viewTick = m.vt;
    for (const ev of m.ev || []) Object.assign(p.in, ev);
  }
}
function hostLeave(pid) {
  const i = App.slots.findIndex(x => x.pid === pid);
  if (i >= 0) { const nm = App.slots[i].name; App.slots[i] = { kind: 'empty' }; if (!App.G) syncRoom(); else App.feed.unshift({ t: 5, txt: `${esc(nm)} saiu (um bot assumiu)` }); }
  if (App.G) { const p = App.G.players.find(q => q.pid === pid); if (p) { p.bot = true; p.pid = null; p.brain = null; p.name = p.name + ' [bot]'; } }
}
function moveSlot(pid, i) {
  if (App.G || !App.slots[i] || App.slots[i].kind !== 'empty') return;
  const j = App.slots.findIndex(x => x.pid === pid); if (j < 0) return;
  App.slots[i] = App.slots[j]; App.slots[j] = { kind: 'empty' }; syncRoom();
}
function syncRoom() { if (App.role === 'host' && App.tr) App.tr.broadcast({ t: 'room', slots: App.slots, map: App.mapSel, kind: App.kind, expect: App.expect, search: App.search ? App.search.t0 : 0 }); renderRoom(); }
function clientMsg(m) {
  switch (m.t) {
    case 'welcome': App.myPid = m.pid; App.kind = m.kind || App.kind; if (typeof Social !== "undefined") Social.presence('room'); renderRoom(); break;
    case 'room': App.slots = m.slots; App.mapSel = m.map || 'random'; App.kind = m.kind || App.kind; App.expect = m.expect || 0; App.searchT0 = m.search || 0; renderRoom(); break;
    case 'goto': // o líder do grupo achou partida na sala de outro grupo
      App.moving = true; App.gen++;
      try { App.tr.close(); } catch (e) { }
      App.tr = null; App.role = 'solo';
      setTimeout(() => joinRoom(m.code, { team: 1, kind: 'ranked' }), 900);
      break;
    case 'full': leaveRoom(); $('#acctmsg').textContent = m.why; break;
    case 'start': App.vsBots = !!m.vsBots; startMatch(m.slots, m.map); break;
    case 's': if (App.G) App.snaps.push(m); break;
    case 'back': App.running = false; App.G = null; $('#hud').style.display = 'none'; $('#end').classList.remove('show'); document.exitPointerLock?.(); openRoom(); break;
  }
}
function clientClose() {
  if (App.moving) return;
  if (App.ended) { App.tr = null; App.role = 'solo'; return; } // partida já acabou: fica na tela final
  const inGame = !!App.G; leaveRoom(); $('#acctmsg').textContent = inGame ? 'O dono da sala saiu. A partida acabou.' : 'Conexão com a sala perdida.'; }
function hostStart() {
  if (App.role !== 'host' || App.G) return;
  if (App.kind === 'ranked') { if (App.search) stopSearch(true); else Queue.cancel(App.code); App.expect = 0; }
  const S = botSlots(App.slots), map = App.kind === 'ranked' ? pickMap('random') : pickMap(App.mapSel);
  App.tr.broadcast({ t: 'start', slots: S, map, vsBots: !!App.vsBots });
  startMatch(S, map);
}
function backToRoom() { // depois da partida, o dono leva todos de volta para a sala
  App.running = false; App.G = null; $('#hud').style.display = 'none'; $('#end').classList.remove('show');
  App.slots = App.slots.map(s => s.kind === 'bot' ? { kind: 'empty' } : s);
  App.tr.broadcast({ t: 'back' }); openRoom(); syncRoom();
}
function openRoom() { $('#menu').style.display = 'none'; $('#room').classList.add('show'); if (typeof Social !== "undefined") Social.presence('room'); renderRoom(); }
function renderRoom() {
  if (!$('#room').classList.contains('show')) return;
  if (!App.slots) App.slots = emptySlots();
  const hide = App.hideCode;
  $('#rcode').textContent = hide ? '•••••' : App.code;
  const ranked = App.kind === 'ranked', duel = !ranked || App.expect > 0;
  $('#rkind').textContent = ranked ? 'RANQUEADA · GRUPO' : 'SALA PERSONALIZADA';
  $('#room').classList.toggle('ranked', ranked);
  $('#btn-rstart').style.display = App.role === 'host' && !ranked ? '' : 'none';
  $('#rmapbox').style.display = ranked ? 'none' : '';
  $('.rvs').style.display = $('#rt1').style.display = duel ? '' : 'none';
  roomMsg(ranked ? (App.expect ? 'Partida encontrada! Esperando o outro grupo entrar...' : App.role === 'host' ? 'Chame até 4 amigos pelo código ou pela lista de amigos e busque uma partida.' : 'Esperando o líder do grupo buscar partida...')
    : App.role === 'host' ? 'Passe o código para seus amigos. Vagas vazias viram bots.' : App.myPid ? 'Esperando o dono da sala começar...' : 'Entrando...');
  for (const t of [0, 1]) {
    const el = $('#rt' + t);
    el.innerHTML = `<h4 style="color:${TEAM_COL[t]}">${ranked && !App.expect ? 'Seu grupo' : TEAM_NAME[t]}</h4>` + App.slots.slice(t * RULES.teamSize, (t + 1) * RULES.teamSize).map((x, k) => {
      const i = t * RULES.teamSize + k;
      if (x.kind === 'empty') return ranked ? `<div class="rs empty off">${t === 0 && !App.expect ? '+ vaga do grupo (amigo entra pelo código)' : 'vaga (bot)'}</div>` : `<div class="rs empty" data-i="${i}">+ vaga (bot) — clique para entrar</div>`;
      const nm = typeof Social !== "undefined" ? Social.shownName(x) : x.name;
      return `<div class="rs${x.pid === App.myPid ? ' me' : ''}">${x.rank != null ? `<canvas class="rsrk" data-rk="${x.rank}" title="${esc(rankName(x.rank))}"></canvas>` : ''}<div><b>${esc(nm)}${x.pid === App.myPid ? ' (você)' : x.pid === 'host' ? ' ★' : ''}</b><span>${HUNTERS[x.hunter].nome} · ${CLASSES[HUNTERS[x.hunter].classe].nome}${x.lvl ? ' · nível ' + x.lvl : ''}</span></div></div>`;
    }).join('');
    el.querySelectorAll('.rs.empty:not(.off)').forEach(d => d.onclick = () => { if (App.role === 'host') moveSlot('host', +d.dataset.i); else App.tr.send({ t: 'move', i: +d.dataset.i }); });
    el.querySelectorAll('canvas.rsrk').forEach(c => { c.width = c.height = 40; drawRankEmblem(c.getContext('2d'), +c.dataset.rk, 40); });
  }
  renderQueue();
  $('#rmap').innerHTML = mapCards(App.role === 'host');
  if (App.role === 'host') $('#rmap').querySelectorAll('[data-map]').forEach(d => d.onclick = () => { App.mapSel = d.dataset.map; try { localStorage.setItem('ruptura-fps-map', App.mapSel); } catch (e) { } syncRoom(); });
  $('#rpick').innerHTML = HUNTERS_BY_ROLE.map(h => `<button class="rh${App.hunter === h ? ' on' : ''}" data-h="${h}" style="--c:${CLASSES[HUNTERS[h].classe].cor}">${HUNTERS[h].nome}<small>${CLASSES[HUNTERS[h].classe].nome}</small></button>`).join('');
  $('#rpick').querySelectorAll('.rh').forEach(b => b.onclick = () => {
    App.hunter = b.dataset.h; try { localStorage.setItem('ruptura-fps-h', App.hunter); } catch (e) { }
    if (App.role === 'host') { const sl = App.slots.find(x => x.pid === 'host'); if (sl) sl.hunter = App.hunter; syncRoom(); }
    else { App.tr.send({ t: 'hunter', h: App.hunter }); renderRoom(); }
  });
}
// ---------------- Ranqueada: fila de grupos (Firestore) ----------------
// O líder do grupo entra na fila. Quando dois grupos se acham, o grupo que "reivindicou" vai
// para a sala do outro (lado Crepúsculo). Vagas que sobram nos 5v5 viram bots.
const VSBOTS_AFTER = 60; // segundos na fila até liberar "jogar contra bots"
function partyOf() { return App.slots.slice(0, RULES.teamSize).filter(x => x.kind === 'human'); }
async function startSearch() {
  if (App.role !== 'host' || App.kind !== 'ranked' || App.search || App.expect) return;
  const party = partyOf();
  if (!partyAllowed(party)) return roomMsg('Diferença de elo grande demais no grupo (máx. 1 elo).');
  if (!App.testQueue && (App.net === 'local' || !Account.db)) { App.search = { t0: Date.now(), local: true }; syncRoom(); return; }
  try { await Queue.enter(App.code, party); } catch (e) { return roomMsg('Erro ao entrar na fila: ' + e.message); }
  const S = App.search = { t0: Date.now(), busy: false };
  S.unsub = Queue.watch(App.code, d => {
    // só o grupo "reivindicado" recebe guestSize; quem reivindicou segue pelo tryMatch
    if (App.search !== S || !d || d.state !== 'matched' || S.claimer || !d.guestSize) return;
    // outro grupo nos encontrou: esta sala vira a sala da partida
    stopSearch(false); App.expect = partyOf().length + (d.guestSize || 1); syncRoom();
    setTimeout(() => { if (!App.G && App.expect && App.role === 'host') hostStart(); }, 25000);
  });
  S.iv = setInterval(async () => {
    if (App.search !== S || S.busy) return;
    S.busy = true;
    try { const code = await Queue.tryMatch(App.code, (Date.now() - S.t0) / 1000); if (code && App.search === S) { S.claimer = true; goToMatch(code); } }
    catch (e) { console.warn(e); }
    S.busy = false;
  }, 2500);
  S.hb = setInterval(() => Queue.heartbeat(App.code), 15000);
  syncRoom();
}
function stopSearch(del) {
  const S = App.search; if (!S) return;
  clearInterval(S.iv); clearInterval(S.hb); if (S.unsub) try { S.unsub(); } catch (e) { }
  if (del && !S.local) Queue.cancel(App.code);
  App.search = null;
}
function cancelSearch() { stopSearch(true); syncRoom(); }
function rankedVsBots() { stopSearch(true); App.vsBots = true; hostStart(); }
async function goToMatch(code) {
  stopSearch(true);
  App.tr.broadcast({ t: 'goto', code });
  await new Promise(r => setTimeout(r, 600));
  App.moving = true;
  try { App.tr.close(); } catch (e) { }
  App.tr = null; App.role = 'solo';
  joinRoom(code, { team: 1, kind: 'ranked' });
}
function renderQueue() {
  const el = $('#rq'); if (!el) return;
  if (App.kind !== 'ranked') { el.innerHTML = ''; el.dataset.sig = ''; return; }
  const t0 = App.role === 'host' ? (App.search && App.search.t0) : App.searchT0;
  const P = Account.profile;
  const me = P ? `<div class="rqme"><canvas id="rq-emb" width="56" height="56"></canvas><div><b>${esc(rankName(P.rank))}</b><small>${P.placements < 5 ? `Colocação ${P.placements}/5` : `${P.rr} / 100 RR`}</small></div></div>` : '';
  const sec0 = t0 ? Math.floor((Date.now() - t0) / 1000) : 0;
  const sig = [App.role, App.expect, !!t0, sec0 >= VSBOTS_AFTER || !!(App.search && App.search.local), P && P.rank, P && P.rr].join('|');
  if (el.dataset.sig === sig && t0 && !App.expect) { const sb = el.querySelector('.srch'); if (sb) sb.textContent = `Procurando partida… ${Math.floor(sec0 / 60)}:${String(sec0 % 60).padStart(2, '0')}`; return; }
  el.dataset.sig = sig;
  let mid = '';
  if (App.expect) mid = '<b class="found">PARTIDA ENCONTRADA</b>';
  else if (t0) {
    const sec = Math.floor((Date.now() - t0) / 1000);
    mid = `<b class="srch">Procurando partida… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</b>` + (App.role === 'host' ? `<button class="btn" id="rq-cancel">Cancelar</button>${sec >= VSBOTS_AFTER || (App.search && App.search.local) ? '<button class="btn ghost" id="rq-bots" title="Ninguém encontrado? Joga contra bots valendo metade do RR">Jogar contra bots (½ RR)</button>' : ''}` : '');
  } else mid = App.role === 'host' ? '<button class="btn rk big" id="rq-go">Buscar partida</button>' : '<span class="wait">O líder do grupo inicia a busca.</span>';
  el.innerHTML = me + `<div class="rqmid">${mid}</div><div class="rqinfo">Primeiro a 7 · troca de lado no round 6 · prorrogação até abrir 2<br>Grupo de até 5 · no máximo 1 elo de diferença</div>`;
  const c = $('#rq-emb'); if (c && P) drawRankEmblem(c.getContext('2d'), P.rank, 56);
  if ($('#rq-go')) $('#rq-go').onclick = () => startSearch();
  if ($('#rq-cancel')) $('#rq-cancel').onclick = () => cancelSearch();
  if ($('#rq-bots')) $('#rq-bots').onclick = () => rankedVsBots();
}
setInterval(() => { if ($('#room').classList.contains('show') && App.kind === 'ranked' && !App.expect && (App.search || App.searchT0)) renderQueue(); }, 1000);
// mantém a conexão viva enquanto espera na sala
setInterval(() => { if (App.role === 'client' && App.tr && !App.running) try { App.tr.send({ t: 'ka' }); } catch (e) { } }, 2000);
$('#btn-rstart').onclick = () => hostStart();
$('#btn-rleave').onclick = () => leaveRoom();
$('#btn-rcopy').onclick = () => { try { navigator.clipboard.writeText(App.code); $('#btn-rcopy').textContent = 'Copiado!'; setTimeout(() => $('#btn-rcopy').textContent = 'Copiar', 1200); } catch (e) { } };
$('#btn-rhide').onclick = () => { App.hideCode = !App.hideCode; renderRoom(); };

// ---------------- rede durante a partida ----------------
const INTERP = 6; // ticks de atraso para suavizar os outros (100ms)
function hostFeed() {
  for (const p of App.G.players) {
    if (!p.pid || p.pid === App.myPid || p.bot || !p.netQ || !p.netQ.length) continue;
    // se acumulou comandos (atraso), anda os extras para não perder movimento
    while (p.netQ.length > 3) { const x = p.netQ.shift(); unpackIn(p.in, x.slice(1)); p.yaw = p.in.yaw; if (p.alive) App.G.moveStep(p, p.in, TICK, true); p.ackSeq = x[0]; }
    const a = p.netQ.shift(); unpackIn(p.in, a.slice(1)); p.ackSeq = a[0];
  }
}
function hostSend(ev) {
  App.evBuf.push(...ev);
  if ((App.G.tick || 0) % 2) return;
  const acks = {}; for (const p of App.G.players) if (p.pid && p.ackSeq) acks[p.pid] = p.ackSeq;
  App.tr.broadcast(packSnap(App.G, App.evBuf, acks)); App.evBuf = [];
}
function clientTick() {
  const G = App.G, me = App.me, I = me.in;
  App.seq++;
  App.outQ.push([App.seq, ...packIn(I)]);
  App.pend.push({ seq: App.seq, I: { mx: I.mx, mz: I.mz, yaw: I.yaw, pitch: I.pitch, jump: I.jump, crouch: I.crouch, walk: I.walk } });
  if (App.pend.length > 120) App.pend.shift();
  if (me.alive) { me.yaw = I.yaw; me.pitch = I.pitch; me.slowT = Math.max(0, me.slowT - TICK); me.stunT = Math.max(0, me.stunT - TICK); G.moveStep(me, I, TICK, true); }
  localFire(me, I);
  App.estTick += 1; App.ct = (App.ct || 0) + TICK;
  for (const t of G.tracers) t.t -= TICK; G.tracers = G.tracers.filter(t => t.t > 0);
  if (App.seq % 2 === 0) { App.tr.send({ t: 'in', L: App.outQ, vt: Math.round(App.estTick - INTERP), ev: App.evOut }); App.outQ = []; App.evOut = []; }
}
function clientSnaps() {
  const G = App.G, me = App.me;
  while (App.snaps.length) {
    const S = App.snaps.shift();
    applySnap(G, S, me.id);
    if (!App.estTick || Math.abs(S.tk - App.estTick) > 12) App.estTick = S.tk; else App.estTick += (S.tk - App.estTick) * 0.08;
    // reconcilia o próprio boneco: volta para a posição do servidor e refaz os comandos ainda não confirmados
    const ack = (S.A && S.A[App.myPid]) || 0;
    App.pend = App.pend.filter(q => q.seq > ack);
    const sv = me.server;
    if (sv && S.rd !== App.lastRd) { App.lastRd = S.rd; me.yaw = sv.yaw; me.pitch = 0; App.pend = []; }
    if (sv && me.alive) {
      const px = me.x, pz = me.z;
      Object.assign(me, { x: sv.x, y: sv.y, z: sv.z, vx: sv.vx, vy: sv.vy, vz: sv.vz, crouch: sv.crouch, onGround: me.onGroundNet });
      for (const q of App.pend) { me.yaw = q.I.yaw; G.moveStep(me, q.I, TICK, true); }
      if (Math.hypot(px - me.x, pz - me.z) > 3) { App.yaw = me.yaw; }
    }
    if (sv && !me.alive) { me.x = sv.x; me.z = sv.z; }
    handleEvents(S.E);
  }
  interpOthers(G, me.id, App.estTick - INTERP);
}
function localFire(me, I) {
  const G = App.G;
  me.lfCd = Math.max(0, (me.lfCd || 0) - TICK);
  me.recoil = Math.max(0, (me.recoil || 0) - TICK * 14 * ((App.ct || 0) - (me.lfLast || 0) > 0.12 ? 1 : 0));
  if (!I.fire || !me.alive || App.buyOpen) { me.lfHeld = false; return; }
  const W = G.curW(me); if (!W) return;
  if (!(G.phase === 'live' || G.phase === 'planted') || me.stunT > 0 || me.switchT > 0 || me.reloadT > 0 || me.lfCd > 0) return;
  if (W.melee) { me.lfCd = 1 / W.rps; return; }
  const g = me.guns[me.cur]; if (!g || g.ammo <= 0) return;
  if (!W.auto && me.lfHeld) return;
  me.lfHeld = true; me.lfCd = 1 / W.rps; me.lfLast = App.ct || 0;
  const ey = G.eye(me), d = fwdVec(me.yaw, me.pitch + me.recoil * Math.PI / 180), h = G.trace(me.x, ey, me.z, d[0], d[1], d[2], 200, me, 'walls');
  G.tracers.push({ x0: me.x, y0: ey - 0.12, z0: me.z, x1: me.x + d[0] * h.t, y1: ey + d[1] * h.t, z1: me.z + d[2] * h.t, t: 0.06, owner: me.id });
  me.recoil = Math.min(me.recoil + W.rec * 0.8, 9);
  handleEvents([{ k: 'shot', id: me.id, w: g.id, x: me.x, z: me.z, local: true }]);
}
// o dono continua rodando a partida mesmo com a aba escondida
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'], { type: 'text/javascript' })));
  wk.onmessage = () => { const now = performance.now(); if (App.running && now - (App.lastSim || 0) > 40) { readInput(); simPump(now); } };
} catch (e) { }
function simPump(now) {
  const G = App.G; if (!G || !App.running) return;
  App.acc += Math.min(0.25, (now - (App.lastSim || now)) / 1000); App.lastSim = now;
  while (App.acc >= TICK) {
    App.acc -= TICK;
    if (App.role === 'client') clientTick();
    else {
      if (App.role === 'host') hostFeed();
      G.step(TICK); const ev = G.drain(); handleEvents(ev);
      if (App.role === 'host' && App.tr) hostSend(ev);
    }
  }
  if (App.role === 'client') clientSnaps();
}

// ---------------- controles ----------------
const keys = new Set(); let mouseL = false, mouseR = false;
function lockPointer() { const c = $('#cv'); try { const r = c.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => c.requestPointerLock()); } catch (e) { c.requestPointerLock?.(); } }
document.addEventListener('pointerlockchange', () => {
  App.locked = document.pointerLockElement === $('#cv');
  if (!App.locked && App.running && !App.buyOpen && !App.ended) $('#pause').classList.add('show');
});
$('#cv').addEventListener('click', () => { if (App.running && !App.locked && !App.buyOpen && !App.ended) { $('#pause').classList.remove('show'); lockPointer(); } });
addEventListener('mousemove', e => {
  if (!App.locked || !App.me) return;
  const W = App.G.curW(App.me), z = W && W.zoom && App.me.zoom ? W.zoom : 1;
  const k = FS.sens * 0.0022 / z;
  App.yaw += e.movementX * k; App.pitch = clamp(App.pitch - e.movementY * k, -1.5, 1.5);
});
addEventListener('mousedown', e => { if (!App.locked) return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (!App.running) return;
  if (e.code === 'KeyB' && App.G && App.G.phase === 'buy') { toggleBuy(); e.preventDefault(); return; }
  if (App.buyOpen && (e.code === 'Escape' || e.code === 'KeyB')) { toggleBuy(false); return; }
  if (e.code === 'Tab') { e.preventDefault(); $('#board').classList.add('show'); renderBoard(); }
  keys.add(e.code);
  const me = App.me; if (!me) return;
  if (e.code === 'Digit1') sendEv({ slot: 1 }); if (e.code === 'Digit2') sendEv({ slot: 2 }); if (e.code === 'Digit3') sendEv({ slot: 3 });
  if (e.code === 'KeyR') sendEv({ reload: true });
  if (e.code === 'KeyG') sendEv({ drop: true });
  if (!e.repeat) for (const [code, k] of [['KeyC', 'c'], ['KeyQ', 'q'], ['KeyE', 'e'], ['KeyX', 'x']]) if (e.code === code) sendEv({ ab: k });
  if (['Space', 'ControlLeft', 'KeyC', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Tab') $('#board').classList.remove('show'); });
addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
function readInput() {
  const me = App.me; if (!me) return;
  const I = me.in;
  I.mz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  I.mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  I.jump = keys.has('Space'); I.crouch = keys.has('ControlLeft') || keys.has('ControlRight');
  I.walk = keys.has('ShiftLeft') || keys.has('ShiftRight');
  I.use = keys.has('KeyF') || keys.has('Digit4');
  I.fire = mouseL && App.locked && !App.buyOpen; I.alt = mouseR && App.locked;
  if (me.alive) { I.yaw = App.yaw; I.pitch = App.pitch; } else { App.yaw = me.yaw; }
}

// ---------------- loja ----------------
function toggleBuy(force) {
  App.buyOpen = force ?? !App.buyOpen;
  $('#buy').classList.toggle('show', App.buyOpen);
  if (App.buyOpen) { document.exitPointerLock?.(); renderBuy(); } else if (App.running) lockPointer();
}
const _icons = {};
function iconURL(id) { return _icons[id] || (_icons[id] = weaponIcon(id).toDataURL()); }
function renderBuy() {
  const me = App.me, G = App.G; if (!me) return;
  const F = FPS_HUNTERS[me.hunter];
  let h = `<div class="buy-top"><b>Arsenal</b><span class="cr">◈ ${me.creds}</span><span class="bt">${Math.max(0, Math.ceil(G.phaseT))}s de compra · B fecha</span></div><div class="buy-grid">`;
  for (const cat of SHOP) {
    h += `<div class="bcol"><h4>${cat.cat}</h4>`;
    for (const id of cat.itens) {
      const W = WEAPONS[id], own = me.guns[W.slot] && me.guns[W.slot].id === id;
      h += `<button class="bitem wpn${own ? ' own' : ''}" ${me.creds < W.preco && !own ? 'disabled' : ''} data-buy="${id}" title="${esc(W.desc || '')}"><img src="${iconURL(id)}" alt=""><span>${W.nome}</span><em>${W.preco ? '◈ ' + W.preco : 'grátis'}</em></button>`;
    }
    h += '</div>';
  }
  h += `<div class="bcol"><h4>Escudos</h4>${Object.entries(SHIELDS).map(([id, S]) => `<button class="bitem${me.armor >= S.val ? ' own' : ''}" ${me.creds < S.preco || me.armor >= S.val ? 'disabled' : ''} data-buy="${id}"><span>${S.nome} <small>+${S.val}</small></span><em>◈ ${S.preco}</em></button>`).join('')}
    <h4>Habilidades</h4>${['c', 'q'].map(k => `<button class="bitem" ${me.creds < F[k].preco || me.ab[k] >= F[k].max ? 'disabled' : ''} data-buy="${k}" title="${esc(F[k].desc)}"><span>${k.toUpperCase()} · ${F[k].nome} <small>${me.ab[k]}/${F[k].max}</small></span><em>◈ ${F[k].preco}</em></button>`).join('')}
    <div class="bnote">E · ${F.e.nome}: grátis (${F.e.free} por round)<br>X · ${F.x.nome}: ${FPS_ULT[me.hunter]} pontos</div></div>`;
  h += '</div>';
  $('#buy').innerHTML = h;
  $('#buy').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { sendEv({ buy: b.dataset.buy }); AU.tone(800, 1200, 0.08, 0.15, 'triangle'); setTimeout(renderBuy, App.role === 'client' ? 150 : 40); });
}

// ---------------- eventos -> efeitos/HUD ----------------
function handleEvents(evs) {
  const G = App.G, me = App.me;
  for (const e of evs) {
    const p = e.id ? G.byId(e.id) : null;
    switch (e.k) {
      case 'shot': {
        if (App.role === 'client' && e.id === me.id && !e.local) break;
        if (App.role === 'client' && e.tr && e.id !== me.id) for (const t of e.tr) G.tracers.push({ x0: t[0], y0: t[1], z0: t[2], x1: t[3], y1: t[4], z1: t[5], t: 0.06 });
        const W = WEAPONS[e.w], v = e.id === me.id ? 1 : AU.at(e.x, e.z);
        AU.noise(W.cat === 'Snipers' ? 0.35 : 0.13, W.cat === 'Pistolas' ? 2600 : 1800, (W.cat === 'Snipers' ? 0.55 : 0.32) * v, 0.7);
        AU.tone(W.cat === 'Snipers' ? 120 : 200, 50, 0.1, 0.25 * v, 'square');
        if (e.id === me.id) { App.kick = 1; App.flash = 0.05; }
        break;
      }
      case 'hit':
        if (e.by === me.id && !e.tick) { App.hitMark = 0.2; App.hitHead = e.zone === 'head'; App.dmgTxt.push({ x: e.x, y: e.y, z: e.z, t: 0.8, v: e.dmg, hs: e.zone === 'head' }); AU.tone(e.zone === 'head' ? 1500 : 900, 600, 0.06, 0.18, 'triangle'); }
        if (e.id === me.id && !e.tick) { App.hurtT = 0.4; AU.noise(0.08, 500, 0.25); const s = G.byId(e.by); if (s) App.hurtDir = Math.atan2(s.x - me.x, -(s.z - me.z)); }
        burst(e.x, e.y, e.z, 6, [0.8, 0.1, 0.1], 2.5);
        break;
      case 'kill': {
        const v = G.byId(e.id), k = G.byId(e.by);
        App.feed.unshift({ t: 5, k, v, w: e.w, hs: e.hs });
        if (e.by === me.id) { AU.tone(600, 1400, 0.25, 0.3, 'sawtooth'); App.killBanner = { t: 1.2, n: me.roundKills }; }
        if (e.id === me.id) { App.deathCam = e.by; }
        break;
      }
      case 'round': {
        const att = e.att, side = me.team === att ? 'ATAQUE' : 'DEFESA';
        banner(e.half ? 'TROCA DE LADO' : e.ot ? 'PRORROGAÇÃO' : `ROUND ${e.n}`, `Você está no ${side} · fase de compra (B)`, 2600);
        App.yaw = me.yaw; App.pitch = 0; App.deathCam = null;
        break;
      }
      case 'live': banner('', '', 0); AU.tone(300, 600, 0.3, 0.25, 'triangle'); if (App.buyOpen) toggleBuy(false); break;
      case 'planted': banner('NÚCLEO PLANTADO', `Site ${e.site} · ${RULES.nucleoTime}s até romper`, 2200); AU.tone(900, 300, 0.6, 0.3, 'sawtooth'); break;
      case 'defused': banner('NÚCLEO DESARMADO', '', 1800); AU.tone(500, 1500, 0.4, 0.3, 'triangle'); break;
      case 'explode': burst(e.x, 1, e.z, 120, [1, 0.6, 0.2], 18); AU.noise(1.4, 300, 0.9); App.shake = 1; break;
      case 'roundEnd': {
        const won = e.w === me.team, why = { elim: 'Time eliminado', time: 'Tempo esgotado', explode: 'O Núcleo rompeu', defuse: 'Núcleo desarmado' }[e.why] || '';
        banner(won ? 'ROUND VENCIDO' : 'ROUND PERDIDO', `${why} · ${e.sc[me.team]} × ${e.sc[1 - me.team]}`, 3500, won ? 'win' : 'lose');
        AU.tone(won ? 500 : 300, won ? 900 : 150, 0.6, 0.3, 'triangle');
        break;
      }
      case 'match': showEnd(e.w === me.team); break;
      case 'boom': burst(e.x, e.y + 0.3, e.z, e.kind === 'quake' ? 40 : 60, e.kind === 'stone' || e.kind === 'quake' ? [0.6, 0.5, 0.4] : e.kind === 'storm' ? [0.7, 0.6, 1] : e.kind === 'bell' ? [1, 0.9, 0.5] : [1, 0.55, 0.15], Math.min(e.r * 1.2, 12)); AU.noise(0.6, 400, 0.6 * AU.at(e.x, e.z)); if (Math.hypot(e.x - me.x, e.z - me.z) < e.r * 2) App.shake = 0.6; break;
      case 'flash': burst(e.x, e.y, e.z, 30, [1, 1, 1], 6); AU.tone(2400, 1800, 0.3, 0.2 * AU.at(e.x, e.z)); break;
      case 'smoke': AU.noise(0.8, 600, 0.3 * AU.at(e.x, e.z)); break;
      case 'fire': AU.noise(0.6, 900, 0.3 * AU.at(e.x, e.z)); break;
      case 'splash': AU.noise(0.5, 1200, 0.25 * AU.at(e.x, e.z), 0.5, 'bandpass'); break;
      case 'reveal': case 'hunt': AU.tone(400, 1200, 0.4, 0.15); break;
      case 'alarm': if (e.team === me.team) { banner('', 'O Sino Vigia tocou!', 1200); } AU.tone(1300, 1300, 0.5, 0.2 * AU.at(e.x, e.z)); break;
      case 'trc': if (App.role === 'client') { const t = e.t; G.tracers.push({ x0: t[0], y0: t[1], z0: t[2], x1: t[3], y1: t[4], z1: t[5], t: e.ttl, bolt: e.bolt, chain: e.chain }); } break;
      case 'bolt': AU.noise(0.3, 3000, 0.4 * (p ? AU.at(p.x, p.z) : 1), 0.5, 'highpass'); break;
      case 'step': if (e.id !== me.id) AU.noise(0.05, 300, 0.2 * AU.at(e.x, e.z) ** 2); else AU.noise(0.04, 250, 0.06); break;
      case 'reload': if (e.id === me.id) AU.tone(400, 300, 0.15, 0.1, 'square'); break;
      case 'ability': if (e.id === me.id) AU.tone(500, 900, 0.15, 0.15, 'triangle'); if (p && p.team !== me.team && p.hunter === 'brasa' && e.key === 'x') banner('', 'Foguete inimigo!', 900); break;
      case 'blink': case 'dash': AU.noise(0.2, 2000, 0.2 * (p ? AU.at(p.x, p.z) : 1), 0.5, 'highpass'); break;
      case 'revive': if (p) App.feed.unshift({ t: 4, txt: `${esc(p.name)} foi revivido` }); break;
    }
  }
}
function burst(x, y, z, n, col, sp) {
  for (let i = 0; i < n; i++) App.parts.push({ x, y, z, vx: rnd(-1, 1) * sp, vy: rnd(0, 1) * sp, vz: rnd(-1, 1) * sp, t: rnd(0.3, 0.9), T: 0.9, col, s: rnd(0.05, 0.14) });
  if (App.parts.length > 900) App.parts.splice(0, App.parts.length - 900);
}
let bannerTO = 0;
function banner(t, s, ms, cls = '') {
  const el = $('#banner'); clearTimeout(bannerTO);
  if (!t && !s) { el.classList.remove('show'); return; }
  el.className = 'banner show ' + cls; el.innerHTML = `${t ? `<b>${t}</b>` : ''}${s ? `<small>${s}</small>` : ''}`;
  bannerTO = setTimeout(() => el.classList.remove('show'), ms);
}
function showEnd(won) {
  document.exitPointerLock?.(); App.ended = true;
  const G = App.G, me = App.me;
  $('#end').classList.add('show');
  const again = App.kind === 'ranked' ? 'Nova ranqueada' : App.role === 'host' ? 'Voltar para a sala' : App.role === 'client' ? '' : 'Jogar de novo';
  $('#end').innerHTML = `<div class="endbox"><h1 class="${won ? 'win' : 'lose'}">${won ? 'VITÓRIA' : 'DERROTA'}</h1><div class="sub">${KIND_NAME[App.kind] || ''} · ${G.score[me.team]} × ${G.score[1 - me.team]}</div><div id="rewards" class="rewards"></div>${boardHTML()}<div class="row"><button class="btn" id="btn-endq">Sair</button>${again ? `<button class="btn gold" id="btn-again">${again}</button>` : '<span class="wait">Esperando o dono da sala...</span>'}</div></div>`;
  $('#btn-endq').onclick = () => quitMatch();
  if ($('#btn-again')) $('#btn-again').onclick = () => {
    $('#end').classList.remove('show');
    if (App.kind === 'ranked') { quitMatch(); Social.ranked(); }
    else if (App.role === 'host') backToRoom(); else startMatch();
  };
  recordMatch(won);
}
// registra a partida na conta (XP, estatísticas e, na Ranqueada, RR/MMR)
function recordMatch(won, quit) {
  const G = App.G, me = App.me; if (!G || !me || App.recorded || !Account.profile) return;
  if (App.net === 'local' && App.kind === 'ranked') return;
  const mine = G.players.filter(p => p.team === me.team), opp = G.players.filter(p => p.team !== me.team);
  const sc = p => p.dmg + p.kills * 150 + (p.plants || 0) * 120 + (p.defuses || 0) * 150;
  const avg = mine.reduce((a, p) => a + sc(p), 0) / mine.length || 1;
  const mmrOf = p => { const s = App.slots && App.slots[p.id - 1]; return s && s.mmr || 1000; };
  const r = { mode: App.kind === 'ranked' ? 'ranked' : App.kind === 'custom' ? 'standard' : 'training', won, my: G.score[me.team], opp: G.score[1 - me.team],
    hunter: me.hunter, kills: me.kills, deaths: me.deaths, dmg: me.dmg, heal: 0, perf: quit ? 0.5 : sc(me) / avg,
    oppMMR: opp.reduce((a, p) => a + mmrOf(p), 0) / (opp.length || 1), vsBots: !!App.vsBots || opp.every(p => p.bot) };
  if (quit) { r.won = false; r.my = Math.min(r.my, r.opp); }
  App.recorded = Account.record(r);
  App.recorded.then(out => { if (!quit && typeof Social !== "undefined") Social.rewards(out, App.kind); }).catch(e => console.warn(e));
}
function boardHTML() {
  const G = App.G, me = App.me;
  const rows = t => G.players.filter(p => p.team === t).sort((a, b) => b.kills - a.kills).map(p => `<tr class="${p === me ? 'mine' : ''}${p.alive ? '' : ' dead'}"><td>${esc(HUNTERS[p.hunter].nome)}</td><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg)}</td><td>◈ ${p.team === me.team ? p.creds : '?'}</td></tr>`).join('');
  return `<table class="tb"><tr><th>Caçador</th><th>Jogador</th><th>A</th><th>M</th><th>Dano</th><th>Créditos</th></tr>
    <tr><td colspan="6" class="tt" style="color:${TEAM_COL[me.team]}">Seu time</td></tr>${rows(me.team)}<tr><td colspan="6" class="tt" style="color:${TEAM_COL[1 - me.team]}">Inimigos</td></tr>${rows(1 - me.team)}</table>`;
}
function renderBoard() { $('#board').innerHTML = boardHTML(); }

// ---------------- HUD ----------------
const hud = $('#hud2d'); let hx = hud.getContext('2d');
function drawHud(dt) {
  const G = App.G, me = App.me, W = innerWidth, H = innerHeight;
  if (hud.width !== W || hud.height !== H) { hud.width = W; hud.height = H; }
  hx.clearRect(0, 0, W, H);
  if (FS.showFps) { hx.font = '700 13px Rajdhani, sans-serif'; hx.textAlign = 'right'; hx.fillStyle = App.fps >= 55 ? '#7dffa0' : App.fps >= 40 ? '#ffd65a' : '#ff6a6a'; hx.fillText(`${Math.round(App.fps)} FPS · ${Math.round(App.rs * 100)}%`, W - 12, H - 10); }
  const Wc = G.curW(me);
  // luneta
  if (me.alive && Wc && Wc.zoom && me.zoom) {
    hx.fillStyle = '#000'; const r = Math.min(W, H) * 0.46;
    hx.beginPath(); hx.rect(0, 0, W, H); hx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); hx.fill('evenodd');
    hx.strokeStyle = '#000'; hx.lineWidth = 2; hx.beginPath(); hx.moveTo(W / 2 - r, H / 2); hx.lineTo(W / 2 + r, H / 2); hx.moveTo(W / 2, H / 2 - r); hx.lineTo(W / 2, H / 2 + r); hx.stroke();
  }
  // nomes de aliados e marcas
  hx.textAlign = 'center'; hx.font = '600 12px Rajdhani, sans-serif';
  for (const p of G.players) {
    if (!p.alive || p === me) continue;
    const ally = p.team === me.team, revealed = p.revealT > 0 || G.revealTeam[me.team] > 0;
    if (!ally && !revealed) continue;
    const s = gl.project(p.x, p.y + G.height(p) + 0.35, p.z); if (!s) continue;
    if (ally) { hx.fillStyle = '#7fd0ff'; hx.fillText(p.name.replace(' [bot]', ''), s[0], s[1]); hx.fillRect(s[0] - 3, s[1] + 4, 6, 6); }
    else if (!App.vis.has(p.id) || revealed) { hx.strokeStyle = '#ff4848'; hx.lineWidth = 2; const sz = 600 / s[2]; hx.strokeRect(s[0] - sz * 0.3, s[1], sz * 0.6, sz * 1.8); }
  }
  // Núcleo plantado (marcador)
  if (G.nucleo) { const s = gl.project(G.nucleo.x, 1.2, G.nucleo.z); if (s) { hx.fillStyle = G.nucleo.planted ? '#ff5a5a' : '#7ff5ff'; hx.font = '700 13px Rajdhani, sans-serif'; hx.fillText(G.nucleo.planted ? '◆ NÚCLEO' : '◇ Núcleo', s[0], s[1]); } }
  // números de dano
  for (const d of App.dmgTxt) { d.t -= dt; const s = gl.project(d.x, d.y + (0.8 - d.t) * 0.8, d.z); if (s) { hx.globalAlpha = Math.max(0, d.t / 0.8); hx.fillStyle = d.hs ? '#ffd65a' : '#fff'; hx.font = `700 ${d.hs ? 20 : 16}px Rajdhani, sans-serif`; hx.fillText(d.v, s[0] + 20, s[1]); hx.globalAlpha = 1; } }
  App.dmgTxt = App.dmgTxt.filter(d => d.t > 0);
  // mira
  if (me.alive && !(Wc && Wc.zoom && me.zoom)) {
    const sp = Wc && !Wc.melee ? G.spreadOf(me, Wc) : 0, gap = 4 + Math.min(40, sp / (FS.fov * Math.PI / 180) * W * 0.6);
    hx.fillStyle = FS.xcol; hx.strokeStyle = 'rgba(0,0,0,.6)'; hx.lineWidth = 1;
    const cx = W / 2, cy = H / 2;
    for (const [x, y, w, h] of [[cx - gap - 6, cy - 1, 6, 2], [cx + gap, cy - 1, 6, 2], [cx - 1, cy - gap - 6, 2, 6], [cx - 1, cy + gap, 2, 6], [cx - 1, cy - 1, 2, 2]]) { hx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1); hx.fillRect(x, y, w, h); }
  }
  if (App.hitMark > 0) { App.hitMark -= dt; hx.strokeStyle = App.hitHead ? '#ffd65a' : '#fff'; hx.lineWidth = 2; const c = 8, o = 5, cx = W / 2, cy = H / 2; hx.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { hx.moveTo(cx + a * o, cy + b * o); hx.lineTo(cx + a * (o + c), cy + b * (o + c)); } hx.stroke(); }
  // dano recebido
  if (App.hurtT > 0) { App.hurtT -= dt; const a = App.hurtDir - App.yaw; hx.save(); hx.translate(W / 2, H / 2); hx.rotate(a); hx.fillStyle = `rgba(255,40,40,${App.hurtT})`; hx.beginPath(); hx.moveTo(-40, -150); hx.lineTo(40, -150); hx.lineTo(0, -175); hx.fill(); hx.restore(); }
  // cegueira
  if (me.blindT > 0) { hx.fillStyle = `rgba(255,255,255,${Math.min(1, me.blindT)})`; hx.fillRect(0, 0, W, H); }
  if (me.stunT > 0) { hx.fillStyle = `rgba(120,90,60,${Math.min(0.35, me.stunT * 0.2)})`; hx.fillRect(0, 0, W, H); }
  minimap();
}
function minimap() {
  const G = App.G, me = App.me, M = G.M, s = Math.min(5, 230 / M.W), ox = 14, oy = 14, w = M.W * s, h = M.H * s;
  hx.save(); hx.globalAlpha = 0.9;
  // o fundo do minimapa só é redesenhado quando muda (portas, madeira quebrada)
  const key = M.W + ':' + s + ':' + G.M.doors.map(d => d.open ? 1 : 0).join('') + ':' + G.M.breakables.map(b => b.hp > 0 ? 1 : 0).join('');
  if (!App.mmC || App.mmKey !== key || App.mmM !== M) {
    App.mmKey = key; App.mmM = M;
    const cv = App.mmC = App.mmC || document.createElement('canvas'); cv.width = w + 8; cv.height = h + 8;
    const real = hx; hx = cv.getContext('2d'); hx.clearRect(0, 0, cv.width, cv.height);
    minimapBase(M, s, 4, 4, w, h);
    hx = real;
  }
  hx.drawImage(App.mmC, ox - 4, oy - 4);
  hx.font = '700 14px Rajdhani, sans-serif'; hx.textAlign = 'center'; hx.fillStyle = '#fff';
  for (const k of M.siteIds) { const S = M.sites[k]; hx.fillText(k, ox + S.x / M.cell * s, oy + S.z / M.cell * s + 5); }
  minimapDyn(G, me, M, s, ox, oy, w, h);
}
function minimapBase(M, s, ox, oy, w, h) {
  hx.fillStyle = 'rgba(10,12,20,.75)'; hx.fillRect(ox - 4, oy - 4, w + 8, h + 8);
  for (let r = 0; r < M.H; r++) for (let c = 0; c < M.W; c++) {
    const ch = M.at(c, r); if (ch === '#') continue;
    hx.fillStyle = { A: '#8a6040', B: '#406080', C: '#4a7a40', x: '#555', h: '#555', o: '#05070d', w: '#2c6a80', i: '#c8dfee', g: '#3a6a2a', P: '#a070ff', Q: '#50e0ff', L: '#ffd060' }[ch] || (ch === '=' ? (M.doorAt(c, r) ? '#e0a030' : '#9a968c') : ch === 'b' ? (M.breakAt(c, r) ? '#a0703a' : '#9a968c') : '#9a968c');
    hx.fillRect(ox + c * s, oy + r * s, s, s);
  }
}
function minimapDyn(G, me, M, s, ox, oy, w, h) {
  const P = (x, z) => [ox + x / M.cell * s, oy + z / M.cell * s];
  if (G.nucleo) { const [x, y] = P(G.nucleo.x, G.nucleo.z); hx.fillStyle = G.nucleo.planted ? '#ff5a5a' : '#7ff5ff'; hx.fillRect(x - 3, y - 3, 6, 6); }
  for (const p of G.players) {
    if (!p.alive) continue;
    const ally = p.team === me.team; if (!ally && !App.vis.has(p.id) && !(p.revealT > 0) && !(G.revealTeam[me.team] > 0)) continue;
    const [x, y] = P(p.x, p.z);
    hx.fillStyle = p === me ? '#ffe27a' : ally ? '#3fa9ff' : '#ff4848';
    hx.beginPath(); hx.arc(x, y, p === me ? 4 : 3.5, 0, Math.PI * 2); hx.fill();
    if (p === me || ally) { hx.strokeStyle = hx.fillStyle; hx.lineWidth = 1.5; hx.beginPath(); hx.moveTo(x, y); hx.lineTo(x + Math.sin(p.yaw) * 9, y - Math.cos(p.yaw) * 9); hx.stroke(); }
    if (p.nucleo && ally) { hx.fillStyle = '#7ff5ff'; hx.fillRect(x + 3, y - 6, 4, 4); }
  }
  hx.restore();
  hx.fillStyle = '#e8ecf5'; hx.font = '700 13px Rajdhani, sans-serif'; hx.textAlign = 'left';
  hx.fillText(M.calloutAt(me.x, me.z), ox, oy + h + 18);
}
// HUD em HTML (atualizado poucas vezes por segundo)
let domT = 0;
function updateDom(dt) {
  domT -= dt; if (domT > 0) return; domT = 0.08;
  const G = App.G, me = App.me;
  const side = me.team === G.attTeam() ? 'ATAQUE' : 'DEFESA';
  const t = Math.max(0, G.phaseT), mm = Math.floor(t / 60), ss = Math.floor(t % 60);
  $('#sc-me').textContent = G.score[me.team]; $('#sc-en').textContent = G.score[1 - me.team];
  $('#timer').textContent = G.phase === 'planted' ? '◆' : G.phase === 'end' || G.phase === 'matchEnd' ? '' : `${mm}:${String(ss).padStart(2, '0')}`;
  $('#timer').className = G.phase === 'planted' ? 'planted' : G.phase === 'buy' ? 'buy' : '';
  $('#phase').textContent = G.phase === 'buy' ? `FASE DE COMPRA · B abre a loja · ${side}` : G.phase === 'planted' ? `NÚCLEO PLANTADO NO SITE ${G.plantSite} · ${Math.ceil(t)}s` : `${side} · Round ${G.round}`;
  const ros = t2 => G.players.filter(p => p.team === t2).map(p => `<i class="${p.alive ? '' : 'dead'}" style="background:${HUNTERS[p.hunter].cores.roupa}" title="${esc(p.name)}">${HUNTERS[p.hunter].nome[0]}</i>`).join('');
  $('#ros-me').innerHTML = ros(me.team); $('#ros-en').innerHTML = ros(1 - me.team);
  $('#hp').textContent = Math.max(0, Math.ceil(me.hp)); $('#ar').textContent = me.armor ? Math.ceil(me.armor) : ''; $('#ar').style.display = me.armor ? '' : 'none';
  $('#cr').textContent = '◈ ' + me.creds;
  const g = me.cur === 3 ? null : me.guns[me.cur], W = G.curW(me);
  $('#ammo').innerHTML = g ? `<b>${g.ammo}</b><span>/ ${g.res}</span>` : '<b>—</b>';
  $('#wname').textContent = W ? W.nome : '';
  $('#slots').innerHTML = [1, 2, 3].map(s => { const gg = s === 3 ? { id: 'faca' } : me.guns[s]; return gg ? `<span class="${me.cur === s ? 'on' : ''}">${s} · ${WEAPONS[gg.id].nome}</span>` : ''; }).join('') + (me.nucleo ? '<span class="nuc">4 · Núcleo (segure F no site)</span>' : '');
  const F = FPS_HUNTERS[me.hunter];
  $('#abil').innerHTML = ['c', 'q', 'e', 'x'].map(k => {
    const n = k === 'x' ? null : me.ab[k], ready = k === 'x' ? me.ult >= FPS_ULT[me.hunter] : n > 0;
    const pts = k === 'x' ? `<div class="pts">${Array.from({ length: FPS_ULT[me.hunter] }, (_, i) => `<em class="${i < me.ult ? 'on' : ''}"></em>`).join('')}</div>` : `<div class="pts">${Array.from({ length: k === 'e' ? F.e.free : F[k].max }, (_, i) => `<em class="${i < n ? 'on' : ''}"></em>`).join('')}</div>`;
    return `<div class="ab ${ready ? 'rdy' : ''} ${k === 'x' ? 'ult' : ''}" title="${esc(F[k].nome + ' — ' + F[k].desc)}"><span class="k">${k.toUpperCase()}</span><span class="n">${F[k].nome}</span>${pts}</div>`;
  }).join('');
  // progresso de plantar/desarmar
  const pr = $('#prog');
  if (me.useT > 0 && me.alive) { const tot = me.team === G.attTeam() ? RULES.plantTime : RULES.defuseTime; pr.style.display = ''; pr.innerHTML = `<span>${me.team === G.attTeam() ? 'Plantando o Núcleo' : 'Desarmando o Núcleo'}</span><i style="width:${me.useT / tot * 100}%"></i>`; }
  else pr.style.display = 'none';
  // dica contextual
  let tip = '';
  if (me.alive && me.nucleo && G.phase === 'live') tip = G.M.siteAt(me.x, me.z) ? 'Segure F para plantar o Núcleo' : 'Leve o Núcleo até um site (' + G.M.siteIds.join(', ') + ')';
  else if (me.alive && me.team !== G.attTeam() && G.phase === 'planted' && G.nucleo && Math.hypot(me.x - G.nucleo.x, me.z - G.nucleo.z) < 1.6) tip = 'Segure F para desarmar';
  else if (me.alive && G.drops.some(d => Math.hypot(d.x - me.x, d.z - me.z) < 1.6)) tip = 'Segure F para pegar a arma';
  else if (!me.alive) tip = 'Você morreu · assistindo um aliado';
  $('#tip').textContent = tip;
  // killfeed
  App.feed = App.feed.filter(f => (f.t -= 0.08) > 0).slice(0, 6);
  $('#feed').innerHTML = App.feed.map(f => f.txt ? `<div>${f.txt}</div>` : `<div><b style="color:${TEAM_COL[f.k ? (f.k.team === me.team ? 0 : 1) : 0]}">${f.k ? esc(f.k.name) : '—'}</b> <span class="w">${WEAPONS[f.w] ? WEAPONS[f.w].nome : f.w === 'nucleo' ? 'Núcleo' : '✦'}${f.hs ? ' ◎' : ''}</span> <b style="color:${TEAM_COL[f.v.team === me.team ? 0 : 1]}">${esc(f.v.name)}</b></div>`).join('');
  if (App.killBanner) { App.killBanner.t -= 0.08; $('#kb').textContent = App.killBanner.t > 0 ? ['', 'ABATE', 'DUPLO', 'TRIPLO', 'QUÁDRUPLO', 'ACE'][Math.min(5, App.killBanner.n)] : ''; }
  if (App.buyOpen && G.phase !== 'buy') toggleBuy(false);
  if (App.buyOpen && Math.random() < 0.3) { const el = $('#buy .bt'); if (el) el.textContent = `${Math.max(0, Math.ceil(G.phaseT))}s de compra · B fecha`; }
}

// ---------------- laço ----------------
// ---------------- desempenho: resolução automática para segurar 60 FPS ----------------
// Mede o FPS a cada meio segundo. Se cair, baixa um pouco a resolução interna; quando sobra folga, volta a subir.
App.rs = FS.scale; App.fps = 60;
const PERF = { n: 0, t0: 0, good: 0, hold: 0 };
function perfTick(now) {
  if (!PERF.t0) PERF.t0 = now;
  PERF.n++;
  const el = now - PERF.t0; if (el < 500) return;
  App.fps = PERF.n * 1000 / el; PERF.n = 0; PERF.t0 = now;
  if (document.hidden || el > 2000) return;
  const minRS = HQ ? 0.6 : 0.5;
  if (!FS.autoRes) { App.rs = FS.scale; return; }
  App.rs = Math.min(App.rs, FS.scale);
  PERF.hold = Math.max(0, PERF.hold - el / 1000);
  if (App.fps < 54 && App.rs > minRS) { App.rs = Math.max(minRS, +(App.rs - 0.08).toFixed(2)); PERF.good = 0; PERF.hold = PERF.raised ? 20 : 2; PERF.raised = false; }
  else if (App.fps >= 58) {
    PERF.good += el / 1000;
    if (PERF.good > 4 && PERF.hold <= 0 && App.rs < FS.scale) { App.rs = Math.min(FS.scale, +(App.rs + 0.05).toFixed(2)); PERF.good = 0; PERF.raised = true; }
  } else PERF.good = 0;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (App.last || now)) / 1000); App.last = now;
  perfTick(now); gl.resize(App.rs);
  if (!App.G) { // fundo do menu: câmera girando
    const T = now / 1000, cx = App.M.W, cz = App.M.H, cam = { x: cx + Math.sin(T * 0.08) * cx * 0.5, y: 11, z: cz + Math.cos(T * 0.08) * cz * 0.45, yaw: T * 0.08 + Math.PI, pitch: -0.42, fov: 1.25 };
    gl.begin(cam, T); gl.draw(App.mapMesh, null, { stat: true }); for (const l of App.lamps) gl.box(l.x, l.y, l.z, 0.14, 0.2, 0.14, l.col, { emis: 1, cast: false }); gl.flush(); return;
  }
  const G = App.G, me = App.me;
  if (App.running) { readInput(); simPump(now); }
  // câmera (morto: assiste um aliado vivo)
  let view = me;
  if (!me.alive) { const al = G.players.filter(p => p.alive && p.team === me.team); App.spec = al[0] || null; if (App.spec) view = App.spec; }
  const W = G.curW(view), zoom = view === me && me.alive && W && W.zoom && me.zoom ? W.zoom : 1;
  App.shake = Math.max(0, (App.shake || 0) - dt * 2);
  const sk = App.shake * 0.02;
  const cam = { x: view.x + rnd(-sk, sk), y: G.eye(view) + rnd(-sk, sk), z: view.z, yaw: view === me ? App.yaw : view.yaw, pitch: (view === me ? App.pitch : view.pitch) + (view === me ? (me.recoil || 0) * Math.PI / 180 * 0.6 : 0), fov: Math.atan(Math.tan(FS.fov * Math.PI / 180 / 2) / zoom * (innerHeight / innerWidth)) * 2 };
  gl.begin(cam, now / 1000);
  drawWorld(now / 1000, dt);
  gl.flush();
  if (view === me) drawViewmodel(now / 1000, dt);
  gl.flush();
  drawHud(dt); updateDom(dt);
}
requestAnimationFrame(frame);

// ---------------- configurações ----------------
function bindSettings(s) {
  const pct = v => Math.round(v * 100) + '%';
  s.innerHTML = `<div class="qual"><span>Gráficos</span><button data-q="alta" class="${HQ ? 'on' : ''}">Alta qualidade</button><button data-q="desempenho" class="${HQ ? '' : 'on'}">Desempenho</button></div>
  <small class="qhint">${HQ ? 'Sombras suaves, texturas detalhadas e antisserrilhado.' : 'Mais leve: sombra e textura simplificadas, sem antisserrilhado. Quase o mesmo visual.'}</small>
  <label>Sensibilidade <input type="range" min="0.05" max="1.5" step="0.01" value="${FS.sens}" data-k="sens"><b>${FS.sens}</b></label>
  <label>Campo de visão <input type="range" min="80" max="115" step="1" value="${FS.fov}" data-k="fov"><b>${FS.fov}°</b></label>
  <label>Resolução <input type="range" min="0.5" max="1" step="0.05" value="${FS.scale}" data-k="scale"><b>${pct(FS.scale)}</b></label>
  <label>Resolução automática (segura 60 FPS) <input type="checkbox" data-k="autoRes" ${FS.autoRes ? 'checked' : ''}></label>
  <label>Sombras <input type="checkbox" data-k="shadows" ${FS.shadows ? 'checked' : ''}></label>
  <label>Mostrar FPS <input type="checkbox" data-k="showFps" ${FS.showFps ? 'checked' : ''}></label>
  <label>Volume <input type="range" min="0" max="100" step="1" value="${FS.vol}" data-k="vol"><b>${FS.vol}</b></label>
  <label>Cor da mira <input type="color" value="${FS.xcol}" data-k="xcol"></label>`;
  s.querySelectorAll('input').forEach(i => i.oninput = () => {
    const k = i.dataset.k;
    FS[k] = i.type === 'color' ? i.value : i.type === 'checkbox' ? (i.checked ? 1 : 0) : +i.value; saveFS();
    gl.shadows = !!FS.shadows; if (k === 'scale') App.rs = FS.scale;
    const b = i.nextElementSibling; if (b) b.textContent = k === 'scale' ? pct(FS.scale) : k === 'fov' ? FS.fov + '°' : FS[k];
    for (const o of document.querySelectorAll(`[data-k="${k}"]`)) if (o !== i) { if (o.type === 'checkbox') o.checked = !!FS[k]; else o.value = FS[k]; }
  });
  s.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    if (b.dataset.q === FS.quality || (b.dataset.q === 'alta' && HQ)) return;
    FS.quality = b.dataset.q; saveFS();
    if (!App.G) location.reload(); // trocar a qualidade recria o motor gráfico
    else s.querySelector('.qhint').textContent = 'Vale quando a partida acabar (a página recarrega).';
  });
}
bindSettings($('#fpset')); bindSettings($('#fpset2'));
buildMenu(); buildMaps();

