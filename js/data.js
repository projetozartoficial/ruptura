// =====================================================================
//  RUPTURA — Caçadores do Abismo
//  data.js : universo, classes, caçadores e mapa
// =====================================================================

const WORLD_W = 2400, WORLD_H = 1600;
const TICK = 1 / 60;
const WIN_ROUNDS = 3;

const TEAMS = [
  { name: 'Alvorada', main: '#3fa9ff', light: '#a8dcff', dark: '#174a86', glow: 'rgba(63,169,255,' },
  { name: 'Crepúsculo', main: '#ff5a4a', light: '#ffb3a8', dark: '#86201a', glow: 'rgba(255,90,74,' },
];

const LORE = {
  titulo: 'RUPTURA',
  subtitulo: 'Caçadores do Abismo',
  mundo: 'Há trezentos anos o céu se partiu. A Ruptura rasgou o mundo em ilhas que flutuam sobre o Abismo, um vazio sem fundo de onde sobe a Névoa Rubra. Das rachaduras do céu caem Fragmentos de Éter, cristais que dão poder a quem os carrega. As Casas de Caça mandam seus melhores Caçadores disputar cada fragmento, e a Arena de Vésper é onde as rivalidades se resolvem: dois esquadrões, uma ilha e a Névoa fechando o cerco.',
  arena: 'Arena de Vésper: uma ilha de ruínas antigas, presa ao céu por um monólito de Éter no centro. Dizem que quem cai da borda nunca chega ao fundo.',
};

const CLASSES = {
  lutador:     { nome: 'Lutador',     cor: '#ff7a3d', icone: '⚔', desc: 'Dano massivo de curta e média distância.' },
  iniciador:   { nome: 'Iniciador',   cor: '#b46bff', icone: '➶', desc: 'Força o começo das lutas e caça alvos isolados.' },
  controlador: { nome: 'Controlador', cor: '#2fd6c5', icone: '◎', desc: 'Manipula o campo de batalha e controla zonas.' },
  protetor:    { nome: 'Protetor',    cor: '#ffd65a', icone: '✚', desc: 'Cura, escudos e sustentação do esquadrão.' },
  vanguarda:   { nome: 'Vanguarda',   cor: '#9aa7b8', icone: '⛨', desc: 'Tanque que absorve dano e protege a linha de trás.' },
};

// Cada caçador: atributos + textos. A lógica das habilidades fica em sim.js
const HUNTERS = {
  brasa: {
    nome: 'Brasa', titulo: 'A Pistoleira da Forja', classe: 'lutador',
    hp: 520, speed: 232, r: 22,
    cores: { pele: '#e8b48e', roupa: '#b8321e', roupa2: '#5a1a12', detalhe: '#ffb13b', cabelo: '#ff5a1f', arma: '#2b2b33' },
    lore: 'Kaela Ferro cresceu nas forjas da Ilha de Cinza, onde os Fragmentos são derretidos em munição. Quando a Casa Ferro foi traída, ela pegou as duas pistolas do pai e jurou queimar cada traidor do arquipélago.',
    habilidades: {
      basico: { nome: 'Tiro Ígneo', cd: 0.28, desc: 'Disparos rápidos de brasa. Segure o botão esquerdo.' },
      q: { nome: 'Leque de Brasas', cd: 6, desc: 'Dispara 5 brasas em leque. Devastador de perto.' },
      e: { nome: 'Investida Ígnea', cd: 8, desc: 'Avança na direção da mira deixando um rastro de fogo.' },
      r: { nome: 'Coração do Vulcão', cd: 42, desc: 'Lança uma bola de fogo gigante que explode e deixa o chão em chamas.' },
    },
  },
  corvo: {
    nome: 'Corvo', titulo: 'A Sombra que Caça', classe: 'iniciador',
    hp: 480, speed: 252, r: 21,
    cores: { pele: '#c99a7c', roupa: '#3a2352', roupa2: '#1a1026', detalhe: '#c58bff', cabelo: '#151018', arma: '#d9dce8' },
    lore: 'Ninguém sabe o nome verdadeiro de Corvo. Diz-se que ela caiu no Abismo ainda criança e voltou com penas negras e olhos que enxergam no escuro. Ela caça por contrato e nunca deixa um alvo escapar.',
    habilidades: {
      basico: { nome: 'Adaga Lançada', cd: 0.33, desc: 'Arremessa adagas rápidas e precisas.' },
      q: { nome: 'Corrente do Corvo', cd: 9, desc: 'Lança uma corrente que puxa o inimigo atingido e o atordoa.' },
      e: { nome: 'Passo Sombrio', cd: 7, desc: 'Teleporta até a mira, ferindo e lentificando quem estiver perto.' },
      r: { nome: 'Caçada', cd: 45, desc: 'Por 5s: +35% velocidade, +40% dano, adagas duplas e roubo de vida.' },
    },
  },
  mare: {
    nome: 'Maré', titulo: 'A Senhora das Correntes', classe: 'controlador',
    hp: 470, speed: 226, r: 21,
    cores: { pele: '#8fc7c0', roupa: '#127a83', roupa2: '#0b3d4a', detalhe: '#7ff5ff', cabelo: '#e8fbff', arma: '#7ff5ff' },
    lore: 'Nalu era sacerdotisa dos Lagos Suspensos, ilhas inteiras feitas de água que nunca cai. Quando a Névoa Rubra secou seu templo, ela aprendeu a dobrar a própria maré para lutar.',
    habilidades: {
      basico: { nome: 'Orbe de Água', cd: 0.42, desc: 'Esfera de água que fere e lentifica levemente.' },
      q: { nome: 'Poça Abissal', cd: 8, desc: 'Cria uma poça na mira que lentifica e causa dano.' },
      e: { nome: 'Muralha de Gelo', cd: 12, desc: 'Ergue uma muralha que bloqueia tiros, passagem e visão.' },
      r: { nome: 'Maremoto', cd: 45, desc: 'Uma onda gigante que empurra e atordoa todos os inimigos no caminho.' },
    },
  },
  lumi: {
    nome: 'Lumi', titulo: 'O Farol Vivo', classe: 'protetor',
    hp: 460, speed: 236, r: 21,
    cores: { pele: '#f2d2b6', roupa: '#f3f0e6', roupa2: '#b99a4a', detalhe: '#ffe27a', cabelo: '#fff6c9', arma: '#ffe27a' },
    lore: 'Lumi foi o último aprendiz dos Faroleiros, guardiões que guiavam navios-voadores entre as ilhas. O farol caiu, mas a luz ficou nele. Agora ele guia o esquadrão e não deixa ninguém para trás.',
    habilidades: {
      basico: { nome: 'Raio Prismático', cd: 0.35, desc: 'Raio de luz que fere inimigos e cura aliados que atravessa.' },
      q: { nome: 'Égide', cd: 9, desc: 'Dá um escudo ao aliado mais perto da mira (ou a si mesmo).' },
      e: { nome: 'Santuário', cd: 14, desc: 'Cria um círculo de luz que cura aliados dentro dele.' },
      r: { nome: 'Aurora', cd: 50, desc: 'Cura todos os aliados próximos, remove atordoamentos e dá velocidade.' },
    },
  },
  rocha: {
    nome: 'Rocha', titulo: 'O Muro de Vésper', classe: 'vanguarda',
    hp: 820, speed: 212, r: 26,
    cores: { pele: '#9c7b63', roupa: '#5d6470', roupa2: '#353a43', detalhe: '#f2a33a', cabelo: '#2a2a2a', arma: '#7b828e' },
    lore: 'Tauro Rocha foi pedreiro nas fundações das ilhas, preso por correntes de Éter ao monólito central. Quando o monólito o escolheu, sua pele virou pedra. Ele não fala muito, mas nenhum aliado cai enquanto ele estiver de pé.',
    habilidades: {
      basico: { nome: 'Martelada', cd: 0.62, desc: 'Golpe em arco à frente com o martelo.' },
      q: { nome: 'Fenda Sísmica', cd: 8, desc: 'Racha o chão em linha reta atordoando todos atingidos.' },
      e: { nome: 'Bastião', cd: 11, desc: 'Ergue o escudo: -50% de dano e bloqueia tiros vindos da frente.' },
      r: { nome: 'Avalanche', cd: 45, desc: 'Salta até a mira e esmaga a área, atordoando todos.' },
    },
  },
};
const HUNTER_IDS = Object.keys(HUNTERS);
const DASH_CD = 6;

// ------------------------------------------------------------------
//  MAPA — Arena de Vésper (espelhado no eixo X)
// ------------------------------------------------------------------
function buildMap() {
  const half = [
    { t: 'rect', k: 'ruin', x: 400, y: 500, w: 54, h: 150, hh: 70 },
    { t: 'rect', k: 'ruin', x: 400, y: 950, w: 54, h: 150, hh: 70 },
    { t: 'rect', k: 'ruin', x: 640, y: 290, w: 230, h: 52, hh: 64 },
    { t: 'rect', k: 'ruin', x: 640, y: 1258, w: 230, h: 52, hh: 64 },
    { t: 'circ', k: 'pillar', x: 720, y: 680, r: 38, hh: 120 },
    { t: 'circ', k: 'pillar', x: 720, y: 920, r: 38, hh: 120 },
    { t: 'rect', k: 'rock', x: 905, y: 500, w: 74, h: 66, hh: 56 },
    { t: 'rect', k: 'rock', x: 905, y: 1034, w: 74, h: 66, hh: 56 },
    { t: 'rect', k: 'ruin', x: 1010, y: 120, w: 60, h: 210, hh: 76 },
    { t: 'rect', k: 'ruin', x: 1010, y: 1270, w: 60, h: 210, hh: 76 },
    { t: 'circ', k: 'tree', x: 290, y: 250, r: 46, hh: 150 },
    { t: 'circ', k: 'tree', x: 290, y: 1350, r: 46, hh: 150 },
    { t: 'circ', k: 'tree', x: 560, y: 800, r: 40, hh: 140 },
    { t: 'circ', k: 'tree', x: 820, y: 140, r: 42, hh: 140 },
    { t: 'circ', k: 'tree', x: 820, y: 1460, r: 42, hh: 140 },
    { t: 'rect', k: 'rock', x: 560, y: 1010, w: 60, h: 46, hh: 44 },
    { t: 'rect', k: 'rock', x: 560, y: 545, w: 60, h: 46, hh: 44 },
  ];
  const center = [
    { t: 'circ', k: 'crystal', x: 1200, y: 800, r: 64, hh: 190 },
    { t: 'rect', k: 'ruin', x: 1140, y: 390, w: 120, h: 50, hh: 66 },
    { t: 'rect', k: 'ruin', x: 1140, y: 1160, w: 120, h: 50, hh: 66 },
    { t: 'circ', k: 'crystal', x: 1200, y: 170, r: 30, hh: 100 },
    { t: 'circ', k: 'crystal', x: 1200, y: 1430, r: 30, hh: 100 },
  ];
  const obs = [];
  for (const o of half) {
    obs.push({ ...o });
    const m = { ...o };
    if (o.t === 'rect') m.x = WORLD_W - o.x - o.w; else m.x = WORLD_W - o.x;
    obs.push(m);
  }
  for (const o of center) obs.push({ ...o });
  obs.forEach((o, i) => { o.id = i; o.seed = (i * 9301 + 49297) % 233280; });
  return obs;
}
const MAP_OBS = buildMap();

// Ilha: retângulo arredondado com margem (a borda é o Abismo)
const ISLAND = { x: 60, y: 60, w: WORLD_W - 120, h: WORLD_H - 120, r: 260 };

const SPAWNS = [
  [{ x: 210, y: 640 }, { x: 260, y: 740 }, { x: 260, y: 860 }, { x: 210, y: 960 }],
  [{ x: WORLD_W - 210, y: 640 }, { x: WORLD_W - 260, y: 740 }, { x: WORLD_W - 260, y: 860 }, { x: WORLD_W - 210, y: 960 }],
];
