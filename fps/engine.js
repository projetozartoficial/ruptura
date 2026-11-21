// =====================================================================
//  fps/engine.js : matemática 3D, renderizador WebGL2, colisão e raycast
// =====================================================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const angWrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ---------------- mat4 (coluna-maior) ----------------
const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  },
  look(ex, ey, ez, fx, fy, fz) { // olho + direção
    let zx = -fx, zy = -fy, zz = -fz; const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    let xx = zz, xy = 0, xz = -zx; const xl = Math.hypot(xx, xz) || 1; xx /= xl; xz /= xl; // up = (0,1,0)
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[4] = xy; m[8] = xz; m[12] = -(xx * ex + xy * ey + xz * ez);
    m[1] = yx; m[5] = yy; m[9] = yz; m[13] = -(yx * ex + yy * ey + yz * ez);
    m[2] = zx; m[6] = zy; m[10] = zz; m[14] = -(zx * ex + zy * ey + zz * ez);
    m[15] = 1; return m;
  },
  // T * Ry * Rx * Rz * S
  trs(x, y, z, ry, rx, rz, sx, sy, sz) {
    const cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx || 0), sx_ = Math.sin(rx || 0), cz = Math.cos(rz || 0), sz_ = Math.sin(rz || 0);
    // R = Ry*Rx*Rz
    const r00 = cy * cz + sy_ * sx_ * sz_, r01 = -cy * sz_ + sy_ * sx_ * cz, r02 = sy_ * cx;
    const r10 = cx * sz_, r11 = cx * cz, r12 = -sx_;
    const r20 = -sy_ * cz + cy * sx_ * sz_, r21 = sy_ * sz_ + cy * sx_ * cz, r22 = cy * cx;
    const m = new Float32Array(16);
    m[0] = r00 * sx; m[1] = r10 * sx; m[2] = r20 * sx;
    m[4] = r01 * sy; m[5] = r11 * sy; m[6] = r21 * sy;
    m[8] = r02 * sz; m[9] = r12 * sz; m[10] = r22 * sz;
    m[12] = x; m[13] = y; m[14] = z; m[15] = 1; return m;
  },
};
function fwdVec(yaw, pitch) { const cp = Math.cos(pitch); return [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp]; }

// ---------------- Renderizador ----------------
M4.ortho = (l, r, b, t, n, f) => { const m = new Float32Array(16); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n); m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m; };
M4.inv = m => { // inversa 4x4 (para o céu)
  const inv = new Float32Array(16), a = m;
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  let det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12]; det = det ? 1 / det : 0;
  for (let i = 0; i < 16; i++) inv[i] *= det; return inv;
};
const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNor; in vec3 aCol; in float aMat;
uniform mat4 uVP; uniform mat4 uM;
out vec3 vW; out vec3 vN; out vec3 vC; out float vMat;
void main(){ vec4 w = uM * vec4(aPos,1.0); vW = w.xyz; vN = normalize(mat3(uM) * aNor); vC = aCol; vMat = aMat; gl_Position = uVP * w; }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main(){ o = vec4(1.0); }`;
const FS_SRC = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vW; in vec3 vN; in vec3 vC; in float vMat;
uniform vec3 uCam; uniform vec4 uTint; uniform float uEmis; uniform vec3 uFog; uniform float uFogD; uniform float uMatO;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uAmb; uniform float uTime;
uniform mat4 uLVP; uniform sampler2DShadow uShadow; uniform float uUseShadow; uniform sampler2D uNoise; uniform float uSM;
out vec4 o;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
// ruído vindo de uma textura (bem mais barato que calcular na hora)
float noise(vec2 p){ return texture(uNoise, p * (1.0 / 64.0)).r; }
float fbm(vec2 p){ float v = 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 17.3);
#ifdef HQ
  v += 0.125 * noise(p * 4.1 + 41.7) + 0.0625 * noise(p * 8.3 + 5.1);
#else
  v += 0.1875 * noise(p * 4.1 + 41.7);
#endif
  return v; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float shadowAt(vec3 w, vec3 n){
  if (uUseShadow < 0.5) return 1.0;
  vec4 lp = uLVP * vec4(w + n * 0.06, 1.0); vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float t = 1.0 / uSM, z = p.z - 0.0015;
#ifdef HQ
  // 4 amostras com filtro bilinear do hardware = borda suave (equivale a 16)
  return 0.25 * (texture(uShadow, vec3(p.xy + vec2(-0.6, -0.6) * t, z)) + texture(uShadow, vec3(p.xy + vec2(0.6, -0.6) * t, z))
               + texture(uShadow, vec3(p.xy + vec2(-0.6, 0.6) * t, z)) + texture(uShadow, vec3(p.xy + vec2(0.6, 0.6) * t, z)));
#else
  return texture(uShadow, vec3(p.xy, z));
#endif
}
void main(){
  vec3 n = normalize(vN);
  vec3 base = pow(vC * uTint.rgb, vec3(2.2));
  float m = uMatO >= 0.0 ? uMatO : vMat;
  float spec = 0.0, rough = 1.0;
  if (m > 0.5) {
    vec2 uv = abs(n.y) > 0.5 ? vW.xz : vec2(vW.x + vW.z, vW.y);
    if (m < 1.5) { // piso de lajotas
      vec2 t = fract(vW.xz / 2.0); float e = min(min(t.x,1.0-t.x),min(t.y,1.0-t.y));
      base *= 0.8 + 0.25 * h21(floor(vW.xz/2.0)); base *= mix(0.55, 1.0, smoothstep(0.0, 0.03, e));
      base *= 0.8 + 0.3 * fbm(vW.xz * 1.7);
      spec = 0.08;
    } else if (m < 2.5) { // parede com blocos
      if (abs(n.y) < 0.5) { vec2 g = uv / vec2(1.6, 0.8); g.x += floor(g.y) * 0.5; vec2 t = fract(g); float e = min(min(t.x,1.0-t.x),min(t.y,1.0-t.y)); base *= mix(0.62, 1.0, smoothstep(0.0, 0.05, e)); base *= 0.82 + 0.3 * h21(floor(g)); }
      base *= 0.8 + 0.35 * fbm(uv * 1.3);
      base *= mix(0.5, 1.0, clamp(vW.y / 1.4, 0.0, 1.0));
    } else if (m < 3.5) { // madeira
      float pl = fract((abs(n.y) > 0.5 ? vW.x : vW.y) / 0.3); base *= mix(0.6, 1.0, smoothstep(0.0, 0.1, pl)); base *= 0.75 + 0.4 * noise(uv * vec2(1.5, 14.0));
    } else if (m < 4.5) { // metal / gelo
      base *= 0.8 + 0.3 * fbm(uv * 4.0); spec = 0.55; rough = 0.3;
    } else if (m < 5.5) { // folhagem
      base *= 0.6 + 0.7 * fbm(uv * 3.0 + vec2(uTime * 0.2, 0.0));
    } else { // água
      float w1 = sin(vW.x * 1.7 + uTime * 1.6) + sin(vW.z * 2.1 - uTime * 1.3) + sin((vW.x + vW.z) * 3.3 + uTime * 2.2) * 0.5;
      n = normalize(vec3(cos(vW.x * 1.7 + uTime * 1.6) * 0.12, 1.0, cos(vW.z * 2.1 - uTime * 1.3) * 0.12));
      base *= 0.85 + 0.15 * w1; spec = 1.2; rough = 0.08;
    }
  }
  vec3 L = normalize(uSun);
  float dif = max(dot(n, L), 0.0);
  float sh = dif > 0.0 ? shadowAt(vW, n) : 0.0;
  vec3 sky = pow(uSky, vec3(2.2)), ground = pow(vec3(0.35, 0.32, 0.3), vec3(2.2));
  vec3 amb = mix(ground, sky, n.y * 0.5 + 0.5) * uAmb * 1.6;
  float ao = mix(0.55, 1.0, clamp(vW.y / 0.9, 0.0, 1.0)); // sombra de contato perto do chão
  vec3 V = normalize(uCam - vW), Hh = normalize(L + V);
  float sp = pow(max(dot(n, Hh), 0.0), mix(160.0, 12.0, rough)) * spec;
  vec3 sunC = pow(uSunCol, vec3(2.2)) * 2.4;
  vec3 lit = base * (amb * ao + sunC * dif * sh) + sunC * sp * sh;
  lit = mix(lit, base * 2.2, uEmis);
  float d = length(vW - uCam);
  float f = 1.0 - exp(-d * uFogD);
  vec3 fogC = pow(uFog, vec3(2.2));
  lit = mix(lit, fogC, f);
  vec3 col = pow(aces(lit * 1.05), vec3(1.0 / 2.2));
  o = vec4(col, uTint.a);
}`;
const SKY_VS = `#version 300 es
in vec2 p; out vec2 v; void main(){ v = p; gl_Position = vec4(p, 0.9999, 1.0); }`;
const SKY_FS = `#version 300 es
precision highp float; in vec2 v; uniform mat4 uInv; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uTime; uniform sampler2D uNoise; out vec4 o;
float noise(vec2 p){ return texture(uNoise, p * (1.0 / 64.0)).r; }
float fbm(vec2 p){ return 0.5 * noise(p) + 0.25 * noise(p * 2.1 + 9.1) + 0.125 * noise(p * 4.4 + 3.7) + 0.0625 * noise(p * 9.0 + 1.3); }
void main(){
  vec4 a = uInv * vec4(v, 1.0, 1.0), b = uInv * vec4(v, -1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w - b.xyz / b.w);
  float y = d.y;
  vec3 c = mix(uHor, uTop, smoothstep(-0.05, 0.6, y));
  c = mix(c, uHor * 0.75, smoothstep(0.0, -0.4, y));
  vec3 L = normalize(uSun); float s = max(dot(d, L), 0.0);
  c += uSunCol * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.25);
  if (y > 0.0) { vec2 q = d.xz / (y + 0.12) * 1.4 + vec2(uTime * 0.012, 0.0); float cl = smoothstep(0.45, 0.85, fbm(q)); c = mix(c, mix(vec3(1.0), uHor, 0.25) * (0.85 + 0.25 * s), cl * 0.75 * smoothstep(0.0, 0.25, y)); }
  o = vec4(c, 1.0);
}`;

// textura de ruído suave que se repete (64 células em 256 px), usada nas texturas e nas nuvens
function noiseTex(g) {
  const N = 256, C = 64, k = N / C, L = new Float32Array(C * C);
  let sd = 1234567; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < L.length; i++) L[i] = rr();
  const d = new Uint8Array(N * N * 4), sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = x / k, gy = y / k, ix = Math.floor(gx), iy = Math.floor(gy), fx = sm(gx - ix), fy = sm(gy - iy);
    const a = L[(iy % C) * C + ix % C], b = L[(iy % C) * C + (ix + 1) % C], c = L[((iy + 1) % C) * C + ix % C], e = L[((iy + 1) % C) * C + (ix + 1) % C];
    const v = (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy, o = (y * N + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = v * 255; d[o + 3] = 255;
  }
  const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, N, N, 0, g.RGBA, g.UNSIGNED_BYTE, d);
  g.generateMipmap(g.TEXTURE_2D);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
  return t;
}

class GL {
  // opt.hq: qualidade alta (true) ou modo desempenho (false); opt.aa: antisserrilhado
  constructor(canvas, opt = {}) {
    this.c = canvas; this.hq = opt.hq !== false;
    const g = this.g = canvas.getContext('webgl2', { antialias: opt.aa !== false, alpha: false, powerPreference: 'high-performance' });
    if (!g) throw new Error('Seu navegador não suporta WebGL2 (necessário para o modo FPS).');
    const def = src => src.replace('precision highp float;', 'precision highp float;\n' + (this.hq ? '#define HQ\n' : ''));
    this.prog = this.mk(VS, def(FS_SRC));
    this.dprog = this.mk(VS, DEPTH_FS);
    this.sky = this.mk(SKY_VS, SKY_FS);
    const P = this.prog; this.u = {};
    for (const n of ['uVP', 'uM', 'uCam', 'uTint', 'uEmis', 'uFog', 'uFogD', 'uMatO', 'uSun', 'uSunCol', 'uSky', 'uAmb', 'uTime', 'uLVP', 'uShadow', 'uUseShadow', 'uNoise', 'uSM']) this.u[n] = g.getUniformLocation(P, n);
    this.du = { uVP: g.getUniformLocation(this.dprog, 'uVP'), uM: g.getUniformLocation(this.dprog, 'uM') };
    this.su = {}; for (const n of ['uInv', 'uTop', 'uHor', 'uSun', 'uSunCol', 'uTime', 'uNoise']) this.su[n] = g.getUniformLocation(this.sky, n);
    this.skyBuf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, this.skyBuf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    this.skyVao = g.createVertexArray(); g.bindVertexArray(this.skyVao);
    const sp = g.getAttribLocation(this.sky, 'p'); g.enableVertexAttribArray(sp); g.vertexAttribPointer(sp, 2, g.FLOAT, false, 0, 0);
    this.cube = this.mesh(boxGeo([{ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, col: [1, 1, 1], mat: 0, center: true }]));
    this.sph = this.mesh(sphereGeo(14, 10));
    // mapa de sombras
    // o mapa (parado) é desenhado na sombra uma vez só e copiado a cada quadro;
    // só o que se mexe (jogadores, portas, objetos) é redesenhado
    this.SM = this.hq ? 2048 : 1024;
    const mkDepth = () => {
      const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
      g.texStorage2D(g.TEXTURE_2D, 1, g.DEPTH_COMPONENT24, this.SM, this.SM);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_COMPARE_MODE, g.COMPARE_REF_TO_TEXTURE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_COMPARE_FUNC, g.LEQUAL);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      const f = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, f);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.TEXTURE_2D, t, 0);
      g.drawBuffers([g.NONE]); g.readBuffer(g.NONE);
      return [t, f];
    };
    [this.shTex, this.shFbo] = mkDepth();
    [this.stTex, this.stFbo] = mkDepth();
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    this.noise = noiseTex(g);
    this.stats = { draws: 0 };
    this.shadows = true;
    this.setTheme({ sky: [0.32, 0.5, 0.78], fog: [0.62, 0.68, 0.76], sun: [0.45, 0.85, 0.3], sunCol: [1, 0.95, 0.85], amb: 0.55 }, 80, 52);
    this.fogD = 0.010; this.q = [];
    g.enable(g.DEPTH_TEST); g.enable(g.CULL_FACE);
  }
  setTheme(T, mw, mh) {
    this.T = T; this.fog = T.fog; this.skyTop = T.sky;
    const L = T.sun, l = Math.hypot(...L), d = [L[0] / l, L[1] / l, L[2] / l];
    const cx = mw / 2, cz = mh / 2, R = Math.hypot(mw, mh) / 2 + 4;
    const V = M4.look(cx + d[0] * 120, d[1] * 120, cz + d[2] * 120, -d[0], -d[1], -d[2]);
    this.LVP = M4.mul(M4.ortho(-R, R, -R, R, 20, 260), V); this.mw = mw; this.mh = mh;
    this.shadowDirty = true;
  }
  mk(vs, fs) {
    const g = this.g, p = g.createProgram();
    for (const [t, s] of [[g.VERTEX_SHADER, vs], [g.FRAGMENT_SHADER, fs]]) {
      const sh = g.createShader(t); g.shaderSource(sh, s); g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh));
      g.attachShader(p, sh);
    }
    for (const [i, n] of ['aPos', 'aNor', 'aCol', 'aMat'].entries()) g.bindAttribLocation(p, i, n);
    g.linkProgram(p); if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    return p;
  }
  mesh(data) {
    const g = this.g, vao = g.createVertexArray(); g.bindVertexArray(vao);
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW);
    const st = 10 * 4; let off = 0;
    for (const [i, k] of [3, 3, 3, 1].entries()) { g.enableVertexAttribArray(i); g.vertexAttribPointer(i, k, g.FLOAT, false, st, off); off += k * 4; }
    return { vao, n: data.length / 10, buf };
  }
  resize(scale) {
    const w = Math.floor(innerWidth * scale), h = Math.floor(innerHeight * scale);
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
  }
  // começa o quadro: as peças opacas vão para uma fila (para desenhar sombra + cor)
  begin(cam, time = 0) {
    const g = this.g;
    this.time = time; this.q = []; this.flushed = false;
    const asp = this.c.width / this.c.height;
    this.P = M4.persp(cam.fov, asp, 0.05, 400);
    const f = fwdVec(cam.yaw, cam.pitch);
    this.V = M4.look(cam.x, cam.y, cam.z, f[0], f[1], f[2]);
    this.VP = M4.mul(this.P, this.V);
    this.cam = cam;
  }
  flush() {
    if (this.flushed) return; this.flushed = true;
    const g = this.g, T = this.T, cam = this.cam;
    // 1) sombras
    if (this.shadows) {
      g.useProgram(this.dprog); g.uniformMatrix4fv(this.du.uVP, false, this.LVP);
      g.enable(g.POLYGON_OFFSET_FILL); g.polygonOffset(2, 4); g.disable(g.CULL_FACE);
      const shadowOf = it => { g.uniformMatrix4fv(this.du.uM, false, it.M); g.bindVertexArray(it.mesh.vao); g.drawArrays(g.TRIANGLES, 0, it.mesh.n); this.stats.draws++; };
      const stat = this.q.filter(it => it.stat);
      const key = stat.map(it => it.mesh.n).join(',');
      if (this.shadowDirty || key !== this.stKey) { // refaz a sombra do mapa (troca de mapa/tema)
        g.bindFramebuffer(g.FRAMEBUFFER, this.stFbo); g.viewport(0, 0, this.SM, this.SM); g.clear(g.DEPTH_BUFFER_BIT);
        for (const it of stat) shadowOf(it);
        this.shadowDirty = false; this.stKey = key;
      }
      g.bindFramebuffer(g.READ_FRAMEBUFFER, this.stFbo); g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.shFbo);
      g.blitFramebuffer(0, 0, this.SM, this.SM, 0, 0, this.SM, this.SM, g.DEPTH_BUFFER_BIT, g.NEAREST);
      g.bindFramebuffer(g.FRAMEBUFFER, this.shFbo); g.viewport(0, 0, this.SM, this.SM);
      for (const it of this.q) if (it.cast !== false && !it.stat && this.inShadowRange(it)) shadowOf(it);
      g.disable(g.POLYGON_OFFSET_FILL); g.enable(g.CULL_FACE);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
    }
    g.viewport(0, 0, this.c.width, this.c.height);
    g.clearColor(this.fog[0], this.fog[1], this.fog[2], 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, this.noise); g.activeTexture(g.TEXTURE0);
    // 2) cena (o mapa por último: o que está na frente já tapa os pixels dele)
    g.useProgram(this.prog);
    const u = this.u;
    g.uniformMatrix4fv(u.uVP, false, this.VP); g.uniform3f(u.uCam, cam.x, cam.y, cam.z);
    g.uniform3fv(u.uFog, this.fog); g.uniform1f(u.uFogD, this.fogD);
    g.uniform3fv(u.uSun, T.sun); g.uniform3fv(u.uSunCol, T.sunCol); g.uniform3fv(u.uSky, T.sky); g.uniform1f(u.uAmb, T.amb); g.uniform1f(u.uTime, this.time);
    g.uniformMatrix4fv(u.uLVP, false, this.LVP); g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, this.shTex); g.uniform1i(u.uShadow, 0); g.uniform1f(u.uUseShadow, this.shadows ? 1 : 0);
    g.uniform1i(u.uNoise, 1); g.uniform1f(u.uSM, this.SM);
    g.uniform1f(u.uMatO, -1);
    this.q.sort((a, b) => (a.stat ? 1 : 0) - (b.stat ? 1 : 0));
    for (const it of this.q) { this.stats.draws++; g.uniform4f(u.uTint, it.c[0], it.c[1], it.c[2], 1); g.uniform1f(u.uEmis, it.e); g.uniform1f(u.uMatO, it.mat ?? -1); g.uniformMatrix4fv(u.uM, false, it.M); g.bindVertexArray(it.mesh.vao); g.drawArrays(g.TRIANGLES, 0, it.mesh.n); }
    g.uniform1f(u.uMatO, -1);
    // 3) céu por último: só é calculado onde nada o tapa
    g.useProgram(this.sky); g.depthFunc(g.LEQUAL); g.depthMask(false); g.bindVertexArray(this.skyVao);
    g.uniformMatrix4fv(this.su.uInv, false, M4.inv(this.VP)); g.uniform3fv(this.su.uTop, T.sky); g.uniform3fv(this.su.uHor, T.fog);
    g.uniform3fv(this.su.uSun, T.sun); g.uniform3fv(this.su.uSunCol, T.sunCol); g.uniform1f(this.su.uTime, this.time); g.uniform1i(this.su.uNoise, 1);
    g.drawArrays(g.TRIANGLES, 0, 3); g.depthMask(true); g.depthFunc(g.LESS);
    g.useProgram(this.prog);
    this.q = [];
  }
  // objetos fora da área do mapa de sombras não precisam ser desenhados nele
  inShadowRange(it) { const M = it.M; return M[12] > -8 && M[14] > -8 && M[12] < this.mw + 8 && M[14] < this.mh + 8; }
  tint(r, g_, b, a = 1, emis = 0) { this.g.uniform4f(this.u.uTint, r, g_, b, a); this.g.uniform1f(this.u.uEmis, emis); }
  // desenha (ou põe na fila, se ainda for a parte opaca do quadro)
  put(mesh, M, col, opt = {}) {
    const a = opt.a ?? 1;
    if (!this.flushed && a >= 1) { this.q.push({ mesh, M, c: col, e: opt.emis || 0, mat: opt.mat, cast: opt.cast, stat: opt.stat }); return; }
    const g = this.g; this.tint(col[0], col[1], col[2], a, opt.emis || 0);
    if (opt.mat != null) g.uniform1f(this.u.uMatO, opt.mat);
    g.uniformMatrix4fv(this.u.uM, false, M); g.bindVertexArray(mesh.vao); g.drawArrays(g.TRIANGLES, 0, mesh.n);
    if (opt.mat != null) g.uniform1f(this.u.uMatO, -1);
  }
  draw(mesh, M, opt = {}) { this.put(mesh, M || M4.ident(), [1, 1, 1], opt); }
  box(x, y, z, sx, sy, sz, col, opt = {}) { this.put(this.cube, M4.trs(x, y, z, opt.ry || 0, opt.rx || 0, opt.rz || 0, sx, sy, sz), col, opt); }
  ball(x, y, z, sx, sy, sz, col, opt = {}) { const g = this.g; if (this.flushed) g.disable(g.CULL_FACE); this.put(this.sph, M4.trs(x, y, z, opt.ry || 0, 0, 0, sx, sy, sz), col, opt); if (this.flushed) g.enable(g.CULL_FACE); }
  boxM(M, col, opt = {}) { this.put(this.cube, M, col, opt); }
  blend(on) { this.flush(); const g = this.g; if (on) { g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA); g.depthMask(false); } else { g.disable(g.BLEND); g.depthMask(true); } }
  additive(on) { this.flush(); const g = this.g; if (on) { g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE); g.depthMask(false); } else { g.disable(g.BLEND); g.depthMask(true); } }
  // arma em primeira pessoa: projeção própria e profundidade limpa
  viewmodel(fov) {
    this.flush();
    const g = this.g; g.clear(g.DEPTH_BUFFER_BIT);
    const P = M4.persp(fov, this.c.width / this.c.height, 0.01, 10);
    g.uniformMatrix4fv(this.u.uVP, false, P);
    g.uniform3f(this.u.uCam, 0, 0, 0); g.uniform1f(this.u.uUseShadow, 0);
    // luz do sol no espaço da câmera
    const L = this.T.sun, V = this.V, l = Math.hypot(...L);
    g.uniform3f(this.u.uSun, (V[0] * L[0] + V[4] * L[1] + V[8] * L[2]) / l, (V[1] * L[0] + V[5] * L[1] + V[9] * L[2]) / l, (V[2] * L[0] + V[6] * L[1] + V[10] * L[2]) / l);
  }
  // projeta ponto do mundo na tela (para nomes, marcadores)
  project(x, y, z) {
    const m = this.VP, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return null;
    return [(cx / cw * 0.5 + 0.5) * innerWidth, (1 - (cy / cw * 0.5 + 0.5)) * innerHeight, cw];
  }
}

// geometria de caixas (posição, normal, cor, material)
function boxGeo(boxes) {
  const out = [];
  const F = [ // normal, 4 cantos (u,v em [0,1] por eixo)
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
    [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
    [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
    [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  ];
  for (const b of boxes) {
    const x0 = b.center ? b.x - b.w / 2 : b.x, y0 = b.center ? b.y - b.h / 2 : b.y, z0 = b.center ? b.z - b.d / 2 : b.z;
    for (const [n, cs] of F) {
      if (b.skipBottom && n[1] === -1) continue;
      const sh = n[1] > 0 ? 1 : n[1] < 0 ? 0.6 : (n[0] !== 0 ? 0.92 : 0.84);
      const c = b.col.map(v => v * (b.flat ? 1 : sh));
      const P = cs.map(([u, v, w]) => [x0 + u * b.w, y0 + v * b.h, z0 + w * b.d]);
      for (const i of [0, 1, 2, 0, 2, 3]) out.push(...P[i], ...n, ...c, b.mat || 0);
    }
  }
  return new Float32Array(out);
}

// esfera de raio 0.5 (para névoas e efeitos)
function sphereGeo(nu, nv) {
  const out = [], P = (u, v) => { const a = u / nu * Math.PI * 2, b = v / nv * Math.PI - Math.PI / 2; return [Math.cos(b) * Math.cos(a) * 0.5, Math.sin(b) * 0.5, Math.cos(b) * Math.sin(a) * 0.5]; };
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
    const a = P(u, v), b = P(u + 1, v), c = P(u + 1, v + 1), d = P(u, v + 1);
    for (const q of [a, c, b, a, d, c]) out.push(...q, q[0] * 2, q[1] * 2, q[2] * 2, 1, 1, 1, 0);
  }
  return new Float32Array(out);
}

// ---------------- Colisão e raycast ----------------
// caixas: {x0,y0,z0,x1,y1,z1}
function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let t0 = 0, t1 = maxT;
  const ax = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]];
  for (const [o, d, lo, hi] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const t = a; a = c; c = t; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1;
  }
  return t0;
}
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tc = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > r * r) return -1;
  const th = Math.sqrt(r * r - d2); let t = tc - th; if (t < 0) t = tc + th; if (t < 0 || t > maxT) return -1; return t;
}
function aabbHit(b, x0, y0, z0, x1, y1, z1) { return x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1 && z1 > b.z0 && z0 < b.z1; }
