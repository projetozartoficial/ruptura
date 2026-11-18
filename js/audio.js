// =====================================================================
//  audio.js : efeitos sonoros sintetizados (sem arquivos externos)
// =====================================================================
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null, enabled = true, vol = 0.5;
  const last = {};
  function init() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type = 'sine', g = 0.2, delay = 0) {
    if (!ac || !enabled) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), a = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(a); a.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq, g = 0.25, q = 1, type = 'lowpass') {
    if (!ac || !enabled) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), a = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(a); a.connect(master); s.start(t); s.stop(t + dur);
  }
  function lim(k, ms) { const n = performance.now(); if (last[k] && n - last[k] < ms) return false; last[k] = n; return true; }
  const lib = {
    shot_brasa() { noise(0.08, 2400, 0.12, 1, 'bandpass'); tone(420, 120, 0.08, 'square', 0.04); },
    shot_corvo() { noise(0.07, 5000, 0.08, 2, 'highpass'); },
    shot_mare() { tone(600, 300, 0.12, 'sine', 0.08); noise(0.1, 900, 0.05); },
    shot_lumi() { tone(1200, 1800, 0.1, 'triangle', 0.05); },
    shot_lamina() { noise(0.12, 3200, 0.1, 1.5, 'bandpass'); },
    shot_trovao() { noise(0.06, 4000, 0.1, 2, 'highpass'); tone(1600, 300, 0.06, 'square', 0.03); },
    shot_vinha() { noise(0.06, 1800, 0.07, 2, 'bandpass'); },
    shot_sino() { tone(520, 500, 0.25, 'sine', 0.06); tone(1040, 1000, 0.2, 'sine', 0.03); },
    swing() { noise(0.15, 700, 0.18, 1); tone(140, 60, 0.15, 'sawtooth', 0.06); },
    hit() { tone(220, 90, 0.07, 'square', 0.05); },
    hurt() { tone(160, 60, 0.15, 'sawtooth', 0.12); noise(0.1, 600, 0.1); },
    heal() { tone(660, 990, 0.18, 'sine', 0.06); tone(880, 1320, 0.2, 'sine', 0.04, 0.06); },
    boom() { noise(0.7, 400, 0.45); tone(90, 30, 0.6, 'sine', 0.35); },
    quake() { noise(0.6, 250, 0.5); tone(70, 25, 0.6, 'sawtooth', 0.25); },
    dash() { noise(0.18, 1600, 0.12, 0.7, 'bandpass'); },
    blink() { tone(900, 200, 0.2, 'sine', 0.1); noise(0.15, 3000, 0.06, 2, 'bandpass'); },
    cast() { tone(300, 600, 0.12, 'triangle', 0.06); },
    death() { tone(400, 60, 0.6, 'sawtooth', 0.12); },
    revive() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.25, 'sine', 0.07, i * 0.08)); },
    shield() { tone(500, 1000, 0.25, 'triangle', 0.07); },
    block() { tone(1400, 900, 0.08, 'square', 0.05); },
    round() { [392, 523, 659].forEach((f, i) => tone(f, f * 1.01, 0.35, 'triangle', 0.09, i * 0.12)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.4, 'triangle', 0.1, i * 0.12)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, f, 0.45, 'sawtooth', 0.06, i * 0.15)); },
    tick() { tone(880, 880, 0.08, 'square', 0.05); },
    click() { tone(700, 500, 0.05, 'square', 0.04); },
    hook() { noise(0.2, 2500, 0.1, 3, 'bandpass'); tone(300, 150, 0.2, 'square', 0.04); },
    aurora() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, f * 1.5, 0.5, 'sine', 0.05, i * 0.05)); },
  };
  return {
    init, play(k, ms = 40) { if (!ac) return; if (ac.state === 'suspended') ac.resume(); if (lib[k] && lim(k, ms)) lib[k](); },
    toggle() { enabled = !enabled; return enabled; }, get on() { return enabled; },
    setVolume(v) { vol = v; if (master) master.gain.value = v; },
  };
})();
