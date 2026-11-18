// =====================================================================
//  fps/main.js : tela, controles, HUD, loja, sons e laço do jogo
// =====================================================================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TEAM_NAME = ['Alvorada', 'Crepúsculo'], TEAM_COL = ['#3fa9ff', '#ff5a4a'];
const BOT_NAMES_F = ['Eco', 'Vulto', 'Faísca', 'Garoa', 'Breu', 'Ônix', 'Sina', 'Musgo', 'Rajada', 'Cinza', 'Neblina', 'Trovo'];
const FPSET_DEF = { sens: 0.35, fov: 103, scale: 1, xcol: '#5dff9a', vol: 70 };
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
try { gl = App.gl = new GL($('#cv')); } catch (e) { $('#gate').innerHTML = `<h2>Não deu para abrir o modo FPS</h2><p>${esc(e.message)}</p><a class="btn" href="index.html">Voltar</a>`; throw e; }
App.M = buildWorld(MAP_FPS);
App.mapMesh = gl.mesh(boxGeo(App.M.renderBoxes));

function buildMenu() {
  const box = $('#pick'); box.innerHTML = '';
  for (const h of FPS_HUNTER_IDS) {
    const H = HUNTERS[h], C = CLASSES[H.classe], F = FPS_HUNTERS[h];
    const d = document.createElement('div'); d.className = 'hcard' + (App.hunter === h ? ' sel' : '');
    const cv = hunterPortraitFPS(h); d.appendChild(cv);
    d.insertAdjacentHTML('beforeend', `<div class="hn">${H.nome}</div><div class="hc" style="color:${C.cor}">${C.icone} ${C.nome}</div>
      <div class="hab">${['c', 'q', 'e', 'x'].map(k => `<div><b>${k.toUpperCase()}</b> ${F[k].nome}<small>${k === 'x' ? FPS_ULT[h] + ' pontos' : F[k].free ? 'grátis · ' + F[k].free + ' por round' : F[k].preco + ' créditos'} — ${F[k].desc}</small></div>`).join('')}</div>`);
    d.onclick = () => { App.hunter = h; try { localStorage.setItem('ruptura-fps-h', h); } catch (e) { } buildMenu(); };
    box.appendChild(d);
  }
}
function hunterPortraitFPS(h) {
  const c = document.createElement('canvas'); c.width = c.height = 90; const g = c.getContext('2d');
  const C = HUNTERS[h].cores; g.fillStyle = '#10131f'; g.fillRect(0, 0, 90, 90);
  g.fillStyle = C.roupa; g.fillRect(28, 46, 34, 40); g.fillStyle = C.pele; g.fillRect(33, 16, 24, 26); g.fillStyle = C.cabelo; g.fillRect(31, 12, 28, 10);
  g.fillStyle = C.detalhe; g.fillRect(28, 60, 34, 4); g.fillStyle = '#111'; g.fillRect(48, 26, 4, 4);
  return c;
}
try { App.hunter = localStorage.getItem('ruptura-fps-h') || 'brasa'; if (!FPS_HUNTERS[App.hunter]) App.hunter = 'brasa'; } catch (e) { }

function startMatch() {
  AU.init();
  const name = (window.Account && Account.profile && Account.profile.name) || 'Você';
  const names = BOT_NAMES_F.slice().sort(() => Math.random() - 0.5);
  const slots = [];
  for (let i = 0; i < RULES.teamSize * 2; i++) {
    if (i === 0) slots.push({ id: 1, name, bot: false, hunter: App.hunter });
    else {
      const team = i < RULES.teamSize ? 0 : 1, used = slots.filter((s, j) => (j < RULES.teamSize ? 0 : 1) === team).map(s => s.hunter);
      const free = FPS_HUNTER_IDS.filter(h => !used.includes(h));
      slots.push({ id: i + 1, name: names.pop() + ' [bot]', bot: true, hunter: free[(Math.random() * free.length) | 0] || 'brasa' });
    }
  }
  App.G = new Game(App.M, slots);
  App.me = App.G.byId(1);
  App.yaw = App.me.yaw; App.pitch = 0;
  App.feed = []; App.parts = [];
  $('#menu').style.display = 'none'; $('#hud').style.display = '';
  App.running = true; lockPointer();
  handleEvents(App.G.drain());
}
$('#btn-play').onclick = () => startMatch();
$('#btn-resume').onclick = () => { $('#pause').classList.remove('show'); lockPointer(); };
$('#btn-quit').onclick = () => { App.running = false; $('#pause').classList.remove('show'); $('#hud').style.display = 'none'; $('#menu').style.display = ''; document.exitPointerLock?.(); };

// ---------------- controles ----------------
const keys = new Set(); let mouseL = false, mouseR = false;
function lockPointer() { const c = $('#cv'); try { const r = c.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => c.requestPointerLock()); } catch (e) { c.requestPointerLock?.(); } }
document.addEventListener('pointerlockchange', () => {
  App.locked = document.pointerLockElement === $('#cv');
  if (!App.locked && App.running && !App.buyOpen && !App.G?.phase?.startsWith('match')) $('#pause').classList.add('show');
});
$('#cv').addEventListener('click', () => { if (App.running && !App.locked && !App.buyOpen) { $('#pause').classList.remove('show'); lockPointer(); } });
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
  const I = me.in;
  if (e.code === 'Digit1') I.slot = 1; if (e.code === 'Digit2') I.slot = 2; if (e.code === 'Digit3') I.slot = 3;
  if (e.code === 'KeyR') I.reload = true;
  if (e.code === 'KeyG') I.drop = true;
  if (!e.repeat) for (const [code, k] of [['KeyC', 'c'], ['KeyQ', 'q'], ['KeyE', 'e'], ['KeyX', 'x']]) if (e.code === code) I.ab = k;
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
function renderBuy() {
  const me = App.me, G = App.G; if (!me) return;
  const F = FPS_HUNTERS[me.hunter];
  let h = `<div class="buy-top"><b>Loja</b><span class="cr">◈ ${me.creds}</span><span class="bt">${Math.max(0, Math.ceil(G.phaseT))}s de compra · B fecha</span></div><div class="buy-grid">`;
  for (const cat of SHOP) {
    h += `<div class="bcol"><h4>${cat.cat}</h4>`;
    for (const id of cat.itens) {
      const W = WEAPONS[id], own = me.guns[W.slot] && me.guns[W.slot].id === id;
      h += `<button class="bitem${own ? ' own' : ''}" ${me.creds < W.preco && !own ? 'disabled' : ''} data-buy="${id}"><span>${W.nome}</span><em>${W.preco ? '◈ ' + W.preco : 'grátis'}</em></button>`;
    }
    h += '</div>';
  }
  h += `<div class="bcol"><h4>Escudos</h4>${Object.entries(SHIELDS).map(([id, S]) => `<button class="bitem${me.armor >= S.val ? ' own' : ''}" ${me.creds < S.preco || me.armor >= S.val ? 'disabled' : ''} data-buy="${id}"><span>${S.nome}</span><em>◈ ${S.preco}</em></button>`).join('')}
    <h4>Habilidades</h4>${['c', 'q'].map(k => `<button class="bitem" ${me.creds < F[k].preco || me.ab[k] >= F[k].max ? 'disabled' : ''} data-buy="${k}"><span>${k.toUpperCase()} · ${F[k].nome} <small>${me.ab[k]}/${F[k].max}</small></span><em>◈ ${F[k].preco}</em></button>`).join('')}
    <div class="bnote">E · ${F.e.nome}: grátis (${F.e.free} por round)<br>X · ${F.x.nome}: ${FPS_ULT[me.hunter]} pontos (abates, mortes, plantar/desarmar)</div></div>`;
  h += '</div>';
  $('#buy').innerHTML = h;
  $('#buy').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { me.in.buy = b.dataset.buy; AU.tone(800, 1200, 0.08, 0.15, 'triangle'); setTimeout(renderBuy, 40); });
}

// ---------------- eventos -> efeitos/HUD ----------------
function handleEvents(evs) {
  const G = App.G, me = App.me;
  for (const e of evs) {
    const p = e.id ? G.byId(e.id) : null;
    switch (e.k) {
      case 'shot': {
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
      case 'boom': burst(e.x, e.y + 0.3, e.z, e.kind === 'quake' ? 40 : 60, e.kind === 'stone' || e.kind === 'quake' ? [0.6, 0.5, 0.4] : [1, 0.55, 0.15], e.r * 1.2); AU.noise(0.6, 400, 0.6 * AU.at(e.x, e.z)); if (Math.hypot(e.x - me.x, e.z - me.z) < e.r * 2) App.shake = 0.6; break;
      case 'flash': burst(e.x, e.y, e.z, 30, [1, 1, 1], 6); AU.tone(2400, 1800, 0.3, 0.2 * AU.at(e.x, e.z)); break;
      case 'smoke': AU.noise(0.8, 600, 0.3 * AU.at(e.x, e.z)); break;
      case 'fire': AU.noise(0.6, 900, 0.3 * AU.at(e.x, e.z)); break;
      case 'splash': AU.noise(0.5, 1200, 0.25 * AU.at(e.x, e.z), 0.5, 'bandpass'); break;
      case 'reveal': case 'hunt': AU.tone(400, 1200, 0.4, 0.15); break;
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
  App.running = false; document.exitPointerLock?.();
  const G = App.G, me = App.me;
  $('#end').classList.add('show');
  $('#end').innerHTML = `<div class="endbox"><h1 class="${won ? 'win' : 'lose'}">${won ? 'VITÓRIA' : 'DERROTA'}</h1><div class="sub">${G.score[me.team]} × ${G.score[1 - me.team]}</div>${boardHTML()}<div class="row"><a class="btn" href="index.html">Menu principal</a><button class="btn gold" id="btn-again">Jogar de novo</button></div></div>`;
  $('#btn-again').onclick = () => { $('#end').classList.remove('show'); startMatch(); };
  if (window.Account && Account.logged && Account.record) { try { Account.record({ mode: 'fps', won, my: G.score[me.team], opp: G.score[1 - me.team], hunter: me.hunter, kills: me.kills, deaths: me.deaths, dmg: me.dmg, heal: 0, perf: 1, oppMMR: 1000, vsBots: true }); } catch (e) { console.warn(e); } }
}
function boardHTML() {
  const G = App.G, me = App.me;
  const rows = t => G.players.filter(p => p.team === t).sort((a, b) => b.kills - a.kills).map(p => `<tr class="${p === me ? 'mine' : ''}${p.alive ? '' : ' dead'}"><td>${esc(HUNTERS[p.hunter].nome)}</td><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.dmg)}</td><td>◈ ${p.team === me.team ? p.creds : '?'}</td></tr>`).join('');
  return `<table class="tb"><tr><th>Caçador</th><th>Jogador</th><th>A</th><th>M</th><th>Dano</th><th>Créditos</th></tr>
    <tr><td colspan="6" class="tt" style="color:${TEAM_COL[me.team]}">Seu time</td></tr>${rows(me.team)}<tr><td colspan="6" class="tt" style="color:${TEAM_COL[1 - me.team]}">Inimigos</td></tr>${rows(1 - me.team)}</table>`;
}
function renderBoard() { $('#board').innerHTML = boardHTML(); }

// ---------------- desenho do mundo ----------------
function drawPlayer(p, T) {
  const C = HUNTERS[p.hunter].cores, col = k => hex3(C[k]);
  const h = App.G.height(p), ry = -p.yaw, cy = Math.cos(ry), sy = Math.sin(ry);
  const L = (lx, ly, lz) => [p.x + cy * lx + sy * lz, p.y + ly, p.z - sy * lx + cy * lz];
  const part = (lx, ly, lz, sx, sy_, sz, c, rx = 0) => { const [x, y, z] = L(lx, ly, lz); gl.box(x, y, z, sx, sy_, sz, c, { ry, rx }); };
  const mv = Math.hypot(p.vx, p.vz), sw = mv > 1 ? Math.sin(T * 11) * 0.5 : 0, k = h / PH.H;
  part(-0.12, 0.42 * k, 0, 0.18, 0.84 * k, 0.2, col('roupa2'), sw);
  part(0.12, 0.42 * k, 0, 0.18, 0.84 * k, 0.2, col('roupa2'), -sw);
  part(0, 0.84 * k + 0.33, 0, 0.5, 0.66, 0.3, col('roupa'));
  part(0, 0.84 * k + 0.35, -0.16, 0.5, 0.08, 0.02, col('detalhe'));
  part(0, h - 0.17, 0, 0.3, 0.32, 0.3, col('pele'));
  part(0, h - 0.04, 0.02, 0.33, 0.12, 0.33, col('cabelo'));
  part(0.06, h - 0.16, -0.155, 0.16, 0.05, 0.02, [0.1, 0.1, 0.12]);
  // braços e arma apontando para a mira
  const W = App.G.curW(p), len = W && W.len || 0.25, ap = -p.pitch;
  part(0.3, 0.84 * k + 0.4, -0.18, 0.13, 0.13, 0.42, col('roupa'), ap);
  part(-0.22, 0.84 * k + 0.4, -0.22, 0.13, 0.13, 0.36, col('roupa'), ap);
  part(0.12, 0.84 * k + 0.45, -0.45 - len / 2, 0.09, 0.12, len, W && W.cor || [0.7, 0.7, 0.75], ap);
  if (p.nucleo) part(0, 0.84 * k + 0.4, 0.22, 0.3, 0.35, 0.16, [0.4, 0.95, 1]);
}
function drawWorld(T, dt) {
  const G = App.G, me = App.me;
  gl.draw(App.mapMesh);
  // jogadores (inimigos só se visíveis)
  App.vis = new Set();
  for (const p of G.players) {
    if (p === me && me.alive) continue;
    if (!p.alive) { if (p.body) { gl.box(p.body.x, 0.12, p.body.z, 0.55, 0.24, 1.6, hex3(HUNTERS[p.hunter].cores.roupa), { ry: -p.body.yaw }); } continue; }
    const ally = p.team === me.team;
    if (!ally && !(G.canSee(me.alive ? me : (App.spec || me), p) || p.revealT > 0 || G.revealTeam[me.team] > 0)) continue;
    App.vis.add(p.id);
    drawPlayer(p, T);
  }
  // Núcleo
  if (G.nucleo) {
    const n = G.nucleo, pl = n.planted, pulse = pl ? (Math.sin(T * (6 + (RULES.nucleoTime - G.phaseT) * 0.4)) * 0.5 + 0.5) : 0.4;
    gl.box(n.x, 0.25, n.z, 0.5, 0.5, 0.5, [0.2, 0.3, 0.4], { ry: T });
    gl.box(n.x, 0.62, n.z, 0.28, 0.3, 0.28, [0.4, 0.95, 1], { emis: 0.6 + pulse * 0.4, ry: -T * 2 });
  }
  // armas no chão
  for (const d of G.drops) gl.box(d.x, 0.08, d.z, 0.12, 0.1, WEAPONS[d.g.id].len + 0.2, WEAPONS[d.g.id].cor, { ry: d.t * 3 });
  // granadas
  for (const g of G.grenades) gl.box(g.x, g.y, g.z, 0.18, 0.18, 0.18, g.kind === 'rocket' ? [1, 0.5, 0.2] : g.kind === 'flash' ? [1, 1, 0.9] : [0.4, 0.4, 0.45], { emis: g.kind === 'rocket' || g.kind === 'flash' ? 1 : 0, ry: T * 8 });
  // barreiras sólidas
  for (const w of G.temp) if (w.solid) gl.box((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2, w.x1 - w.x0, w.y1 - w.y0, w.z1 - w.z0, [1, 0.88, 0.5], { emis: 0.35 });
  // efeitos transparentes
  gl.blend(true);
  for (const z of G.zones) {
    const c = z.kind === 'fire' ? [1, 0.45, 0.1] : z.kind === 'flood' ? [0.2, 0.5, 0.9] : z.kind === 'slow' ? [1, 0.9, 0.4] : [0.2, 0.6, 1];
    gl.box(z.x, 0.04, z.z, z.r * 2, 0.06, z.r * 2, c, { a: 0.45, emis: 0.6 });
    if (z.kind === 'fire' && Math.random() < 0.6) App.parts.push({ x: z.x + rnd(-z.r, z.r) * 0.7, y: 0.1, z: z.z + rnd(-z.r, z.r) * 0.7, vx: 0, vy: rnd(1, 3), vz: 0, t: 0.6, T: 0.6, col: [1, 0.6, 0.15], s: 0.15, glow: 1 });
  }
  for (const w of G.temp) if (!w.solid) gl.box((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2, w.x1 - w.x0, w.y1 - w.y0, w.z1 - w.z0, [0.25, 0.55, 0.85], { a: 0.75, emis: 0.3 });
  for (const s of G.smokes) {
    const f = Math.min(1, (s.T - s.t) / 0.6, s.t / 0.8);
    for (let i = 0; i < 3; i++) gl.ball(s.x + Math.sin(T * 0.3 + i * 2) * 0.3, s.y - i * 0.2, s.z + Math.cos(T * 0.3 + i * 2) * 0.3, s.r * 2 * f * (1 - i * 0.1), s.r * 1.8 * f * (1 - i * 0.1), s.r * 2 * f * (1 - i * 0.1), [0.72, 0.8, 0.9], { a: 0.6 + i * 0.15, ry: i * 0.5 + T * 0.1 });
  }
  gl.blend(false);
  // traçantes e partículas (aditivo)
  gl.additive(true);
  for (const t of G.tracers) {
    const dx = t.x1 - t.x0, dy = t.y1 - t.y0, dz = t.z1 - t.z0, l = Math.hypot(dx, dy, dz);
    if (l < 0.5) continue;
    gl.boxM(M4.trs((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, (t.z0 + t.z1) / 2, Math.atan2(dx, dz), -Math.asin(dy / l), 0, 0.025, 0.025, l), [1, 0.85, 0.5], { emis: 1, a: 0.8 });
  }
  for (const q of App.parts) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= (q.glow ? -1 : 9) * dt; if (q.y < 0) { q.y = 0; q.vy *= -0.3; } gl.box(q.x, q.y, q.z, q.s, q.s, q.s, q.col, { emis: 1, a: Math.max(0, q.t / q.T) }); }
  App.parts = App.parts.filter(q => q.t > 0);
  gl.additive(false);
}
function drawViewmodel(T, dt) {
  const me = App.me, G = App.G; if (!me.alive) return;
  const W = G.curW(me); if (W && W.zoom && me.zoom) return;
  gl.viewmodel(70 * Math.PI / 180);
  const mv = Math.hypot(me.vx, me.vz) / MOVE.run;
  App.bobT += dt * mv * 9;
  App.kick = Math.max(0, App.kick - dt * 12);
  const bx = Math.sin(App.bobT) * 0.012 * mv, by = -Math.abs(Math.cos(App.bobT)) * 0.012 * mv;
  const sw = me.switchT > 0 ? me.switchT * 0.5 : 0, rl = me.reloadT > 0 ? Math.sin(Math.min(1, me.reloadT / WEAPONS[me.guns[me.cur]?.id || 'lasca'].reload) * Math.PI) * 0.12 : 0;
  const ox = 0.15 + bx, oy = -0.15 + by - sw - rl, oz = -0.36 + App.kick * 0.04;
  const C = HUNTERS[me.hunter].cores;
  if (me.cur === 3) {
    gl.box(ox, oy + 0.03, oz - 0.05, 0.03, 0.03, 0.2, [0.2, 0.2, 0.22]);
    gl.box(ox, oy + 0.04, oz - 0.24, 0.015, 0.05, 0.22, [0.85, 0.88, 0.92], { emis: 0.2 });
    gl.box(ox + 0.02, oy - 0.03, oz + 0.05, 0.08, 0.08, 0.2, hex3(C.pele));
    return;
  }
  const L = W.len * 0.75, c = W.cor, rx = App.kick * 0.15, K = 0.7;
  const g = (x, y, z, sx, sy, sz, col, o = {}) => gl.box(ox + x * K, oy + y * K, oz + z, sx * K, sy * K, sz, col, Object.assign({ rx }, o));
  g(0, 0, -L / 2, 0.06, 0.08, L, c);
  g(0, 0.05, -L * 0.4, 0.04, 0.03, L * 0.6, c.map(v => v * 0.7));
  g(0, -0.08, -0.02, 0.05, 0.12, 0.06, [0.12, 0.12, 0.14]);
  if (W.mag > 7 && W.cat !== 'Pistolas') g(0, -0.08, -L * 0.45, 0.045, 0.14, 0.07, [0.15, 0.15, 0.17]);
  if (W.zoom) g(0, 0.075, -L * 0.45, 0.05, 0.05, 0.2, [0.1, 0.1, 0.12]);
  g(0, 0.02, -L - 0.02, 0.03, 0.03, 0.04, [0.05, 0.05, 0.05]);
  g(-0.02, -0.07, 0.06, 0.08, 0.08, 0.16, hex3(C.pele));
  g(-0.05, -0.04, -L * 0.6, 0.07, 0.06, 0.12, hex3(C.pele));
  g(0.02, -0.09, 0.2, 0.11, 0.11, 0.2, hex3(C.roupa));
  if (App.flash > 0) { App.flash -= dt; gl.additive(true); g(0, 0.02, -L - 0.12, 0.12, 0.12, 0.12, [1, 0.8, 0.4], { emis: 1, a: 0.9, ry: Math.random() }); gl.additive(false); }
}

// ---------------- HUD ----------------
const hud = $('#hud2d'), hx = hud.getContext('2d');
function drawHud(dt) {
  const G = App.G, me = App.me, W = innerWidth, H = innerHeight;
  if (hud.width !== W || hud.height !== H) { hud.width = W; hud.height = H; }
  hx.clearRect(0, 0, W, H);
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
  const G = App.G, me = App.me, M = G.M, s = 5, ox = 14, oy = 14, w = M.W * s, h = M.H * s;
  hx.save(); hx.globalAlpha = 0.9; hx.fillStyle = 'rgba(10,12,20,.75)'; hx.fillRect(ox - 4, oy - 4, w + 8, h + 8);
  for (let r = 0; r < M.H; r++) for (let c = 0; c < M.W; c++) {
    const ch = M.at(c, r); if (ch === '#') continue;
    hx.fillStyle = ch === 'A' ? '#8a6040' : ch === 'B' ? '#406080' : ch === 'x' || ch === 'h' ? '#555' : '#9a968c';
    hx.fillRect(ox + c * s, oy + r * s, s, s);
  }
  hx.font = '700 14px Rajdhani, sans-serif'; hx.textAlign = 'center'; hx.fillStyle = '#fff';
  for (const k of ['A', 'B']) { const S = M['site' + k]; hx.fillText(k, ox + S.x / M.cell * s, oy + S.z / M.cell * s + 5); }
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
  if (me.alive && me.nucleo && G.phase === 'live') tip = G.M.siteAt(me.x, me.z) ? 'Segure F para plantar o Núcleo' : 'Leve o Núcleo até o Site A ou B';
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
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - (App.last || now)) / 1000); App.last = now;
  gl.resize(FS.scale);
  if (!App.G) { // fundo do menu: câmera girando
    const T = now / 1000, cam = { x: 40 + Math.sin(T * 0.1) * 20, y: 9, z: 26 + Math.cos(T * 0.1) * 14, yaw: T * 0.1 + Math.PI, pitch: -0.35, fov: 1.3 };
    gl.begin(cam); gl.draw(App.mapMesh); return;
  }
  const G = App.G, me = App.me;
  if (App.running) {
    readInput();
    App.acc += dt;
    while (App.acc >= TICK) { G.step(TICK); App.acc -= TICK; handleEvents(G.drain()); }
  }
  // câmera (morto: assiste um aliado vivo)
  let view = me;
  if (!me.alive) { const al = G.players.filter(p => p.alive && p.team === me.team); App.spec = al[0] || null; if (App.spec) view = App.spec; }
  const W = G.curW(view), zoom = view === me && me.alive && W && W.zoom && me.zoom ? W.zoom : 1;
  App.shake = Math.max(0, (App.shake || 0) - dt * 2);
  const sk = App.shake * 0.02;
  const cam = { x: view.x + rnd(-sk, sk), y: G.eye(view) + rnd(-sk, sk), z: view.z, yaw: view === me ? App.yaw : view.yaw, pitch: (view === me ? App.pitch : view.pitch) + (view === me ? me.recoil * Math.PI / 180 * 0.6 : 0), fov: Math.atan(Math.tan(FS.fov * Math.PI / 180 / 2) / zoom * (innerHeight / innerWidth)) * 2 };
  gl.begin(cam);
  drawWorld(now / 1000, dt);
  if (view === me) drawViewmodel(now / 1000, dt);
  drawHud(dt); updateDom(dt);
}
requestAnimationFrame(frame);

// ---------------- configurações ----------------
function bindSettings(s) {
  s.innerHTML = `<label>Sensibilidade <input type="range" min="0.05" max="1.5" step="0.01" value="${FS.sens}" data-k="sens"><b>${FS.sens}</b></label>
  <label>Campo de visão <input type="range" min="80" max="115" step="1" value="${FS.fov}" data-k="fov"><b>${FS.fov}°</b></label>
  <label>Resolução <input type="range" min="0.5" max="1" step="0.05" value="${FS.scale}" data-k="scale"><b>${Math.round(FS.scale * 100)}%</b></label>
  <label>Volume <input type="range" min="0" max="100" step="1" value="${FS.vol}" data-k="vol"><b>${FS.vol}</b></label>
  <label>Cor da mira <input type="color" value="${FS.xcol}" data-k="xcol"></label>`;
  s.querySelectorAll('input').forEach(i => i.oninput = () => { FS[i.dataset.k] = i.type === 'color' ? i.value : +i.value; saveFS(); const b = i.nextElementSibling; if (b) b.textContent = i.dataset.k === 'scale' ? Math.round(FS.scale * 100) + '%' : i.dataset.k === 'fov' ? FS.fov + '°' : FS[i.dataset.k]; });
}
bindSettings($('#fpset')); bindSettings($('#fpset2'));
buildMenu();

// ---------------- conta: só quem está logado joga ----------------
(function gate() {
  const play = $('#btn-play');
  if (!window.Account || !window.FIREBASE_CONFIG) { play.disabled = false; return; }
  play.disabled = true; $('#acctmsg').textContent = 'Verificando sua conta...';
  Account.on(() => {
    if (Account.logged) { play.disabled = false; $('#acctmsg').innerHTML = `Conectado como <b>${esc(Account.profile.name)}</b>${Account.profile.tag ? ' #' + esc(Account.profile.tag) : ''}`; }
    else if (Account.enabled === false || Account.error) { play.disabled = true; $('#acctmsg').innerHTML = `${esc(Account.error || 'Login indisponível')} · <a href="index.html">voltar</a>`; }
    else { play.disabled = true; $('#acctmsg').innerHTML = 'Entre com sua conta Google na <a href="index.html">página inicial</a> para jogar.'; }
  });
  Account.init();
})();
