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
const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNor; in vec3 aCol; in float aMat;
uniform mat4 uVP; uniform mat4 uM;
out vec3 vW; out vec3 vN; out vec3 vC; out float vMat;
void main(){ vec4 w = uM * vec4(aPos,1.0); vW = w.xyz; vN = normalize(mat3(uM) * aNor); vC = aCol; vMat = aMat; gl_Position = uVP * w; }`;
const FS_SRC = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vC; in float vMat;
uniform vec3 uCam; uniform vec4 uTint; uniform float uEmis; uniform vec3 uFog; uniform float uFogD; uniform float uMatO;
out vec4 o;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec3 n = normalize(vN);
  vec3 col = vC * uTint.rgb;
  float m = uMatO >= 0.0 ? uMatO : vMat;
  if (m > 0.5) {
    vec2 uv = abs(n.y) > 0.5 ? vW.xz : vec2(vW.x + vW.z, vW.y);
    if (m < 1.5) { // piso de lajotas
      vec2 t = fract(vW.xz / 2.0); float e = min(min(t.x,1.0-t.x),min(t.y,1.0-t.y));
      col *= 0.86 + 0.14 * h21(floor(vW.xz/2.0)) ; col *= mix(0.72, 1.0, smoothstep(0.0, 0.03, e));
      col *= 0.92 + 0.08 * noise(vW.xz * 3.0);
    } else if (m < 2.5) { // parede com painéis
      if (abs(n.y) < 0.5) { vec2 t = fract(uv / vec2(2.0, 1.25)); float e = min(min(t.x,1.0-t.x),min(t.y,1.0-t.y)); col *= mix(0.78, 1.0, smoothstep(0.0, 0.025, e)); col *= 0.9 + 0.1 * h21(floor(uv / vec2(2.0,1.25))); }
      col *= 0.93 + 0.07 * noise(uv * 2.0);
      col *= mix(0.62, 1.0, clamp(vW.y / 1.2, 0.0, 1.0)); // sujeira perto do chão
    } else if (m < 3.5) { // caixa de madeira
      float pl = fract((abs(n.y) > 0.5 ? vW.x : vW.y) / 0.32); col *= mix(0.8, 1.0, smoothstep(0.0, 0.08, pl)); col *= 0.9 + 0.1 * noise(uv * vec2(1.0, 8.0));
    } else if (m < 4.5) { // metal
      col *= 0.88 + 0.12 * noise(uv * 6.0);
    } else { col *= 1.0; }
  }
  vec3 L = normalize(vec3(0.45, 0.85, 0.3));
  float dif = max(dot(n, L), 0.0);
  vec3 amb = mix(vec3(0.32,0.30,0.34), vec3(0.55,0.62,0.75), n.y * 0.5 + 0.5);
  vec3 lit = col * (amb + vec3(1.0,0.95,0.85) * dif * 0.75);
  lit = mix(lit, col, uEmis);
  float d = length(vW - uCam);
  float f = 1.0 - exp(-d * uFogD);
  o = vec4(mix(lit, uFog, f), uTint.a);
}`;
const SKY_VS = `#version 300 es
in vec2 p; out vec2 v; void main(){ v = p; gl_Position = vec4(p, 0.9999, 1.0); }`;
const SKY_FS = `#version 300 es
precision highp float; in vec2 v; uniform float uPitch; uniform vec3 uTop; uniform vec3 uHor; out vec4 o;
void main(){ float y = v.y * 0.5 + uPitch * 0.9; vec3 c = mix(uHor, uTop, clamp(y * 0.9 + 0.35, 0.0, 1.0)); o = vec4(c, 1.0); }`;

class GL {
  constructor(canvas) {
    this.c = canvas;
    const g = this.g = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!g) throw new Error('Seu navegador não suporta WebGL2 (necessário para o modo FPS).');
    this.prog = this.mk(VS, FS_SRC);
    this.sky = this.mk(SKY_VS, SKY_FS);
    const P = this.prog; this.u = {};
    for (const n of ['uVP', 'uM', 'uCam', 'uTint', 'uEmis', 'uFog', 'uFogD', 'uMatO']) this.u[n] = g.getUniformLocation(P, n);
    this.su = { uPitch: g.getUniformLocation(this.sky, 'uPitch'), uTop: g.getUniformLocation(this.sky, 'uTop'), uHor: g.getUniformLocation(this.sky, 'uHor') };
    this.skyBuf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, this.skyBuf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    this.skyVao = g.createVertexArray(); g.bindVertexArray(this.skyVao);
    const sp = g.getAttribLocation(this.sky, 'p'); g.enableVertexAttribArray(sp); g.vertexAttribPointer(sp, 2, g.FLOAT, false, 0, 0);
    this.cube = this.mesh(boxGeo([{ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, col: [1, 1, 1], mat: 0, center: true }]));
    this.sph = this.mesh(sphereGeo(14, 10));
    this.fog = [0.62, 0.68, 0.76]; this.fogD = 0.012; this.skyTop = [0.32, 0.5, 0.78];
    g.enable(g.DEPTH_TEST); g.enable(g.CULL_FACE);
  }
  mk(vs, fs) {
    const g = this.g, p = g.createProgram();
    for (const [t, s] of [[g.VERTEX_SHADER, vs], [g.FRAGMENT_SHADER, fs]]) {
      const sh = g.createShader(t); g.shaderSource(sh, s); g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh));
      g.attachShader(p, sh);
    }
    g.linkProgram(p); if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    return p;
  }
  mesh(data) {
    const g = this.g, vao = g.createVertexArray(); g.bindVertexArray(vao);
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW);
    const st = 10 * 4; let off = 0;
    for (const [n, k] of [['aPos', 3], ['aNor', 3], ['aCol', 3], ['aMat', 1]]) {
      const l = g.getAttribLocation(this.prog, n); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, k, g.FLOAT, false, st, off); off += k * 4;
    }
    return { vao, n: data.length / 10, buf };
  }
  resize(scale) {
    const w = Math.floor(innerWidth * scale), h = Math.floor(innerHeight * scale);
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
  }
  begin(cam) {
    const g = this.g;
    g.viewport(0, 0, this.c.width, this.c.height);
    g.clearColor(this.fog[0], this.fog[1], this.fog[2], 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    // céu
    g.useProgram(this.sky); g.disable(g.DEPTH_TEST); g.bindVertexArray(this.skyVao);
    g.uniform1f(this.su.uPitch, cam.pitch); g.uniform3fv(this.su.uTop, this.skyTop); g.uniform3fv(this.su.uHor, this.fog);
    g.drawArrays(g.TRIANGLES, 0, 3); g.enable(g.DEPTH_TEST);
    const asp = this.c.width / this.c.height;
    this.P = M4.persp(cam.fov, asp, 0.05, 400);
    const f = fwdVec(cam.yaw, cam.pitch);
    this.V = M4.look(cam.x, cam.y, cam.z, f[0], f[1], f[2]);
    this.VP = M4.mul(this.P, this.V);
    g.useProgram(this.prog);
    g.uniformMatrix4fv(this.u.uVP, false, this.VP);
    g.uniform3f(this.u.uCam, cam.x, cam.y, cam.z);
    g.uniform3fv(this.u.uFog, this.fog); g.uniform1f(this.u.uFogD, this.fogD);
    this.tint(1, 1, 1, 1, 0); g.uniform1f(this.u.uMatO, -1);
    this.cam = cam;
  }
  tint(r, g_, b, a = 1, emis = 0) { this.g.uniform4f(this.u.uTint, r, g_, b, a); this.g.uniform1f(this.u.uEmis, emis); }
  draw(mesh, M) { const g = this.g; g.uniformMatrix4fv(this.u.uM, false, M || M4.ident()); g.bindVertexArray(mesh.vao); g.drawArrays(g.TRIANGLES, 0, mesh.n); }
  // caixa colorida (para personagens, efeitos)
  box(x, y, z, sx, sy, sz, col, opt = {}) {
    this.tint(col[0], col[1], col[2], opt.a ?? 1, opt.emis || 0);
    if (opt.mat != null) this.g.uniform1f(this.u.uMatO, opt.mat);
    this.draw(this.cube, M4.trs(x, y, z, opt.ry || 0, opt.rx || 0, opt.rz || 0, sx, sy, sz));
    if (opt.mat != null) this.g.uniform1f(this.u.uMatO, -1);
  }
  ball(x, y, z, sx, sy, sz, col, opt = {}) { const g = this.g; g.disable(g.CULL_FACE); this.tint(col[0], col[1], col[2], opt.a ?? 1, opt.emis || 0); this.draw(this.sph, M4.trs(x, y, z, opt.ry || 0, 0, 0, sx, sy, sz)); g.enable(g.CULL_FACE); }
  boxM(M, col, opt = {}) { this.tint(col[0], col[1], col[2], opt.a ?? 1, opt.emis || 0); this.draw(this.cube, M); }
  blend(on) { const g = this.g; if (on) { g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA); g.depthMask(false); } else { g.disable(g.BLEND); g.depthMask(true); } }
  additive(on) { const g = this.g; if (on) { g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE); g.depthMask(false); } else { g.disable(g.BLEND); g.depthMask(true); } }
  // arma em primeira pessoa: projeção própria e profundidade limpa
  viewmodel(fov) {
    const g = this.g; g.clear(g.DEPTH_BUFFER_BIT);
    const P = M4.persp(fov, this.c.width / this.c.height, 0.01, 10);
    g.uniformMatrix4fv(this.u.uVP, false, P);
    g.uniform3f(this.u.uCam, 0, 0, 0);
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
