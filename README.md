# RUPTURA — Caçadores do Abismo

Hero shooter isométrico em navegador: **Arena 4v4**, WASD + mira no mouse, 10 caçadores, 2 por classe (Lutador, Iniciador, Controlador, Protetor e Vanguarda), multiplayer online com bots completando as vagas, contas Google e **Ranqueada** (Bronze → Champion).

## Jogar
Abra o site do GitHub Pages deste repositório. O multiplayer online usa PeerJS (P2P, gratuito): quem cria a sala vira o "servidor" da partida.

## Contas com Google (Firebase)
1. Crie um projeto em https://console.firebase.google.com (ou reaproveite um que você já tem).
2. Configurações do projeto → Seus apps → Web (`</>`) → copie o `firebaseConfig` para `js/firebase-config.js`.
3. **Authentication** → Método de login → ative **Google**.
4. **Authentication** → Configurações → Domínios autorizados → adicione `wasmorf.github.io`.
5. **Firestore Database** → criar banco → aba **Regras** → cole o conteúdo de `firestore.rules`.

Só joga quem conectar a conta Google (vale para todos os modos). Sem essa configuração, ninguém consegue jogar.

## Ranqueada (Arena 4v4)
- Libera no **nível 15** de conta (`RANKED_MIN_LEVEL` em `js/firebase-config.js`).
- 5 partidas de colocação; depois, 100 RR sobe de divisão.
- RR depende de vitória/derrota, diferença de rounds, desempenho individual (mais nos elos baixos) e do MMR oculto.
- Grupos de 1 a 4 jogadores, com no máximo um elo de diferença.
- Primeiro a 5 rounds. No 4×4 da Ranqueada há prorrogação até alguém abrir 2 rounds; na partida padrão o 4×4 vira round decisivo.

## Arquivos
- `js/data.js` — universo, caçadores, mapa
- `js/sim.js` — simulação da partida (roda no dono da sala)
- `js/ai.js` — bots
- `js/render.js` — gráficos
- `js/net.js` — rede (PeerJS / abas locais)
- `js/account.js` — contas, progressão, ranques e fila da Ranqueada
- `js/main.js` — menus, lobby, HUD e loop do jogo
