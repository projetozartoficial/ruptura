# RUPTURA — Caçadores do Abismo

FPS tático 5v5 de navegador, com contas Google, amigos, Ranqueada e partidas online (bots completam as vagas vazias).

**Jogar:** https://wasmorf.github.io/Ruptura/

## Como funciona
FPS tático em primeira pessoa, 5 contra 5.
- O ataque leva o **Núcleo** até um site e planta; a defesa impede ou desarma. Vence quem fizer **7 rounds**; troca de lado depois do round 6 (6×6 vai pra prorrogação, precisa abrir 2).
- **Economia:** começo ◈800 · vitória ◈3000 · derrota ◈1900 / 2400 / 2900 · abate ◈200 · plantar ◈300 para o time.
- **Arsenal:** 16 armas + faca (pistolas, SMGs, escopetas, rifles, snipers e metralhadoras) e escudos leve/pesado.
- **20 caçadores**, 5 por função. Cada um tem 2 habilidades compradas (C e Q), 1 grátis por round (E) e um ultimate carregado por pontos (X).
  - **Desafiantes** (Brasa, Lâmina, Fera, Bisão, Vespa) — abrem espaço, puxam a entrada e vencem os duelos diretos.
  - **Dominadores** (Maré, Vinha, Duna, Lumi, Égide) — cortinas de fumaça e barreiras que negam visão e ditam o ritmo das entradas e retomadas.
  - **Batedores** (Corvo, Trovão, Rocha, Âncora, Cometa) — revelam posições, atordoam e cegam, preparando o terreno para o time.
  - **Guardiões** (Sino, Teia, Elo, Brisa, Serra) — armadilhas e sensores que protegem áreas, vigiam flancos e atrasam o avanço.
  - Os bots montam o time tentando ter uma função de cada.
- **7 mapas**, cada um com uma mecânica que muda a estratégia:

| Mapa | Mecânica |
|---|---|
| Ruínas de Vésper | Clássico: 2 sites e meio forte |
| Forja de Cinza | 3 sites (A, B e C) |
| Mosteiro dos Ecos | Sem meio, com portais entre os lados |
| Zênite | Ataque nasce dividido (pinça); cair no abismo mata |
| Picos Uivantes | Portões com alavanca e chão de gelo |
| Jardim Caído | Paredes de madeira que quebram com tiros |
| Lagos Suspensos | Mapa aberto; água deixa lento e faz barulho |

- Fogo amigo: tiros não ferem aliados; habilidades ferem com metade do dano.
- Controles: WASD · Shift andar devagar · Ctrl agachar · Espaço pular · mouse mirar/atirar · botão direito luneta · R recarregar · 1/2/3 armas · B loja · F plantar/desarmar/pegar arma/alavanca · C Q E X habilidades · G largar arma · Tab placar.

## Modos de jogo
- **Contra bots** — você e 4 bots contra 5 bots, no mapa que escolher.
- **Sala personalizada** — crie uma sala, passe o código (ou convide pela lista de amigos) e escolha o mapa. Vagas vazias viram bots.
- **Ranqueada** — libera no **nível 15** de conta.
  - Monte um grupo de 1 a 5 pessoas (no máximo **1 elo de diferença** entre elas) e busque partida. Dois grupos se encontram pela fila; quem faltar vira bot. Se ninguém aparecer em 1 minuto, dá pra jogar contra bots valendo metade do RR.
  - Elos: Bronze, Silver, Gold, Platinum, Diamond, Elite, Master e GrandMaster (I, II e III) e Champion.
  - **5 partidas de colocação** definem o primeiro elo. Depois, cada divisão tem **100 RR**.
  - O RR depende de vitória/derrota, da diferença de rounds, do seu desempenho (pesa mais nos elos baixos) e de um MMR escondido. O mapa é sorteado.
  - Sair no meio de uma ranqueada conta como derrota.

## Conta e amigos
- Entrar com Google é obrigatório. No primeiro login você escolhe seu ID **Nome#TAG** (TAG de 3 a 5 letras ou números, única).
- **Perfil:** nível, XP, elo, pico, estatísticas, caçadores favoritos e últimas partidas.
- **Amigos:** adicione pelo ID, veja quem está online/em sala/em partida, convide para sua sala ou entre na sala deles.
- **Privacidade:** esconder os nomes dos outros jogadores e o código da sala (bom para live).

## Gráficos e desempenho
- **Alta qualidade** (padrão): sombras suaves, texturas detalhadas e antisserrilhado.
- **Desempenho**: sombra e textura simplificadas e sem antisserrilhado. Fica mais leve e o visual muda pouco.
- **Resolução automática** (ligada por padrão): se o FPS cair abaixo de ~55, a resolução interna baixa um pouco; quando sobra folga, volta a subir.
- **Mostrar FPS** nas configurações para acompanhar.

## Configurar as contas (Firebase)
Só joga quem conectar a conta Google.
1. Crie um projeto em https://console.firebase.google.com.
2. Configurações do projeto → Seus apps → Web (`</>`) → copie o `firebaseConfig` para `js/firebase-config.js`.
3. **Authentication** → Método de login → ative **Google**.
4. **Authentication** → Configurações → Domínios autorizados → adicione o domínio do site (ex.: `wasmorf.github.io`).
5. **Firestore Database** → criar banco → aba **Regras** → cole o conteúdo de `firestore.rules`.

O multiplayer é P2P (WebRTC): quem cria a sala roda a partida, e a conexão entre os jogadores é combinada pelo Firestore.

## Arquivos
- `index.html` — página do jogo (`fps.html` só redireciona para ela)

**`fps/`**
- `engine.js` — motor 3D próprio em WebGL2 (sombras, céu, materiais), colisão e raios
- `weapons.js` — armas e modelos 3D
- `data.js` — regras, economia e habilidades dos caçadores
- `maps.js` / `world.js` — os 7 mapas, montagem 3D e navegação dos bots
- `game.js` — partida (rounds, Núcleo, tiros, habilidades) e bots
- `render.js` — desenho do mapa, personagens e arma em primeira pessoa
- `net.js` — rede (previsão de movimento, interpolação, compensação de atraso)
- `main.js` — menus, salas, fila da Ranqueada, loja, HUD e laço do jogo
- `social.js` — login, ID, perfil, amigos, convites e privacidade

**`js/`**
- `data.js` — classes e caçadores (nomes, cores e história)
- `net.js` — transporte de rede (WebRTC combinado pelo Firestore)
- `account.js` — contas, XP, elos/RR e fila da Ranqueada
- `firebase-config.js` — configuração do Firebase e nível mínimo da Ranqueada
