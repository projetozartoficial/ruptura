// =====================================================================
//  RUPTURA — Caçadores do Abismo
//  js/data.js : universo, classes e caçadores (nomes, cores e história).
//  As habilidades do modo tático ficam em fps/data.js e fps/game.js.
// =====================================================================

const TICK = 1 / 60;

const TEAMS = [
  {
    "name": "Alvorada",
    "main": "#3fa9ff",
    "light": "#a8dcff",
    "dark": "#174a86",
    "glow": "rgba(63,169,255,"
  },
  {
    "name": "Crepúsculo",
    "main": "#ff5a4a",
    "light": "#ffb3a8",
    "dark": "#86201a",
    "glow": "rgba(255,90,74,"
  }
];

const LORE = { mundo: "Há trezentos anos o céu se partiu. A Ruptura rasgou o mundo em ilhas que flutuam sobre o Abismo, um vazio sem fundo de onde sobe a Névoa Rubra. Das rachaduras do céu caem Fragmentos de Éter, cristais que dão poder a quem os carrega. As Casas de Caça mandam seus melhores Caçadores disputar cada fragmento, e a Arena de Vésper é onde as rivalidades se resolvem: dois esquadrões, uma ilha e a Névoa fechando o cerco." };

// As 4 funções do time
const CLASSES = {
  desafiante: { nome: 'Desafiante', cor: '#ff6a3d', icone: '⚔', desc: 'Abre espaço: puxa a entrada no site e vence os duelos diretos.' },
  dominador:  { nome: 'Dominador',  cor: '#2fd6c5', icone: '◎', desc: 'Corta a visão com cortinas e barreiras e dita o ritmo das entradas e retomadas.' },
  batedor:    { nome: 'Batedor',    cor: '#b46bff', icone: '➶', desc: 'Revela posições, atordoa e cega os inimigos e prepara o terreno para o time.' },
  guardiao:   { nome: 'Guardião',   cor: '#ffd65a', icone: '⛨', desc: 'Protege áreas, vigia os flancos e atrasa o avanço do inimigo.' },
};

const HUNTERS = {
  brasa: {
    nome: "Brasa", titulo: "A Pistoleira da Forja", classe: "desafiante",
    cores: {"pele":"#e8b48e","roupa":"#b8321e","roupa2":"#5a1a12","detalhe":"#ffb13b","cabelo":"#ff5a1f","arma":"#2b2b33"},
    lore: "Kaela Ferro cresceu nas forjas da Ilha de Cinza, onde os Fragmentos são derretidos em munição. Quando a Casa Ferro foi traída, ela pegou as duas pistolas do pai e jurou queimar cada traidor do arquipélago.",
  },
  corvo: {
    nome: "Corvo", titulo: "A Sombra que Caça", classe: "batedor",
    cores: {"pele":"#c99a7c","roupa":"#3a2352","roupa2":"#1a1026","detalhe":"#c58bff","cabelo":"#151018","arma":"#d9dce8"},
    lore: "Ninguém sabe o nome verdadeiro de Corvo. Diz-se que ela caiu no Abismo ainda criança e voltou com penas negras e olhos que enxergam no escuro. Ela caça por contrato e nunca deixa um alvo escapar.",
  },
  mare: {
    nome: "Maré", titulo: "A Senhora das Correntes", classe: "dominador",
    cores: {"pele":"#8fc7c0","roupa":"#127a83","roupa2":"#0b3d4a","detalhe":"#7ff5ff","cabelo":"#e8fbff","arma":"#7ff5ff"},
    lore: "Nalu era sacerdotisa dos Lagos Suspensos, ilhas inteiras feitas de água que nunca cai. Quando a Névoa Rubra secou seu templo, ela aprendeu a dobrar a própria maré para lutar.",
  },
  lumi: {
    nome: "Lumi", titulo: "O Farol Vivo", classe: "dominador",
    cores: {"pele":"#f2d2b6","roupa":"#f3f0e6","roupa2":"#b99a4a","detalhe":"#ffe27a","cabelo":"#fff6c9","arma":"#ffe27a"},
    lore: "Lumi foi o último aprendiz dos Faroleiros, guardiões que guiavam navios-voadores entre as ilhas. O farol caiu, mas a luz ficou nele. Agora ele guia o esquadrão e não deixa ninguém para trás.",
  },
  rocha: {
    nome: "Rocha", titulo: "O Muro de Vésper", classe: "batedor",
    cores: {"pele":"#9c7b63","roupa":"#5d6470","roupa2":"#353a43","detalhe":"#f2a33a","cabelo":"#2a2a2a","arma":"#7b828e"},
    lore: "Tauro Rocha foi pedreiro nas fundações das ilhas, preso por correntes de Éter ao monólito central. Quando o monólito o escolheu, sua pele virou pedra. Ele não fala muito, mas nenhum aliado cai enquanto ele estiver de pé.",
  },
  lamina: {
    nome: "Lâmina", titulo: "O Duelista do Vento", classe: "desafiante",
    cores: {"pele":"#d9b08c","roupa":"#2f5d8a","roupa2":"#1b2f45","detalhe":"#9fe3ff","cabelo":"#eef0f6","arma":"#cfd8e6"},
    lore: "Ren Sorai treinou nos Picos Uivantes, ilhas onde o vento nunca para. Diz que sua espada corta o próprio ar e que o vento corta por ele. Luta para provar que a velha Escola do Vento ainda tem um mestre de pé.",
  },
  trovao: {
    nome: "Trovão", titulo: "O Arauto da Tempestade", classe: "batedor",
    cores: {"pele":"#b07a55","roupa":"#3a3f8f","roupa2":"#22254f","detalhe":"#ffe14a","cabelo":"#ffe14a","arma":"#ffe14a"},
    lore: "Kaito Raio era um para-raios vivo nas torres de Éter de Zênite. Um dia o raio não passou por ele: ficou. Agora ele corre na frente do esquadrão e abre as lutas antes que o inimigo veja o clarão.",
  },
  vinha: {
    nome: "Vinha", titulo: "A Guardiã do Bosque", classe: "dominador",
    cores: {"pele":"#c9a27e","roupa":"#3f7a3a","roupa2":"#24481f","detalhe":"#ff7fb6","cabelo":"#5a3a1f","arma":"#7a5a2f"},
    lore: "Flora Vinha é a última druida da Ilha Jardim, que caiu no Abismo durante a Ruptura. Ela carrega as sementes que sobraram e faz a floresta brotar onde pisa, prendendo quem ameaçar o que restou.",
  },
  sino: {
    nome: "Sino", titulo: "O Monge do Eco", classe: "guardiao",
    cores: {"pele":"#e0b896","roupa":"#c76a1e","roupa2":"#7a3a10","detalhe":"#ffd65a","cabelo":"#3a2a20","arma":"#d8b04a"},
    lore: "Irmão Oto viveu cem anos no Mosteiro dos Ecos, onde os sinos tocam sozinhos quando alguém corre perigo. Quando o mosteiro silenciou, ele levou o último sino para a arena. Cada badalada sua é uma promessa de proteção.",
  },
  ancora: {
    nome: "Âncora", titulo: "A Muralha das Correntes", classe: "batedor",
    cores: {"pele":"#8c6a55","roupa":"#4a5a5f","roupa2":"#2a3438","detalhe":"#3fd4c0","cabelo":"#2a3a3f","arma":"#6a7680"},
    lore: "Brígida Âncora era mergulhadora dos portos do céu, presa por correntes para não cair no Abismo. Numa queda ela desceu fundo demais e voltou com o escafandro brilhando. Ela não teme nada que a corrente possa puxar.",
  },
  serra: {
    nome: "Serra", titulo: "A Caçadora de Recompensas", classe: "guardiao",
    cores: {"pele":"#c99a7a","roupa":"#6b4a2f","roupa2":"#3a2818","detalhe":"#e0b050","cabelo":"#3a2a20","arma":"#4a4a52"},
    lore: "Jana Serra caça recompensas nas ilhas sem lei do Arquipélago Baixo. Ela nunca chega perto: um tiro, uma recompensa. O chapéu de aba larga esconde uma cicatriz de cada caçador que tentou pegá-la primeiro.",
  },
  fera: {
    nome: "Fera", titulo: "A Loba de Ônix", classe: "desafiante",
    cores: {"pele":"#b88a6a","roupa":"#5a4a42","roupa2":"#2e2622","detalhe":"#ff6a3a","cabelo":"#d9d2c4","arma":"#e8e2d6"},
    lore: "Criada por lobos nas florestas de Ônix, Lua Fera fala pouco e ataca rápido. Veste a pele do lobo que a criou e luta como ele lutava: em saltos, sempre atrás do mais fraco do bando.",
  },
  duna: {
    nome: "Duna", titulo: "O Senhor das Areias", classe: "dominador",
    cores: {"pele":"#a8744f","roupa":"#d8b070","roupa2":"#8a6a3a","detalhe":"#3fb6a8","cabelo":"#2a2018","arma":"#c8a050"},
    lore: "Zahir Duna guardava a ampulheta do Deserto Flutuante, onde a areia cai para cima. Quando a Ruptura quebrou a ampulheta, a areia passou a obedecer a ele. Diz que tem todo o tempo do mundo, e que os inimigos não.",
  },
  elo: {
    nome: "Elo", titulo: "O Tecelão de Vínculos", classe: "guardiao",
    cores: {"pele":"#e0c0a0","roupa":"#2f6a5a","roupa2":"#1a3a32","detalhe":"#9fffb0","cabelo":"#c0e0ff","arma":"#9fffb0"},
    lore: "Elo tece fios de Éter entre as pessoas. Dizem que nenhum esquadrão que ele acompanhou perdeu alguém para sempre: enquanto o fio não se rompe, ele puxa os caídos de volta.",
  },
  bisao: {
    nome: "Bisão", titulo: "O Aríete das Planícies", classe: "desafiante",
    cores: {"pele":"#7a5a44","roupa":"#6a3a2a","roupa2":"#3a2018","detalhe":"#e0c080","cabelo":"#4a3020","arma":"#8a6a4a"},
    lore: "Toro Bisão guiava manadas pelas planícies suspensas até que a terra rachou embaixo delas. Agora ele carrega o elmo de chifres do líder da manada e avança contra qualquer coisa que ameace os seus.",
  },
  vespa: {
    nome: "Vespa", titulo: "A Arqueira do Ninho", classe: "desafiante",
    cores: {"pele":"#d8a878","roupa":"#2a2a2a","roupa2":"#e0b020","detalhe":"#b6ff3a","cabelo":"#1a1a1a","arma":"#6a5030"},
    lore: "Nina Vespa cresceu nas colmeias gigantes do Bosque Zumbidor, onde as abelhas do Éter têm o tamanho de cães. Ela aprendeu a molhar as flechas no veneno delas. Uma picada não mata ninguém. A terceira, sim.",
  },
  cometa: {
    nome: "Cometa", titulo: "O Viajante Estelar", classe: "batedor",
    cores: {"pele":"#c8b8e8","roupa":"#1e2a5a","roupa2":"#0e1430","detalhe":"#9fd8ff","cabelo":"#f0f4ff","arma":"#9fd8ff"},
    lore: "Ninguém sabe de onde Cometa veio. Ele caiu do céu na noite da Ruptura, dentro de uma pedra em chamas, e acordou sem memória. Só lembra de uma coisa: como cair de novo, e cair com força.",
  },
  teia: {
    nome: "Teia", titulo: "A Tecelã das Sombras", classe: "guardiao",
    cores: {"pele":"#b8a8c8","roupa":"#2a1a3a","roupa2":"#140c20","detalhe":"#d070ff","cabelo":"#e8e0f0","arma":"#d070ff"},
    lore: "Aracne Teia mora nas cavernas debaixo das ilhas, onde a luz não chega. Ela tece fios tão finos que só aparecem quando já é tarde. Os mineiros dizem que, se você ouvir um fio vibrando, é porque ela já sabe onde você está.",
  },
  brisa: {
    nome: "Brisa", titulo: "A Guardiã dos Ventos", classe: "guardiao",
    cores: {"pele":"#e8c8a8","roupa":"#d8eef0","roupa2":"#7ab8c8","detalhe":"#5ff0d0","cabelo":"#a8e8ff","arma":"#5ff0d0"},
    lore: "Céu Brisa cuida dos moinhos que mantêm as ilhas flutuando. Ela conversa com o vento, e o vento obedece. Num campo de batalha, ela empurra os inimigos para longe e leva os aliados nas costas do ar.",
  },
  egide: {
    nome: "Égide", titulo: "A Muralha Viva", classe: "dominador",
    cores: {"pele":"#a87858","roupa":"#8a8a9a","roupa2":"#4a4a5a","detalhe":"#ffcf6a","cabelo":"#6a3a2a","arma":"#c0c0cc"},
    lore: "Égide foi a capitã da guarda da última cidade que caiu na Ruptura. Ela segurou o portão sozinha até todos fugirem. O escudo dela ainda tem as marcas daquela noite, e ela promete que ninguém passa por ele de novo.",
  },
};
