// =====================================================================
//  RUPTURA — Caçadores do Abismo
//  data.js : universo, classes, caçadores e mapa
// =====================================================================

const WORLD_W = 2400, WORLD_H = 1600;
const TICK = 1 / 60;
const WIN_ROUNDS = 5;
const SWAP_TIME = 8; // segundos entre rounds para trocar de caçador

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
    hp: 820, speed: 212, r: 26, big: 1.18,
    cores: { pele: '#9c7b63', roupa: '#5d6470', roupa2: '#353a43', detalhe: '#f2a33a', cabelo: '#2a2a2a', arma: '#7b828e' },
    lore: 'Tauro Rocha foi pedreiro nas fundações das ilhas, preso por correntes de Éter ao monólito central. Quando o monólito o escolheu, sua pele virou pedra. Ele não fala muito, mas nenhum aliado cai enquanto ele estiver de pé.',
    habilidades: {
      basico: { nome: 'Martelada', cd: 0.62, desc: 'Golpe em arco à frente com o martelo.' },
      q: { nome: 'Fenda Sísmica', cd: 8, desc: 'Racha o chão em linha reta atordoando todos atingidos.' },
      e: { nome: 'Bastião', cd: 11, desc: 'Ergue o escudo: -50% de dano e bloqueia tiros vindos da frente.' },
      r: { nome: 'Avalanche', cd: 45, desc: 'Salta até a mira e esmaga a área, atordoando todos.' },
    },
  },
  lamina: {
    nome: 'Lâmina', titulo: 'O Duelista do Vento', classe: 'lutador',
    hp: 560, speed: 240, r: 22,
    cores: { pele: '#d9b08c', roupa: '#2f5d8a', roupa2: '#1b2f45', detalhe: '#9fe3ff', cabelo: '#eef0f6', arma: '#cfd8e6' },
    lore: 'Ren Sorai treinou nos Picos Uivantes, ilhas onde o vento nunca para. Diz que sua espada corta o próprio ar e que o vento corta por ele. Luta para provar que a velha Escola do Vento ainda tem um mestre de pé.',
    habilidades: {
      basico: { nome: 'Corte de Vento', cd: 0.45, desc: 'Lança uma lâmina de vento curta que atravessa vários inimigos.' },
      q: { nome: 'Rajada Cortante', cd: 7, desc: 'Avança cortando todos no caminho.' },
      e: { nome: 'Postura Espelho', cd: 10, desc: 'Por 1s bloqueia todo o dano. Se for atingido, ganha velocidade.' },
      r: { nome: 'Ciclone de Aço', cd: 42, desc: 'Gira por 2,5s cortando tudo em volta e andando mais rápido.' },
    },
  },
  trovao: {
    nome: 'Trovão', titulo: 'O Arauto da Tempestade', classe: 'iniciador',
    hp: 500, speed: 246, r: 22,
    cores: { pele: '#b07a55', roupa: '#3a3f8f', roupa2: '#22254f', detalhe: '#ffe14a', cabelo: '#ffe14a', arma: '#ffe14a' },
    lore: 'Kaito Raio era um para-raios vivo nas torres de Éter de Zênite. Um dia o raio não passou por ele: ficou. Agora ele corre na frente do esquadrão e abre as lutas antes que o inimigo veja o clarão.',
    habilidades: {
      basico: { nome: 'Faísca', cd: 0.36, desc: 'Raio que salta para um segundo inimigo próximo.' },
      q: { nome: 'Investida Trovejante', cd: 9, desc: 'Avança e atordoa o primeiro inimigo que atingir.' },
      e: { nome: 'Campo Estático', cd: 11, desc: 'Cria um campo elétrico em volta que lentifica e fere.' },
      r: { nome: 'Céu Partido', cd: 45, desc: 'Marca uma área: um raio cai depois de um instante e atordoa todos.' },
    },
  },
  vinha: {
    nome: 'Vinha', titulo: 'A Guardiã do Bosque', classe: 'controlador',
    hp: 480, speed: 228, r: 21,
    cores: { pele: '#c9a27e', roupa: '#3f7a3a', roupa2: '#24481f', detalhe: '#ff7fb6', cabelo: '#5a3a1f', arma: '#7a5a2f' },
    lore: 'Flora Vinha é a última druida da Ilha Jardim, que caiu no Abismo durante a Ruptura. Ela carrega as sementes que sobraram e faz a floresta brotar onde pisa, prendendo quem ameaçar o que restou.',
    habilidades: {
      basico: { nome: 'Espinho', cd: 0.4, desc: 'Dispara espinhos afiados.' },
      q: { nome: 'Raízes', cd: 9, desc: 'Raízes avançam em linha e prendem o primeiro inimigo no lugar.' },
      e: { nome: 'Semente Explosiva', cd: 9, desc: 'Planta uma semente que explode depois de 1s, ferindo e lentificando.' },
      r: { nome: 'Floresta Viva', cd: 48, desc: 'Ergue um bosque que cura aliados e prende inimigos que entrarem.' },
    },
  },
  sino: {
    nome: 'Sino', titulo: 'O Monge do Eco', classe: 'protetor',
    hp: 500, speed: 232, r: 21,
    cores: { pele: '#e0b896', roupa: '#c76a1e', roupa2: '#7a3a10', detalhe: '#ffd65a', cabelo: '#3a2a20', arma: '#d8b04a' },
    lore: 'Irmão Oto viveu cem anos no Mosteiro dos Ecos, onde os sinos tocam sozinhos quando alguém corre perigo. Quando o mosteiro silenciou, ele levou o último sino para a arena. Cada badalada sua é uma promessa de proteção.',
    habilidades: {
      basico: { nome: 'Onda Sonora', cd: 0.45, desc: 'Onda de som que atravessa vários inimigos.' },
      q: { nome: 'Ressonância', cd: 10, desc: 'Salta até o aliado mais perto da mira e dá um escudo a ele.' },
      e: { nome: 'Badalada', cd: 9, desc: 'Empurra inimigos próximos e cura aliados ao redor.' },
      r: { nome: 'Canto Sagrado', cd: 50, desc: 'Por 4s aliados próximos recebem 40% menos dano e se curam.' },
    },
  },
  ancora: {
    nome: 'Âncora', titulo: 'A Muralha das Correntes', classe: 'vanguarda',
    hp: 780, speed: 214, r: 25, big: 1.14,
    cores: { pele: '#8c6a55', roupa: '#4a5a5f', roupa2: '#2a3438', detalhe: '#3fd4c0', cabelo: '#2a3a3f', arma: '#6a7680' },
    lore: 'Brígida Âncora era mergulhadora dos portos do céu, presa por correntes para não cair no Abismo. Numa queda ela desceu fundo demais e voltou com o escafandro brilhando. Ela não teme nada que a corrente possa puxar.',
    habilidades: {
      basico: { nome: 'Âncora Giratória', cd: 0.6, desc: 'Arremessa a âncora a curta distância, ferindo e lentificando.' },
      q: { nome: 'Arpão', cd: 9, desc: 'Lança o arpão: se acertar inimigo, ela voa até ele e o atordoa; se acertar parede, ela se puxa até lá.' },
      e: { nome: 'Fortaleza', cd: 12, desc: 'Ganha um escudo enorme por 3s.' },
      r: { nome: 'Correntes do Abismo', cd: 45, desc: 'Puxa todos os inimigos próximos para perto e os atordoa.' },
    },
  },
  serra: {
    nome: 'Serra', titulo: 'A Caçadora de Recompensas', classe: 'lutador',
    hp: 470, speed: 226, r: 21,
    cores: { pele: '#c99a7a', roupa: '#6b4a2f', roupa2: '#3a2818', detalhe: '#e0b050', cabelo: '#3a2a20', arma: '#4a4a52' },
    lore: 'Jana Serra caça recompensas nas ilhas sem lei do Arquipélago Baixo. Ela nunca chega perto: um tiro, uma recompensa. O chapéu de aba larga esconde uma cicatriz de cada caçador que tentou pegá-la primeiro.',
    habilidades: {
      basico: { nome: 'Tiro Certeiro', cd: 0.85, desc: 'Tiro lento e de longo alcance que causa muito dano.' },
      q: { nome: 'Bala Perfurante', cd: 8, desc: 'Um disparo potente que atravessa todos os inimigos em linha.' },
      e: { nome: 'Recuo Tático', cd: 8, desc: 'Salta para trás e ganha velocidade por um instante.' },
      r: { nome: 'Chuva de Balas', cd: 45, desc: 'Cobre uma área com tiros por 3s, ferindo e lentificando.' },
    },
  },
  fera: {
    nome: 'Fera', titulo: 'A Loba de Ônix', classe: 'iniciador',
    hp: 540, speed: 250, r: 22,
    cores: { pele: '#b88a6a', roupa: '#5a4a42', roupa2: '#2e2622', detalhe: '#ff6a3a', cabelo: '#d9d2c4', arma: '#e8e2d6' },
    lore: 'Criada por lobos nas florestas de Ônix, Lua Fera fala pouco e ataca rápido. Veste a pele do lobo que a criou e luta como ele lutava: em saltos, sempre atrás do mais fraco do bando.',
    habilidades: {
      basico: { nome: 'Garras', cd: 0.42, desc: 'Arranhões rápidos de curta distância.' },
      q: { nome: 'Bote', cd: 8, desc: 'Salta até a mira, ferindo e lentificando quem estiver na queda.' },
      e: { nome: 'Rugido', cd: 10, desc: 'Fere e lentifica muito os inimigos em volta.' },
      r: { nome: 'Frenesi', cd: 45, desc: 'Por 5s: ataques 2x mais rápidos, +25% de velocidade e roubo de vida.' },
    },
  },
  duna: {
    nome: 'Duna', titulo: 'O Senhor das Areias', classe: 'controlador',
    hp: 480, speed: 226, r: 21,
    cores: { pele: '#a8744f', roupa: '#d8b070', roupa2: '#8a6a3a', detalhe: '#3fb6a8', cabelo: '#2a2018', arma: '#c8a050' },
    lore: 'Zahir Duna guardava a ampulheta do Deserto Flutuante, onde a areia cai para cima. Quando a Ruptura quebrou a ampulheta, a areia passou a obedecer a ele. Diz que tem todo o tempo do mundo, e que os inimigos não.',
    habilidades: {
      basico: { nome: 'Rajada de Areia', cd: 0.4, desc: 'Lança uma esfera de areia compactada.' },
      q: { nome: 'Areia Movediça', cd: 9, desc: 'Cria uma área que lentifica muito os inimigos.' },
      e: { nome: 'Duna', cd: 13, desc: 'Ergue uma longa muralha de areia que bloqueia tiros, passagem e visão.' },
      r: { nome: 'Redemoinho', cd: 48, desc: 'Um redemoinho que puxa os inimigos para o centro e os fere.' },
    },
  },
  elo: {
    nome: 'Elo', titulo: 'O Tecelão de Vínculos', classe: 'protetor',
    hp: 470, speed: 234, r: 21,
    cores: { pele: '#e0c0a0', roupa: '#2f6a5a', roupa2: '#1a3a32', detalhe: '#9fffb0', cabelo: '#c0e0ff', arma: '#9fffb0' },
    lore: 'Elo tece fios de Éter entre as pessoas. Dizem que nenhum esquadrão que ele acompanhou perdeu alguém para sempre: enquanto o fio não se rompe, ele puxa os caídos de volta.',
    habilidades: {
      basico: { nome: 'Fio de Éter', cd: 0.4, desc: 'Fere inimigos e cura aliados que atravessa.' },
      q: { nome: 'Vínculo', cd: 10, desc: 'Liga-se ao aliado mais perto da mira: ele recebe 30% menos dano e se cura por 4s.' },
      e: { nome: 'Pulso Restaurador', cd: 11, desc: 'Cura você e os aliados em volta.' },
      r: { nome: 'Renascer', cd: 55, desc: 'Revive na hora o aliado caído mais perto da mira. Sem caídos, cura todo o time.' },
    },
  },
  bisao: {
    nome: 'Bisão', titulo: 'O Aríete das Planícies', classe: 'vanguarda',
    hp: 800, speed: 212, r: 26, big: 1.16,
    cores: { pele: '#7a5a44', roupa: '#6a3a2a', roupa2: '#3a2018', detalhe: '#e0c080', cabelo: '#4a3020', arma: '#8a6a4a' },
    lore: 'Toro Bisão guiava manadas pelas planícies suspensas até que a terra rachou embaixo delas. Agora ele carrega o elmo de chifres do líder da manada e avança contra qualquer coisa que ameace os seus.',
    habilidades: {
      basico: { nome: 'Cabeçada', cd: 0.65, desc: 'Golpe em arco à frente.' },
      q: { nome: 'Investida', cd: 9, desc: 'Avança com tudo e atordoa o primeiro inimigo atingido.' },
      e: { nome: 'Couraça', cd: 12, desc: 'Por 3s: -40% de dano e imune a atordoar, prender e lentificar.' },
      r: { nome: 'Estouro da Manada', cd: 45, desc: 'Três ondas de choque seguidas em volta de você.' },
    },
  },
  vespa: {
    nome: 'Vespa', titulo: 'A Arqueira do Ninho', classe: 'lutador',
    hp: 490, speed: 238, r: 20,
    cores: { pele: '#d8a878', roupa: '#2a2a2a', roupa2: '#e0b020', detalhe: '#b6ff3a', cabelo: '#1a1a1a', arma: '#6a5030' },
    lore: 'Nina Vespa cresceu nas colmeias gigantes do Bosque Zumbidor, onde as abelhas do Éter têm o tamanho de cães. Ela aprendeu a molhar as flechas no veneno delas. Uma picada não mata ninguém. A terceira, sim.',
    habilidades: {
      basico: { nome: 'Ferrão', cd: 0.32, desc: 'Flecha rápida que envenena (dano ao longo do tempo).' },
      q: { nome: 'Rajada Tripla', cd: 7, desc: 'Dispara três ferrões em leque.' },
      e: { nome: 'Voo Rasante', cd: 8, desc: 'Avança rápido até a mira.' },
      r: { nome: 'Enxame', cd: 45, desc: 'Solta um enxame numa área: fere, lentifica e envenena por 4s.' },
    },
  },
  cometa: {
    nome: 'Cometa', titulo: 'O Viajante Estelar', classe: 'iniciador',
    hp: 560, speed: 244, r: 21,
    cores: { pele: '#c8b8e8', roupa: '#1e2a5a', roupa2: '#0e1430', detalhe: '#9fd8ff', cabelo: '#f0f4ff', arma: '#9fd8ff' },
    lore: 'Ninguém sabe de onde Cometa veio. Ele caiu do céu na noite da Ruptura, dentro de uma pedra em chamas, e acordou sem memória. Só lembra de uma coisa: como cair de novo, e cair com força.',
    habilidades: {
      basico: { nome: 'Estilhaço Estelar', cd: 0.4, desc: 'Lança um fragmento de estrela.' },
      q: { nome: 'Queda de Cometa', cd: 9, desc: 'Salta alto e cai na mira, ferindo e atordoando quem estiver na queda.' },
      e: { nome: 'Órbita', cd: 11, desc: 'Ganha um escudo e velocidade por alguns segundos.' },
      r: { nome: 'Chuva de Meteoros', cd: 48, desc: 'Cinco meteoros caem em sequência na área da mira.' },
    },
  },
  teia: {
    nome: 'Teia', titulo: 'A Tecelã das Sombras', classe: 'controlador',
    hp: 470, speed: 228, r: 21,
    cores: { pele: '#b8a8c8', roupa: '#2a1a3a', roupa2: '#140c20', detalhe: '#d070ff', cabelo: '#e8e0f0', arma: '#d070ff' },
    lore: 'Aracne Teia mora nas cavernas debaixo das ilhas, onde a luz não chega. Ela tece fios tão finos que só aparecem quando já é tarde. Os mineiros dizem que, se você ouvir um fio vibrando, é porque ela já sabe onde você está.',
    habilidades: {
      basico: { nome: 'Fio Pegajoso', cd: 0.42, desc: 'Fio que fere e lentifica um pouco.' },
      q: { nome: 'Armadilha', cd: 7, desc: 'Esconde uma armadilha no chão (invisível para o inimigo). Quem pisar fica preso.' },
      e: { nome: 'Casulo', cd: 12, desc: 'Ganha um escudo e se livra de lentidão, prisão e veneno.' },
      r: { nome: 'Grande Teia', cd: 45, desc: 'Cobre uma área enorme com teia: prende quem entra e lentifica muito.' },
    },
  },
  brisa: {
    nome: 'Brisa', titulo: 'A Guardiã dos Ventos', classe: 'protetor',
    hp: 490, speed: 240, r: 20,
    cores: { pele: '#e8c8a8', roupa: '#d8eef0', roupa2: '#7ab8c8', detalhe: '#5ff0d0', cabelo: '#a8e8ff', arma: '#5ff0d0' },
    lore: 'Céu Brisa cuida dos moinhos que mantêm as ilhas flutuando. Ela conversa com o vento, e o vento obedece. Num campo de batalha, ela empurra os inimigos para longe e leva os aliados nas costas do ar.',
    habilidades: {
      basico: { nome: 'Sopro', cd: 0.4, desc: 'Rajada de ar que fere inimigos e cura aliados que atravessa.' },
      q: { nome: 'Corrente Ascendente', cd: 10, desc: 'Você e os aliados em volta ganham velocidade e um escudo.' },
      e: { nome: 'Rajada Repulsora', cd: 10, desc: 'Empurra para longe os inimigos perto de você.' },
      r: { nome: 'Olho do Furacão', cd: 50, desc: 'Cria uma área calma: aliados dentro se curam e recebem menos dano por 5s.' },
    },
  },
  egide: {
    nome: 'Égide', titulo: 'A Muralha Viva', classe: 'vanguarda',
    hp: 780, speed: 214, r: 25, big: 1.14,
    cores: { pele: '#a87858', roupa: '#8a8a9a', roupa2: '#4a4a5a', detalhe: '#ffcf6a', cabelo: '#6a3a2a', arma: '#c0c0cc' },
    lore: 'Égide foi a capitã da guarda da última cidade que caiu na Ruptura. Ela segurou o portão sozinha até todos fugirem. O escudo dela ainda tem as marcas daquela noite, e ela promete que ninguém passa por ele de novo.',
    habilidades: {
      basico: { nome: 'Golpe de Escudo', cd: 0.65, desc: 'Golpe em arco à frente.' },
      q: { nome: 'Avanço com Escudo', cd: 9, desc: 'Avança e atordoa o primeiro inimigo atingido.' },
      e: { nome: 'Provocar', cd: 12, desc: 'Inimigos em volta são obrigados a mirar em você por 1,5s. Você recebe menos dano.' },
      r: { nome: 'Égide Ancestral', cd: 50, desc: 'Você e os aliados próximos ganham escudo e -40% de dano por 4s.' },
    },
  },
};
const HUNTER_IDS = Object.keys(HUNTERS);
const DASH_CD = 6;

// Os obstáculos do mapa atual (preenchido por setMap em maps.js)
const MAP_OBS = [];

// Ilha: retângulo arredondado com margem (a borda é o Abismo)
const ISLAND = { x: 60, y: 60, w: WORLD_W - 120, h: WORLD_H - 120, r: 260 };

const SPAWNS = [
  [{ x: 210, y: 640 }, { x: 260, y: 740 }, { x: 260, y: 860 }, { x: 210, y: 960 }],
  [{ x: WORLD_W - 210, y: 640 }, { x: WORLD_W - 260, y: 740 }, { x: WORLD_W - 260, y: 860 }, { x: WORLD_W - 210, y: 960 }],
];
