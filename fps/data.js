// =====================================================================
//  fps/data.js : mapa, armas, economia e caçadores (modo FPS tático)
// =====================================================================

// ---------------- Regras da partida ----------------
const RULES = {
  winRounds: 7, half: 6,           // vence quem fizer 7; troca de lado depois do round 6
  buyTime: 30, roundTime: 100, nucleoTime: 45, plantTime: 4, defuseTime: 7, endTime: 6,
  startCreds: 800, maxCreds: 9000, otCreds: 5000,
  win: 3000, loss: [1900, 2400, 2900], kill: 200, plant: 300,
  ultCost: 7, teamSize: 5,
};

// ---------------- Mapa: Ruínas de Vésper ----------------
// cada letra = 2m. '#' parede, 'x' caixa, 'h' meia-parede, 'A'/'B' bombsite, 'T' spawn do ataque, 'D' spawn da defesa
const MAP_FPS = {
  nome: 'Ruínas de Vésper', cell: 2, wallH: 5.2,
  rows: [
    '########################################',
    '################........################',
    '################...DD...################',
    '######..........DDDDDD..........########',
    '######..........DDDDDD..........########',
    '######..####......DD......####..########',
    '##AAAAAAAAAA##..........##BBBBBBBBBB####',
    '##AAAxAAAAAA##..######..##BBBBBBxBBB####',
    '##AAAxxAAhAA.....#..#.....BBhBBxxBBB####',
    '##AAAAAAAAAA.....#..#.....BBBBBBBBBB####',
    '##AAAAAAxAAA##..........##BBBxBBBBBB####',
    '##AAAAAAAAAA##...x..x...##BBBBBBBBBB####',
    '####..####..######..######..####..######',
    '####..####..##........##....####..######',
    '####........##...xx...##..........######',
    '######..######........######..##########',
    '######..######..h..h..######..##########',
    '######..######........######..##########',
    '######..######...x..x.######..##########',
    '######..........................########',
    '######..........................########',
    '##########..######....######..##########',
    '##########......TTTTTTTT......##########',
    '##########......TTTTTTTT......##########',
    '##################TTTT##################',
    '########################################',
  ],
  // nomes das regiões (aparecem no HUD e no minimapa)
  callouts: [
    { n: 'Site A', x0: 2, y0: 6, x1: 12, y1: 12 }, { n: 'Site B', x0: 25, y0: 6, x1: 36, y1: 12 },
    { n: 'Meio', x0: 14, y0: 6, x1: 25, y1: 19 }, { n: 'Spawn da Defesa', x0: 6, y0: 1, x1: 32, y1: 6 },
    { n: 'Principal A', x0: 4, y0: 12, x1: 14, y1: 19 }, { n: 'Principal B', x0: 25, y0: 12, x1: 36, y1: 19 },
    { n: 'Pátio', x0: 6, y0: 19, x1: 32, y1: 21 }, { n: 'Spawn do Ataque', x0: 10, y0: 21, x1: 30, y1: 25 },
  ],
};

// ---------------- Armas ----------------
// dmg: [cabeça, corpo, pernas]; rps = tiros/s; spread em graus; mv = imprecisão andando; rec = coice (graus por tiro)
const WEAPONS = {
  faca:      { nome: 'Lâmina Curta', cat: 'faca', preco: 0, melee: true, rps: 2.2, dmg: [50, 50, 50], range: 2.2, slot: 3 },
  lasca:     { nome: 'Lasca', cat: 'Pistolas', preco: 0, rps: 6.75, dmg: [78, 26, 22], mag: 12, res: 36, reload: 1.75, spread: 0.4, mv: 3.5, rec: 0.9, auto: false, slot: 2, cor: [0.35, 0.36, 0.4], len: 0.22 },
  brado:     { nome: 'Brado', cat: 'Pistolas', preco: 800, rps: 4, dmg: [159, 55, 46], mag: 6, res: 24, reload: 2.25, spread: 0.25, mv: 4, rec: 3.2, auto: false, slot: 2, cor: [0.55, 0.45, 0.3], len: 0.28 },
  zumbido:   { nome: 'Zumbido', cat: 'SMGs', preco: 1600, rps: 13.3, dmg: [78, 26, 22], mag: 30, res: 90, reload: 2.25, spread: 0.4, mv: 1.4, rec: 0.55, auto: true, slot: 1, cor: [0.3, 0.32, 0.36], len: 0.42 },
  estrondo:  { nome: 'Estrondo', cat: 'Escopetas', preco: 1850, rps: 3.5, dmg: [34, 17, 14], pellets: 12, mag: 7, res: 21, reload: 2.2, spread: 6, mv: 1, rec: 4, auto: true, falloff: 10, slot: 1, cor: [0.42, 0.3, 0.22], len: 0.5 },
  gaviao:    { nome: 'Gavião', cat: 'Snipers', preco: 950, rps: 1.5, dmg: [202, 101, 85], mag: 5, res: 10, reload: 2.5, spread: 0.1, mv: 5, unscoped: 4, rec: 4, auto: false, zoom: 2.5, slot: 1, cor: [0.35, 0.4, 0.3], len: 0.7 },
  corisco:   { nome: 'Corisco', cat: 'Rifles', preco: 2900, rps: 11, dmg: [140, 35, 30], mag: 30, res: 60, reload: 2.5, spread: 0.2, mv: 4, rec: 0.6, auto: true, slot: 1, cor: [0.25, 0.27, 0.32], len: 0.62 },
  rompante:  { nome: 'Rompante', cat: 'Rifles', preco: 2900, rps: 9.75, dmg: [160, 40, 34], mag: 25, res: 50, reload: 2.5, spread: 0.25, mv: 4, rec: 0.75, auto: true, slot: 1, cor: [0.3, 0.22, 0.18], len: 0.64 },
  tormenta:  { nome: 'Tormenta', cat: 'Pesadas', preco: 3200, rps: 12, dmg: [95, 38, 32], mag: 100, res: 200, reload: 5, spread: 0.8, mv: 3, rec: 0.35, auto: true, slot: 1, cor: [0.3, 0.3, 0.26], len: 0.7 },
  arauto:    { nome: 'Arauto', cat: 'Snipers', preco: 4700, rps: 0.75, dmg: [255, 150, 127], mag: 5, res: 10, reload: 3.7, spread: 0.05, mv: 6, unscoped: 6, rec: 6, auto: false, zoom: 5, slot: 1, cor: [0.18, 0.22, 0.3], len: 0.85 },
};
const SHOP = [
  { cat: 'Pistolas', itens: ['lasca', 'brado'] },
  { cat: 'SMGs', itens: ['zumbido'] },
  { cat: 'Escopetas', itens: ['estrondo'] },
  { cat: 'Rifles', itens: ['corisco', 'rompante'] },
  { cat: 'Snipers', itens: ['gaviao', 'arauto'] },
  { cat: 'Pesadas', itens: ['tormenta'] },
];
const SHIELDS = { leve: { nome: 'Escudo Leve', preco: 400, val: 25 }, pesado: { nome: 'Escudo Pesado', preco: 1000, val: 50 } };

// ---------------- Caçadores (versão FPS) ----------------
// c e q: compradas (preço por carga, máx. cargas). e: assinatura grátis (cargas por round). x: ultimate (pontos)
const FPS_HUNTERS = {
  brasa: {
    c: { nome: 'Brasa Viva', preco: 250, max: 1, desc: 'Granada que espalha fogo no chão por 6s.' },
    q: { nome: 'Impulso', preco: 150, max: 2, desc: 'Avança rápido na direção em que você anda.' },
    e: { nome: 'Granada de Fogo', free: 1, desc: 'Granada que explode e causa muito dano em área.' },
    x: { nome: 'Chuva de Brasas', desc: 'Um foguete que explode tudo onde acerta.' },
  },
  corvo: {
    c: { nome: 'Olho do Corvo', preco: 250, max: 1, desc: 'Dardo que revela inimigos perto de onde cai por 3s.' },
    q: { nome: 'Clarão Sombrio', preco: 250, max: 2, desc: 'Clarão que cega quem estiver olhando.' },
    e: { nome: 'Passo Sombrio', free: 1, desc: 'Teleporta 9m para frente.' },
    x: { nome: 'Caçada', desc: 'Revela todos os inimigos para o seu time por 6s.' },
  },
  mare: {
    c: { nome: 'Muralha d\'Água', preco: 300, max: 1, desc: 'Ergue uma parede de água que bloqueia a visão por 10s.' },
    q: { nome: 'Correnteza', preco: 200, max: 2, desc: 'Poça que deixa os inimigos lentos por 5s.' },
    e: { nome: 'Névoa', free: 2, desc: 'Lança uma cortina de névoa onde você mira (15s). Bloqueia a visão.' },
    x: { nome: 'Maremoto', desc: 'Inunda uma área enorme: lentidão forte e dano por 8s.' },
  },
  lumi: {
    c: { nome: 'Barreira de Luz', preco: 400, max: 1, desc: 'Ergue uma barreira sólida na frente (8s).' },
    q: { nome: 'Orbe Lento', preco: 200, max: 2, desc: 'Campo que deixa os inimigos muito lentos (6s).' },
    e: { nome: 'Luz Curadora', free: 1, desc: 'Cura 60 de vida em você ou no aliado que você mira.' },
    x: { nome: 'Ressurgir', desc: 'Revive o aliado caído mais perto da mira.' },
  },
  rocha: {
    c: { nome: 'Couraça', preco: 200, max: 1, desc: 'Ganha 50 de escudo extra até o fim do round.' },
    q: { nome: 'Tremor', preco: 250, max: 1, desc: 'Onda no chão à frente que atordoa (1,5s).' },
    e: { nome: 'Pedregulho', free: 1, desc: 'Arremessa uma pedra que atordoa quem estiver perto da queda.' },
    x: { nome: 'Terremoto', desc: 'Atordoa todos os inimigos num raio enorme ao seu redor.' },
  },
};
Object.assign(FPS_HUNTERS, {
  lamina: {
    c: { nome: 'Corte de Vento', preco: 200, max: 2, desc: 'Avanço rápido e longo na direção em que você anda.' },
    q: { nome: 'Corrente Ascendente', preco: 150, max: 1, desc: 'Um salto altíssimo para pegar ângulos de cima.' },
    e: { nome: 'Rajada', free: 1, desc: 'Nuvem curta de vento bem na sua frente (4s). Bloqueia a visão.' },
    x: { nome: 'Leque de Lâminas', desc: 'Arremessa 5 lâminas de uma vez na mira (muito dano na cabeça).' },
  },
  trovao: {
    c: { nome: 'Raio', preco: 250, max: 1, desc: 'Um raio em linha reta: dano e atordoa quem acertar.' },
    q: { nome: 'Clarão', preco: 250, max: 2, desc: 'Clarão que cega quem estiver olhando.' },
    e: { nome: 'Pulso Elétrico', free: 1, desc: 'Revela inimigos num raio de 16m ao seu redor por 3s.' },
    x: { nome: 'Tempestade', desc: 'Cria uma tempestade na mira: dano e lentidão por 6s.' },
  },
  vinha: {
    c: { nome: 'Raízes', preco: 200, max: 1, desc: 'Raízes no chão que quase prendem quem passa (3s).' },
    q: { nome: 'Esporos', preco: 250, max: 2, desc: 'Nuvem de esporos venenosos que fere quem fica dentro.' },
    e: { nome: 'Cortina de Folhas', free: 2, desc: 'Cortina verde onde você mira (14s). Bloqueia a visão.' },
    x: { nome: 'Floresta Viva', desc: 'Três cortinas e raízes enormes ao redor do ponto mirado.' },
  },
  sino: {
    c: { nome: 'Sino Vigia', preco: 200, max: 1, desc: 'Deixa um sino no chão: quando um inimigo passa, ele é revelado e fica lento.' },
    q: { nome: 'Badalo', preco: 250, max: 1, desc: 'Som forte ao seu redor que atordoa inimigos próximos.' },
    e: { nome: 'Canto', free: 1, desc: 'Cura 40 de vida em você e nos aliados perto.' },
    x: { nome: 'Réquiem', desc: 'Aliados perto ganham vida cheia e 50 de escudo.' },
  },
  ancora: {
    c: { nome: 'Corrente', preco: 250, max: 1, desc: 'Lança uma corrente: o primeiro inimigo atingido é puxado e atordoado.' },
    q: { nome: 'Âncora Pesada', preco: 200, max: 1, desc: 'Arremessa a âncora: atordoa quem estiver perto da queda.' },
    e: { nome: 'Escudo de Ferro', free: 1, desc: 'Ergue uma parede de ferro baixa na sua frente (10s).' },
    x: { nome: 'Maré Baixa', desc: 'Puxa e deixa lentos todos os inimigos num raio enorme.' },
  },
});
const FPS_HUNTER_IDS = Object.keys(FPS_HUNTERS);
const FPS_ULT = { brasa: 7, corvo: 6, mare: 7, lumi: 8, rocha: 7, lamina: 7, trovao: 7, vinha: 7, sino: 7, ancora: 7 };
