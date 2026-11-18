// =====================================================================
//  settings.js : configurações salvas no navegador + teclas (atalhos)
// =====================================================================
const ACTIONS = [
  { id: 'up', nome: 'Andar para cima', grupo: 'Movimento' },
  { id: 'down', nome: 'Andar para baixo', grupo: 'Movimento' },
  { id: 'left', nome: 'Andar para a esquerda', grupo: 'Movimento' },
  { id: 'right', nome: 'Andar para a direita', grupo: 'Movimento' },
  { id: 'dash', nome: 'Esquiva', grupo: 'Movimento' },
  { id: 'basic', nome: 'Ataque básico', grupo: 'Combate', dica: 'segure para atirar' },
  { id: 'q', nome: 'Habilidade 1 (Q)', grupo: 'Combate' },
  { id: 'e', nome: 'Habilidade 2 (E)', grupo: 'Combate' },
  { id: 'r', nome: 'Suprema (R)', grupo: 'Combate' },
  { id: 'score', nome: 'Placar', grupo: 'Interface', dica: 'segure para ver' },
  { id: 'fps', nome: 'Mostrar/ocultar FPS', grupo: 'Interface' },
];
const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  dash: ['Space', 'ShiftLeft'], basic: ['Mouse0', ''], q: ['KeyQ', 'Mouse2'], e: ['KeyE', ''], r: ['KeyR', ''],
  score: ['Tab', ''], fps: ['F3', ''],
};
const DEFAULT_SETTINGS = {
  quality: 'auto', fps: false, sound: true, volume: 70, shake: true, dmgNumbers: true, names: true,
  lookahead: true, smooth: true, net: 'online', binds: JSON.parse(JSON.stringify(DEFAULT_BINDS)),
};
const Settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
try {
  const saved = JSON.parse(localStorage.getItem('ruptura-settings') || '{}');
  Object.assign(Settings, saved);
  Settings.binds = Object.assign(JSON.parse(JSON.stringify(DEFAULT_BINDS)), saved.binds || {});
} catch (e) { }
function saveSettings() { try { localStorage.setItem('ruptura-settings', JSON.stringify(Settings)); } catch (e) { } }

const KEY_NAMES = {
  Space: 'Espaço', ShiftLeft: 'Shift', ShiftRight: 'Shift dir.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl dir.', AltLeft: 'Alt', AltRight: 'Alt Gr',
  Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps Lock', Escape: 'Esc',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Botão esquerdo', Mouse1: 'Botão do meio', Mouse2: 'Botão direito', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  Backquote: "'", Minus: '-', Equal: '=', BracketLeft: '´', BracketRight: '[', Semicolon: 'Ç', Quote: '~', Backslash: ']', Comma: ',', Period: '.', Slash: ';', IntlRo: '/',
};
const KEY_SHORT = { Mouse0: 'M1', Mouse1: 'M3', Mouse2: 'M2', Mouse3: 'M4', Mouse4: 'M5', Space: 'ESP', ShiftLeft: 'SHIFT', ControlLeft: 'CTRL', AltLeft: 'ALT', Tab: 'TAB' };
function keyLabel(code) {
  if (!code) return '—';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
function keyShort(code) { return KEY_SHORT[code] || (code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : keyLabel(code)).slice(0, 5).toUpperCase(); }

// teclas/botões pressionados agora (por "code" do teclado ou MouseN)
const Down = new Set();
function actionDown(a) { const b = Settings.binds[a]; return !!b && b.some(c => c && Down.has(c)); }
function actionOf(code) { return Object.keys(Settings.binds).find(a => Settings.binds[a].includes(code)); }
// atribui uma tecla; se já estiver em outra ação, tira de lá
function setBind(action, slot, code) {
  if (code) for (const a in Settings.binds) Settings.binds[a] = Settings.binds[a].map(c => (c === code ? '' : c));
  Settings.binds[action][slot] = code;
  saveSettings();
}
