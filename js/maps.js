// =====================================================================
//  maps.js : os 7 mapas da Arena — cada um com formato e mecânica próprios
// =====================================================================
// Obstáculos: t 'rect' (x,y,w,h) ou 'circ' (x,y,r); hh = altura visual.
//   k: 'ruin' | 'rock' | 'pillar' | 'tree' | 'crystal' | 'hole' (abismo: bloqueia passagem, NÃO bloqueia tiro/visão)
// Áreas (features): f: 'lava' | 'water' | 'ice' | 'bush' | 'fountain' | 'pad' (salto, com "to") | 'bell'
// Tudo em "half" é espelhado no eixo X; "center" não.
const R_ = (k, x, y, w, h, hh) => ({ t: 'rect', k, x, y, w, h, hh });
const C_ = (k, x, y, r, hh) => ({ t: 'circ', k, x, y, r, hh });
const H_ = (x, y, w, h) => ({ t: 'rect', k: 'hole', x, y, w, h, hh: 0, low: true });
const FR = (f, x, y, w, h) => ({ f, t: 'rect', x, y, w, h });
const FC = (f, x, y, r, extra) => Object.assign({ f, t: 'circ', x, y, r }, extra || {});

const DEFAULT_ISLAND = { x: 60, y: 60, w: WORLD_W - 120, h: WORLD_H - 120, r: 260 };

const MAP_DEFS = [
  {
    id: 'vesper', nome: 'Arena de Vésper', tag: 'Equilibrado',
    desc: 'Ruínas antigas e um monólito de Éter no centro. Coberturas para todos os estilos.',
    dica: 'Mapa equilibrado: use as ruínas como cobertura.',
    half: [
      R_('ruin', 400, 500, 54, 150, 70), R_('ruin', 400, 950, 54, 150, 70), R_('ruin', 640, 290, 230, 52, 64), R_('ruin', 640, 1258, 230, 52, 64),
      C_('pillar', 720, 680, 38, 120), C_('pillar', 720, 920, 38, 120), R_('rock', 905, 500, 74, 66, 56), R_('rock', 905, 1034, 74, 66, 56),
      R_('ruin', 1010, 120, 60, 210, 76), R_('ruin', 1010, 1270, 60, 210, 76), C_('tree', 290, 250, 46, 150), C_('tree', 290, 1350, 46, 150),
      C_('tree', 560, 800, 40, 140), C_('tree', 820, 140, 42, 140), C_('tree', 820, 1460, 42, 140), R_('rock', 560, 1010, 60, 46, 44), R_('rock', 560, 545, 60, 46, 44),
    ],
    center: [C_('crystal', 1200, 800, 64, 190), R_('ruin', 1140, 390, 120, 50, 66), R_('ruin', 1140, 1160, 120, 50, 66), C_('crystal', 1200, 170, 30, 100), C_('crystal', 1200, 1430, 30, 100)],
    features: [], centerFeatures: [],
    theme: {
      ground: ['#4b7a49', '#2d5236'], blotch: ['rgba(20,45,25,0.10)', 'rgba(120,160,90,0.07)'], blades: { h: [95, 135], s: [35, 60], l: [22, 47] },
      path: ['rgba(92,72,52,0.85)', 'rgba(130,104,74,0.6)'], plaza: { h: 35, s: 10, l: 52, line: 'rgba(127,245,255,0.35)' },
      flowers: ['#ffe7a3', '#ff9fc4', '#b9a6ff', '#ffffff', '#8ff0ff'], cracks: 'rgba(15,25,15,0.35)', rim: 'rgba(190,240,170,0.35)',
      ruin: ['#c9b48c', '#8c7656', '#5e4d37'], rock: ['#8a95a3', '#596372', '#3b4350'], pillar: ['#6f6658', '#c8bba0', '#5a5246'],
      tree: 'leaf', crystal: ['#2a8fb0', '#bff9ff', '#1c5d86'], glow: '120,240,255', moss: true, cor: '#5b8f55',
    },
  },
  {
    id: 'forja', nome: 'Forja de Cinza', tag: 'Pontes e lava',
    desc: 'Dois rios de lava cortam a ilha. Só dá pra atravessar pelas 3 pontes. Gêiseres entram em erupção no meio.',
    dica: 'A lava queima! Atravesse pelas pontes. Fuja dos gêiseres quando o chão brilhar.',
    vents: [[1040, 520], [1040, 1080], [1360, 520], [1360, 1080]],
    half: [
      R_('rock', 420, 420, 64, 110, 70), R_('rock', 420, 1070, 64, 110, 70), C_('pillar', 520, 620, 30, 90), C_('pillar', 520, 980, 30, 90),
      R_('ruin', 820, 560, 120, 44, 60), R_('ruin', 820, 996, 120, 44, 60), R_('rock', 980, 300, 64, 64, 58), R_('rock', 980, 1236, 64, 64, 58),
      C_('crystal', 900, 800, 30, 100), C_('tree', 300, 300, 38, 130), C_('tree', 300, 1300, 38, 130),
    ],
    center: [R_('rock', 1140, 740, 120, 120, 96), C_('crystal', 1200, 330, 34, 110), C_('crystal', 1200, 1270, 34, 110)],
    features: [FR('lava', 640, 40, 90, 260), FR('lava', 640, 400, 90, 360), FR('lava', 640, 840, 90, 360), FR('lava', 640, 1300, 90, 260)],
    centerFeatures: [],
    theme: {
      ground: ['#4a3530', '#1e1517'], blotch: ['rgba(0,0,0,0.18)', 'rgba(255,90,30,0.05)'], blades: null, specks: ['#5a4440', '#2a2020', '#7a5a4a'],
      path: ['rgba(30,22,22,0.85)', 'rgba(70,50,44,0.6)'], plaza: { h: 10, s: 8, l: 22, line: 'rgba(255,120,40,0.45)' },
      flowers: ['#ff7a1a', '#ffb040'], cracks: 'rgba(255,110,30,0.55)', crackGlow: true, rim: 'rgba(255,140,60,0.35)',
      ruin: ['#5a5560', '#33303a', '#1e1c24'], rock: ['#3a3236', '#241e22', '#141014'], pillar: ['#3a2a24', '#8a5a3a', '#2a1a14'],
      tree: 'charred', crystal: ['#b0301a', '#ffd0a0', '#701808'], glow: '255,120,40', moss: false, cor: '#c2502a',
    },
  },
  {
    id: 'lagos', nome: 'Lagos Suspensos', tag: 'Campo aberto',
    desc: 'Poucas paredes e lagos rasos que deixam você lento. A fonte do centro cura quem fica nela.',
    dica: 'A água deixa você 40% mais lento. A fonte no centro cura: dispute ela!',
    half: [
      R_('ruin', 470, 520, 46, 110, 64), R_('ruin', 470, 970, 46, 110, 64), C_('pillar', 760, 800, 28, 110),
      R_('ruin', 1000, 250, 46, 140, 60), R_('ruin', 1000, 1210, 46, 140, 60), C_('tree', 330, 280, 40, 150), C_('tree', 330, 1320, 40, 150),
      C_('pillar', 1040, 800, 22, 100),
    ],
    center: [C_('pillar', 1200, 620, 24, 110), C_('pillar', 1200, 980, 24, 110)],
    features: [FC('water', 760, 460, 150), FC('water', 760, 1140, 150)],
    centerFeatures: [FC('fountain', 1200, 800, 110), FC('water', 1200, 300, 140), FC('water', 1200, 1300, 140)],
    theme: {
      ground: ['#5f9a86', '#2c5a52'], blotch: ['rgba(10,40,40,0.12)', 'rgba(150,220,200,0.07)'], blades: { h: [150, 175], s: [30, 50], l: [28, 48] },
      path: ['rgba(200,200,190,0.75)', 'rgba(235,235,225,0.55)'], plaza: { h: 190, s: 12, l: 70, line: 'rgba(127,245,255,0.5)' },
      flowers: ['#ffffff', '#8ff0ff', '#c0d8ff'], cracks: 'rgba(10,40,40,0.25)', rim: 'rgba(160,255,240,0.4)',
      ruin: ['#eef0f2', '#a8b0b8', '#6a7480'], rock: ['#8fa8b0', '#5a707a', '#3a4a52'], pillar: ['#9aa4aa', '#f2f4f6', '#7a848a'],
      tree: 'willow', crystal: ['#1a9cb0', '#d0ffff', '#0a5a70'], glow: '120,255,240', moss: true, cor: '#3fb6a8',
    },
  },
  {
    id: 'picos', nome: 'Picos Uivantes', tag: 'Estreito e vento',
    desc: 'Ilha estreita no topo do mundo. O gelo escorrega e rajadas de vento empurram todos para um lado.',
    dica: 'Mapa estreito: briga de perto. No gelo você escorrega. Cuidado com as rajadas de vento!',
    island: { x: 60, y: 300, w: WORLD_W - 120, h: 1000, r: 200 }, wind: true,
    half: [
      C_('tree', 430, 480, 32, 140), C_('tree', 430, 1120, 32, 140), C_('tree', 620, 620, 30, 130), C_('tree', 620, 980, 30, 130),
      C_('tree', 820, 430, 32, 140), C_('tree', 820, 1170, 32, 140), C_('tree', 1000, 560, 30, 130), C_('tree', 1000, 1040, 30, 130),
      R_('rock', 560, 780, 50, 40, 40), R_('rock', 960, 780, 60, 44, 50),
    ],
    center: [C_('crystal', 1200, 520, 34, 120), C_('crystal', 1200, 1080, 34, 120)],
    features: [FC('ice', 760, 800, 130)], centerFeatures: [FC('ice', 1200, 800, 160)],
    theme: {
      ground: ['#e8eef6', '#aebccc'], blotch: ['rgba(90,110,140,0.10)', 'rgba(255,255,255,0.18)'], blades: null, specks: ['#ffffff', '#d0dcea', '#c0cee0'],
      path: ['rgba(150,160,175,0.7)', 'rgba(190,200,212,0.6)'], plaza: { h: 210, s: 10, l: 70, line: 'rgba(150,200,255,0.5)' },
      flowers: [], cracks: 'rgba(90,110,140,0.25)', rim: 'rgba(255,255,255,0.6)', snow: true,
      ruin: ['#c8d0da', '#8a96a6', '#5a6676'], rock: ['#9aa8b8', '#64707e', '#3e4854'], pillar: ['#8a94a0', '#e0e8f0', '#6a7480'],
      tree: 'pine', crystal: ['#5aa8e0', '#eaf8ff', '#2a6aa8'], glow: '170,220,255', moss: false, cor: '#9fc8ff',
    },
  },
  {
    id: 'jardim', nome: 'Jardim Caído', tag: 'Moitas e emboscada',
    desc: 'Mata fechada. Quem está dentro de uma moita fica invisível para o inimigo, até chegar perto ou atacar.',
    dica: 'Moitas escondem você! Quem atacar de dentro da moita é revelado por 1s.',
    half: [
      C_('tree', 340, 380, 40, 150), C_('tree', 340, 1220, 40, 150), C_('tree', 620, 330, 38, 140), C_('tree', 620, 1270, 38, 140),
      C_('tree', 880, 640, 34, 140), C_('tree', 880, 960, 34, 140), C_('tree', 1040, 330, 36, 140), C_('tree', 1040, 1270, 36, 140), R_('ruin', 560, 770, 40, 60, 50),
    ],
    center: [C_('crystal', 1200, 800, 40, 150)],
    features: [FC('bush', 520, 560, 75), FC('bush', 520, 1040, 75), FC('bush', 740, 800, 85), FC('bush', 1010, 520, 70), FC('bush', 1010, 1080, 70), FC('bush', 800, 420, 60), FC('bush', 800, 1180, 60)],
    centerFeatures: [FC('bush', 1200, 560, 70), FC('bush', 1200, 1040, 70)],
    theme: {
      ground: ['#3f7a3a', '#1e4424'], blotch: ['rgba(10,30,10,0.16)', 'rgba(140,200,90,0.07)'], blades: { h: [90, 130], s: [45, 70], l: [20, 42] },
      path: ['rgba(70,52,34,0.85)', 'rgba(110,84,56,0.6)'], plaza: { h: 90, s: 12, l: 40, line: 'rgba(255,127,182,0.4)' },
      flowers: ['#ff7fb6', '#ffd65a', '#ffffff', '#c58bff', '#ff9a5a', '#ff7fb6'], cracks: 'rgba(10,30,10,0.35)', rim: 'rgba(170,240,140,0.4)',
      ruin: ['#9aa878', '#5e6a46', '#3a4430'], rock: ['#6a7a5a', '#46543a', '#2c3624'], pillar: ['#5a6a4a', '#a0b080', '#3a4a2a'],
      tree: 'jungle', crystal: ['#c04a8a', '#ffd0ea', '#701a50'], glow: '255,140,200', moss: true, cor: '#ff7fb6',
    },
  },
  {
    id: 'mosteiro', nome: 'Mosteiro dos Ecos', tag: '3 corredores e sino',
    desc: 'Muros dividem o pátio em 3 corredores. Quem segurar o Sino do centro por 3s revela os inimigos ao time.',
    dica: 'Fique 3s no Sino (centro) sem inimigos por perto: seu time vê todos os inimigos por 5s.',
    half: [
      R_('ruin', 560, 500, 420, 40, 80), R_('ruin', 560, 1060, 420, 40, 80),
      C_('pillar', 720, 300, 24, 120), C_('pillar', 720, 1300, 24, 120), C_('pillar', 860, 700, 24, 120), C_('pillar', 860, 900, 24, 120),
      R_('ruin', 420, 740, 36, 120, 70), C_('tree', 300, 300, 38, 140), C_('tree', 300, 1300, 38, 140), C_('pillar', 1040, 690, 22, 110), C_('pillar', 1040, 910, 22, 110),
    ],
    center: [R_('ruin', 1140, 560, 120, 36, 76), R_('ruin', 1140, 1004, 120, 36, 76)],
    features: [], centerFeatures: [FC('bell', 1200, 800, 110)],
    theme: {
      ground: ['#d8b88a', '#a07e52'], blotch: ['rgba(90,60,30,0.10)', 'rgba(255,240,200,0.08)'], blades: null, tiles: true, specks: ['#c0a070', '#e0c8a0'],
      path: ['rgba(150,40,40,0.75)', 'rgba(190,70,60,0.6)'], plaza: { h: 32, s: 20, l: 62, line: 'rgba(255,214,90,0.5)' },
      flowers: [], cracks: 'rgba(90,60,30,0.3)', rim: 'rgba(255,230,180,0.4)',
      ruin: ['#e0c090', '#a8804e', '#6e5230'], rock: ['#b89a70', '#7e6644', '#54422a'], pillar: ['#8a2a20', '#d8503a', '#6a1a12'],
      tree: 'cherry', crystal: ['#c09020', '#fff0b0', '#7a5a08'], glow: '255,214,90', moss: false, cor: '#ffd65a',
    },
  },
  {
    id: 'zenite', nome: 'Zênite', tag: 'Abismos e saltos',
    desc: 'Abismos dividem a ilha em plataformas ligadas por pontes estreitas. Plataformas de salto cruzam o vão.',
    dica: 'Não dá pra andar sobre o abismo, mas dá pra atirar por cima. Pise nas plataformas de salto para cruzar.',
    half: [
      H_(800, 62, 120, 268), H_(800, 470, 120, 660), H_(800, 1270, 120, 268),
      R_('rock', 460, 480, 70, 70, 70), R_('rock', 460, 1050, 70, 70, 70), R_('rock', 1020, 560, 60, 60, 56), R_('rock', 1020, 980, 60, 60, 56),
      C_('pillar', 560, 800, 26, 150), R_('rock', 300, 280, 60, 60, 60), R_('rock', 300, 1260, 60, 60, 60),
    ],
    center: [C_('crystal', 1200, 800, 44, 170), R_('ruin', 1120, 380, 160, 40, 56), R_('ruin', 1120, 1180, 160, 40, 56)],
    features: [FC('pad', 700, 740, 34, { to: [1020, 740] }), FC('pad', 1010, 860, 34, { to: [690, 860] })],
    centerFeatures: [],
    theme: {
      ground: ['#3a4250', '#1c2028'], blotch: ['rgba(0,0,0,0.15)', 'rgba(120,200,255,0.04)'], blades: null, metal: true, specks: ['#4a5260', '#2a3038'],
      path: ['rgba(60,200,255,0.25)', 'rgba(127,245,255,0.35)'], plaza: { h: 210, s: 15, l: 30, line: 'rgba(127,245,255,0.6)' },
      flowers: [], cracks: 'rgba(0,0,0,0.25)', rim: 'rgba(127,245,255,0.5)',
      ruin: ['#6a7480', '#3a424c', '#22282e'], rock: ['#5a6470', '#343c46', '#1e242a'], pillar: ['#2a3440', '#7ff5ff', '#1a2228'],
      tree: 'leaf', crystal: ['#7a3ab0', '#e8d0ff', '#3a1a70'], glow: '190,140,255', moss: false, cor: '#7ff5ff',
    },
  },
];
const MAP_IDS = MAP_DEFS.map(m => m.id);
let CUR_MAP = MAP_DEFS[0];
const FEATURES = [];
const mapHooks = [];
function mapDef(id) { return MAP_DEFS.find(m => m.id === id) || MAP_DEFS[0]; }
function mirror(o) {
  const m = { ...o };
  m.x = o.t === 'rect' ? WORLD_W - o.x - o.w : WORLD_W - o.x;
  if (o.to) m.to = [WORLD_W - o.to[0], o.to[1]];
  return m;
}
function setMap(id) {
  const d = mapDef(id);
  Object.assign(ISLAND, d.island || DEFAULT_ISLAND);
  MAP_OBS.length = 0;
  for (const o of d.half) { MAP_OBS.push({ ...o }); MAP_OBS.push(mirror(o)); }
  for (const o of d.center) MAP_OBS.push({ ...o });
  MAP_OBS.forEach((o, i) => { o.id = i; o.seed = (i * 9301 + 49297 + d.id.length * 7919) % 233280; });
  FEATURES.length = 0;
  for (const f of d.features) { FEATURES.push({ ...f }); FEATURES.push(mirror(f)); }
  for (const f of d.centerFeatures) FEATURES.push({ ...f });
  FEATURES.forEach((f, i) => { f.id = i; });
  CUR_MAP = d;
  for (const f of mapHooks) f(d);
}
function inFeature(f, x, y, pad = 0) {
  if (f.t === 'rect') return x > f.x - pad && x < f.x + f.w + pad && y > f.y - pad && y < f.y + f.h + pad;
  return (x - f.x) ** 2 + (y - f.y) ** 2 < (f.r + pad) ** 2;
}
function featuresAt(x, y, kind) { return FEATURES.filter(f => (!kind || f.f === kind) && inFeature(f, x, y)); }
function inBush(x, y) { for (const f of FEATURES) if (f.f === 'bush' && inFeature(f, x, y)) return f; return null; }
setMap('vesper');
