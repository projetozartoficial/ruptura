// =====================================================================
//  main.js : menus, contas, lobby, ranqueada, loop do jogo, entrada e HUD
// =====================================================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const BOT_NAMES = ['Eco', 'Vulto', 'Faísca', 'Garoa', 'Breu', 'Ônix', 'Sina', 'Lasca', 'Rajada', 'Cinza', 'Neblina', 'Trovo'];
const ICONS = {
  brasa: ['✹', '✺', '➤', '☄'], corvo: ['➶', '⛓', '✧', '☾'], mare: ['◉', '◌', '▥', '≋'], lumi: ['✦', '⛉', '✚', '☀'], rocha: ['⚒', '⚡', '⛨', '⛰'],
  lamina: ['〉', '➹', '◈', '✵'], trovao: ['ϟ', '⇶', '⌁', '☈'], vinha: ['❦', '⚘', '✿', '♣'], sino: ['〰', '⇄', '◍', '♫'], ancora: ['⚓', '⥅', '⛊', '⛓'],
};
const MODE_NAME = { training: 'Treino', standard: 'Partida padrão', ranked: 'Ranqueada' };

const App = {
  name: '', net: 'online', role: 'none', kind: 'standard', code: '', myId: 0, slots: [], myHunter: 'brasa',
  sim: null, cs: null, tr: null, peers: new Map(), nextPid: 2, pending: [], remoteIn: new Map(),
  inGame: false, paused: false, ended: false, matchMode: 'standard', demo: null, demoMe: null, demoT: 0,
  search: null, expect: 0, moving: false,
};

// ------------------------------------------------------------------
//  Canvas / renderer / qualidade
// ------------------------------------------------------------------
const canvas = $('#bg');
const R = new Renderer(canvas);
let curQ = Settings.quality === 'auto' ? 'alta' : Settings.quality;
function applyQuality(q) {
  curQ = q; R.Q = QUALITY[q];
  R.dpr = Math.min(window.devicePixelRatio || 1, R.Q.dpr);
  resize();
}
function resize() { canvas.width = Math.floor(innerWidth * R.dpr); canvas.height = Math.floor(innerHeight * R.dpr); }
addEventListener('resize', resize);
applyQuality(curQ);
if (!Settings.sound) SFX.toggle();
SFX.setVolume(Settings.volume / 100);
function applyGameplaySettings() { R.shakeOn = Settings.shake; R.dmgNumbers = Settings.dmgNumbers; R.names = Settings.names; R.lookahead = Settings.lookahead; }
applyGameplaySettings();

const perf = { acc: 0, n: 0, fps: 60 };
function trackPerf(raw) {
  if (raw > 0.5) return;
  perf.acc += raw; perf.n++;
  perf.fps += (1 / Math.max(raw, 0.001) - perf.fps) * 0.05;
  if (perf.acc < 2) return;
  const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
  if (Settings.quality === 'auto' && App.inGame && !App.paused && avg > 0.02) {
    if (curQ === 'alta') applyQuality('media'); else if (curQ === 'media') applyQuality('baixa');
    else if (R.dpr > 0.5) { R.dpr = Math.max(0.5, R.dpr - 0.1); resize(); }
  }
}

// ------------------------------------------------------------------
//  Telas e utilidades
// ------------------------------------------------------------------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id)); App.screen = id;
  const online = (App.role === 'host' || App.role === 'client') && App.net === 'online';
  const st = id === 'game' ? 'jogo' : id === 'lobby' ? 'sala' : 'menu';
  if (Account.pres.status !== st || Account.pres.room !== (online ? App.code : null)) Account.presence({ status: st, room: online && id !== 'game' ? App.code : null, kind: App.kind });
  if (id === 'game') $('#friends').classList.remove('show');
}
function msg(sel, t) { $(sel).textContent = t || ''; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0]; return s; }
try { App.myHunter = localStorage.getItem('ruptura-hunter') || 'brasa'; } catch (e) { }
const portraitCache = new Map();
function portrait(h, size) { const k = h + size; if (!portraitCache.has(k)) portraitCache.set(k, hunterPortrait(h, size)); const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(portraitCache.get(k), 0, 0); return c; }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  SFX.init(); SFX.play('click');
  if (['solo', 'host', 'ranked', 'join', 'friends'].includes(b.dataset.act) && !Account.logged) {
    msg('#menu-msg', Account.enabled ? 'Entre com sua conta Google para jogar.' : 'O login ainda não está configurado (js/firebase-config.js).');
    return;
  }
  if (['solo', 'host', 'ranked', 'join', 'friends'].includes(b.dataset.act) && Account.needsNick) { openNick(true); return; }
  ({
    solo: () => startSolo(), host: () => startHost('standard'), ranked: () => startRankedParty(), join: () => startJoin(),
    codex: () => { buildCodex(); show('codex'); }, howto: () => show('howto'), back: () => show('menu'),
    profile: () => { buildProfile(); show('profile'); }, settings: () => openSettings(), setclose: () => closeSettings(),
    leave: () => leaveRoom(), start: () => hostStart(), menu: () => leaveRoom(), again: () => playAgain(),
    resume: () => togglePause(false), quit: () => leaveRoom(),
    login: () => doLogin(), logout: () => Account.logout(),
    search: () => startSearch(), cancelsearch: () => cancelSearch(), vsbots: () => rankedVsBots(),
    nickok: () => confirmNick(), nickcancel: () => $('#nick-modal').classList.remove('show'), editnick: () => openNick(false),
    friends: () => { $('#friends').classList.add('show'); renderFriends(); }, friendsclose: () => $('#friends').classList.remove('show'),
    addfriend: () => addFriend(), fraccept: () => Account.respond(b.dataset.id, true), frdecline: () => Account.respond(b.dataset.id, false),
    frremove: () => { const f = Account.friends.find(x => x.req === b.dataset.id); if (f) Account.removeFriend(f); },
    frjoin: () => joinFriendRoom(b.dataset.code), frinvite: () => inviteFriend(b.dataset.uid, b),
    copycode: () => { try { navigator.clipboard.writeText(App.code); b.textContent = 'Copiado ✓'; setTimeout(() => (b.textContent = 'Copiar código'), 1500); } catch (e) { } },
    invjoin: () => acceptInvite(b.dataset.id), invclose: () => { const i = Account.invites.find(x => x.id === b.dataset.id); if (i) Account.dropInvite(i); },
  })[b.dataset.act]?.();
});

// ------------------------------------------------------------------
//  Conta
// ------------------------------------------------------------------
Account.on(() => {
  renderAcct(); if (App.screen === 'profile') buildProfile();
  if (!Account.logged && App.role !== 'none' && !App.inGame) leaveRoom();
});
Account.init();
async function doLogin() {
  msg('#menu-msg', '');
  try { await Account.login(); } catch (e) { msg('#menu-msg', e.message); }
}
function renderAcct() {
  const P = Account.profile; if (!P) return;
  const el = $('#acct'); el.innerHTML = '';
  el.appendChild(rankCanvas(P.rank, 92));
  const need = xpNeed(P.level);
  const rk = P.rank >= 0 ? rankName(P.rank) : P.placements > 0 ? `Colocação ${P.placements}/5` : 'Sem ranque';
  el.insertAdjacentHTML('beforeend', `<div class="ai"><div class="an">${Account.logged ? (P.nickSet ? `${esc(P.name)} <span style="color:var(--dim)">#${esc(P.tag)}</span>` : 'Escolha seu ID') : 'Sem conta conectada'}</div><div class="al">${Account.logged ? `Nível ${P.level} · ${rk}` : 'Conecte sua conta Google para jogar'}</div><div class="xpb"><i style="width:${P.xp / need * 100}%"></i></div></div>`);
  if (Account.logged) el.insertAdjacentHTML('beforeend', `<button class="btn ghost" data-act="logout">Sair</button>`);
  for (const k of ['solo', 'host', 'ranked', 'join']) { const bt = document.querySelector(`#scr-menu [data-act=${k}]`); if (bt) bt.classList.toggle('locked', !Account.logged); }
  $('#login-gate').style.display = Account.logged ? 'none' : '';
  if (Account.needsNick && !$('#nick-modal').classList.contains('show')) openNick(true);
  if (Account.error) msg('#menu-msg', Account.error);
}

function readName() {
  App.name = Account.profile ? Account.profile.name : 'Caçador';
  App.net = Settings.net || 'online';
}
function mySlotInfo() { const s = Account.summary(); return { uid: s.uid, tag: s.tag, hide: !!Settings.hideName, lvl: s.level, rank: s.rank, mmr: s.mmr, pl: s.placements }; }

// ------------------------------------------------------------------
//  Lobby (o dono da sala é a autoridade)
// ------------------------------------------------------------------
function emptySlots() { return Array.from({ length: 8 }, () => ({ kind: 'empty' })); }
function teamHunters(slots, team, exceptIdx) { const s = new Set(); for (let i = team * 4; i < team * 4 + 4; i++) if (i !== exceptIdx && slots[i].kind !== 'empty') s.add(slots[i].hunter); return s; }
function freeHunter(slots, team, pref) { const used = teamHunters(slots, team); if (pref && !used.has(pref)) return pref; return HUNTER_IDS.find(h => !used.has(h)); }
function slotOf(id) { return App.slots.findIndex(s => s.id === id); }
function humans(team) { return App.slots.filter((s, i) => s.kind === 'human' && (team === undefined || (i < 4 ? 0 : 1) === team)); }
function placeHuman(info, team) {
  const S = App.slots;
  let order;
  if (team === 0 || team === 1) order = [team];
  else if (App.kind === 'ranked') order = [0];
  else order = humans(0).length <= humans(1).length ? [0, 1] : [1, 0];
  for (const t of order) for (let i = t * 4; i < t * 4 + 4; i++) if (S[i].kind === 'empty') { S[i] = Object.assign({ kind: 'human' }, info, { hunter: freeHunter(S, t, info.pref) }); delete S[i].pref; return true; }
  return false;
}

function startSolo() {
  readName(); App.role = 'solo'; App.kind = 'training'; App.myId = 1; App.slots = emptySlots();
  App.slots[0] = Object.assign({ kind: 'human', id: 1, name: App.name, hunter: App.myHunter }, mySlotInfo());
  openLobby();
}
async function startHost(kind) {
  readName();
  if (App.net === 'online' && !hasWebRTC()) return msg('#menu-msg', 'Este navegador bloqueia conexões online. Use o modo Local ou abra o site hospedado.');
  msg('#menu-msg', 'Criando sala...');
  const code = genCode();
  try { App.tr = await Transport.host(App.net, code, { onJoin: () => { }, onLeave: hostOnLeave, onMsg: hostOnMsg }); }
  catch (e) { return msg('#menu-msg', e.message); }
  msg('#menu-msg', '');
  App.role = 'host'; App.kind = kind; App.code = code; App.myId = 1; App.slots = emptySlots(); App.peers.clear(); App.nextPid = 2;
  App.slots[0] = Object.assign({ kind: 'human', id: 1, name: App.name, hunter: App.myHunter }, mySlotInfo());
  openLobby();
  return true;
}
function rankedBlock() {
  if (!Account.enabled) return 'A Ranqueada precisa de conta. Configure o Firebase (js/firebase-config.js).';
  if (!Account.logged) return 'Entre com sua conta Google para jogar a Ranqueada.';
  if (Account.profile.level < window.RANKED_MIN_LEVEL) return `A Ranqueada libera no nível ${window.RANKED_MIN_LEVEL} de conta (você está no ${Account.profile.level}). Jogue treinos e partidas padrão para subir.`;
  return '';
}
async function startRankedParty() {
  const b = rankedBlock(); if (b) return msg('#menu-msg', b);
  if (App.net !== 'online') { /* local serve para testes */ }
  await startHost('ranked');
}
async function startJoin(codeArg, hint) {
  if (!codeArg) readName();
  const code = (codeArg || $('#in-code').value.trim()).toUpperCase();
  if (code.length < 5) return msg('#menu-msg', 'Digite o código de 5 letras da sala.');
  if (App.net === 'online' && !hasWebRTC()) return msg('#menu-msg', 'Este navegador bloqueia conexões online. Use o modo Local ou abra o site hospedado.');
  msg('#menu-msg', 'Conectando...');
  try { App.tr = await Transport.join(App.net, code, { onMsg: clientOnMsg, onClose: clientOnClose }); }
  catch (e) { App.moving = false; show('menu'); return msg('#menu-msg', e.message); }
  msg('#menu-msg', '');
  App.moving = false;
  App.role = 'client'; App.code = code; App.myId = 0; App.kind = hint && hint.kind || 'standard';
  App.tr.send(Object.assign({ t: 'hello', name: App.name, pref: App.myHunter }, mySlotInfo(), hint || {}));
  App.slots = emptySlots();
  openLobby();
}
function openLobby() {
  App.inGame = false; App.ended = false;
  $('#lob-code').textContent = App.role === 'solo' ? 'TREINO' : codeText(App.code);
  $('#btn-copy').style.display = App.role === 'host' || App.role === 'client' ? '' : 'none';
  $('#lob-mode').textContent = App.role === 'solo' ? 'Você + bots · primeiro a 5 rounds'
    : App.kind === 'ranked' ? 'Grupo da Ranqueada · passe o código para até 3 amigos'
      : App.net === 'local' ? 'Modo local: abra outra aba e entre com este código' : 'Partida padrão · passe este código para seus amigos';
  $('.lob-title').textContent = App.kind === 'ranked' ? 'Ranqueada · Arena 4v4' : 'Escolha seu time e seu caçador';
  $('#btn-start').style.display = App.role === 'client' || App.kind === 'ranked' ? 'none' : '';
  $('.team-col.t1').style.display = App.kind === 'ranked' && !App.expect ? 'none' : '';
  $('.vs').style.display = App.kind === 'ranked' && !App.expect ? 'none' : '';
  msg('#lob-msg', App.role === 'client' && App.kind !== 'ranked' ? 'Aguardando o dono da sala começar...' : '');
  show('lobby'); renderLobby(); renderRankedBar();
}
function broadcastLobby() { if (App.role === 'host') App.tr.broadcast({ t: 'lobby', slots: App.slots, kind: App.kind, expect: App.expect, search: App.search ? { active: App.search.active, t0: App.search.t0 } : null }); }

function hostOnLeave(pid) {
  const pe = App.peers.get(pid); if (!pe) return;
  App.peers.delete(pid); App.remoteIn.delete(pe.id);
  const i = slotOf(pe.id);
  if (App.inGame && App.sim) {
    const p = App.sim.byId(pe.id); if (p) { p.bot = true; p.name += ' (bot)'; }
    feed(`<span class="enemy">${esc(pe.name)}</span> saiu — um bot assumiu`);
  } else if (i >= 0) { App.slots[i] = { kind: 'empty' }; renderLobby(); broadcastLobby(); if (App.search) cancelSearch(); }
}
function hostOnMsg(pid, m) {
  if (m.t === 'hello') {
    if (App.peers.has(pid)) return;
    if (App.inGame) { App.tr.send(pid, { t: 'full', why: 'A partida já começou. Espere acabar.' }); return; }
    if (App.kind === 'ranked' && App.search && App.search.active) { App.tr.send(pid, { t: 'full', why: 'Esse grupo está na fila. Peça para cancelarem a busca.' }); return; }
    if (!m.uid) { App.tr.send(pid, { t: 'full', why: 'Só jogadores com conta conectada podem entrar.' }); return; }
    const id = App.nextPid++;
    const info = { id, name: String(m.name || 'Caçador').slice(0, 14), tag: String(m.tag || '').slice(0, 5), hide: !!m.hide, pref: m.pref, uid: m.uid || null, lvl: m.lvl || 1, rank: m.rank ?? -1, mmr: m.mmr || 1000, pl: m.pl || 0 };
    if (!placeHuman(info, App.kind === 'ranked' ? (m.team === 1 ? 1 : 0) : undefined)) { App.tr.send(pid, { t: 'full', why: 'Sala cheia.' }); return; }
    App.peers.set(pid, { id, name: info.name });
    App.tr.send(pid, { t: 'welcome', id, kind: App.kind });
    renderLobby(); broadcastLobby();
    if (App.expect && humans().length >= App.expect) setTimeout(() => { if (!App.inGame && App.expect) hostStart(); }, 1200);
    return;
  }
  const pe = App.peers.get(pid); if (!pe) return;
  if (m.t === 'in') { App.remoteIn.set(pe.id, m.i); return; }
  if (m.t === 'swap') { if (App.sim) App.sim.requestSwap(pe.id, m.hunter); return; }
  if (!App.inGame) lobbyAction(pe.id, m);
}
function lobbyAction(id, m) {
  const S = App.slots, i = slotOf(id); if (i < 0) return;
  if (m.t === 'slot' && App.kind !== 'ranked' && S[m.slot] && S[m.slot].kind === 'empty') {
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

function renderLobby() {
  const S = App.slots;
  for (const t of [0, 1]) {
    const box = $('#slots' + t); box.innerHTML = '';
    for (let i = t * 4; i < t * 4 + 4; i++) {
      const s = S[i], d = document.createElement('div');
      d.className = 'slot' + (s.kind !== 'empty' ? ' filled' : '') + (s.id === App.myId ? ' me' : '');
      if (s.kind === 'empty') {
        d.innerHTML = App.kind === 'ranked' ? `<span class="empty">${t === 0 ? '+ Vaga do grupo (amigo entra pelo código)' : 'Adversário'}</span>` : `<span class="empty">+ Vaga livre (bot) — clique para entrar</span>`;
        if (App.kind !== 'ranked') d.onclick = () => { SFX.play('click'); myAction({ t: 'slot', slot: i }); };
      } else {
        d.appendChild(portrait(s.hunter, 88));
        const H = HUNTERS[s.hunter], C = CLASSES[H.classe];
        const info = document.createElement('div'); info.style.flex = '1';
        const myIdx = slotOf(App.myId), meT = myIdx >= 0 ? { id: App.myId, team: myIdx < 4 ? 0 : 1 } : null;
        const sp = { id: s.id, name: s.name, hide: s.hide, hunter: s.hunter, team: i < 4 ? 0 : 1 }, nm = displayName(sp, meT), generic = nm !== s.name;
        info.innerHTML = `<div class="nm">${esc(nm)}${s.tag && !generic ? ` <span class="tg">#${esc(s.tag)}</span>` : ''}${s.id === App.myId ? ' (você)' : ''}</div><div class="hn" style="color:${C.cor}">${H.nome} · ${C.nome}${s.lvl ? ` <span style="color:var(--dim)">· Nv ${s.lvl}</span>` : ''}</div>`;
        d.appendChild(info);
        if (s.kind === 'human' && (App.kind === 'ranked' || s.rank >= 0)) { const rc = rankCanvas(s.rank ?? -1, 68); rc.className = 'rk'; rc.title = rankName(s.rank ?? -1); d.appendChild(rc); }
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

// ------------------------------------------------------------------
//  Ranqueada: fila e pareamento
// ------------------------------------------------------------------
function partyProblem() {
  const H = humans(0);
  if (H.some(s => !s.uid)) return 'Todos do grupo precisam estar logados com Google.';
  const low = H.find(s => (s.lvl || 1) < window.RANKED_MIN_LEVEL); if (low) return `${low.name} ainda não tem nível ${window.RANKED_MIN_LEVEL}.`;
  if (!partyAllowed(H)) return 'Diferença de elo grande demais no grupo (máximo 1 elo de distância, ex.: Gold com Platinum).';
  return '';
}
let rankedTicker = 0;
function renderRankedBar() {
  const el = $('#lob-ranked');
  el.classList.toggle('show', App.kind === 'ranked');
  if (App.kind !== 'ranked') return;
  const S = App.search, host = App.role === 'host';
  let html = '';
  if (App.expect) html = `<div class="spin"></div><div class="st">Partida encontrada!<small>Conectando os adversários...</small></div>`;
  else if (S && S.active) {
    const t = Math.floor((Date.now() - S.t0) / 1000);
    html = `<div class="spin"></div><div class="st">Procurando partida... ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}<small>Fila padrão · ${humans(0).length} jogador(es) no grupo</small></div>`;
    if (host) { if (t >= 45) html += `<button class="btn" data-act="vsbots">Jogar contra bots (RR pela metade)</button>`; html += `<button class="btn ghost" data-act="cancelsearch">Cancelar</button>`; }
  } else {
    const pb = partyProblem();
    html = `<div class="st">${host ? 'Monte seu grupo (até 4) e busque uma partida' : 'Aguardando o líder do grupo buscar partida'}<small>${pb ? '⚠ ' + esc(pb) : 'Primeiro a 5 rounds · 4×4 vai pra prorrogação (vence quem abrir 2)'}</small></div>`;
    if (host) html += `<button class="btn big gold" data-act="search" ${pb ? 'disabled' : ''}>Buscar partida</button>`;
  }
  el.innerHTML = html;
}
setInterval(() => { if (App.screen === 'lobby' && App.kind === 'ranked' && App.search && App.search.active) renderRankedBar(); }, 1000);

async function startSearch() {
  if (App.role !== 'host' || App.search) return;
  const pb = partyProblem(); if (pb) return msg('#lob-msg', pb);
  try { await Queue.enter(App.code, humans(0)); } catch (e) { return msg('#lob-msg', 'Erro na fila: ' + e.message); }
  const S = App.search = { active: true, t0: Date.now(), unsub: null, iv: 0, hb: 0 };
  S.unsub = Queue.watch(App.code, d => {
    if (!App.search || !d || d.state !== 'matched' || S.claimer) return;
    // outro grupo nos encontrou: somos a sala da partida
    S.active = false; App.expect = humans(0).length + (d.guestSize || 1);
    $('.team-col.t1').style.display = ''; $('.vs').style.display = '';
    renderRankedBar(); broadcastLobby();
    setTimeout(() => { if (!App.inGame && App.expect) hostStart(); }, 20000);
  });
  S.iv = setInterval(async () => {
    if (!App.search || !S.active || S.busy) return;
    S.busy = true;
    try {
      const code = await Queue.tryMatch(App.code, (Date.now() - S.t0) / 1000);
      if (code) { S.claimer = true; S.active = false; goToMatch(code); }
    } catch (e) { console.warn(e); }
    S.busy = false;
  }, 2500);
  S.hb = setInterval(() => Queue.heartbeat(App.code), 15000);
  renderRankedBar(); broadcastLobby();
}
function stopSearch(del) {
  const S = App.search; if (!S) return;
  clearInterval(S.iv); clearInterval(S.hb); if (S.unsub) S.unsub();
  if (del) Queue.cancel(App.code);
  App.search = null;
}
function cancelSearch() { stopSearch(true); App.expect = 0; renderRankedBar(); broadcastLobby(); }
function rankedVsBots() { stopSearch(true); App.vsBots = true; hostStart(); }
// nosso grupo vai para a sala do outro grupo (lado Crepúsculo)
async function goToMatch(code) {
  stopSearch(true);
  App.tr.broadcast({ t: 'goto', code });
  await new Promise(r => setTimeout(r, 600));
  try { App.tr.close(); } catch (e) { }
  App.tr = null; App.moving = true; App.role = 'none';
  startJoin(code, { team: 1, kind: 'ranked' });
}

// ------------------------------------------------------------------
//  Início/fim de sala
// ------------------------------------------------------------------
function fillBots(slots) {
  const S = slots.map(s => ({ ...s }));
  const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
  const hm = S.filter(s => s.kind === 'human'), avg = hm.length ? Math.round(hm.reduce((a, s) => a + (s.mmr || 1000), 0) / hm.length) : 1000;
  let bid = 100;
  for (let i = 0; i < 8; i++) if (S[i].kind === 'empty') {
    const used = teamHunters(S, i < 4 ? 0 : 1), free = HUNTER_IDS.filter(h => !used.has(h));
    S[i] = { kind: 'bot', id: bid++, name: names.pop() + ' [bot]', hunter: free[(Math.random() * free.length) | 0], mmr: avg };
  }
  return S;
}
function hostStart() {
  if (App.role === 'client' || App.inGame) return;
  const mode = App.kind === 'training' ? 'training' : App.kind;
  if (App.search) stopSearch(true);
  if (App.kind === 'ranked') Queue.cancel(App.code);
  const S = fillBots(App.slots);
  if (App.role === 'host') App.tr.broadcast({ t: 'start', slots: S, mode, vsBots: !!App.vsBots });
  beginGame(S, mode, !!App.vsBots);
}
function leaveRoom() {
  if (App.search) stopSearch(true);
  if (App.tr) { try { App.tr.close(); } catch (e) { } }
  App.tr = null; App.role = 'none'; App.inGame = false; App.sim = null; App.cs = null; App.paused = false; App.expect = 0; App.vsBots = false;
  $('#pause').classList.remove('show');
  renderAcct();
  show('menu');
}
function playAgain() {
  if (App.matchMode === 'ranked') { leaveRoom(); startRankedParty(); return; }
  if (App.role === 'client') { show('lobby'); msg('#lob-msg', 'Aguardando o dono da sala...'); return; }
  App.inGame = false; App.sim = null; App.vsBots = false;
  App.slots = App.slots.map(s => s.kind === 'human' && (s.id === App.myId || [...App.peers.values()].some(p => p.id === s.id)) ? s : { kind: 'empty' });
  const me = App.slots[slotOf(App.myId)]; if (me) Object.assign(me, mySlotInfo());
  if (App.role === 'host') App.tr.broadcast({ t: 'tolobby', slots: App.slots });
  openLobby();
}

// ------------------------------------------------------------------
//  Cliente
// ------------------------------------------------------------------
function clientOnMsg(m) {
  switch (m.t) {
    case 'welcome': App.myId = m.id; App.kind = m.kind || App.kind; openLobby(); break;
    case 'full': leaveRoom(); msg('#menu-msg', m.why); break;
    case 'lobby':
      App.slots = m.slots; App.kind = m.kind || App.kind; App.expect = m.expect || 0;
      App.search = m.search ? Object.assign(App.search || {}, m.search) : null;
      if (!App.inGame && App.screen === 'lobby') { $('.team-col.t1').style.display = App.kind === 'ranked' && !App.expect ? 'none' : ''; $('.vs').style.display = $('.team-col.t1').style.display; renderLobby(); renderRankedBar(); }
      break;
    case 'tolobby': App.slots = m.slots; if (App.screen === 'end' || App.screen === 'game' || App.screen === 'lobby') openLobby(); break;
    case 'goto': // o líder do grupo achou partida em outra sala
      App.moving = true; App.search = null;
      try { App.tr.close(); } catch (e) { }
      App.tr = null; App.role = 'none';
      setTimeout(() => startJoin(m.code, { team: 1, kind: 'ranked' }), 900);
      break;
    case 'start': beginGame(m.slots, m.mode || 'standard', !!m.vsBots); break;
    case 's':
      if (!App.cs) return;
      App.cs.apply(m, App.myId);
      handleEvents(m.E, App.cs);
      break;
  }
}
function clientOnClose() { if (App.role !== 'client' || App.moving) return; leaveRoom(); msg('#menu-msg', 'Conexão com a sala perdida (o dono saiu?).'); }

// ------------------------------------------------------------------
//  Partida
// ------------------------------------------------------------------
let hostLast = 0;
function beginGame(slots, mode, vsBots) {
  App.slots = slots.map(s => ({ ...s }));
  App.matchMode = mode; App.vsBots = vsBots; App.expect = 0;
  App.inGame = true; App.ended = false; App.paused = false; App.pending = []; App.acc = 0; App.ticks = 0; hostLast = 0; App.recorded = null;
  if (App.role === 'client') { App.sim = null; App.cs = new ClientState(slots); }
  else { App.sim = new Sim(slots, { mode }); App.cs = null; handleEvents(App.sim.drainEvents(), App.sim); }
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
const mouse = { sx: 0, sy: 0, wx: 0, wy: 0 };
let binding = null; // { action, slot } enquanto espera uma tecla nova
function finishBind(code) { if (!binding) return; setBind(binding.action, binding.slot, code); binding = null; renderSettings(); buildHudLabels(); }
addEventListener('keydown', e => {
  if (binding) {
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { binding = null; renderSettings(); }
    else finishBind(e.code === 'Backspace' || e.code === 'Delete' ? '' : e.code);
    return;
  }
  if (e.target.tagName === 'INPUT') {
    if (e.key === 'Enter' && e.target.id === 'in-code') startJoin();
    if (e.key === 'Enter' && (e.target.id === 'nk-name' || e.target.id === 'nk-tag')) confirmNick();
    return;
  }
  if (e.code === 'Escape' && $('#set-modal').classList.contains('show')) { closeSettings(); return; }
  Down.add(e.code);
  if (App.screen === 'game') {
    const a = actionOf(e.code);
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || a) e.preventDefault();
    if (a === 'score') { $('#tabboard').classList.add('show'); buildTab(); }
    if (a === 'fps' && !e.repeat) { Settings.fps = !Settings.fps; saveSettings(); }
    if (e.code === 'Escape') togglePause();
    if (e.code === 'KeyM' && !a) { const on = SFX.toggle(); Settings.sound = on; saveSettings(); flashBanner(on ? 'Som ligado' : 'Som desligado', '', 800); }
  }
}, true);
addEventListener('keyup', e => { Down.delete(e.code); if (actionOf(e.code) === 'score') $('#tabboard').classList.remove('show'); });
addEventListener('blur', () => Down.clear());
$('#scr-game').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('contextmenu', e => { if (binding) e.preventDefault(); });
addEventListener('mousemove', e => { mouse.cx = e.clientX; mouse.cy = e.clientY; });
addEventListener('mousedown', e => {
  if (binding && e.target.closest('.kb.wait')) { e.preventDefault(); finishBind('Mouse' + e.button); return; }
  if (App.screen !== 'game' || App.paused || e.target.closest('#swap,#pause,.modal,#friends')) return;
  SFX.init(); Down.add('Mouse' + e.button);
  if (e.button === 1) e.preventDefault();
}, true);
addEventListener('mouseup', e => Down.delete('Mouse' + e.button));
function togglePause(v) { App.paused = v ?? !App.paused; $('#pause').classList.toggle('show', App.paused); if (App.paused) Down.clear(); }
function readInput() {
  const z = R.cam.z || 1;
  mouse.sx = (mouse.cx || 0) * R.dpr; mouse.sy = (mouse.cy || 0) * R.dpr;
  mouse.wx = R.cam.x + (mouse.sx - canvas.width / 2) / z;
  mouse.wy = R.cam.y + (mouse.sy - canvas.height / 2) / z;
  const b = App.paused || $('#set-modal').classList.contains('show');
  const A = a => !b && actionDown(a);
  return {
    mx: (A('right') ? 1 : 0) - (A('left') ? 1 : 0), my: (A('down') ? 1 : 0) - (A('up') ? 1 : 0),
    ax: Math.round(mouse.wx), ay: Math.round(mouse.wy),
    fire: A('basic'), q: A('q'), e: A('e'), r: A('r'), dash: A('dash'),
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
      case 'aurora': case 'ward': if (near(e.x, e.y)) SFX.play('aurora'); break;
      case 'bell': if (near(e.x, e.y)) SFX.play('shield'); break;
      case 'zap': if (near(e.x1, e.y1)) SFX.play('hit', 80); break;
      case 'parry': if (near(e.x, e.y)) SFX.play('block'); break;
      case 'pull': if (near(e.x, e.y)) SFX.play('hook'); break;
      case 'revive': { const p = pl(e.id); SFX.play('revive'); if (p) feed(`${nameTag(p, me)} foi revivido`); break; }
      case 'death': {
        const v = pl(e.id), k = pl(e.by);
        SFX.play('death', 0);
        if (v) feed(k ? `${nameTag(k, me)} <span style="color:#fff">✕</span> ${nameTag(v, me)}` : `${nameTag(v, me)} sucumbiu à Névoa`);
        break;
      }
      case 'round': {
        SFX.play('round', 0);
        const sub = (e.night ? 'NOITE · a visão vira um cone' : 'DIA · visão aberta');
        flashBanner(e.ot ? 'PRORROGAÇÃO' : e.dec ? 'ROUND DECISIVO' : 'ROUND ' + e.n, e.ot || e.dec ? `Round ${e.n} · ${sub}` : sub, 2200);
        break;
      }
      case 'fight': flashBanner('LUTEM!', '', 900); SFX.play('tick', 0); break;
      case 'swap': {
        const p = pl(e.id); if (!p) break;
        if (p.team === me.team) feed(`${nameTag(p, me)} trocou para <b style="color:${CLASSES[HUNTERS[e.h].classe].cor}">${HUNTERS[e.h].nome}</b>`);
        if (e.id === me.id) { App.myHunter = e.h; try { localStorage.setItem('ruptura-hunter', e.h); } catch (x) { } SFX.play('cast', 0); }
        App.hudDirty = true; App.swapSig = '';
        break;
      }
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
        recordMatch(S, won);
        setTimeout(() => { if (App.inGame) showEnd(S, won); }, 2800);
        break;
      }
    }
  }
}
function nameTag(p, me) { const c = p.id === me.id ? 'self' : p.team === me.team ? 'ally' : 'enemy'; return `<span class="${c}">${esc(displayName(p, me))}</span>`; }
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

// registra o resultado no perfil (XP, estatísticas, RR)
function recordMatch(S, won) {
  const me = meP(S); if (!me || App.recorded) return;
  const myTeam = S.players.filter(p => p.team === me.team), opp = S.players.filter(p => p.team !== me.team);
  const score = p => p.dmg + p.heal * 0.8 + p.kills * 150;
  const avg = myTeam.reduce((a, p) => a + score(p), 0) / myTeam.length || 1;
  const slotMMR = id => { const s = App.slots.find(q => q.id === id); return s && s.mmr || 1000; };
  const r = {
    mode: App.matchMode, won, my: S.score[me.team], opp: S.score[1 - me.team], hunter: me.hunter,
    kills: me.kills, deaths: me.deaths, dmg: me.dmg, heal: me.heal, perf: score(me) / avg,
    oppMMR: opp.reduce((a, p) => a + slotMMR(p.id), 0) / opp.length, vsBots: App.vsBots || opp.every(p => p.bot),
  };
  App.recorded = Account.record(r);
}

// ------------------------------------------------------------------
//  HUD (elementos guardados e só atualizados quando mudam)
// ------------------------------------------------------------------
let HUD = null;
function buildHud() {
  const S = state(), me = meP(S);
  $('#hud-code').textContent = (MODE_NAME[App.matchMode] || '') + (App.role === 'host' || App.role === 'client' ? ` · Sala ${codeText(App.code)}` : '');
  for (const t of [0, 1]) {
    const box = $('#ros' + t); box.innerHTML = '';
    for (const p of S.players.filter(q => q.team === t)) { const d = document.createElement('div'); d.dataset.id = p.id; d.title = displayName(p, me); d.appendChild(portrait(p.hunter, 60)); box.appendChild(d); }
  }
  $('#feed').innerHTML = '';
  HUD = { ab: [], last: {}, ros: [...$$('.ros div')], hp: $('#me-hp'), sh: $('#me-sh'), hpt: $('#me-hptxt'), spec: $('#spectate'), sc0: $('#sc0'), sc1: $('#sc1'), rd: $('#hud-round'), tm: $('#hud-timer'), fps: $('#fps') };
  if (!me) return;
  const H = HUNTERS[me.hunter];
  const mp = $('#me-port').getContext('2d'); mp.clearRect(0, 0, 84, 84); mp.drawImage(hunterPortrait(me.hunter, 84), 0, 0);
  $('#me-name').innerHTML = `${esc(me.name)} <span style="color:${CLASSES[H.classe].cor};font-size:13px">· ${H.nome}</span>`;
  const ab = $('#abil'); ab.innerHTML = '';
  const defs = [['basic', 'basico'], ['q', 'q'], ['e', 'e'], ['r', 'r'], ['dash', null]];
  defs.forEach(([key, hk], i) => {
    const label = keyShort(Settings.binds[key][0] || Settings.binds[key][1] || '');
    const d = document.createElement('div'); d.className = 'ab' + (key === 'r' ? ' ult' : '');
    const col = key === 'dash' ? '#d8f0ff' : CLASSES[H.classe].cor;
    const name = hk ? H.habilidades[hk].nome : 'Esquiva';
    d.innerHTML = `<span class="ic" style="color:${col}">${key === 'dash' ? '»' : ICONS[me.hunter][i]}</span><span class="k" data-k="${key}">${label}</span><div class="cdv"></div><div class="cdt"></div>`;
    d.title = name + (hk ? ' — ' + H.habilidades[hk].desc : '');
    ab.appendChild(d);
    HUD.ab.push({ key, el: d, cdv: d.querySelector('.cdv'), cdt: d.querySelector('.cdt'), max: key === 'dash' ? DASH_CD : key === 'basic' ? H.habilidades.basico.cd : H.habilidades[key].cd, p: -1, t: null, rdy: null });
  });
}
// painel de troca entre rounds
function requestSwap(h) {
  if (App.role === 'client') App.tr.send({ t: 'swap', hunter: h });
  else if (App.sim) App.sim.requestSwap(App.myId, h);
}
function updateSwap(S, me) {
  const el = $('#swap');
  const open = me && !App.ended && (S.phase === 'roundEnd' || S.phase === 'countdown') && App.screen === 'game';
  el.classList.toggle('show', !!open);
  if (!open) { App.swapSig = ''; return; }
  const left = S.phase === 'roundEnd' ? S.phaseT + 3 : S.phaseT;
  setText($('#swap-t'), 'swapt', `${Math.max(0, Math.ceil(left))}s · não repete no time`);
  const used = new Set(S.players.filter(p => p.team === me.team && p.id !== me.id).map(p => p.hunter));
  const sig = me.hunter + '|' + [...used].sort().join(',');
  if (sig === App.swapSig) return;
  App.swapSig = sig;
  const L = $('#swap-list'); L.innerHTML = '';
  for (const h of HUNTER_IDS) {
    const H = HUNTERS[h], C = CLASSES[H.classe];
    const d = document.createElement('div');
    d.className = 'sw' + (h === me.hunter ? ' cur' : '') + (used.has(h) ? ' taken' : '');
    d.title = `${H.nome} — ${C.nome}`;
    d.appendChild(portrait(h, 116));
    d.insertAdjacentHTML('beforeend', `<span class="cl" style="color:${C.cor}">${C.icone}</span><span>${H.nome}</span>`);
    d.onclick = () => { SFX.init(); requestSwap(h); };
    L.appendChild(d);
  }
}
function setText(el, key, v) { if (HUD.last[key] !== v) { HUD.last[key] = v; el.textContent = v; } }
let hudT = 0;
function updateHud(S, me, dt) {
  if (App.hudDirty) { App.hudDirty = false; buildHud(); }
  const showCur = App.paused || !me || !me.alive || $('#swap').classList.contains('show') || App.screen !== 'game';
  if (App._cur !== showCur) { App._cur = showCur; $('#scr-game').classList.toggle('showcur', showCur); }
  if (!HUD) return;
  updateSwap(S, me);
  if (me) {
    for (const a of HUD.ab) {
      const cd = me.cd[a.key] || 0;
      const p = cd > 0 ? Math.round(Math.min(100, cd / a.max * 100)) : 0;
      if (p !== a.p) { a.p = p; a.cdv.style.setProperty('--p', p + '%'); }
      const t = cd > 0.05 && a.key !== 'basic' ? (cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd))) : '';
      if (t !== a.t) { a.t = t; a.cdt.textContent = t; }
      const r = cd <= 0; if (r !== a.rdy) { a.rdy = r; a.el.classList.toggle('ready', r); }
    }
    const tot = Math.max(me.maxHp, me.hp + me.shield);
    const hpw = Math.round(me.hp / tot * 1000) / 10, shw = Math.round(me.shield / tot * 1000) / 10;
    if (HUD.last.hpw !== hpw || HUD.last.shw !== shw) { HUD.last.hpw = hpw; HUD.last.shw = shw; HUD.hp.style.width = hpw + '%'; HUD.sh.style.left = hpw + '%'; HUD.sh.style.width = shw + '%'; }
    setText(HUD.hpt, 'hpt', `${Math.ceil(me.hp)} / ${me.maxHp}` + (me.shield > 0 ? ` (+${Math.ceil(me.shield)})` : ''));
    setText(HUD.spec, 'spec', !me.alive && S.phase === 'fight' ? (me.revive > 0 ? 'Um aliado está te revivendo...' : 'Você caiu! Um aliado pode te reviver na sua alma.') : '');
  }
  hudT -= dt;
  if (hudT > 0) return; hudT = 0.1;
  setText(HUD.sc0, 'sc0', String(S.score[0])); setText(HUD.sc1, 'sc1', String(S.score[1]));
  const ot = App.matchMode === 'ranked' && S.score[0] >= WIN_ROUNDS - 1 && S.score[1] >= WIN_ROUNDS - 1;
  setText(HUD.rd, 'rd', (ot ? 'PRORROGAÇÃO · ' : 'ROUND ') + S.round + (S.night ? ' · NOITE' : ' · DIA'));
  let tm;
  if (S.phase === 'countdown') tm = String(Math.ceil(S.phaseT));
  else { const t = Math.floor(S.fightT); tm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
  setText(HUD.tm, 'tm', tm);
  if (S.phase === 'countdown' && S.phaseT < 3) {
    const n = Math.ceil(S.phaseT);
    if (n !== App.lastCount) { App.lastCount = n; if (n <= 3 && n > 0) SFX.play('tick', 0); }
  }
  for (const d of HUD.ros) { const p = S.players.find(q => q.id == d.dataset.id); if (p) { const dead = !p.alive; if (d._dead !== dead) { d._dead = dead; d.classList.toggle('dead', dead); } } }
  HUD.fps.style.display = Settings.fps ? 'block' : 'none';
  if (Settings.fps) setText(HUD.fps, 'fps', `${Math.round(perf.fps)} FPS · ${QUALITY[curQ].name}`);
}
function buildTab() {
  const S = state(); if (!S) return;
  const me = meP(S);
  let h = '<table><tr><th>Time</th><th>Jogador</th><th>Caçador</th><th>Abates</th><th>Mortes</th><th>Dano</th><th>Cura</th></tr>';
  for (const p of S.players.slice().sort((a, b) => a.team - b.team || b.kills - a.kills))
    h += `<tr style="${me && p.id === me.id ? 'color:var(--gold)' : ''}"><td style="color:${TEAMS[p.team].main}">${TEAMS[p.team].name}</td><td>${esc(displayName(p, me))}</td><td>${HUNTERS[p.hunter].nome}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg)}</td><td>${Math.round(p.heal)}</td></tr>`;
  $('#tabboard').innerHTML = h + '</table>';
}
async function showEnd(S, won) {
  App.inGame = false;
  const t = $('#end-title'); t.textContent = won ? 'VITÓRIA' : 'DERROTA'; t.className = won ? 'win' : 'lose';
  $('#end-sub').textContent = `${MODE_NAME[App.matchMode]} · ${TEAMS[0].name} ${S.score[0]} × ${S.score[1]} ${TEAMS[1].name}`;
  const me = meP(S);
  let h = '<tr><th>TIME</th><th>JOGADOR</th><th>CAÇADOR</th><th>ABATES</th><th>MORTES</th><th>DANO</th><th>CURA</th></tr>';
  for (const p of S.players.slice().sort((a, b) => a.team - b.team || b.dmg - a.dmg))
    h += `<tr class="${me && p.id === me.id ? 'mine' : ''}"><td class="tm${p.team}">${TEAMS[p.team].name}</td><td>${esc(displayName(p, me))}</td><td>${HUNTERS[p.hunter].nome}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg)}</td><td>${Math.round(p.heal)}</td></tr>`;
  $('#end-table').innerHTML = h;
  $('#btn-again').textContent = App.matchMode === 'ranked' ? 'Nova ranqueada' : App.role === 'client' ? 'Voltar ao lobby' : 'Jogar de novo';
  $('#end-rewards').innerHTML = '<div class="hint">Salvando progresso...</div>';
  show('end');
  const out = App.recorded ? await App.recorded : null;
  if (!out) { $('#end-rewards').innerHTML = ''; return; }
  const P = Account.profile;
  let html = `<div class="rw"><b>+${out.xp} XP</b><span>NÍVEL ${P.level}${out.levels ? ' · SUBIU!' : ''}</span><div class="bar xp"><i style="width:${P.xp / xpNeed(P.level) * 100}%"></i></div></div>`;
  if (App.matchMode === 'ranked') {
    if (out.placement) html += `<div class="rw"><b>Colocação ${out.placement}/5</b><span>${out.placed ? 'RANQUE DEFINIDO!' : 'PARTIDAS DE COLOCAÇÃO'}</span></div>`;
    else html += `<div class="rw"><b class="${out.rr >= 0 ? 'win' : 'loss'}">${out.rr >= 0 ? '+' : ''}${out.rr} RR</b><span>${P.rr} / 100 RR${App.vsBots ? ' · contra bots' : ''}</span><div class="bar rr"><i style="width:${Math.min(100, P.rr)}%"></i></div></div>`;
    if (P.rank >= 0) {
      const changed = out.rankAfter !== out.rankBefore;
      html += `<div class="rw" id="rw-rank"><span>${changed ? (out.rankAfter > out.rankBefore ? 'PROMOVIDO!' : 'REBAIXADO') : 'RANQUE'}</span><b style="font-size:18px">${rankName(P.rank)}</b></div>`;
    }
  }
  if (out.saved === false) html += `<div class="hint">Não consegui salvar: ${esc(out.err)}</div>`;
  $('#end-rewards').innerHTML = html;
  const rw = $('#rw-rank'); if (rw) rw.prepend(rankCanvas(P.rank, 140));
}

// ------------------------------------------------------------------
//  Perfil, configurações, codex
// ------------------------------------------------------------------
function buildProfile() {
  const P = Account.profile; if (!P) return;
  const s = P.stats, wr = s.matches ? Math.round(s.wins / s.matches * 100) : 0;
  const lock = P.level < window.RANKED_MIN_LEVEL;
  let rankLine;
  if (P.rank >= 0) rankLine = `<div class="prof-rank">${rankName(P.rank)}</div><div class="bar rr"><i style="width:${Math.min(100, P.rr)}%"></i></div><div class="hint">${P.rank >= RANK_MAX ? P.rr + ' RR' : P.rr + ' / 100 RR'} · pico: ${rankName(P.peak)}</div>`;
  else if (lock) rankLine = `<div class="prof-rank">Ranqueada bloqueada</div><div class="hint">Libera no nível ${window.RANKED_MIN_LEVEL} de conta.</div>`;
  else rankLine = `<div class="prof-rank">Sem ranque</div><div class="hint">Partidas de colocação: ${P.placements}/5</div>`;
  let html = `<div class="prof-top"><div id="pf-emb"></div><div><div class="prof-name">${esc(P.name)}${P.tag ? ` <span style="color:var(--dim);font-size:22px">#${esc(P.tag)}</span>` : ''}</div>${Account.logged ? '<button class="btn ghost" data-act="editnick" style="padding:5px 10px;font-size:12px;margin:4px 0">Alterar ID</button>' : ''}${rankLine}</div>
    <div style="min-width:220px"><div class="lbl">Nível de conta</div><div style="font-size:30px;font-weight:800">${P.level}</div><div class="bar xp"><i style="width:${P.xp / xpNeed(P.level) * 100}%"></i></div><div class="hint">${P.xp} / ${xpNeed(P.level)} XP</div>
    <div class="hint" style="margin-top:6px">${Account.logged ? 'Conta Google conectada' : Account.enabled ? 'Convidado — entre com Google no menu para salvar na conta' : 'Convidado (progresso salvo só neste navegador)'}</div></div></div>`;
  html += `<div class="grid-stats"><div><b>${s.matches}</b><span>PARTIDAS</span></div><div><b>${s.wins}</b><span>VITÓRIAS</span></div><div><b>${wr}%</b><span>% VITÓRIA</span></div><div><b>${s.kills}</b><span>ABATES</span></div><div><b>${s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills}</b><span>K/D</span></div><div><b>${s.matches ? Math.round(s.dmg / s.matches) : 0}</b><span>DANO/PARTIDA</span></div></div>`;
  html += `<div class="lbl" style="margin-top:8px">Caçadores</div><table class="ptable"><tr><th>CAÇADOR</th><th>PARTIDAS</th><th>VITÓRIAS</th><th>ABATES</th></tr>`;
  for (const h of HUNTER_IDS) { const x = P.hunters[h] || { m: 0, w: 0, k: 0 }; html += `<tr><td style="color:${CLASSES[HUNTERS[h].classe].cor}">${HUNTERS[h].nome}</td><td>${x.m}</td><td>${x.w}</td><td>${x.k}</td></tr>`; }
  html += `</table><div class="lbl" style="margin-top:14px">Últimas partidas</div><table class="ptable"><tr><th>MODO</th><th>RESULTADO</th><th>PLACAR</th><th>CAÇADOR</th><th>K/D</th><th>RR</th></tr>`;
  if (!P.history.length) html += `<tr><td colspan="6" class="hint">Nenhuma partida ainda</td></tr>`;
  for (const m of P.history) html += `<tr><td>${MODE_NAME[m.mode] || m.mode}</td><td class="${m.won ? 'win' : 'loss'}">${m.won ? 'Vitória' : 'Derrota'}</td><td>${m.sc[0]} × ${m.sc[1]}</td><td>${HUNTERS[m.h] ? HUNTERS[m.h].nome : ''}</td><td>${m.k}/${m.d}</td><td>${m.mode === 'ranked' ? (m.pl ? `Col. ${m.pl}/5` : (m.rr >= 0 ? '+' : '') + m.rr) : '—'}</td></tr>`;
  html += `</table><div class="lbl" style="margin-top:14px">Elos da Ranqueada · Arena 4v4</div><div class="ladder" id="pf-ladder"></div>`;
  $('#profile-body').innerHTML = html;
  $('#pf-emb').appendChild(rankCanvas(P.rank, 260));
  const lad = $('#pf-ladder');
  for (let i = 0; i <= RANK_MAX; i++) { const d = document.createElement('div'); if (i === P.rank) d.className = 'cur'; d.appendChild(rankCanvas(i, 88)); d.insertAdjacentHTML('beforeend', `<span>${rankName(i)}</span>`); lad.appendChild(d); }
}
// ------------------------------------------------------------------
//  Configurações (janela com abas)
// ------------------------------------------------------------------
let setTab = 'video';
function openSettings() { binding = null; $('#set-modal').classList.add('show'); renderSettings(); }
function closeSettings() { binding = null; $('#set-modal').classList.remove('show'); }
function buildHudLabels() { for (const el of $$('.ab .k')) { const k = el.dataset.k; el.textContent = keyShort(Settings.binds[k][0] || Settings.binds[k][1] || ''); } }
function toggleRow(id, label, sub) {
  return `<div class="set-row"><span class="lbl2">${label}${sub ? `<small>${sub}</small>` : ''}</span><label class="switch"><input type="checkbox" data-set="${id}" ${Settings[id] ? 'checked' : ''}><i></i></label></div>`;
}
function renderSettings() {
  for (const b of $$('#set-tabs button')) { b.classList.toggle('on', b.dataset.tab === setTab); b.onclick = () => { setTab = b.dataset.tab; binding = null; renderSettings(); }; }
  const B = $('#set-body'); let h = '';
  if (setTab === 'video') {
    h += `<div class="set-row"><span class="lbl2">Qualidade gráfica<small>Atual: ${QUALITY[curQ].name}${Settings.quality === 'auto' ? ' (automático)' : ''}</small></span><div class="seg">${['auto', 'alta', 'media', 'baixa'].map(q => `<button data-q="${q}" class="${Settings.quality === q ? 'on' : ''}">${q === 'auto' ? 'Auto' : QUALITY[q].name}</button>`).join('')}</div></div>`;
    h += `<p class="hint" style="margin:6px 0">Se travar, use Média ou Baixa. No Auto o jogo baixa a qualidade sozinho quando o PC sofre.</p>`;
    h += toggleRow('smooth', 'Movimento suave', 'Interpola entre os quadros da simulação (deixa tudo mais liso)');
    h += toggleRow('fps', 'Mostrar FPS', `Atalho: ${keyLabel(Settings.binds.fps[0])}`);
    h += toggleRow('shake', 'Tremor de tela', 'Em explosões e quando você leva dano');
    h += toggleRow('dmgNumbers', 'Números de dano e cura');
    h += toggleRow('names', 'Nomes acima dos caçadores');
  } else if (setTab === 'audio') {
    h += `<div class="set-row"><span class="lbl2">Volume geral</span><span><input type="range" min="0" max="100" value="${Settings.volume}" data-range="volume"> <b id="vol-v">${Settings.volume}%</b></span></div>`;
    h += toggleRow('sound', 'Som ligado', 'Atalho na partida: M');
  } else if (setTab === 'controls') {
    h += `<p class="hint">Clique numa tecla e aperte a nova (vale botão do mouse também). <b>Esc</b> cancela, <b>Backspace</b> apaga. Se a tecla já estiver em outra ação, ela sai de lá.</p><table class="kb-table">`;
    let grp = '';
    for (const a of ACTIONS) {
      if (a.grupo !== grp) { grp = a.grupo; h += `<tr><td colspan="3" style="color:var(--gold);font-size:12px;letter-spacing:1.5px;padding-top:12px">${grp.toUpperCase()}</td></tr>`; }
      const cell = slot => { const c = Settings.binds[a.id][slot]; const w = binding && binding.action === a.id && binding.slot === slot; return `<td><button class="kb ${w ? 'wait' : ''} ${c ? '' : 'empty'}" data-bind="${a.id}" data-slot="${slot}">${w ? 'Aperte uma tecla...' : keyLabel(c)}</button></td>`; };
      h += `<tr><td>${a.nome}${a.dica ? `<small>${a.dica}</small>` : ''}</td>${cell(0)}${cell(1)}</tr>`;
    }
    h += `<tr><td>Pausa<small>fixo</small></td><td colspan="2" class="hint">Esc</td></tr></table><div class="set-foot"><span></span><button class="btn ghost" data-reset="binds">Restaurar padrão</button></div>`;
  } else if (setTab === 'privacy') {
    h += `<p class="hint" style="margin-bottom:4px">"Grupo" é o seu time na partida. Igual ao Valorant.</p>`;
    h += toggleRow('hideName', 'Ocultar meu nome para quem não é do meu grupo', 'Os adversários veem o nome do seu caçador em vez do seu ID');
    h += toggleRow('genericNames', 'Usar nomes genéricos para quem não é do meu grupo', 'Você vê os adversários pelo nome do caçador (bom pra live)');
    h += toggleRow('streamer', 'Modo streamer: esconder código da sala', 'O código aparece como ••••• (use o botão Copiar código para passar aos amigos)');
  } else if (setTab === 'game') {
    h += toggleRow('lookahead', 'Câmera acompanha a mira', 'A câmera puxa um pouco na direção do mouse');
    h += `<div class="set-row"><span class="lbl2">Conexão das salas<small>Local serve só para testar com várias abas no mesmo PC</small></span><div class="seg">${['online', 'local'].map(n => `<button data-net="${n}" class="${Settings.net === n ? 'on' : ''}">${n === 'online' ? 'Online' : 'Local (teste)'}</button>`).join('')}</div></div>`;
    h += `<div class="set-foot"><span class="hint">Configurações ficam salvas neste navegador.</span><button class="btn ghost" data-reset="all">Restaurar tudo</button></div>`;
  }
  B.innerHTML = h;
  for (const b of B.querySelectorAll('[data-q]')) b.onclick = () => { Settings.quality = b.dataset.q; saveSettings(); applyQuality(b.dataset.q === 'auto' ? 'alta' : b.dataset.q); renderSettings(); };
  for (const b of B.querySelectorAll('[data-net]')) b.onclick = () => { Settings.net = b.dataset.net; saveSettings(); renderSettings(); };
  for (const c of B.querySelectorAll('[data-set]')) c.onchange = () => {
    const k = c.dataset.set; Settings[k] = c.checked; saveSettings();
    if (k === 'sound' && SFX.on !== c.checked) SFX.toggle();
    applyGameplaySettings();
    if (k === 'streamer') { if (App.screen === 'lobby') openLobby(); $('#in-code').type = Settings.streamer ? 'password' : 'text'; renderFriends(); renderToasts(); }
    if (k === 'genericNames' || k === 'hideName') { if (App.screen === 'lobby') renderLobby(); App.hudDirty = true; }
    if (k === 'hideName' && App.role !== 'none' && !App.inGame) { const me = App.slots[slotOf(App.myId)]; if (me && App.role === 'host') { me.hide = Settings.hideName; broadcastLobby(); renderLobby(); } }
  };
  for (const r of B.querySelectorAll('[data-range]')) r.oninput = () => { Settings.volume = +r.value; $('#vol-v').textContent = r.value + '%'; SFX.setVolume(Settings.volume / 100); saveSettings(); };
  for (const k of B.querySelectorAll('[data-bind]')) k.onclick = e => { if (binding) return; binding = { action: k.dataset.bind, slot: +k.dataset.slot }; renderSettings(); };
  for (const b of B.querySelectorAll('[data-reset]')) b.onclick = () => {
    if (b.dataset.reset === 'binds') Settings.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    else { const keep = Settings.binds; Object.assign(Settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS))); Settings.binds = keep; applyQuality('alta'); SFX.setVolume(Settings.volume / 100); if (!SFX.on) SFX.toggle(); applyGameplaySettings(); }
    saveSettings(); renderSettings(); buildHudLabels();
  };
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

// ------------------------------------------------------------------
//  ID Nome#TAG
// ------------------------------------------------------------------
function openNick(forced) {
  const P = Account.profile;
  $('#nk-name').value = P.nickSet ? P.name : (P.name || '');
  $('#nk-tag').value = P.nickSet ? P.tag : randomTag();
  $('#nk-cancel').style.display = forced ? 'none' : '';
  msg('#nk-msg', ''); nickPreview();
  $('#nick-modal').classList.add('show');
  setTimeout(() => $('#nk-name').focus(), 50);
}
function nickPreview() {
  const n = $('#nk-name').value.trim(), t = $('#nk-tag').value.trim();
  $('#nk-prev').innerHTML = n ? `${esc(n)} <small>#${esc(t)}</small>` : '';
}
$('#nk-name').addEventListener('input', nickPreview);
$('#nk-tag').addEventListener('input', () => { $('#nk-tag').value = $('#nk-tag').value.replace(/[^A-Za-z0-9]/g, ''); nickPreview(); });
async function confirmNick() {
  msg('#nk-msg', 'Salvando...');
  try { await Account.claimNick($('#nk-name').value, $('#nk-tag').value); $('#nick-modal').classList.remove('show'); msg('#nk-msg', ''); }
  catch (e) { msg('#nk-msg', e.message); }
}

// ------------------------------------------------------------------
//  Amigos e convites
// ------------------------------------------------------------------
Account.onSocial(() => { renderFriends(); renderToasts(); });
function friendStatus(f) {
  const p = f.pres;
  if (!p || Date.now() - p.t > 75000) return { cls: '', txt: 'Offline' };
  if (p.status === 'jogo') return { cls: 'game', txt: 'Em partida' };
  if (p.status === 'sala' && p.room) return { cls: 'on', txt: `Em sala · ${p.room}`, room: p.room };
  return { cls: 'on', txt: 'Online no menu' };
}
function renderFriends() {
  const n = Account.incoming.length;
  $('#fr-badge').textContent = n ? String(n) : '';
  if (!$('#friends').classList.contains('show')) return;
  $('#fr-me').innerHTML = Account.logged ? `Seu ID: <b>${esc(Account.fullId)}</b><br>Passe ele para seus amigos te adicionarem.` : '';
  const canInvite = (App.role === 'host' || App.role === 'client') && App.net === 'online' && App.screen === 'lobby';
  let h = '';
  if (Account.incoming.length) {
    h += '<h4>PEDIDOS RECEBIDOS</h4>';
    for (const r of Account.incoming) h += `<div class="fr"><div class="fi"><div class="fn">${esc(r.fromName)} <small>#${esc(r.fromTag)}</small></div></div><button class="btn gold" data-act="fraccept" data-id="${r.id}">Aceitar</button><button class="btn ghost" data-act="frdecline" data-id="${r.id}">✕</button></div>`;
  }
  const order = { game: 1, on: 0, '': 2 };
  const fr = Account.friends.map(f => ({ f, s: friendStatus(f) })).sort((a, b) => order[a.s.cls] - order[b.s.cls] || a.f.name.localeCompare(b.f.name));
  h += `<h4>AMIGOS (${fr.length})</h4>`;
  if (!fr.length) h += '<div class="hint">Adicione amigos pelo ID Nome#TAG.</div>';
  for (const { f, s } of fr) {
    let btns = '';
    if (s.room && s.room !== App.code) btns += `<button class="btn gold" data-act="frjoin" data-code="${esc(s.room)}">Entrar</button>`;
    if (s.room) s.txt = s.txt.replace(s.room, codeText(s.room));
    if (canInvite && s.cls && s.cls !== 'game') btns += `<button class="btn" data-act="frinvite" data-uid="${f.uid}">Convidar</button>`;
    btns += `<button class="btn ghost" data-act="frremove" data-id="${f.req}" title="Remover amigo">✕</button>`;
    h += `<div class="fr"><span class="dot ${s.cls}"></span><div class="fi"><div class="fn">${esc(f.name)} <small>#${esc(f.tag)}</small></div><div class="fs">${s.txt}</div></div>${btns}</div>`;
  }
  if (Account.outgoing.length) {
    h += '<h4>PEDIDOS ENVIADOS</h4>';
    for (const r of Account.outgoing) h += `<div class="fr"><div class="fi"><div class="fn">${esc(r.toName)} <small>#${esc(r.toTag)}</small></div><div class="fs">Aguardando resposta</div></div><button class="btn ghost" data-act="frdecline" data-id="${r.id}">Cancelar</button></div>`;
  }
  $('#fr-list').innerHTML = h;
}
async function addFriend() {
  msg('#fr-msg', '...');
  try { const r = await Account.addFriend($('#fr-add').value); $('#fr-add').value = ''; msg('#fr-msg', ''); $('#fr-msg').innerHTML = `<span style="color:#7dff95">${esc(r)}</span>`; }
  catch (e) { msg('#fr-msg', e.message); }
}
$('#fr-add').addEventListener('keydown', e => { if (e.key === 'Enter') addFriend(); });
async function inviteFriend(uid, btn) {
  const f = Account.friends.find(x => x.uid === uid); if (!f) return;
  try { await Account.invite(f, App.code); btn.textContent = 'Convidado ✓'; btn.disabled = true; } catch (e) { msg('#fr-msg', e.message); }
}
function joinFriendRoom(code) {
  if (App.inGame) return;
  if (App.role !== 'none') leaveRoom();
  $('#friends').classList.remove('show');
  readName(); App.net = 'online';
  startJoin(code);
}
const seenInv = new Set();
function renderToasts() {
  const box = $('#toasts'); box.innerHTML = '';
  for (const i of Account.invites) {
    if (!seenInv.has(i.id + i.t)) { seenInv.add(i.id + i.t); SFX.play('round', 0); }
    const d = document.createElement('div'); d.className = 'toast';
    d.innerHTML = `<span>${esc(i.fromName)}<small style="color:var(--dim)">#${esc(i.fromTag)}</small> te convidou pra sala <b style="color:var(--gold)">${esc(codeText(i.code))}</b></span><button class="btn gold" data-act="invjoin" data-id="${i.id}">Entrar</button><button class="btn ghost" data-act="invclose" data-id="${i.id}">✕</button>`;
    box.appendChild(d);
  }
}
function acceptInvite(id) {
  const i = Account.invites.find(x => x.id === id); if (!i) return;
  Account.dropInvite(i);
  if (App.inGame) return;
  joinFriendRoom(i.code);
}

// ------------------------------------------------------------------
//  Partida de demonstração no fundo do menu
// ------------------------------------------------------------------
function newDemo() {
  const S = [];
  const pool = HUNTER_IDS.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < 8; i++) S.push({ kind: 'bot', id: 200 + i, name: BOT_NAMES[i], hunter: pool[i] });
  App.demo = new Sim(S, { mode: 'standard' }); App.demo.drainEvents(); App.demoT = 0;
}
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

// ------------------------------------------------------------------
//  Loop principal
// ------------------------------------------------------------------
// Simulação do host: chamada pelo quadro e por um relógio em Web Worker,
// para o jogo não congelar se o dono da sala minimizar a aba.
function hostUpdate() {
  if (!App.sim || (!App.inGame && App.screen !== 'end')) return;
  const now = performance.now();
  if (!hostLast) hostLast = now;
  const el = (now - hostLast) / 1000; hostLast = now;
  if (App.role === 'solo' && App.paused) return;
  App.acc += Math.min(el, 0.25);
  let steps = 0;
  while (App.acc >= TICK && steps++ < 15) {
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
      if (App.ticks % 2 === 0) { App.tr.broadcast(encodeSnap(App.sim, App.pending)); App.pending = []; }
    }
  }
  if (App.acc > TICK * 4) App.acc = 0;
}
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'], { type: 'text/javascript' })));
  wk.onmessage = () => { if (App.role === 'host' || App.role === 'solo') hostUpdate(); };
} catch (e) { /* sem worker */ }

let last = performance.now(), sendT = 0;
function loop(ts) {
  const raw = (ts - last) / 1000;
  const dt = Math.min(0.05, raw); last = ts;
  trackPerf(raw);
  if (App.inGame || (App.screen === 'end' && state())) gameFrame(dt);
  else if (App.screen !== 'game') demoFrame(dt);
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
        if (me.slowT) sp *= 0.7; if (me.spdT) sp *= 1.25; if (me.huntT) sp *= 1.35; if (me.bastionT) sp *= 0.8; if (me.spinT) sp *= 1.2; if (me.rootT) sp = 0;
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
    cs.tick(dt, me, pred, Settings.smooth);
  }
  const me = meP(S) || S.players[0];
  let camT = me;
  if (!me.alive) camT = S.players.find(p => p.alive && p.team === me.team) || { x: me.soulX, y: me.soulY };
  const view = Object.assign({}, me, { x: me.alive ? me.x : camT.x, y: me.alive ? me.y : camT.y });
  // host/treino: desenha entre o passo anterior e o atual da simulação (mais liso em monitores rápidos)
  let saved = null;
  if (App.sim && Settings.smooth && App.sim.phase !== 'countdown') {
    const al = Math.min(1, App.acc / TICK); saved = [];
    for (const p of App.sim.players) if (p.px !== undefined && p.id !== App.myId || (p.id === App.myId && p.px !== undefined)) { saved.push([p, p.x, p.y, p.z]); p.x = p.px + (p.x - p.px) * al; p.y = p.py + (p.y - p.py) * al; p.z = p.pz + (p.z - p.pz) * al; }
    for (const pr of App.sim.projectiles) if (pr.px !== undefined) { saved.push([pr, pr.x, pr.y, 0]); pr.x = pr.px + (pr.x - pr.px) * al; pr.y = pr.py + (pr.y - pr.py) * al; }
    if (me.alive && view.id === me.id) { view.x = me.x; view.y = me.y; }
  }
  R.frame(S, view, dt, App.screen === 'game' && !App.paused ? mouse : null);
  if (saved) for (const [o, x, y, z] of saved) { o.x = x; o.y = y; if (o.z !== undefined && o.hp !== undefined) o.z = z; }
  updateHud(S, me, dt);
  if ((App.mmT = (App.mmT || 0) - dt) <= 0) { App.mmT = 0.15; R.minimap($('#minimap'), S, me); }
}

show('menu');
newDemo();
requestAnimationFrame(loop);

$('#in-code').type = Settings.streamer ? 'password' : 'text';
