// =====================================================================
//  fps/legal.js : padrão Grupo Zart — páginas legais (Termos, Privacidade,
//  Cookies, Reembolso, Sobre), aviso de privacidade (aceitar/recusar),
//  carregamento das fontes só com permissão e ajudas de acessibilidade.
// =====================================================================
const ZART = {
  resp: 'Grupo Zart',
  email: 'projetozart@gmail.com',
  atualizado: '25 de novembro de 2026',
};
const CONS_KEY = 'ruptura-privacidade';

// ---------------- escolha de privacidade ----------------
const Privacy = {
  get choice() { try { return JSON.parse(localStorage.getItem(CONS_KEY) || 'null'); } catch (e) { return null; } },
  set(accept) {
    try { localStorage.setItem(CONS_KEY, JSON.stringify({ fontes: !!accept, t: Date.now(), v: window.TERMS_VERSION })); } catch (e) { }
    if (accept) loadFonts();
    else if (document.getElementById('gfonts')) setTimeout(() => location.reload(), 300); // tira as fontes já carregadas
  },
};
// As fontes do jogo vêm do Google Fonts: o Google recebe o endereço IP de quem carrega.
// Por isso só carregam depois que a pessoa aceita. Sem elas, o jogo usa as fontes do aparelho.
function loadFonts() {
  if (document.getElementById('gfonts')) return;
  const l = document.createElement('link'); l.id = 'gfonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap';
  document.head.appendChild(l);
}

function showConsent() {
  let d = document.getElementById('zcons');
  if (d) { d.querySelector('button').focus(); return; }
  d = document.createElement('section');
  d.id = 'zcons'; d.className = 'zcons'; d.setAttribute('role', 'region'); d.setAttribute('aria-labelledby', 'zcons-t');
  d.innerHTML = `<h2 id="zcons-t">Sua privacidade</h2>
    <p>O Ruptura usa o armazenamento do navegador só para o que é necessário: manter seu login e lembrar suas configurações. <b>Não usamos cookies de análise, de anúncios nem de rastreamento.</b></p>
    <p>Com a sua permissão, carregamos as fontes do jogo pelo Google Fonts (o Google recebe o seu endereço IP). Se recusar, o jogo usa as fontes do seu aparelho e funciona igual.</p>
    <div class="zrow"><button class="btn gold" data-z="aceitar">Aceitar</button><button class="btn" data-z="recusar">Recusar</button><button class="lnk" data-page="cookies">Saiba mais</button></div>`;
  document.body.appendChild(d);
  d.querySelector('[data-z=aceitar]').onclick = () => { Privacy.set(true); d.remove(); announce('Escolha salva: fontes do Google Fonts permitidas.'); };
  d.querySelector('[data-z=recusar]').onclick = () => { Privacy.set(false); d.remove(); announce('Escolha salva: nada externo além do necessário será carregado.'); };
  d.querySelector('[data-page]').onclick = () => openPage('cookies');
}

// avisos lidos por leitores de tela
function announce(t) { const el = document.getElementById('sr-live'); if (!el) return; el.textContent = ''; setTimeout(() => { el.textContent = t; }, 50); }

// ---------------- páginas ----------------
const PAGES = {
  sobre: ['Sobre o Grupo Zart', () => `
    <p><b>Grupo Zart</b> é um grupo de projetos digitais independentes: sites, jogos e ferramentas criados com cuidado e com identidade própria. Cada projeto Zart resolve uma coisa diferente, mas todos seguem o mesmo padrão de qualidade, transparência e respeito a quem usa.</p>
    <h3>O que é o Grupo Zart</h3>
    <p>O Grupo Zart reúne projetos digitais criados de forma independente. A ideia é simples: em vez de vários sites soltos, cada um com uma cara, todos fazem parte de uma mesma marca, com a mesma identidade e o mesmo cuidado.</p>
    <h3>Como funciona</h3>
    <p>Cada área do grupo ganha o nome Zart mais o que ela faz. O <b>Ruptura</b> faz parte da <b>Zart Jogos</b>.</p>
    <h3>O que todo projeto Zart tem em comum</h3>
    <ul>
      <li><b>Visual da marca:</b> a coroa, o azul meia-noite, o azul-escuro e o preto.</li>
      <li><b>Transparência:</b> avisamos quando um link é de parceiro e não inventamos avaliações nem promessas.</li>
      <li><b>Privacidade:</b> só pedimos os dados necessários e nada de rastreamento sem permissão.</li>
      <li><b>Acessibilidade:</b> menus que funcionam no celular, no teclado e com leitores de tela.</li>
    </ul>
    <h3>Sobre o Ruptura</h3>
    <p>O Ruptura é um jogo de tiro tático em primeira pessoa, gratuito, que roda no navegador. O mundo, os caçadores, as armas e os mapas foram criados para o próprio jogo. Ele não vende nada.</p>
    <p><b>Acessibilidade do jogo:</b> os menus, as configurações e estas páginas funcionam com teclado (Tab, Enter e Esc) e leitores de tela. A partida em si é em 3D e depende de visão e mouse; não conseguimos torná-la totalmente acessível a leitores de tela. Sugestões são bem-vindas em <a href="mailto:${ZART.email}">${ZART.email}</a>.</p>`],

  termos: ['Termos de Uso', () => `
    <p class="zmut">Última atualização: ${ZART.atualizado}</p>
    <h3>1. O que é o Ruptura</h3>
    <p>O Ruptura é um jogo de navegador gratuito, da Zart Jogos, do Grupo Zart. Ao criar uma conta ou jogar, você concorda com estes Termos e com a <button class="lnk" data-page="privacidade">Política de Privacidade</button>.</p>
    <h3>2. Conta e idade</h3>
    <ul>
      <li>Para jogar é preciso entrar com uma conta Google e escolher um ID no formato Nome#TAG.</li>
      <li>O jogo é para pessoas com <b>13 anos ou mais</b>. Quem tem menos de 18 anos precisa de autorização e acompanhamento dos pais ou responsáveis.</li>
      <li>A conta é pessoal: não compartilhe, venda ou empreste.</li>
      <li>O jogo tem combate com armas em um mundo de fantasia (violência fantasiosa, sem sangue realista).</li>
    </ul>
    <h3>3. Regras de convivência</h3>
    <p>Não é permitido:</p>
    <ul>
      <li>usar IDs ofensivos, discriminatórios, de cunho sexual ou que se passem por outra pessoa;</li>
      <li>assediar, ameaçar ou discriminar outros jogadores (inclusive por convites e pedidos de amizade);</li>
      <li>usar trapaças, programas de terceiros, falhas do jogo (bugs) ou alterar o código para ganhar vantagem;</li>
      <li>atrapalhar de propósito partidas ranqueadas (sair de propósito, entregar partidas, combinar resultado);</li>
      <li>tentar acessar dados de outros jogadores ou sobrecarregar o serviço.</li>
    </ul>
    <h3>4. O que pode acontecer se as regras forem quebradas</h3>
    <p>Podemos trocar um ID ofensivo, zerar ranque ou estatísticas obtidas com trapaça e suspender ou excluir contas, conforme a gravidade. Se achar que houve engano, escreva para <a href="mailto:${ZART.email}">${ZART.email}</a>.</p>
    <h3>5. Gratuidade e moeda do jogo</h3>
    <p>O Ruptura é gratuito e não vende nada. Os créditos (◈) servem só para comprar armas e habilidades dentro de cada partida, não têm valor em dinheiro e não podem ser comprados, vendidos ou trocados. Veja também a <button class="lnk" data-page="reembolso">Política de Reembolso</button>.</p>
    <h3>6. Disponibilidade</h3>
    <p>Fazemos o possível para o jogo funcionar bem, mas ele é um projeto independente e pode ficar fora do ar, mudar ou ter falhas. Temporadas de ranque podem ser reiniciadas, com aviso no jogo. Isso não afasta nenhum direito que a lei garante a você.</p>
    <h3>7. Direitos autorais e créditos</h3>
    <ul>
      <li>O nome Ruptura, o mundo, os caçadores, as armas, os mapas, os textos e as imagens do jogo são criações próprias do projeto. A marca Zart pertence ao Grupo Zart.</li>
      <li>Fontes <b>Cinzel</b> e <b>Rajdhani</b>, distribuídas pelo Google Fonts sob a licença SIL Open Font License (só carregam se você aceitar).</li>
      <li>Login e banco de dados pelo Firebase (Google). Conexão das partidas por WebRTC.</li>
    </ul>
    <p>Se você é dono de algum direito e acha que algo aqui o viola, escreva para <a href="mailto:${ZART.email}">${ZART.email}</a> que analisamos e, se for o caso, retiramos.</p>
    <h3>8. Mudanças nestes Termos</h3>
    <p>Estes Termos podem mudar. A data no topo mostra a versão atual. Se a mudança for importante, pediremos que você aceite de novo ao entrar.</p>
    <h3>9. Lei aplicável</h3>
    <p>Estes Termos seguem as leis do Brasil, incluindo o Código de Defesa do Consumidor, o Marco Civil da Internet e a Lei Geral de Proteção de Dados (LGPD).</p>
    <h3>10. Contato</h3>
    <p>Responsável: ${ZART.resp} · <a href="mailto:${ZART.email}">${ZART.email}</a></p>`],

  privacidade: ['Política de Privacidade', () => `
    <p class="zmut">Última atualização: ${ZART.atualizado}</p>
    <p>Esta política explica quais dados o Ruptura usa, para quê e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD).</p>
    <h3>1. Quem é o responsável</h3>
    <p>Controlador: <b>${ZART.resp}</b>. Contato e encarregado de dados: <a href="mailto:${ZART.email}">${ZART.email}</a>.</p>
    <h3>2. Quais dados usamos</h3>
    <div class="ztab" role="region" aria-label="Tabela de dados usados" tabindex="0"><table>
      <caption class="sr-only">Dados usados pelo Ruptura, finalidade e quem pode ver</caption>
      <thead><tr><th scope="col">Dado</th><th scope="col">Para quê</th><th scope="col">Quem vê</th></tr></thead>
      <tbody>
      <tr><td>Conta Google usada no login (identificador da conta, e-mail, nome e foto do Google)</td><td>Entrar no jogo com segurança. Fica guardado pelo serviço de login (Firebase Authentication). O jogo usa só o identificador; não usa nem mostra e-mail, nome ou foto.</td><td>Só o serviço de login</td></tr>
      <tr><td>ID Nome#TAG que você escolhe</td><td>Mostrar você nas partidas e permitir que amigos te encontrem</td><td>Outros jogadores</td></tr>
      <tr><td>Progresso: nível, XP, ranque, RR, MMR, estatísticas, caçadores usados e as últimas 12 partidas</td><td>Salvar sua evolução, montar partidas equilibradas e mostrar seu perfil</td><td>Você; nível e ranque também para outros jogadores</td></tr>
      <tr><td>Amigos, pedidos de amizade e convites para sala</td><td>Lista de amigos e convites</td><td>Você e o outro jogador envolvido</td></tr>
      <tr><td>Status (no menu, em sala, em partida) e código da sala em que você está</td><td>Mostrar aos amigos se você está online e permitir que entrem na sua sala</td><td>Jogadores logados</td></tr>
      <tr><td>Fila da Ranqueada: código da sala, tamanho do grupo e MMR médio</td><td>Encontrar outro grupo para jogar</td><td>O sistema de fila</td></tr>
      <tr><td>Dados técnicos de conexão, incluindo o endereço IP</td><td>Ligar os jogadores da mesma partida (conexão direta WebRTC)</td><td>Os jogadores da sala e os servidores de conexão (item 5)</td></tr>
      <tr><td>Data em que você aceitou estes termos</td><td>Comprovar o aceite</td><td>Só o Grupo Zart</td></tr>
      <tr><td>No seu navegador: configurações, último caçador e mapa, escolha de privacidade</td><td>Lembrar suas escolhas</td><td>Só o seu aparelho</td></tr>
      </tbody></table></div>
    <p>Não usamos ferramentas de análise, anúncios, pixels de rastreamento nem perfis para publicidade. Não pedimos documentos, telefone ou endereço.</p>
    <h3>3. Base legal (LGPD, art. 7º)</h3>
    <ul>
      <li><b>Execução do serviço que você pediu</b> (art. 7º, V): conta, progresso, amigos, ranqueada e conexão das partidas.</li>
      <li><b>Legítimo interesse</b> (art. 7º, IX): segurança, prevenção de trapaças e moderação de IDs ofensivos, sempre de forma limitada.</li>
      <li><b>Consentimento</b> (art. 7º, I): carregar as fontes pelo Google Fonts. Você pode mudar a escolha a qualquer momento em “Preferências de privacidade”, no rodapé.</li>
    </ul>
    <h3>4. Com quem os dados são compartilhados</h3>
    <ul>
      <li><b>Google (Firebase)</b>: login e banco de dados do jogo.</li>
      <li><b>Outros jogadores</b>: seu ID, nível, ranque, caçador e status; e, por causa da conexão direta, o endereço IP de quem está na mesma sala.</li>
      <li><b>Servidores de conexão</b>: STUN do Google e da Cloudflare (descobrem o caminho da conexão) e, quando a conexão direta falha, o servidor de retransmissão Open Relay (Metered), que repassa os dados da partida.</li>
      <li><b>GitHub Pages</b>: hospeda o site e pode registrar dados técnicos de acesso, como IP e navegador.</li>
      <li><b>Google Fonts</b>: só se você aceitar.</li>
    </ul>
    <p>Não vendemos nem alugamos dados. Só os entregaremos a autoridades quando a lei obrigar.</p>
    <h3>5. Transferência para fora do Brasil</h3>
    <p>Esses serviços guardam dados em servidores fora do Brasil (principalmente nos Estados Unidos). A transferência acontece para executar o serviço que você pediu e com as garantias contratuais desses fornecedores (LGPD, art. 33).</p>
    <h3>6. Por quanto tempo guardamos</h3>
    <ul>
      <li>Conta, ID e progresso: enquanto a conta existir. Você pode excluir quando quiser.</li>
      <li>Status online: atualizado enquanto você joga e apagado quando você sai da conta.</li>
      <li>Convites: até serem usados ou recusados; o jogo ignora convites com mais de 2 minutos.</li>
      <li>Fila da Ranqueada e dados de conexão da sala: apagados quando a busca ou a sala termina.</li>
      <li>Dados no navegador: até você limpar ou usar “Apagar dados deste navegador”.</li>
    </ul>
    <h3>7. Seus direitos (LGPD, art. 18)</h3>
    <p>Você pode confirmar se tratamos seus dados, acessar, corrigir, levar para outro serviço, pedir a exclusão, saber com quem compartilhamos e revogar o consentimento. Como fazer:</p>
    <ul>
      <li><b>Acessar e levar seus dados:</b> Perfil → Seus dados → <b>Baixar meus dados</b> (arquivo JSON).</li>
      <li><b>Corrigir:</b> Perfil → <b>Alterar ID</b>.</li>
      <li><b>Excluir:</b> Perfil → Seus dados → <b>Excluir minha conta</b>. Apaga seu perfil, ID, amigos, convites e a conta de login. Não dá para desfazer.</li>
      <li><b>Revogar o consentimento das fontes:</b> “Preferências de privacidade”, no rodapé.</li>
      <li>Ou escreva para <a href="mailto:${ZART.email}">${ZART.email}</a>. Respondemos em até 15 dias.</li>
    </ul>
    <p>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
    <h3>8. Segurança</h3>
    <p>O acesso ao banco de dados exige login e regras que só deixam cada jogador mudar os próprios dados. Nenhum sistema é 100% seguro; se houver um incidente que possa trazer risco a você, avisaremos e comunicaremos a ANPD.</p>
    <h3>9. Crianças e adolescentes</h3>
    <p>O jogo é para pessoas com 13 anos ou mais. Quem tem menos de 18 anos precisa de autorização dos responsáveis. Se você é responsável e acha que uma criança criou uma conta, escreva para <a href="mailto:${ZART.email}">${ZART.email}</a> que excluímos.</p>
    <h3>10. Cookies e armazenamento</h3>
    <p>Veja <button class="lnk" data-page="cookies">Cookies e armazenamento</button>.</p>
    <h3>11. Mudanças</h3>
    <p>Esta política pode mudar. A data no topo mostra a versão atual. Mudanças importantes serão avisadas no jogo.</p>`],

  cookies: ['Cookies e armazenamento', () => `
    <p class="zmut">Última atualização: ${ZART.atualizado}</p>
    <p>O Ruptura <b>não usa cookies de análise, de anúncios nem de rastreamento</b>. Ele usa o armazenamento do navegador (localStorage e IndexedDB), que funciona de forma parecida, só no seu aparelho.</p>
    <div class="ztab" role="region" aria-label="Tabela de armazenamento" tabindex="0"><table>
      <caption class="sr-only">O que o Ruptura guarda no navegador</caption>
      <thead><tr><th scope="col">O que é</th><th scope="col">Tipo</th><th scope="col">Quando é criado</th></tr></thead>
      <tbody>
      <tr><td>Sessão de login (Firebase Authentication)</td><td>Necessário</td><td>Quando você entra com o Google</td></tr>
      <tr><td>Configurações do jogo (sensibilidade, gráficos, volume…)</td><td>Necessário</td><td>Quando você muda uma configuração</td></tr>
      <tr><td>Último caçador e mapa escolhidos</td><td>Necessário</td><td>Quando você escolhe</td></tr>
      <tr><td>Sua escolha de privacidade</td><td>Necessário</td><td>Quando você aceita ou recusa</td></tr>
      <tr><td>Fontes do Google Fonts</td><td>Opcional</td><td>Só se você aceitar</td></tr>
      </tbody></table></div>
    <p>Os itens necessários servem só para o jogo funcionar e lembrar o que você mesmo escolheu. O único item opcional são as fontes, que vêm de um serviço do Google.</p>
    <div class="zrow"><button class="btn" data-act="consent">Mudar minha escolha</button><button class="btn ghost" data-act="wipe">Apagar dados deste navegador</button></div>`],

  reembolso: ['Política de Reembolso', () => `
    <p class="zmut">Última atualização: ${ZART.atualizado}</p>
    <h3>O Ruptura não vende nada</h3>
    <p>O jogo é gratuito. Não há compras, assinaturas, itens pagos nem anúncios. Os créditos (◈) existem só dentro de cada partida e não podem ser comprados com dinheiro. Por isso, hoje não existe nada a reembolsar.</p>
    <h3>Se um dia houver vendas</h3>
    <ul>
      <li><b>Direito de arrependimento:</b> compras feitas pela internet podem ser canceladas em até <b>7 dias</b> a partir da compra ou do recebimento, sem precisar dar motivo, com devolução integral do valor (Código de Defesa do Consumidor, art. 49).</li>
      <li>A devolução será feita pelo mesmo meio de pagamento usado na compra.</li>
      <li>Produtos com defeito ou que não funcionem como anunciado seguem as regras do CDC.</li>
      <li>Antes de qualquer venda, esta página será atualizada com preços, meios de pagamento e como pedir o cancelamento.</li>
    </ul>
    <p>Dúvidas: <a href="mailto:${ZART.email}">${ZART.email}</a></p>`],
};

let _pageReturn = null;
function openPage(id) {
  const P = PAGES[id]; if (!P) return;
  const dlg = document.getElementById('zpage');
  if (!dlg.classList.contains('show')) _pageReturn = document.activeElement;
  document.getElementById('zpage-t').textContent = P[0];
  document.getElementById('zpage-b').innerHTML = P[1]();
  dlg.classList.add('show'); dlg.setAttribute('aria-hidden', 'false');
  document.getElementById('zpage-b').scrollTop = 0;
  dlg.querySelector('.zclose').focus();
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
}
function closePage() {
  const dlg = document.getElementById('zpage');
  dlg.classList.remove('show'); dlg.setAttribute('aria-hidden', 'true');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (_pageReturn && _pageReturn.focus) _pageReturn.focus();
}

// cliques em links de página e ações das páginas
document.addEventListener('click', e => {
  const b = e.target.closest('[data-page],[data-act]'); if (!b) return;
  if (b.dataset.page) { e.preventDefault(); openPage(b.dataset.page); return; }
  if (b.dataset.act === 'consent') { closePage(); showConsent(); }
  else if (b.dataset.act === 'wipe') {
    if (!confirm('Apagar todos os dados do Ruptura guardados neste navegador (configurações e escolhas)? Sua conta não é apagada.')) return;
    try { Object.keys(localStorage).filter(k => k.startsWith('ruptura')).forEach(k => localStorage.removeItem(k)); } catch (e) { }
    location.reload();
  }
});

// ---------------- teclado e foco ----------------
// cartões com role="button" respondem a Enter e Espaço como botões
document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') { e.preventDefault(); t.click(); return; }
  if (e.key === 'Escape') {
    if (document.getElementById('zpage').classList.contains('show')) { e.stopImmediatePropagation(); closePage(); return; }
    const dl = document.querySelector('.modal.show');
    if (dl && dl.dataset.esc !== 'no') { e.stopImmediatePropagation(); dl.classList.remove('show'); return; }
    const side = document.getElementById('side');
    if (side && side.classList.contains('show') && typeof Social !== 'undefined') { e.stopImmediatePropagation(); Social.close(); }
  }
  // mantém o foco dentro da janela aberta
  if (e.key === 'Tab') {
    const box = document.getElementById('zpage').classList.contains('show') ? document.getElementById('zpage') : document.querySelector('.modal.show');
    if (!box) return;
    const f = [...box.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
}, true);

// ---------------- início ----------------
(function initZart() {
  document.querySelector('#zpage .zclose').onclick = closePage;
  document.getElementById('zpage').addEventListener('click', e => { if (e.target.id === 'zpage') closePage(); });
  const c = Privacy.choice;
  if (c && c.fontes) loadFonts();
  if (!c) showConsent();
  const h = location.hash.slice(1); if (PAGES[h]) openPage(h);
  addEventListener('hashchange', () => { const k = location.hash.slice(1); if (PAGES[k]) openPage(k); });
})();
