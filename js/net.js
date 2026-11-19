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

// ---------------- WebRTC com sinalização pelo Firebase ----------------
// O Firestore só é usado para os jogadores "se apresentarem" (oferta/resposta).
// Depois disso a partida roda direto entre os PCs (canal de dados WebRTC).
const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
function iceDone(pc, ms = 2500) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}
function wrapChannel(dc) { return { send(m) { if (dc.readyState === 'open') dc.send(JSON.stringify(m)); }, get open() { return dc.readyState === 'open'; } }; }

async function fireHost(code, h) {
  const db = Account.db, room = db.collection('rooms').doc(code);
  const ex = await room.get();
  if (ex.exists && Date.now() - (ex.data().t || 0) < 60000) throw new Error('Esse código de sala já está em uso.');
  await room.set({ host: Account.user.uid, t: Date.now() });
  const beat = setInterval(() => room.update({ t: Date.now() }).catch(() => { }), 20000);
  const peers = new Map(); // pid -> {pc, ch}
  const unsub = room.collection('peers').onSnapshot(q => {
    q.docChanges().forEach(async c => {
      const pid = c.doc.id, d = c.doc.data();
      if (c.type !== 'added' || !d.offer || d.answer || peers.has(pid)) return;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const P = { pc, ch: null }; peers.set(pid, P);
      pc.ondatachannel = ev => {
        const dc = ev.channel; P.ch = wrapChannel(dc);
        dc.onopen = () => { h.onJoin(pid); c.doc.ref.delete().catch(() => { }); };
        dc.onmessage = e => { try { h.onMsg(pid, JSON.parse(e.data)); } catch (x) { } };
        dc.onclose = () => { if (peers.delete(pid)) h.onLeave(pid); };
      };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState) && peers.delete(pid)) h.onLeave(pid); };
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: d.offer });
        await pc.setLocalDescription(await pc.createAnswer());
        await iceDone(pc);
        await c.doc.ref.update({ answer: pc.localDescription.sdp });
      } catch (e) { peers.delete(pid); }
    });
  });
  return {
    send(pid, m) { const p = peers.get(pid); if (p && p.ch) p.ch.send(m); },
    broadcast(m) { for (const p of peers.values()) if (p.ch && p.ch.open) try { p.ch.send(m); } catch (e) { } },
    close() { clearInterval(beat); unsub(); for (const p of peers.values()) try { p.pc.close(); } catch (e) { } peers.clear(); room.delete().catch(() => { }); },
  };
}
async function fireJoin(code, h) {
  const db = Account.db, room = db.collection('rooms').doc(code);
  const ex = await room.get();
  if (!ex.exists || Date.now() - (ex.data().t || 0) > 90000) throw new Error('Sala não encontrada. Confira o código.');
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const dc = pc.createDataChannel('game', { ordered: true });
  const ref = room.collection('peers').doc(Account.user.uid + '_' + Math.random().toString(36).slice(2, 7));
  await pc.setLocalDescription(await pc.createOffer());
  await iceDone(pc);
  await ref.set({ offer: pc.localDescription.sdp, t: Date.now() });
  return new Promise((resolve, reject) => {
    let ok = false;
    const unsub = ref.onSnapshot(async d => {
      const v = d.exists ? d.data() : null;
      if (v && v.answer && !pc.currentRemoteDescription) { try { await pc.setRemoteDescription({ type: 'answer', sdp: v.answer }); } catch (e) { } }
    });
    dc.onopen = () => {
      ok = true; unsub();
      resolve({ send(m) { if (dc.readyState === 'open') dc.send(JSON.stringify(m)); }, close() { try { dc.close(); pc.close(); } catch (e) { } } });
    };
    dc.onmessage = e => { try { h.onMsg(JSON.parse(e.data)); } catch (x) { } };
    dc.onclose = () => { if (ok) h.onClose(); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { if (ok) h.onClose(); } };
    setTimeout(() => { if (!ok) { unsub(); ref.delete().catch(() => { }); try { pc.close(); } catch (e) { } reject(new Error('Não consegui conectar com a sala (a rede pode estar bloqueando). Tente de novo.')); } }, 20000);
  });
}

const useFire = () => typeof Account !== 'undefined' && Account.db && Account.user;
const Transport = {
  host(mode, code, h) { return mode === 'local' ? localHost(code, h) : useFire() ? fireHost(code, h) : peerHost(code, h); },
  join(mode, code, h) { return mode === 'local' ? localJoin(code, h) : useFire() ? fireJoin(code, h) : peerJoin(code, h); },
};

// arredondamento usado nos snapshots do modo tático (fps/net.js)
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
