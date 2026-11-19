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

// mapas: ver fps/maps.js
// armas: ver fps/weapons.js

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
Object.assign(FPS_HUNTERS, {
  serra: {
    c: { nome: 'Mira Firme', preco: 200, max: 1, desc: 'Por 5s sua arma fica sem imprecisão e com metade do coice.' },
    q: { nome: 'Recuo Tático', preco: 150, max: 2, desc: 'Salta rápido para trás.' },
    e: { nome: 'Sinalizador', free: 1, desc: 'Arremessa um sinalizador que revela inimigos perto dele por 4s.' },
    x: { nome: 'Bala Perfurante', desc: 'Os próximos 3 tiros atravessam paredes e causam mais dano.' },
  },
  fera: {
    c: { nome: 'Rugido', preco: 250, max: 1, desc: 'Ruge à frente: inimigos perto ficam atordoados de susto (quase cegos).' },
    q: { nome: 'Bote', preco: 200, max: 1, desc: 'Pula longe para frente.' },
    e: { nome: 'Faro', free: 1, desc: 'Revela o inimigo mais perto (até 30m) por 3s.' },
    x: { nome: 'Frenesi', desc: 'Por 8s: mais rápida, atira mais rápido e cada abate cura 50.' },
  },
  duna: {
    c: { nome: 'Muralha de Areia', preco: 300, max: 1, desc: 'Ergue uma muralha larga e sólida na frente (12s).' },
    q: { nome: 'Areia Movediça', preco: 200, max: 2, desc: 'Arremessa areia que deixa os inimigos muito lentos.' },
    e: { nome: 'Tempestade de Areia', free: 2, desc: 'Cortina de areia onde você mira (14s). Bloqueia a visão.' },
    x: { nome: 'Redemoinho', desc: 'Redemoinho na mira: puxa os inimigos para o centro e deixa lentos.' },
  },
  elo: {
    c: { nome: 'Fio Curador', preco: 200, max: 1, desc: 'Cura 60 de vida no aliado que você mira (ou em você).' },
    q: { nome: 'Pulso Restaurador', preco: 250, max: 1, desc: 'Cura 35 de vida em todos os aliados perto.' },
    e: { nome: 'Escudo de Éter', free: 1, desc: 'Dá 30 de escudo ao aliado que você mira (ou a você).' },
    x: { nome: 'Renascer', desc: 'Por 10s, aliados perto não morrem: ao cair, voltam com 40 de vida (uma vez).' },
  },
  bisao: {
    c: { nome: 'Investida', preco: 250, max: 1, desc: 'Corre com tudo para frente e atordoa o primeiro inimigo que atropelar.' },
    q: { nome: 'Cabeçada', preco: 150, max: 1, desc: 'Cabeçada curta: dano e atordoa quem estiver na sua frente.' },
    e: { nome: 'Pisotear', free: 1, desc: 'Pisa forte: inimigos perto ficam lentos por 3s.' },
    x: { nome: 'Estouro da Manada', desc: 'Uma investida enorme que atropela e atordoa todos no caminho.' },
  },
  vespa: {
    c: { nome: 'Ferrão Venenoso', preco: 200, max: 2, desc: 'Arremessa um ferrão que envenena a área onde cai.' },
    q: { nome: 'Voo Rasante', preco: 150, max: 1, desc: 'Avança voando para frente.' },
    e: { nome: 'Enxame', free: 1, desc: 'Solta um enxame na mira: dano leve e revela quem estiver dentro.' },
    x: { nome: 'Ninho', desc: 'Um ninho enorme na mira: veneno forte e lentidão por 7s.' },
  },
  cometa: {
    c: { nome: 'Estilhaço Estelar', preco: 250, max: 2, desc: 'Clarão de estrela que cega quem estiver olhando.' },
    q: { nome: 'Queda de Cometa', preco: 250, max: 1, desc: 'Salta até o ponto mirado e atordoa quem estiver perto da queda.' },
    e: { nome: 'Órbita', free: 1, desc: 'Lança uma estrela que revela inimigos perto de onde cai.' },
    x: { nome: 'Chuva de Meteoros', desc: 'Cinco meteoros caem em volta do ponto mirado.' },
  },
  teia: {
    c: { nome: 'Armadilha', preco: 200, max: 2, desc: 'Fio escondido no chão: quem passa fica preso, lento e revelado.' },
    q: { nome: 'Casulo', preco: 250, max: 1, desc: 'Arremessa uma bola de teia que deixa a área lenta.' },
    e: { nome: 'Véu', free: 2, desc: 'Cortina roxa onde você mira (14s). Bloqueia a visão.' },
    x: { nome: 'Grande Teia', desc: 'Teia gigante na mira: deixa lento e revela todos dentro por 8s.' },
  },
  brisa: {
    c: { nome: 'Corrente de Ar', preco: 200, max: 1, desc: 'Você e aliados perto ficam mais rápidos por 5s.' },
    q: { nome: 'Rajada Repulsora', preco: 250, max: 1, desc: 'Empurra para longe os inimigos à sua frente.' },
    e: { nome: 'Sopro Curador', free: 1, desc: 'Cura 50 no aliado que você mira (ou em você).' },
    x: { nome: 'Olho do Furacão', desc: 'Área calma em volta de você: aliados dentro se curam e levam menos dano.' },
  },
  egide: {
    c: { nome: 'Escudo Erguido', preco: 300, max: 1, desc: 'Ergue um escudo alto e sólido à frente (10s).' },
    q: { nome: 'Provocar', preco: 200, max: 1, desc: 'Inimigos à frente ficam revelados e lentos.' },
    e: { nome: 'Golpe de Escudo', free: 1, desc: 'Empurra e atordoa quem estiver colado na sua frente.' },
    x: { nome: 'Égide Ancestral', desc: 'Aliados perto ganham 50 de escudo e levam menos dano por 6s.' },
  },
});
const FPS_HUNTER_IDS = Object.keys(FPS_HUNTERS);
const FPS_ULT = { brasa: 7, corvo: 6, mare: 7, lumi: 8, rocha: 7, lamina: 7, trovao: 7, vinha: 7, sino: 7, ancora: 7, serra: 7, fera: 7, duna: 7, elo: 8, bisao: 7, vespa: 7, cometa: 7, teia: 7, brisa: 7, egide: 7 };
