# RUPTURA — Caçadores do Abismo

Hero shooter isométrico em navegador: **Arena 4v4**, WASD + mira no mouse, 5 caçadores (Lutador, Iniciador, Controlador, Protetor e Vanguarda), multiplayer online com bots completando as vagas, contas Google e **Ranqueada** (Bronze → Champion).

## Jogar
Abra o site do GitHub Pages deste repositório. O multiplayer online usa PeerJS (P2P, gratuito): quem cria a sala vira o "servidor" da partida.

## Contas com Google (Firebase)
1. Crie um projeto em https://console.firebase.google.com (ou reaproveite um que você já tem).
2. Configurações do projeto → Seus apps → Web (`</>`) → copie o `firebaseConfig` para `js/firebase-config.js`.
3. **Authentication** → Método de login → ative **Google**.
4. **Authentication** → Configurações → Domínios autorizados → adicione `wasmorf.github.io`.
5. **Firestore Database** → criar banco → aba **Regras** → cole o conteúdo de `firestore.rules`.

Sem configuração, o jogo funciona como convidado (progresso salvo só no navegador) e a Ranqueada fica bloqueada.

## Ranqueada (Arena 4v4)
- Libera no **nível 15** de conta (`RANKED_MIN_LEVEL` em `js/firebase-config.js`).
- 5 partidas de colocação; depois, 100 RR sobe de divisão.
- RR depende de vitória/derrota, diferença de rounds, desempenho individual (mais nos elos baixos) e do MMR oculto.
- Grupos de 1 a 4 jogadores, com no máximo um elo de diferença.
- Primeiro a 7 rounds. No 6×6 da Ranqueada há prorrogação até alguém abrir 2 rounds; na partida padrão o 6×6 vira round decisivo.

## Arquivos
- `js/data.js` — universo, caçadores, mapa
- `js/sim.js` — simulação da partida (roda no dono da sala)
- `js/ai.js` — bots
- `js/render.js` — gráficos
- `js/net.js` — rede (PeerJS / abas locais)
- `js/account.js` — contas, progressão, ranques e fila da Ranqueada
- `js/main.js` — menus, lobby, HUD e loop do jogo
