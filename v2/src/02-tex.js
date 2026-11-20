// ======================= 02 PROCEDURAL TEXTURES =======================
const TEX = {};
const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function mkTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO;
  if (srgb) t.encoding = THREE.sRGBEncoding; return t;
}
function pix(w, h, fn) {
  const c = cnv(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, o = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    o[3] = 255; fn(x, y, o); const k = (y * w + x) * 4; d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = o[3];
  }
  g.putImageData(img, 0, 0); return c;
}
function field(w, h, fn) { const a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = fn(x, y); return a; }
function normalMap(H, w, h, s) {
  return mkTex(pix(w, h, (x, y, o) => {
    const l = H[y * w + (x - 1 + w) % w], r = H[y * w + (x + 1) % w], u = H[((y - 1 + h) % h) * w + x], d = H[((y + 1) % h) * w + x];
    const nx = (l - r) * s, ny = (d - u) * s, L = Math.hypot(nx, ny, 1);
    o[0] = (nx / L * 0.5 + 0.5) * 255; o[1] = (ny / L * 0.5 + 0.5) * 255; o[2] = (1 / L * 0.5 + 0.5) * 255;
  }), false);
}
function grayTex(A, w, h) { return mkTex(pix(w, h, (x, y, o) => { o[0] = o[1] = o[2] = clamp(A[y * w + x], 0, 1) * 255; }), false); }
const C255 = v => clamp(v, 0, 1) * 255;
function strokeLayer(S, n, fn) { const c = cnv(S), g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineCap = 'round'; for (let i = 0; i < n; i++) fn(g, i); return g.getImageData(0, 0, S, S).data; }

// ---- 混凝土地坪：4m 一块贴图，2m 分缝 ----
function genConcrete(tint = [1, 0.98, 0.94], bright = 0.56) {
  const S = 512, J = 256;
  const big = field(S, S, (x, y) => Noise.fbm(x / S * 6, y / S * 6, 5, 6));
  const grain = field(S, S, (x, y) => Noise.fbm(x / S * 48, y / S * 48, 3, 48));
  const stain = field(S, S, (x, y) => Noise.fbm(x / S * 3 + 7, y / S * 3 + 1, 4, 3));
  const crack = strokeLayer(S, 9, g => {
    let x = rnd() * S, y = rnd() * S, a = rnd() * TAU; g.lineWidth = rr(0.8, 1.8); g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 26; k++) { a += rr(-0.7, 0.7); x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); } g.stroke();
  });
  const tire = strokeLayer(S, 3, g => {
    g.lineWidth = rr(10, 18); g.globalAlpha = 0.5; g.beginPath(); const y0 = rr(0, S); g.moveTo(-20, y0);
    g.bezierCurveTo(S * 0.3, y0 + rr(-90, 90), S * 0.6, y0 + rr(-90, 90), S + 20, y0 + rr(-40, 40)); g.stroke();
  });
  const H = new Float32Array(S * S), R = new Float32Array(S * S);
  const map = pix(S, S, (x, y, o) => {
    const i = y * S + x;
    const dx = Math.min(x % J, J - x % J), dy = Math.min(y % J, J - y % J);
    const joint = 1 - ss(1, 3.5, Math.min(dx, dy));
    const cr = crack[i * 4 + 3] / 255, tr = tire[i * 4 + 3] / 255 * grain[i];
    const st = ss(0.56, 0.74, stain[i]);
    let b = bright + (big[i] - 0.5) * 0.28 + (grain[i] - 0.5) * 0.16;
    b *= (1 - st * 0.42) * (1 - joint * 0.55 - cr * 0.5) * (1 - tr * 0.3);
    o[0] = C255(b * tint[0]); o[1] = C255(b * tint[1]); o[2] = C255(b * tint[2]);
    H[i] = 0.5 + (grain[i] - 0.5) * 0.18 + (big[i] - 0.5) * 0.15 - joint * 0.8 - cr * 0.5;
    R[i] = clamp(0.93 - st * 0.4 - tr * 0.15 + (grain[i] - 0.5) * 0.12 + joint * 0.05, 0.35, 1);
  });
  return { map: mkTex(map), normal: normalMap(H, S, S, 1.6), rough: grayTex(R, S, S) };
}

// ---- 喷漆钢板：共享锈迹/污渍场，按颜色出多份 ----
function genPaintShared() {
  const S = 512;
  const chip = field(S, S, (x, y) => Noise.fbm(x / S * 16, y / S * 16, 5, 16));
  const streak = field(S, S, (x, y) => Noise.fbm(x / S * 24, y / S * 2, 4, 24, 2));
  const grain = field(S, S, (x, y) => Noise.fbm(x / S * 64, y / S * 64, 2, 64));
  const rust = new Float32Array(S * S), grime = new Float32Array(S * S), seam = new Float32Array(S * S);
  const H = new Float32Array(S * S), R = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const d = Math.min(x % 256, 256 - x % 256, y % 256, 256 - y % 256);
    seam[i] = 1 - ss(0.5, 2.2, d);
    rust[i] = ss(0.69, 0.75, chip[i] + (streak[i] - 0.5) * 0.22 + seam[i] * 0.1) * 0.85 + ss(0.6, 0.8, streak[i]) * 0.12;
    grime[i] = ss(0.45, 0.85, streak[i]);
    H[i] = 0.5 - rust[i] * 0.3 + (grain[i] - 0.5) * 0.15 * (1 + rust[i] * 3) - seam[i] * 0.5;
    R[i] = clamp(0.45 + rust[i] * 0.45 + grime[i] * 0.15 + (grain[i] - 0.5) * 0.12, 0, 1);
  }
  return { S, rust, grime, grain, seam, normal: normalMap(H, S, S, 2.2), rough: grayTex(R, S, S) };
}
function genPaint(sh, rgb, rustAmt = 1) {
  const S = sh.S;
  return mkTex(pix(S, S, (x, y, o) => {
    const i = y * S + x, gr = sh.grain[i];
    const g = (1 - sh.grime[i] * 0.32) * (0.94 + (gr - 0.5) * 0.12) * (1 - sh.seam[i] * 0.35);
    const ru = sh.rust[i] * rustAmt, rc = [0.40 + gr * 0.12, 0.2 + gr * 0.05, 0.1];
    for (let k = 0; k < 3; k++) o[k] = C255(lerp(rgb[k] * g, rc[k] * (0.7 + gr * 0.6), ru));
  }));
}

// ---- 集装箱 ----
const CONT_VARIANTS = [
  { c: [0.50, 0.15, 0.11], name: 'CORSAIR LINE', code: 'CSLU', txt: '#efefea' },
  { c: [0.12, 0.25, 0.44], name: 'NORDHAVN', code: 'NDHU', txt: '#f0f0ea' },
  { c: [0.15, 0.33, 0.25], name: 'PACIFIC STAR', code: 'PSTU', txt: '#eeeee6' },
  { c: [0.74, 0.36, 0.11], name: 'KESTREL', code: 'KSTU', txt: '#181818' },
  { c: [0.47, 0.49, 0.50], name: 'ORION FREIGHT', code: 'ORFU', txt: '#17336a' },
  { c: [0.80, 0.80, 0.76], name: 'TIDEWAY', code: 'TDWU', txt: '#a81c1c' },
  { c: [0.72, 0.56, 0.13], name: 'HALCYON', code: 'HLCU', txt: '#1e1e1e' },
  { c: [0.33, 0.11, 0.14], name: 'MERIDIAN', code: 'MRDU', txt: '#ebebeb' }
];
function genContainerShared() {
  const W = 1024, H = 256, P = W / 42;
  const dent = field(W, H, (x, y) => Noise.fbm(x / W * 8, y / H * 2, 4, 8, 2));
  const grain = field(W, H, (x, y) => Noise.fbm(x / W * 96, y / H * 24, 2, 96, 24));
  const streak = field(W, H, (x, y) => Noise.fbm(x / W * 48, y / H * 2, 4, 48, 2));
  const rustN = field(W, H, (x, y) => Noise.fbm(x / W * 48, y / H * 12, 4, 48, 12));
  const Ht = new Float32Array(W * H), shade = new Float32Array(W * H), rust = new Float32Array(W * H), R = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const frame = y < 10 || y > H - 11 || x < 14 || x > W - 15;
    const ph = (x % P) / P;
    const c = ph < 0.15 ? ph / 0.15 : ph < 0.5 ? 1 : ph < 0.65 ? 1 - (ph - 0.5) / 0.15 : 0;
    Ht[i] = (frame ? 0.95 : c * 0.6) + (dent[i] - 0.5) * 0.7 + (grain[i] - 0.5) * 0.05;
    shade[i] = frame ? 0.72 : 0.86 + c * 0.14;
    rust[i] = ss(0.70, 0.77, rustN[i] + (streak[i] - 0.5) * 0.25 + (y > H - 34 ? 0.07 : 0) + (frame ? 0.05 : 0)) * 0.9;
    R[i] = clamp(0.5 + rust[i] * 0.4 + (grain[i] - 0.5) * 0.12, 0, 1);
  }
  // 门端（2.44m 宽）
  const S = 256, eH = new Float32Array(S * S), eShade = new Float32Array(S * S), eRod = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const frame = y < 10 || y > S - 11 || x < 10 || x > S - 11;
    const seamC = Math.abs(x - 128) < 1.5;
    const rodX = [44, 92, 164, 212].some(r => Math.abs(x - r) < 2.6) && y > 14 && y < S - 14;
    const ph = (y % 26) / 26, c = ph < 0.2 ? ph / 0.2 : ph < 0.5 ? 1 : ph < 0.7 ? 1 - (ph - 0.5) / 0.2 : 0;
    eH[i] = frame ? 0.95 : rodX ? 1.2 : seamC ? 0.0 : 0.25 + c * 0.25 + (Noise.fbm(x / S * 4, y / S * 4, 3, 4) - 0.5) * 0.4;
    eShade[i] = frame ? 0.72 : seamC ? 0.35 : 0.85 + c * 0.1;
    eRod[i] = rodX ? 1 : 0;
  }
  return { W, H, Ht, shade, rust, streak, grain, normal: normalMap(Ht, W, H, 1.7), rough: grayTex(R, W, H), eH, eShade, eRod, eNormal: normalMap(eH, S, S, 1.6) };
}
function genContainerSide(sh, v) {
  const { W, H } = sh;
  const c = pix(W, H, (x, y, o) => {
    const i = y * W + x, g = sh.shade[i] * (1 - ss(0.5, 0.85, sh.streak[i]) * 0.28) * (0.92 + (sh.grain[i] - 0.5) * 0.15);
    const rc = [0.34, 0.17, 0.08];
    for (let k = 0; k < 3; k++) o[k] = C255(lerp(v.c[k] * g, rc[k] * (0.8 + sh.grain[i] * 0.4), sh.rust[i] * 0.85));
  });
  const g = c.getContext('2d');
  g.fillStyle = v.txt; g.globalAlpha = 0.86; g.textBaseline = 'middle';
  g.font = 'bold 76px "Arial Black","Helvetica Neue",Arial,sans-serif'; g.textAlign = 'center';
  g.fillText(v.name, W * 0.5, H * 0.53);
  g.font = 'bold 21px Arial,sans-serif'; g.textAlign = 'left'; g.globalAlpha = 0.85;
  g.fillText(`${v.code} ${ri(100000, 999999)} ${ri(0, 9)}`, W - 260, 36); g.fillText('45G1', W - 260, 61);
  g.font = '12px Arial'; g.fillText('MAX GROSS 32.500 KG', 30, H - 40); g.fillText('TARE   3.800 KG', 30, H - 25);
  g.globalAlpha = 1;
  const grd = g.createLinearGradient(0, H, 0, H * 0.55); grd.addColorStop(0, 'rgba(38,28,18,0.38)'); grd.addColorStop(1, 'rgba(38,28,18,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  return mkTex(c);
}
function genContainerEnd(sh, v) {
  const S = 256;
  const c = pix(S, S, (x, y, o) => {
    const i = y * S + x, n = Noise.fbm(x / S * 8, y / S * 8, 3, 8);
    if (sh.eRod[i]) { const m = 0.42 + n * 0.1; o[0] = C255(m); o[1] = C255(m); o[2] = C255(m * 0.97); return; }
    const g = sh.eShade[i] * (0.9 + (n - 0.5) * 0.2), r = ss(0.74, 0.8, n + Noise.fbm(x / S * 16, y / S * 2, 3, 16, 2) * 0.2);
    const rc = [0.34, 0.17, 0.08];
    for (let k = 0; k < 3; k++) o[k] = C255(lerp(v.c[k] * g, rc[k], r * 0.8));
  });
  const g = c.getContext('2d'); g.fillStyle = v.txt; g.globalAlpha = 0.8; g.font = 'bold 13px Arial'; g.fillText(`${v.code} ${ri(100000, 999999)}`, 140, 30);
  g.fillStyle = '#222'; g.globalAlpha = 0.9;
  for (const rx of [44, 92, 164, 212]) { g.fillRect(rx - 6, 120, 12, 26); }
  for (const hy of [30, 90, 166, 226]) { g.fillRect(4, hy, 10, 14); g.fillRect(S - 14, hy, 10, 14); }
  return mkTex(c);
}

// ---- 布料迷彩 ----
function genCamo(cols, off) {
  const S = 256;
  const map = pix(S, S, (x, y, o) => {
    const a = Noise.fbm(x / S * 5 + off, y / S * 5, 4, 5), b = Noise.fbm(x / S * 9 + off + 3, y / S * 9 + 7, 4, 9), c = Noise.fbm(x / S * 14 + off + 9, y / S * 14, 3, 14);
    let col = cols[0]; if (a > 0.55) col = cols[1]; if (b > 0.6) col = cols[2]; if (c > 0.66) col = cols[3];
    const w = 0.9 + 0.1 * Math.sin(x * 1.6) * Math.sin(y * 1.6);
    for (let k = 0; k < 3; k++) o[k] = C255(col[k] * w);
  });
  const H = field(S, S, (x, y) => 0.5 + 0.5 * Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) + Noise.fbm(x / S * 16, y / S * 16, 2, 16) * 0.6);
  return { map: mkTex(map), normal: normalMap(H, S, S, 0.8) };
}

// ---- 仓库压型钢板外墙（4m） ----
function genCladding() {
  const S = 512;
  const st = field(S, S, (x, y) => Noise.fbm(x / S * 32, y / S * 2, 4, 32, 2));
  const n = field(S, S, (x, y) => Noise.fbm(x / S * 8, y / S * 8, 4, 8));
  const H = new Float32Array(S * S), R = new Float32Array(S * S);
  const map = pix(S, S, (x, y, o) => {
    const i = y * S + x, ph = (x % 64) / 64;
    const c = ph < 0.1 ? ph / 0.1 : ph < 0.35 ? 1 : ph < 0.45 ? 1 - (ph - 0.35) / 0.1 : 0;
    const panel = Math.min(y % 256, 256 - y % 256) < 2 ? 1 : 0;
    H[i] = c * 0.7 - panel * 0.5 + (n[i] - 0.5) * 0.1;
    const b = (0.66 + c * 0.06) * (1 - ss(0.5, 0.85, st[i]) * 0.35) * (0.95 + (n[i] - 0.5) * 0.12) * (1 - panel * 0.3);
    o[0] = C255(b * 0.97); o[1] = C255(b); o[2] = C255(b * 0.99);
    R[i] = 0.45 + ss(0.5, 0.85, st[i]) * 0.3 + (n[i] - 0.5) * 0.1;
  });
  return { map: mkTex(map), normal: normalMap(H, S, S, 2), rough: grayTex(R, S, S) };
}
function genRollerDoor() {
  const S = 256;
  const H = new Float32Array(S * S);
  const map = pix(S, S, (x, y, o) => {
    const i = y * S + x, ph = (y % 16) / 16, n = Noise.fbm(x / S * 6, y / S * 6, 3, 6);
    H[i] = Math.sin(ph * Math.PI) * 0.8 + (n - 0.5) * 0.2;
    const b = (0.5 + Math.sin(ph * Math.PI) * 0.1) * (0.9 + (n - 0.5) * 0.25);
    o[0] = C255(b * 0.95); o[1] = C255(b * 0.97); o[2] = C255(b);
  });
  return { map: mkTex(map), normal: normalMap(H, S, S, 2.5) };
}

// ---- 船壳：u 每 40m 平铺，v 覆盖 y∈[-7,10] ----
function genHull() {
  const W = 1024, Hh = 256;
  const st = field(W, Hh, (x, y) => Noise.fbm(x / W * 64, y / Hh * 2, 4, 64, 2));
  const n = field(W, Hh, (x, y) => Noise.fbm(x / W * 16, y / Hh * 4, 4, 16, 4));
  const H = new Float32Array(W * Hh);
  const yOf = py => 10 - (py / Hh) * 17;
  const map = pix(W, Hh, (x, y, o) => {
    const i = y * W + x, wy = yOf(y);
    const seam = (Math.min(y % 30, 30 - y % 30) < 1 || Math.min(x % 102, 102 - x % 102) < 1) ? 1 : 0;
    H[i] = -seam * 0.6 + (n[i] - 0.5) * 0.3;
    let c;
    if (wy < -1.3) c = [0.30, 0.07, 0.05];
    else if (wy < -0.9) c = [0.04, 0.04, 0.045];
    else c = [0.10, 0.13, 0.16];
    const fromTop = clamp((10 - wy) / 8, 0, 1);
    const rustS = ss(0.55, 0.8, st[i]) * (1 - fromTop * 0.8) * (wy > -0.9 ? 1 : 0.3);
    const g = (0.9 + (n[i] - 0.5) * 0.25) * (1 - seam * 0.25);
    const rc = [0.32, 0.15, 0.07];
    for (let k = 0; k < 3; k++) o[k] = C255(lerp(c[k] * g, rc[k], rustS * 0.75));
  });
  const g = map.getContext('2d'); g.fillStyle = '#e8e8e2'; g.font = 'bold 13px Arial';
  for (let m = 2; m <= 10; m += 2) { const py = (10 - (m - 7)) / 17 * Hh; if (py > 0 && py < Hh) g.fillText(m + 'M', 900, py); }
  return { map: mkTex(map), normal: normalMap(H, W, Hh, 2) };
}
function genSuperstructure() {
  const S = 512;
  const map = pix(S, S, (x, y, o) => {
    const fy = y % 102, fx = x % 64, n = Noise.fbm(x / S * 8, y / S * 8, 3, 8);
    const win = fy > 28 && fy < 60 && fx > 12 && fx < 52;
    if (win) { o[0] = 14; o[1] = 18; o[2] = 24; return; }
    const st = ss(0.5, 0.85, Noise.fbm(x / S * 32, y / S * 4, 3, 32, 4));
    const b = (0.86 - st * 0.22) * (0.95 + (n - 0.5) * 0.1) * (fy < 3 ? 0.7 : 1);
    o[0] = C255(b); o[1] = C255(b * 0.99); o[2] = C255(b * 0.96);
  });
  const em = pix(S, S, (x, y, o) => {
    const fy = y % 102, fx = x % 64, id = ((y / 102) | 0) * 8 + ((x / 64) | 0);
    const lit = (id * 2654435761 >>> 0) % 7 < 2;
    const win = fy > 28 && fy < 60 && fx > 12 && fx < 52;
    o[0] = win && lit ? 255 : 0; o[1] = win && lit ? 190 : 0; o[2] = win && lit ? 120 : 0;
  });
  return { map: mkTex(map), emissive: mkTex(em) };
}

// ---- 小件贴图 ----
function genFence() {
  const S = 128;
  return mkTex(pix(S, S, (x, y, o) => {
    const a = Math.abs(((x + y) % 32) - 16), b = Math.abs(((x - y + 512) % 32) - 16);
    const d = Math.min(16 - a, 16 - b, a, b);
    const w = 1 - ss(0.6, 1.6, Math.min(Math.abs(a - 16), a, Math.abs(b - 16), b));
    o[0] = 150; o[1] = 155; o[2] = 158; o[3] = w * 255;
  }));
}
function genHazard() {
  const S = 128;
  return mkTex(pix(S, S, (x, y, o) => {
    const s = ((x + y) % 64) < 32, n = Noise.fbm(x / S * 8, y / S * 8, 3, 8);
    const c = s ? [0.78, 0.6, 0.08] : [0.05, 0.05, 0.05], g = 0.85 + n * 0.25;
    for (let k = 0; k < 3; k++) o[k] = C255(c[k] * g);
  }));
}
function genWear() {
  const S = 256;
  return mkTex(pix(S, S, (x, y, o) => {
    const n = Noise.fbm(x / S * 12, y / S * 12, 4, 12);
    o[0] = o[1] = o[2] = 255; o[3] = ss(0.3, 0.45, n) * 255;
  }));
}
function genBulletHole() {
  const S = 64;
  return mkTex(pix(S, S, (x, y, o) => {
    const dx = x - 32, dy = y - 32, r = Math.hypot(dx, dy) / 32, a = Math.atan2(dy, dx);
    const crack = Math.pow(Math.abs(Math.sin(a * 5 + 1.3)), 30) * (1 - r);
    const core = 1 - ss(0.1, 0.2, r), ring = (1 - ss(0.15, 0.6, r)) * 0.7;
    const al = Math.max(core, ring, crack * 0.8);
    const c = core > 0.5 ? 0.02 : 0.12;
    o[0] = o[1] = o[2] = C255(c); o[3] = C255(al);
  }));
}
function genSoft(kind) {
  const S = 128;
  return mkTex(pix(S, S, (x, y, o) => {
    const dx = (x - 64) / 64, dy = (y - 64) / 64, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let al;
    if (kind === 'smoke') al = Math.pow(clamp(1 - r, 0, 1), 1.6) * (0.55 + 0.6 * Noise.fbm(x / S * 6, y / S * 6, 4, 6));
    else if (kind === 'flash') { let ray = 0; for (let k = 0; k < 7; k++) { const d = Math.abs(Math.sin((a - k * 0.9) * 0.5)); ray = Math.max(ray, Math.exp(-d * d * 260) * (1 - r)); } al = Math.max(Math.exp(-r * r * 14), ray * 1.1); }
    else al = Math.exp(-r * r * 8);
    o[0] = o[1] = o[2] = 255; o[3] = C255(al);
  }));
}
function genPuddle() {
  const S = 256;
  return mkTex(pix(S, S, (x, y, o) => {
    const dx = (x - 128) / 128, dy = (y - 128) / 128, r = Math.hypot(dx, dy);
    const n = Noise.fbm(x / S * 4 + 3, y / S * 4, 4, 4);
    o[0] = o[1] = o[2] = 255; o[3] = ss(0.5, 0.56, n + 0.45 - r * 0.75) * 255;
  }));
}
function textTex(w, h, draw) { const c = cnv(w, h), g = c.getContext('2d'); draw(g, w, h); return mkTex(c); }

async function genAllTextures(progress) {
  const steps = [
    ['混凝土', () => { TEX.concrete = genConcrete(); TEX.concreteLight = genConcrete([1, 1, 0.97], 0.68); }],
    ['钢结构涂装', () => {
      const sh = genPaintShared(); TEX.paintN = sh.normal; TEX.paintR = sh.rough;
      TEX.crane = genPaint(sh, [0.58, 0.61, 0.62]); TEX.yellow = genPaint(sh, [0.80, 0.58, 0.10], 0.6);
      TEX.dark = genPaint(sh, [0.20, 0.21, 0.22], 0.7); TEX.white = genPaint(sh, [0.84, 0.84, 0.80], 0.5);
      TEX.red = genPaint(sh, [0.50, 0.10, 0.08], 0.7); TEX.blue = genPaint(sh, [0.12, 0.25, 0.45], 0.7);
    }],
    ['集装箱', () => {
      const sh = genContainerShared(); TEX.contN = sh.normal; TEX.contR = sh.rough; TEX.contEN = sh.eNormal;
      TEX.cont = CONT_VARIANTS.map(v => ({ side: genContainerSide(sh, v), end: genContainerEnd(sh, v) }));
    }],
    ['布料与外墙', () => {
      TEX.camoUrban = genCamo([[0.30, 0.32, 0.34], [0.20, 0.22, 0.25], [0.42, 0.43, 0.42], [0.12, 0.13, 0.15]], 0);
      TEX.camoMC = genCamo([[0.55, 0.50, 0.38], [0.40, 0.33, 0.22], [0.35, 0.38, 0.26], [0.20, 0.18, 0.14]], 11);
      TEX.clad = genCladding(); TEX.roller = genRollerDoor();
    }],
    ['船舶', () => { TEX.hull = genHull(); TEX.super = genSuperstructure(); }],
    ['细节', () => {
      TEX.fence = genFence(); TEX.hazard = genHazard(); TEX.wear = genWear(); TEX.hole = genBulletHole();
      TEX.smoke = genSoft('smoke'); TEX.flash = genSoft('flash'); TEX.spark = genSoft('spark'); TEX.puddle = genPuddle();
      TEX.signQC = [1, 2, 3].map(n => textTex(256, 128, (g, w, h) => { g.fillStyle = '#d8d8d2'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a2a4a'; g.font = 'bold 84px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('QC' + n, w / 2, h / 2 + 4); }));
      TEX.signWH = ['C7', 'C8'].map(s => textTex(512, 256, (g, w, h) => { g.fillStyle = '#1d4f8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2f2f2'; g.font = 'bold 170px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, w / 2, h / 2 + 8); }));
      TEX.shipName = textTex(1024, 128, (g, w, h) => { g.fillStyle = '#e9e9e4'; g.font = 'bold 92px "Arial Black",Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AURORA BRIDGE', w / 2, h / 2); });
      TEX.berth = textTex(512, 128, (g, w, h) => { g.fillStyle = '#fff'; g.font = 'bold 100px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BERTH 07', w / 2, h / 2); });
      TEX.screen = textTex(256, 128, (g, w, h) => {
        g.fillStyle = '#031208'; g.fillRect(0, 0, w, h); g.fillStyle = '#5dff9a'; g.font = 'bold 15px monospace';
        ['UPLINK RELAY', 'SAT-LINK  ONLINE', 'TX  2.41 GHz', 'PWR  ███████░'].forEach((t, i) => g.fillText(t, 12, 26 + i * 25));
      });
    }]
  ];
  for (let i = 0; i < steps.length; i++) { progress('生成贴图：' + steps[i][0], i / steps.length * 0.6); await nextFrame(); steps[i][1](); }
}
