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
//  Só joga quem conectar a conta Google. Enquanto ficar null, ninguém
//  consegue entrar nas partidas.
// =====================================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyARVPvyf2SvLo1DB5BoA65mAMuyRvSY9XE",
  authDomain: "ruptura-f1a70.firebaseapp.com",
  projectId: "ruptura-f1a70",
  storageBucket: "ruptura-f1a70.firebasestorage.app",
  messagingSenderId: "58672897771",
  appId: "1:58672897771:web:82fac6625fea66dccba8ae",
  measurementId: "G-474RKCS5QP"
};
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

// Versão dos Termos de Uso e da Política de Privacidade. Ao mudar os textos de forma
// importante, troque a data: todos precisam aceitar de novo ao entrar.
window.TERMS_VERSION = '2026-11-25';
