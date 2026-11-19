// =====================================================================
//  fps/social.js : conta Google, ID Nome#TAG, perfil, amigos, convites,
//  privacidade e as entradas da Ranqueada no menu.
// =====================================================================
const Social = {
  panel: null, // 'friends' | 'profile' | null
  STATUS: { menu: 'No menu', room: 'Em sala', game: 'Em partida' },
  local: App.net === 'local',

  // só quem está logado (e já escolheu o ID) joga
  guard(fn) {
    if (this.local) return fn();
    const m = $('#acctmsg');
    if (!Account.enabled) { m.textContent = Account.error || 'O login ainda não está configurado (js/firebase-config.js).'; return; }
    if (!Account.logged) { m.textContent = 'Entre com sua conta Google para jogar.'; this.login(); return; }
    if (Account.needsNick) { this.openNick(true); return; }
    m.textContent = ''; fn();
  },
  rankedBlock() {
    if (this.local) return '';
    const need = window.RANKED_MIN_LEVEL || 15, P = Account.profile;
    if (P.level < need) return `A Ranqueada libera no nível ${need} de conta (você está no ${P.level}). Jogue contra bots ou em salas para subir.`;
    return '';
  },
  ranked() {
    this.guard(() => {
      const b = this.rankedBlock(); if (b) { $('#acctmsg').textContent = b; return; }
      hostRoom('ranked');
    });
  },
  async login() { try { await Account.login(); } catch (e) { $('#acctmsg').textContent = e.message; } },
  presence(status) {
    if (this.local || !Account.logged) return;
    Account.presence({ status, room: status === 'room' && App.code ? App.code : null });
  },
  // privacidade: esconder o nome dos outros jogadores (modo streamer)
  shownName(x) {
    if (!FS.hideNames || x.pid === App.myPid || x.kind === 'bot') return x.name;
    return HUNTERS[x.hunter] ? HUNTERS[x.hunter].nome : 'Jogador';
  },
  fullId(f) { return `${f.name}#${f.tag}`; },
  online(f) { return f.pres && Date.now() - f.pres.t < 90000; },

  // ---------------- barra da conta ----------------
  renderBar() {
    const el = $('#acct'); if (!el) return;
    const P = Account.profile;
    if (this.local) { el.innerHTML = '<span class="hint">Modo de teste local (sem conta)</span>'; return; }
    if (!Account.logged || !P) {
      el.innerHTML = Account.enabled ? '<button class="btn gold" id="ac-login">Entrar com Google</button>' : `<span class="hint">${esc(Account.error || 'Verificando sua conta...')}</span>`;
      if ($('#ac-login')) $('#ac-login').onclick = () => this.login();
      return;
    }
    const need = xpNeed(P.level), badge = Account.incoming.length + Account.invites.length;
    el.innerHTML = `<canvas id="ac-emb" width="46" height="46" title="${esc(rankName(P.rank))}"></canvas>
      <div class="acinfo"><b>${P.nickSet ? `${esc(P.name)}<span>#${esc(P.tag)}</span>` : 'Escolha seu ID'}</b><small>Nível ${P.level} · ${esc(rankName(P.rank))}</small><div class="xpb"><i style="width:${Math.min(100, P.xp / need * 100)}%"></i></div></div>
      <button class="btn" id="ac-fr">Amigos${badge ? `<em>${badge}</em>` : ''}</button><button class="btn" id="ac-pf">Perfil</button><button class="btn ghost" id="ac-out" title="Sair da conta">Sair</button>`;
    drawRankEmblem($('#ac-emb').getContext('2d'), P.rank, 46);
    $('#ac-fr').onclick = () => this.toggle('friends');
    $('#ac-pf').onclick = () => this.toggle('profile');
    $('#ac-out').onclick = () => { this.close(); Account.logout(); };
  },
  refreshButtons() {
    const ok = this.local || (Account.logged && !Account.needsNick);
    for (const id of ['#btn-play', '#btn-host', '#btn-join', '#btn-ranked']) $(id).classList.toggle('locked', !ok);
    const rb = $('#btn-ranked');
    if (ok && !this.local) { const b = this.rankedBlock(); rb.classList.toggle('locked', !!b); rb.title = b || 'Ranqueada 5v5 · primeiro a 7'; }
  },

  // ---------------- ID Nome#TAG ----------------
  openNick(first) {
    const P = Account.profile;
    $('#nk-name').value = P.nickSet ? P.name : P.name || '';
    $('#nk-tag').value = P.nickSet ? P.tag : randomTag();
    $('#nk-msg').textContent = first ? 'Antes de jogar, escolha o ID que seus amigos vão usar para te adicionar.' : '';
    $('#nk-cancel').style.display = first ? 'none' : '';
    $('#nick').classList.add('show'); $('#nk-name').focus();
  },
  async confirmNick() {
    const b = $('#nk-ok'); b.disabled = true; $('#nk-msg').textContent = 'Reservando...';
    try { await Account.claimNick($('#nk-name').value, $('#nk-tag').value); $('#nick').classList.remove('show'); }
    catch (e) { $('#nk-msg').textContent = e.message; }
    b.disabled = false;
  },

  // ---------------- painel lateral ----------------
  toggle(p) { this.panel = this.panel === p ? null : p; this.renderSide(); },
  close() { this.panel = null; this.renderSide(); },
  renderSide() {
    const el = $('#side');
    el.classList.toggle('show', !!this.panel && Account.logged);
    if (!this.panel || !Account.logged) return;
    if (this.panel === 'friends') this.renderFriends(el); else this.renderProfile(el);
  },
  renderFriends(el) {
    const inRoom = App.tr && (App.role === 'host' || App.role === 'client') && !App.G;
    const fr = Account.friends.slice().sort((a, b) => (this.online(b) ? 1 : 0) - (this.online(a) ? 1 : 0) || a.name.localeCompare(b.name));
    let h = `<div class="sdhead"><h3>Amigos</h3><button class="btn ghost" data-a="close">✕</button></div>
      <div class="myid">Seu ID: <b>${esc(Account.fullId)}</b> <button class="btn ghost sm" data-a="copyid">Copiar</button></div>
      <div class="addf"><input id="fr-id" placeholder="Nome#TAG" maxlength="22" autocomplete="off"><button class="btn gold" data-a="add">Adicionar</button></div><div class="mdmsg" id="fr-msg"></div>`;
    if (Account.incoming.length) h += `<h4>Pedidos recebidos</h4>` + Account.incoming.map(r => `<div class="fr"><div><b>${esc(r.fromName)}<span>#${esc(r.fromTag)}</span></b></div><button class="btn gold sm" data-a="acc" data-id="${r.id}">Aceitar</button><button class="btn ghost sm" data-a="dec" data-id="${r.id}">Recusar</button></div>`).join('');
    if (Account.outgoing.length) h += `<h4>Pedidos enviados</h4>` + Account.outgoing.map(r => `<div class="fr dim"><div><b>${esc(r.toName)}<span>#${esc(r.toTag)}</span></b><small>aguardando</small></div><button class="btn ghost sm" data-a="dec" data-id="${r.id}">Cancelar</button></div>`).join('');
    h += `<h4>Amigos (${fr.length})</h4>` + (fr.length ? fr.map(f => {
      const on = this.online(f), st = on ? this.STATUS[f.pres.status] || 'Online' : 'Offline';
      const canJoin = on && f.pres.status === 'room' && f.pres.room && f.pres.room !== App.code;
      return `<div class="fr${on ? '' : ' dim'}"><i class="dot${on ? ' on' : ''}"></i><div><b>${esc(f.name)}<span>#${esc(f.tag)}</span></b><small>${st}${f.pres && f.pres.level ? ' · nível ' + f.pres.level : ''}${f.pres && f.pres.rank >= 0 ? ' · ' + esc(rankName(f.pres.rank)) : ''}</small></div>
        ${inRoom && on ? `<button class="btn sm" data-a="inv" data-u="${f.uid}">Convidar</button>` : ''}${canJoin ? `<button class="btn gold sm" data-a="join" data-u="${f.uid}">Entrar</button>` : ''}<button class="btn ghost sm" data-a="rem" data-u="${f.uid}" title="Remover amigo">✕</button></div>`;
    }).join('') : '<div class="hint">Adicione amigos pelo ID (Nome#TAG).</div>');
    h += `<h4>Privacidade</h4><label class="chk"><input type="checkbox" data-a="hidenames" ${FS.hideNames ? 'checked' : ''}> Esconder nomes dos outros jogadores (modo streamer)</label>
      <label class="chk"><input type="checkbox" data-a="hidecode" ${FS.hideCode ? 'checked' : ''}> Esconder o código da sala por padrão</label>`;
    el.innerHTML = h;
    const msg = t => { $('#fr-msg').textContent = t || ''; };
    const add = async () => { msg('Procurando...'); try { msg(await Account.addFriend($('#fr-id').value)); $('#fr-id').value = ''; } catch (e) { msg(e.message); } };
    $('#fr-id').onkeydown = e => { if (e.key === 'Enter') add(); };
    el.querySelectorAll('[data-a]').forEach(b => {
      const a = b.dataset.a, f = Account.friends.find(x => x.uid === b.dataset.u);
      if (b.type === 'checkbox') { b.onchange = () => { FS[a === 'hidenames' ? 'hideNames' : 'hideCode'] = b.checked ? 1 : 0; saveFS(); if (a === 'hidecode') App.hideCode = b.checked; renderRoom(); }; return; }
      b.onclick = async () => {
        try {
          if (a === 'close') this.close();
          else if (a === 'copyid') { navigator.clipboard.writeText(Account.fullId); b.textContent = 'Copiado!'; }
          else if (a === 'add') add();
          else if (a === 'acc') await Account.respond(b.dataset.id, true);
          else if (a === 'dec') await Account.respond(b.dataset.id, false);
          else if (a === 'rem' && f && confirm(`Remover ${f.name}#${f.tag} dos amigos?`)) await Account.removeFriend(f);
          else if (a === 'inv' && f) { await Account.invite(f, App.code + (App.kind === 'ranked' ? ':R' : '')); b.textContent = 'Convidado!'; b.disabled = true; }
          else if (a === 'join' && f) this.joinCode(f.pres.room);
        } catch (e) { msg(e.message); }
      };
    });
  },
  joinCode(code) {
    this.guard(() => {
      const ranked = /:R$/.test(code); code = code.replace(/:R$/, '');
      if (ranked) { const b = this.rankedBlock(); if (b) { $('#acctmsg').textContent = b; return; } }
      if (App.G) return;
      if (App.tr) leaveRoom();
      this.close(); joinRoom(code, { kind: ranked ? 'ranked' : 'custom' });
    });
  },
  renderProfile(el) {
    const P = Account.profile, s = P.stats, wr = s.matches ? Math.round(s.wins / s.matches * 100) : 0, kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
    const fav = Object.entries(P.hunters).sort((a, b) => b[1].m - a[1].m).slice(0, 3);
    const MN = { training: 'Contra bots', standard: 'Sala', ranked: 'Ranqueada', fps: 'Modo tático' };
    const rankLine = P.placements < 5 ? `Partidas de colocação: ${P.placements}/5` : `${P.rr} / 100 RR`;
    el.innerHTML = `<div class="sdhead"><h3>Perfil</h3><button class="btn ghost" data-a="close">✕</button></div>
      <div class="pftop"><canvas id="pf-emb" width="120" height="120"></canvas><div><b class="pfn">${esc(P.name)}<span>#${esc(P.tag)}</span></b><button class="btn ghost sm" data-a="nick">Alterar ID</button>
        <div class="pfr">${esc(rankName(P.rank))}</div><small>${rankLine}${P.peak >= 0 ? ' · pico: ' + esc(rankName(P.peak)) : ''}</small>
        ${P.placements >= 5 ? `<div class="xpb rr"><i style="width:${Math.min(100, P.rr)}%"></i></div>` : ''}</div></div>
      <div class="pfst"><div><b>${P.level}</b><small>Nível</small></div><div><b>${s.matches}</b><small>Partidas</small></div><div><b>${wr}%</b><small>Vitórias</small></div><div><b>${kd}</b><small>Abates/Mortes</small></div><div><b>${s.matches ? Math.round(s.dmg / s.matches) : 0}</b><small>Dano/partida</small></div></div>
      ${P.level < (window.RANKED_MIN_LEVEL || 15) ? `<div class="hint">A Ranqueada libera no nível ${window.RANKED_MIN_LEVEL || 15}.</div>` : ''}
      <h4>Caçadores favoritos</h4>${fav.length ? fav.map(([h, v]) => `<div class="fav"><b>${HUNTERS[h] ? HUNTERS[h].nome : h}</b><small>${v.m} partidas · ${Math.round(v.w / v.m * 100)}% vitórias · ${v.k} abates</small></div>`).join('') : '<div class="hint">Jogue algumas partidas.</div>'}
      <h4>Últimas partidas</h4><table class="hist"><tr><th>Modo</th><th></th><th>Placar</th><th>Caçador</th><th>A/M</th><th>RR</th></tr>
      ${P.history.map(m => `<tr><td>${MN[m.mode] || m.mode}</td><td class="${m.won ? 'win' : 'loss'}">${m.won ? 'V' : 'D'}</td><td>${m.sc[0]}×${m.sc[1]}</td><td>${HUNTERS[m.h] ? HUNTERS[m.h].nome : ''}</td><td>${m.k}/${m.d}</td><td>${m.mode === 'ranked' ? (m.pl ? `col. ${m.pl}/5` : (m.rr >= 0 ? '+' : '') + m.rr) : '—'}</td></tr>`).join('')}</table>`;
    drawRankEmblem($('#pf-emb').getContext('2d'), P.rank, 120);
    el.querySelector('[data-a=close]').onclick = () => this.close();
    el.querySelector('[data-a=nick]').onclick = () => this.openNick(false);
  },

  // ---------------- convites ----------------
  renderInvites() {
    const el = $('#invites');
    const inv = Account.invites.filter(i => Date.now() - i.t < 120000);
    el.innerHTML = inv.map(i => `<div class="inv"><div><b>${esc(i.fromName)}<span>#${esc(i.fromTag)}</span></b><small>te convidou para ${/:R$/.test(i.code) ? 'a Ranqueada' : 'uma sala'}</small></div><button class="btn gold sm" data-j="${i.id}">Entrar</button><button class="btn ghost sm" data-x="${i.id}">✕</button></div>`).join('');
    el.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { const i = Account.invites.find(x => x.id === b.dataset.j); if (i) { Account.dropInvite(i); this.joinCode(i.code); } });
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { const i = Account.invites.find(x => x.id === b.dataset.x); if (i) Account.dropInvite(i); });
  },

  // ---------------- recompensas na tela final ----------------
  rewards(out, kind) {
    const el = $('#rewards'); if (!el || !out) return;
    const P = Account.profile;
    let h = `<div class="rw"><b>+${out.xp} XP</b><span>Nível ${P.level}${out.levels ? ' · SUBIU!' : ''}</span><div class="xpb"><i style="width:${Math.min(100, P.xp / xpNeed(P.level) * 100)}%"></i></div></div>`;
    if (kind === 'ranked') {
      if (out.placement) h += `<div class="rw"><b>Colocação ${out.placement}/5</b><span>${out.placed ? 'RANQUE DEFINIDO!' : 'Partidas de colocação'}</span></div>`;
      else h += `<div class="rw"><b class="${out.rr >= 0 ? 'win' : 'loss'}">${out.rr >= 0 ? '+' : ''}${out.rr} RR</b><span>${P.rr} / 100 RR${App.vsBots ? ' · contra bots (½)' : ''}</span><div class="xpb rr"><i style="width:${Math.min(100, P.rr)}%"></i></div></div>`;
      if (P.rank >= 0) h += `<div class="rw rank"><canvas id="rw-emb" width="84" height="84"></canvas><span>${out.rankAfter > out.rankBefore && out.rankBefore >= 0 ? 'PROMOVIDO!' : out.rankAfter < out.rankBefore ? 'REBAIXADO' : 'RANQUE'}</span><b>${esc(rankName(P.rank))}</b></div>`;
    }
    if (out.saved === false) h += `<div class="hint">Não consegui salvar: ${esc(out.err || '')}</div>`;
    el.innerHTML = h;
    const c = $('#rw-emb'); if (c) drawRankEmblem(c.getContext('2d'), P.rank, 84);
  },
};

// botões do menu
$('#btn-play').onclick = () => Social.guard(() => startMatch());
$('#btn-host').onclick = () => Social.guard(() => hostRoom('custom'));
$('#btn-join').onclick = () => Social.guard(() => joinRoom($('#in-code').value));
$('#in-code').onkeydown = e => { if (e.key === 'Enter') $('#btn-join').click(); };
$('#btn-ranked').onclick = () => Social.ranked();
$('#nk-ok').onclick = () => Social.confirmNick();
$('#nk-cancel').onclick = () => $('#nick').classList.remove('show');
$('#nk-tag').onkeydown = $('#nk-name').onkeydown = e => { if (e.key === 'Enter') Social.confirmNick(); };
App.hideCode = !!FS.hideCode;

Account.on(() => {
  Social.renderBar(); Social.refreshButtons(); Social.renderSide();
  if (Account.needsNick && !$('#nick').classList.contains('show')) Social.openNick(true);
  if (!Social.local && !Account.logged && App.tr && !App.G) leaveRoom();
  if (Account.error) $('#acctmsg').textContent = Account.error;
});
Account.onSocial(() => { Social.renderBar(); if (Social.panel === 'friends') Social.renderSide(); Social.renderInvites(); });
setInterval(() => { if (Account.invites.length) Social.renderInvites(); }, 10000);
Social.renderBar(); Social.refreshButtons();
Account.init();
