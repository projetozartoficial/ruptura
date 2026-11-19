// =====================================================================
//  fps/weapons.js : arsenal do Modo Tático (16 armas + faca) e modelos 3D
//  dmg = [cabeça, corpo, pernas]; rps = tiros por segundo; spread/mv/rec em graus
// =====================================================================
const WEAPONS = {
  faca:      { nome: 'Lâmina Curta', cat: 'Faca', preco: 0, melee: true, rps: 2.2, dmg: [50, 50, 50], range: 2.2, slot: 3, model: 'faca' },
  // ---- pistolas ----
  lasca:     { nome: 'Lasca', cat: 'Pistolas', desc: 'Pistola padrão. Grátis.', preco: 0, rps: 6.75, dmg: [78, 26, 22], mag: 12, res: 36, reload: 1.75, spread: 0.4, mv: 3.5, rec: 0.9, auto: false, slot: 2, model: 'pistol', cor: [0.32, 0.34, 0.4] },
  coice:     { nome: 'Coice', cat: 'Pistolas', desc: 'Escopeta de bolso: devastadora de perto.', preco: 300, rps: 3.3, dmg: [36, 12, 10], pellets: 15, mag: 2, res: 6, reload: 1.75, spread: 4.5, mv: 1, rec: 3, auto: false, falloff: 7, slot: 2, model: 'sawed', cor: [0.45, 0.32, 0.22] },
  enxame:    { nome: 'Enxame', cat: 'Pistolas', desc: 'Pistola automática. Forte correndo de perto.', preco: 450, rps: 10, dmg: [78, 26, 22], mag: 13, res: 26, reload: 1.5, spread: 1.3, mv: 1.8, rec: 1.1, auto: true, slot: 2, model: 'machpistol', cor: [0.28, 0.3, 0.36] },
  sussurro:  { nome: 'Sussurro', cat: 'Pistolas', desc: 'Pistola com silenciador. Precisa e quieta.', preco: 500, rps: 6.75, dmg: [105, 30, 25], mag: 15, res: 45, reload: 1.5, spread: 0.3, mv: 3, rec: 0.8, auto: false, silent: true, slot: 2, model: 'silenced', cor: [0.25, 0.27, 0.3] },
  brado:     { nome: 'Brado', cat: 'Pistolas', desc: 'Revólver pesado: um tiro na cabeça derruba.', preco: 800, rps: 4, dmg: [159, 55, 46], mag: 6, res: 24, reload: 2.25, spread: 0.25, mv: 4, rec: 3.2, auto: false, slot: 2, model: 'revolver', cor: [0.6, 0.6, 0.64] },
  // ---- SMGs ----
  ferroada:  { nome: 'Ferroada', cat: 'SMGs', desc: 'Dispara muito rápido. Ótima de perto.', preco: 1100, rps: 16, dmg: [67, 27, 22], mag: 20, res: 60, reload: 2.25, spread: 0.9, mv: 1.5, rec: 0.7, auto: true, slot: 1, model: 'smgCompact', cor: [0.3, 0.32, 0.36] },
  zumbido:   { nome: 'Zumbido', cat: 'SMGs', desc: 'SMG com silenciador. Boa até média distância.', preco: 1600, rps: 13.3, dmg: [78, 26, 22], mag: 30, res: 90, reload: 2.25, spread: 0.4, mv: 1.4, rec: 0.55, auto: true, silent: true, slot: 1, model: 'smg', cor: [0.26, 0.28, 0.32] },
  // ---- escopetas ----
  tranco:    { nome: 'Tranco', cat: 'Escopetas', desc: 'Escopeta de bomba. Um tiro de perto resolve.', preco: 850, rps: 1.1, dmg: [40, 20, 17], pellets: 15, mag: 5, res: 10, reload: 2.5, spread: 3.4, mv: 1, rec: 5, auto: false, falloff: 8, slot: 1, model: 'pump', cor: [0.42, 0.3, 0.2] },
  estrondo:  { nome: 'Estrondo', cat: 'Escopetas', desc: 'Escopeta automática com tambor.', preco: 1850, rps: 3.5, dmg: [34, 17, 14], pellets: 12, mag: 7, res: 21, reload: 2.2, spread: 6, mv: 1, rec: 4, auto: true, falloff: 10, slot: 1, model: 'autoshot', cor: [0.3, 0.3, 0.32] },
  // ---- rifles ----
  mastim:    { nome: 'Mastim', cat: 'Rifles', desc: 'Rifle barato e automático.', preco: 2050, rps: 9.15, dmg: [116, 35, 29], mag: 24, res: 72, reload: 2.5, spread: 0.3, mv: 4, rec: 0.75, auto: true, slot: 1, model: 'bullpup', cor: [0.36, 0.34, 0.28] },
  sentinela: { nome: 'Sentinela', cat: 'Rifles', desc: 'Semiautomático de longa distância. Mata com 1 na cabeça.', preco: 2250, rps: 5.25, dmg: [195, 65, 49], mag: 12, res: 36, reload: 2.5, spread: 0.1, mv: 5, rec: 1.6, auto: false, slot: 1, model: 'dmr', cor: [0.22, 0.26, 0.3] },
  corisco:   { nome: 'Corisco', cat: 'Rifles', desc: 'Rifle silenciado, rápido e controlável.', preco: 2900, rps: 11, dmg: [156, 39, 33], mag: 30, res: 60, reload: 2.5, spread: 0.2, mv: 4, rec: 0.6, auto: true, silent: true, slot: 1, model: 'rifleS', cor: [0.24, 0.26, 0.32] },
  rompante:  { nome: 'Rompante', cat: 'Rifles', desc: 'Rifle forte: 1 tiro na cabeça em qualquer distância.', preco: 2900, rps: 9.75, dmg: [160, 40, 34], mag: 25, res: 50, reload: 2.5, spread: 0.25, mv: 4, rec: 0.75, auto: true, slot: 1, model: 'rifleV', cor: [0.32, 0.22, 0.16] },
  // ---- snipers ----
  gaviao:    { nome: 'Gavião', cat: 'Snipers', desc: 'Sniper de cano duplo: 2 tiros rápidos.', preco: 2400, rps: 2.75, dmg: [238, 140, 119], mag: 2, res: 10, reload: 2.8, spread: 0.1, mv: 5, unscoped: 4, rec: 4, auto: false, zoom: 3.5, slot: 1, model: 'sniperDouble', cor: [0.3, 0.28, 0.24] },
  arauto:    { nome: 'Arauto', cat: 'Snipers', desc: 'A sniper mais forte. Lenta, mas mata no corpo.', preco: 4700, rps: 0.75, dmg: [255, 150, 127], mag: 5, res: 10, reload: 3.7, spread: 0.05, mv: 6, unscoped: 6, rec: 6, auto: false, zoom: 5, heavy: 0.9, slot: 1, model: 'sniper', cor: [0.18, 0.22, 0.3] },
  // ---- metralhadoras ----
  trovoada:  { nome: 'Trovoada', cat: 'Metralhadoras', desc: 'Metralhadora que acelera enquanto atira.', preco: 1600, rps: 10, rpsMax: 13, dmg: [72, 30, 25], mag: 50, res: 100, reload: 3.25, spread: 0.8, mv: 3, rec: 0.35, auto: true, heavy: 0.93, slot: 1, model: 'lmg', cor: [0.32, 0.32, 0.28] },
  tormenta:  { nome: 'Tormenta', cat: 'Metralhadoras', desc: 'Pente de 100 balas. Atravessa tudo na força bruta.', preco: 3200, rps: 12, rpsMax: 15.6, dmg: [95, 38, 32], mag: 100, res: 200, reload: 5, spread: 0.8, mv: 3, rec: 0.35, auto: true, heavy: 0.9, slot: 1, model: 'lmgDrum', cor: [0.26, 0.26, 0.24] },
};
const SHOP = [
  { cat: 'Pistolas', itens: ['lasca', 'coice', 'enxame', 'sussurro', 'brado'] },
  { cat: 'SMGs', itens: ['ferroada', 'zumbido'] },
  { cat: 'Escopetas', itens: ['tranco', 'estrondo'] },
  { cat: 'Rifles', itens: ['mastim', 'sentinela', 'corisco', 'rompante'] },
  { cat: 'Snipers', itens: ['gaviao', 'arauto'] },
  { cat: 'Metralhadoras', itens: ['trovoada', 'tormenta'] },
];
const SHIELDS = { leve: { nome: 'Escudo Leve', preco: 400, val: 25 }, pesado: { nome: 'Escudo Pesado', preco: 1000, val: 50 } };

// ---------------- modelos 3D (caixas) ----------------
// cada peça: [x, y, z, largura, altura, comprimento, cor] — z negativo = para frente (cano)
const DARK = [0.13, 0.14, 0.16], METAL = [0.5, 0.52, 0.56], GRIP = [0.18, 0.17, 0.17], WOOD = [0.45, 0.28, 0.16];
function weaponParts(id) {
  const W = WEAPONS[id], A = W.cor || METAL, A2 = (W.cor || METAL).map(v => v * 0.7);
  const P = [];
  const b = (x, y, z, w, h, d, c) => P.push([x, y, z, w, h, d, c]);
  switch (W.model) {
    case 'faca':
      b(0, 0, 0.05, 0.03, 0.035, 0.12, GRIP); b(0, 0.005, -0.01, 0.05, 0.05, 0.015, METAL);
      b(0, 0.012, -0.12, 0.008, 0.045, 0.2, [0.85, 0.88, 0.92]); b(0, 0.03, -0.12, 0.009, 0.01, 0.2, [0.6, 0.62, 0.66]);
      break;
    case 'pistol': case 'silenced': case 'machpistol':
      b(0, 0.02, -0.07, 0.035, 0.04, 0.2, A); b(0, -0.005, -0.08, 0.03, 0.02, 0.17, A2);
      b(0, -0.06, 0.0, 0.03, 0.09, 0.045, GRIP); b(0, -0.03, -0.06, 0.012, 0.03, 0.04, DARK);
      b(0, 0.045, -0.15, 0.008, 0.012, 0.01, DARK); b(0, 0.045, 0.02, 0.012, 0.012, 0.01, DARK);
      if (W.model === 'silenced') b(0, 0.02, -0.25, 0.03, 0.03, 0.14, DARK);
      if (W.model === 'machpistol') { b(0, -0.12, 0.0, 0.026, 0.07, 0.035, DARK); b(0, 0.02, -0.19, 0.025, 0.025, 0.05, DARK); }
      break;
    case 'revolver':
      b(0, 0.025, -0.13, 0.025, 0.025, 0.2, A); b(0, 0.02, -0.02, 0.045, 0.05, 0.06, METAL); b(0, 0.035, 0.03, 0.03, 0.03, 0.04, A);
      b(0, -0.04, 0.05, 0.032, 0.09, 0.045, WOOD); b(0, -0.01, -0.02, 0.012, 0.03, 0.04, DARK); b(0, 0.045, -0.22, 0.008, 0.015, 0.012, DARK);
      break;
    case 'sawed':
      b(-0.014, 0.02, -0.12, 0.026, 0.026, 0.24, A2); b(0.014, 0.02, -0.12, 0.026, 0.026, 0.24, A2);
      b(0, 0.0, 0.0, 0.05, 0.04, 0.08, METAL); b(0, -0.04, 0.07, 0.035, 0.09, 0.05, WOOD); b(0, -0.005, -0.08, 0.05, 0.02, 0.12, WOOD);
      break;
    case 'smgCompact': case 'smg':
      b(0, 0.02, -0.12, 0.05, 0.06, 0.26, A); b(0, 0.06, -0.12, 0.02, 0.015, 0.2, DARK);
      b(0, 0.02, -0.3, 0.025, 0.025, 0.1, DARK); b(0, -0.06, -0.02, 0.032, 0.09, 0.04, GRIP);
      b(0, -0.07, -0.13, 0.03, W.model === 'smg' ? 0.15 : 0.11, 0.04, DARK); b(0, 0.0, 0.08, 0.02, 0.05, 0.12, DARK);
      if (W.model === 'smg') b(0, 0.02, -0.4, 0.035, 0.035, 0.14, DARK);
      break;
    case 'pump':
      b(0, 0.025, -0.3, 0.035, 0.035, 0.5, A2); b(0, -0.01, -0.3, 0.03, 0.03, 0.42, DARK); b(0, -0.012, -0.32, 0.05, 0.045, 0.14, WOOD);
      b(0, 0.02, -0.02, 0.055, 0.07, 0.14, METAL); b(0, -0.04, 0.06, 0.035, 0.08, 0.05, GRIP); b(0, 0.0, 0.2, 0.045, 0.08, 0.2, WOOD);
      break;
    case 'autoshot':
      b(0, 0.03, -0.2, 0.045, 0.06, 0.4, A); b(0, 0.03, -0.43, 0.035, 0.035, 0.12, DARK);
      b(0, -0.06, -0.12, 0.09, 0.1, 0.1, [0.2, 0.2, 0.18]); b(0, -0.06, 0.02, 0.035, 0.09, 0.045, GRIP); b(0, 0.0, 0.18, 0.04, 0.08, 0.18, DARK);
      b(0, 0.075, -0.15, 0.025, 0.02, 0.18, DARK);
      break;
    case 'bullpup':
      b(0, 0.02, -0.15, 0.06, 0.08, 0.5, A); b(0, 0.02, -0.45, 0.03, 0.03, 0.12, DARK); b(0, 0.075, -0.18, 0.03, 0.03, 0.14, DARK);
      b(0, -0.07, -0.2, 0.032, 0.09, 0.045, GRIP); b(0, -0.06, 0.03, 0.035, 0.11, 0.05, DARK); b(0, 0.0, 0.12, 0.06, 0.1, 0.06, A2);
      break;
    case 'dmr':
      b(0, 0.02, -0.25, 0.045, 0.06, 0.48, A); b(0, 0.02, -0.56, 0.025, 0.025, 0.2, DARK); b(0, 0.075, -0.2, 0.035, 0.04, 0.16, DARK);
      b(0, -0.06, -0.02, 0.032, 0.09, 0.04, GRIP); b(0, -0.06, -0.15, 0.03, 0.1, 0.05, DARK); b(0, 0.0, 0.18, 0.04, 0.09, 0.22, A2);
      break;
    case 'rifleS': case 'rifleV':
      b(0, 0.02, -0.2, 0.05, 0.07, 0.42, A); b(0, 0.025, -0.48, 0.03, 0.03, 0.16, DARK);
      if (W.model === 'rifleS') b(0, 0.025, -0.6, 0.04, 0.04, 0.16, DARK);
      b(0, 0.068, -0.15, 0.022, 0.02, 0.22, DARK); b(0, 0.085, -0.05, 0.02, 0.03, 0.02, DARK);
      b(0, -0.06, 0.0, 0.032, 0.09, 0.04, GRIP);
      if (W.model === 'rifleV') b(0, -0.08, -0.14, 0.032, 0.13, 0.05, A2, 0.25); else b(0, -0.08, -0.14, 0.032, 0.12, 0.045, DARK);
      b(0, 0.005, 0.2, 0.045, 0.1, 0.22, W.model === 'rifleV' ? WOOD : DARK);
      break;
    case 'sniper': case 'sniperDouble':
      b(0, 0.02, -0.3, 0.05, 0.07, 0.5, A);
      if (W.model === 'sniperDouble') { b(-0.012, 0.03, -0.72, 0.022, 0.022, 0.38, DARK); b(0.012, 0.03, -0.72, 0.022, 0.022, 0.38, DARK); }
      else b(0, 0.03, -0.75, 0.028, 0.028, 0.44, DARK);
      b(0, 0.1, -0.25, 0.045, 0.045, 0.28, DARK); b(0, 0.1, -0.4, 0.055, 0.055, 0.04, METAL); b(0, 0.1, -0.1, 0.05, 0.05, 0.03, METAL);
      b(0, -0.06, 0.0, 0.032, 0.09, 0.04, GRIP); b(0, -0.05, -0.18, 0.04, 0.06, 0.07, DARK); b(0, 0.0, 0.22, 0.05, 0.11, 0.26, A2);
      break;
    case 'lmg': case 'lmgDrum':
      b(0, 0.03, -0.25, 0.07, 0.09, 0.5, A); b(0, 0.03, -0.6, 0.035, 0.035, 0.28, DARK); b(0, 0.0, -0.5, 0.05, 0.05, 0.12, DARK);
      b(0, 0.1, -0.2, 0.025, 0.04, 0.14, DARK);
      if (W.model === 'lmgDrum') b(0, -0.08, -0.25, 0.12, 0.12, 0.12, [0.22, 0.22, 0.2]); else b(0.0, -0.08, -0.24, 0.08, 0.1, 0.12, [0.25, 0.27, 0.22]);
      b(0, -0.06, -0.02, 0.035, 0.09, 0.045, GRIP); b(0, 0.0, 0.2, 0.05, 0.1, 0.22, DARK);
      break;
  }
  return P;
}
// tamanho (comprimento) usado pelo boneco em terceira pessoa
for (const id in WEAPONS) { const P = weaponParts(id); let mn = 0; for (const p of P) mn = Math.min(mn, p[2] - p[5] / 2); WEAPONS[id].len = -mn; WEAPONS[id].parts = P; }

// silhueta para a loja (vista de lado)
function weaponIcon(id, w = 150, h = 56) {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d');
  const P = WEAPONS[id].parts; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of P) { x0 = Math.min(x0, p[2] - p[5] / 2); x1 = Math.max(x1, p[2] + p[5] / 2); y0 = Math.min(y0, p[1] - p[4] / 2); y1 = Math.max(y1, p[1] + p[4] / 2); }
  const k = Math.min((c.width - 20) / (x1 - x0), (c.height - 16) / (y1 - y0)), ox = (c.width - (x1 - x0) * k) / 2, oy = (c.height + (y1 - y0) * k) / 2;
  for (const p of P) {
    const sh = 0.55 + 0.45 * (p[6][0] + p[6][1] + p[6][2]) / 3;
    g.fillStyle = `rgb(${Math.round(sh * 225)},${Math.round(sh * 232)},${Math.round(sh * 240)})`;
    g.fillRect(ox + (p[2] - p[5] / 2 - x0) * k, oy - (p[1] + p[4] / 2 - y0) * k, p[5] * k, p[4] * k);
  }
  return c;
}
