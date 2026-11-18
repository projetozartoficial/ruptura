// =====================================================================
//  CONFIGURAÇÃO DO FIREBASE (contas com Google + dados salvos)
//
//  1. Entre em https://console.firebase.google.com e crie um projeto
//     (ou use um que você já tem).
//  2. Engrenagem > Configurações do projeto > "Seus apps" > ícone </> (Web)
//     > registre o app e copie o objeto firebaseConfig para baixo.
//  3. Authentication > Método de login > ative "Google".
//  4. Authentication > Configurações > Domínios autorizados >
//     adicione  wasmorf.github.io
//  5. Firestore Database > Criar banco de dados (modo produção) e cole as
//     regras do arquivo firestore.rules (aba "Regras").
//
//  Enquanto ficar null, o jogo funciona como convidado (progresso salvo
//  só neste navegador) e a Ranqueada fica bloqueada.
// =====================================================================
window.FIREBASE_CONFIG = null;
/* Exemplo:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
*/

// Nível de conta mínimo para a Ranqueada (o padrão do jogo é 15).
// Pode baixar temporariamente para testar.
window.RANKED_MIN_LEVEL = 15;
