# RUPTURA — Caçadores do Abismo

Jogo de navegador com dois modos, contas Google e partidas online com amigos (bots completam as vagas vazias).

**Jogar:** https://wasmorf.github.io/Ruptura/

## Modos

### Modo Tático (FPS) — `fps.html`
FPS tático em primeira pessoa, 5 contra 5.
- O ataque leva o **Núcleo** até um site e planta; a defesa impede ou desarma. Vence quem fizer **7 rounds**; troca de lado depois do round 6 (6×6 vai pra prorrogação, precisa abrir 2).
- **Economia:** começo ◈800 · vitória ◈3000 · derrota ◈1900 / 2400 / 2900 · abate ◈200 · plantar ◈300 para o time.
- **Arsenal:** 16 armas + faca (pistolas, SMGs, escopetas, rifles, snipers e metralhadoras) e escudos leve/pesado.
- **20 caçadores**, 4 por classe. Cada um tem 2 habilidades compradas (C e Q), 1 grátis por round (E) e um ultimate carregado por pontos (X).
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

### Arena 4v4 (isométrico) — `index.html`
Hero shooter visto de cima com WASD + mira no mouse, 20 caçadores, veto de mapas, banimento de caçadores, troca de caçador entre rounds e **Ranqueada** (Bronze → Champion, libera no nível 15). Primeiro a 5 rounds.

## Configurar as contas (Firebase)
Só joga quem conectar a conta Google.
1. Crie um projeto em https://console.firebase.google.com.
2. Configurações do projeto → Seus apps → Web (`</>`) → copie o `firebaseConfig` para `js/firebase-config.js`.
3. **Authentication** → Método de login → ative **Google**.
4. **Authentication** → Configurações → Domínios autorizados → adicione o domínio do site (ex.: `wasmorf.github.io`).
5. **Firestore Database** → criar banco → aba **Regras** → cole o conteúdo de `firestore.rules`.

O multiplayer é P2P (WebRTC): quem cria a sala roda a partida, e a conexão entre os jogadores é combinada pelo Firestore.

## Arquivos
**Modo Tático (`fps/`)**
- `engine.js` — motor 3D próprio em WebGL2 (sombras, céu, materiais), colisão e raios
- `weapons.js` — armas e modelos 3D
- `data.js` — regras, economia e habilidades dos caçadores
- `maps.js` / `world.js` — os 7 mapas, montagem 3D e navegação dos bots
- `game.js` — partida (rounds, Núcleo, tiros, habilidades) e bots
- `render.js` — desenho do mapa, personagens e arma em primeira pessoa
- `net.js` — rede (previsão de movimento, interpolação, compensação de atraso)
- `main.js` — menus, salas, loja, HUD e laço do jogo

**Arena 4v4 (`js/`)**
- `data.js` caçadores · `maps.js` mapas · `sim.js` partida · `ai.js` bots · `render.js` gráficos · `net.js` rede · `account.js` contas, progressão e Ranqueada · `main.js` menus e HUD
