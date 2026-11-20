(() => {
'use strict';
/* ============================================================
   NEON BUNKER  —  单文件 FPS
   地图 / 贴图 / 模型 / 音效 全部在运行时由代码生成
   ============================================================ */

// ---------- 伪随机 ----------
let seed = (Date.now() % 100000) | 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const UI = {
  hpv: $('hpv'), hpb: $('hpb'), mag: $('mag'), reload: $('reload'), wave: $('wave'), score: $('score'),
  alive: $('alive'), kills: $('kills'), msg: $('msg'), sub: $('sub'), dmg: $('dmg'), hit: $('hit'),
  overlay: $('overlay'), obox: $('obox'), map: $('map'), fps: $('fps')
};
const mapCtx = UI.map.getContext('2d');

// ============================================================
//  音效合成（Web Audio）
// ============================================================
const SFX = (() => {
  let ctx = null, master = null, droneGain = null;
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    // 环境低频嗡鸣
    droneGain = ctx.createGain(); droneGain.gain.value = 0.05; droneGain.connect(master);
    [55, 55.7, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
      o.connect(lp).connect(droneGain); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 0.02; lfo.connect(lg).connect(droneGain.gain); lfo.start();
  };
  const noise = dur => {
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  };
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const tone = (type, f0, f1, dur, vol, t) => {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  const burst = (dur, cutoff0, cutoff1, vol, t, type = 'lowpass') => {
    const n = noise(dur); const f = ctx.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(cutoff0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, cutoff1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.003, vol, dur); n.connect(f).connect(g).connect(master); n.start(t); n.stop(t + dur + 0.05);
  };
  const ok = () => !!ctx;
  return {
    init, ok,
    shoot() { if (!ok()) return; const t = ctx.currentTime; burst(0.28, 4000, 150, 0.9, t); tone('triangle', 160, 40, 0.16, 0.7, t); burst(0.06, 8000, 3000, 0.4, t, 'highpass'); },
    enemyShoot(vol) { if (!ok()) return; const t = ctx.currentTime; burst(0.2, 1800, 120, 0.6 * vol, t); tone('square', 420, 90, 0.12, 0.35 * vol, t); },
    hit() { if (!ok()) return; const t = ctx.currentTime; tone('square', 900, 500, 0.05, 0.3, t); burst(0.05, 3000, 800, 0.3, t); },
    headshot() { if (!ok()) return; const t = ctx.currentTime; tone('sine', 1400, 900, 0.08, 0.35, t); tone('sine', 1900, 1200, 0.1, 0.3, t + 0.05); },
    wallHit() { if (!ok()) return; const t = ctx.currentTime; burst(0.08, 2500, 400, 0.25, t); },
    hurt() { if (!ok()) return; const t = ctx.currentTime; tone('sawtooth', 220, 60, 0.25, 0.6, t); burst(0.15, 600, 100, 0.4, t); },
    die() { if (!ok()) return; const t = ctx.currentTime; tone('sawtooth', 300, 30, 1.2, 0.7, t); burst(0.8, 800, 60, 0.5, t); },
    enemyDie() { if (!ok()) return; const t = ctx.currentTime; tone('sawtooth', 500, 80, 0.4, 0.4, t); burst(0.3, 1200, 200, 0.4, t); },
    reload() { if (!ok()) return; const t = ctx.currentTime; tone('square', 700, 500, 0.04, 0.3, t); burst(0.05, 3000, 1000, 0.25, t + 0.02); tone('square', 500, 900, 0.05, 0.3, t + 0.45); burst(0.06, 2500, 900, 0.3, t + 0.9); },
    empty() { if (!ok()) return; const t = ctx.currentTime; tone('square', 1200, 1100, 0.04, 0.25, t); },
    step() { if (!ok()) return; const t = ctx.currentTime; burst(0.07, 500, 120, 0.18, t); },
    pickup() { if (!ok()) return; const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f, 0.12, 0.3, t + i * 0.07)); },
    wave() { if (!ok()) return; const t = ctx.currentTime; [220, 220, 330, 440].forEach((f, i) => tone('square', f, f, 0.18, 0.25, t + i * 0.16)); burst(1.2, 300, 60, 0.3, t); },
    jump() { if (!ok()) return; const t = ctx.currentTime; burst(0.1, 900, 200, 0.2, t); },
    land() { if (!ok()) return; const t = ctx.currentTime; burst(0.12, 400, 80, 0.35, t); }
  };
})();

// ============================================================
//  程序化贴图（Canvas）
// ============================================================
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat, repeat);
  return t;
}
function addNoise(g, size, amt) {
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}
const TEX = {};
function buildTextures() {
  // 砖墙
  TEX.brick = canvasTex(256, (g, s) => {
    g.fillStyle = '#3a3c44'; g.fillRect(0, 0, s, s);
    const bw = 64, bh = 32;
    for (let y = 0; y < s; y += bh) {
      const off = ((y / bh) % 2) * (bw / 2);
      for (let x = -bw; x < s + bw; x += bw) {
        const v = 0.7 + rnd() * 0.35;
        g.fillStyle = `rgb(${(118 * v) | 0},${(66 * v) | 0},${(58 * v) | 0})`;
        g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
        // 砖面高光与阴影
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + off + 2, y + 2, bw - 4, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + off + 2, y + bh - 5, bw - 4, 3);
      }
    }
    // 污渍
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, rr(8, 40), rr(8, 40), rnd() * 3, 0, 6.3); g.fill(); }
    addNoise(g, s, 36);
  });
  // 混凝土地板
  TEX.floor = canvasTex(256, (g, s) => {
    g.fillStyle = '#50545c'; g.fillRect(0, 0, s, s);
    const t = 128;
    for (let y = 0; y < s; y += t) for (let x = 0; x < s; x += t) {
      const v = 0.85 + rnd() * 0.3; g.fillStyle = `rgb(${(78 * v) | 0},${(82 * v) | 0},${(90 * v) | 0})`;
      g.fillRect(x + 3, y + 3, t - 6, t - 6);
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3;
    for (let i = 0; i <= s; i += t) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    // 裂缝
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { let x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rr(-18, 18); y += rr(-18, 18); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.2})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, rr(10, 50), rr(10, 50), rnd() * 3, 0, 6.3); g.fill(); }
    addNoise(g, s, 28);
  });
  // 墙顶金属条
  TEX.metal = canvasTex(128, (g, s) => {
    g.fillStyle = '#2b2f36'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${rnd() * 0.12})`; g.lineWidth = rnd() * 1.5; g.beginPath(); g.moveTo(rnd() * s, rnd() * s); g.lineTo(rnd() * s, rnd() * s); g.stroke(); }
    g.fillStyle = '#0ff'; for (let i = 0; i < 4; i++) g.fillRect(i * 32 + 12, 60, 8, 8);
    addNoise(g, s, 20);
  });
  // 迷彩（敌人身体）
  TEX.camo = {};
  const camo = (name, base, spots) => {
    TEX.camo[name] = canvasTex(128, (g, s) => {
      g.fillStyle = base; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) { g.fillStyle = spots[(rnd() * spots.length) | 0]; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, rr(6, 22), rr(6, 22), rnd() * 3, 0, 6.3); g.fill(); }
      addNoise(g, s, 24);
    });
  };
  camo('grunt', '#5a3a2a', ['#7a2e22', '#3a2a24', '#8c4a30']);
  camo('fast', '#2a4a3a', ['#1a6a4a', '#3a7a3a', '#0d3a2a']);
  camo('heavy', '#3a3a52', ['#5a2a7a', '#2a2a44', '#7a4a9a']);
  // 医疗包
  TEX.med = canvasTex(64, (g, s) => {
    g.fillStyle = '#eee'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#e22'; g.fillRect(26, 10, 12, 44); g.fillRect(10, 26, 44, 12);
  });
}

// ============================================================
//  地图生成
// ============================================================
const N = 30, CELL = 4, WALL_H = 4.5;
const grid = new Uint8Array(N * N);
const gi = (i, j) => j * N + i;
const c2w = i => (i - N / 2 + 0.5) * CELL;
const w2c = x => Math.floor(x / CELL + N / 2);
const isWall = (x, z) => { const i = w2c(x), j = w2c(z); return i < 0 || j < 0 || i >= N || j >= N || grid[gi(i, j)] === 1; };
const openCells = [];
function genMap() {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) grid[gi(i, j)] = (i === 0 || j === 0 || i === N - 1 || j === N - 1) ? 1 : 0;
  const blocks = (N * N / 13) | 0;
  for (let b = 0; b < blocks; b++) {
    const w = 1 + (rnd() * 3) | 0, h = 1 + (rnd() * 3) | 0;
    const x = 1 + (rnd() * (N - 2 - w)) | 0, y = 1 + (rnd() * (N - 2 - h)) | 0;
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) grid[gi(i, j)] = 1;
  }
  // 一些长墙
  for (let k = 0; k < 6; k++) {
    const horiz = rnd() < 0.5, len = 4 + (rnd() * 6) | 0;
    const x = 2 + (rnd() * (N - 4 - (horiz ? len : 0))) | 0, y = 2 + (rnd() * (N - 4 - (horiz ? 0 : len))) | 0;
    for (let s = 0; s < len; s++) { if (rnd() < 0.15) continue; grid[gi(horiz ? x + s : x, horiz ? y : y + s)] = 1; }
  }
  const c = N >> 1;
  for (let i = c - 2; i <= c + 1; i++) for (let j = c - 2; j <= c + 1; j++) grid[gi(i, j)] = 0;
  // 连通性：不可达区域填成墙
  const seen = new Uint8Array(N * N), st = [gi(c, c)]; seen[gi(c, c)] = 1;
  while (st.length) {
    const k = st.pop(), i = k % N, j = (k / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + dx, nj = j + dy; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = gi(ni, nj); if (!grid[nk] && !seen[nk]) { seen[nk] = 1; st.push(nk); }
    }
  }
  openCells.length = 0;
  for (let k = 0; k < N * N; k++) { if (!grid[k] && !seen[k]) grid[k] = 1; if (!grid[k]) openCells.push(k); }
}
// 圆形体与墙格碰撞
function collide(pos, r) {
  for (let pass = 0; pass < 2; pass++) {
    const ci = w2c(pos.x), cj = w2c(pos.z);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      if (i < 0 || j < 0 || i >= N || j >= N || !grid[gi(i, j)]) continue;
      const cx = c2w(i), cz = c2w(j), h = CELL / 2;
      const nx = clamp(pos.x, cx - h, cx + h), nz = clamp(pos.z, cz - h, cz + h);
      const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-9) {
          const px = pos.x - cx, pz = pos.z - cz;
          if (Math.abs(px) > Math.abs(pz)) pos.x = cx + Math.sign(px || 1) * (h + r); else pos.z = cz + Math.sign(pz || 1) * (h + r);
        } else { const d = Math.sqrt(d2); pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
      }
    }
  }
}
const flow = new Int16Array(N * N);
let flowT = 0;
function buildFlow() {
  flow.fill(-1);
  const si = clamp(w2c(player.pos.x), 0, N - 1), sj = clamp(w2c(player.pos.z), 0, N - 1), s0 = gi(si, sj);
  const q = [s0]; flow[s0] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % N, j = (k / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + dx, nj = j + dy; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = gi(ni, nj); if (grid[nk] || flow[nk] >= 0) continue;
      flow[nk] = flow[k] + 1; q.push(nk);
    }
  }
}
// 返回沿流场下一个格子的世界坐标（朝玩家）
const _next = new THREE.Vector3();
function flowStep(pos) {
  const i = w2c(pos.x), j = w2c(pos.z); if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const here = flow[gi(i, j)]; if (here < 0) return null;
  let best = here, bi = i, bj = j;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + dx, nj = j + dy; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
    const v = flow[gi(ni, nj)]; if (v >= 0 && v < best) { best = v; bi = ni; bj = nj; }
  }
  if (bi === i && bj === j) return null;
  return _next.set(c2w(bi), 0, c2w(bj));
}
function hasLOS(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), steps = Math.ceil(d / 0.4);
  for (let s = 1; s < steps; s++) { const t = s / steps; if (isWall(a.x + dx * t, a.z + dz * t)) return false; }
  return true;
}

// ============================================================
//  场景
// ============================================================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.autoClear = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const SKY = 0x060a18;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.FogExp2(SKY, 0.018);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

scene.add(new THREE.HemisphereLight(0x6a86d0, 0x2a2a30, 1.1));
scene.add(new THREE.AmbientLight(0x404858, 0.6));
const moon = new THREE.DirectionalLight(0x9fb8ff, 0.8); moon.position.set(30, 60, -20); scene.add(moon);
// 手电
const torch = new THREE.SpotLight(0xfff4e0, 2.6, 40, 0.55, 0.5, 1);
torch.position.set(0, 0, 0); camera.add(torch); camera.add(torch.target); torch.target.position.set(0, 0, -1);
scene.add(camera);
// 枪口闪光灯
const muzzleLight = new THREE.PointLight(0xffc060, 0, 14); muzzleLight.position.set(0.3, -0.2, -1.2); camera.add(muzzleLight);
// 星空
{
  const pts = []; for (let i = 0; i < 700; i++) { const u = rnd() * 6.283, v = Math.acos(rnd()); const r = 250; pts.push(r * Math.sin(v) * Math.cos(u), r * Math.cos(v) + 10, r * Math.sin(v) * Math.sin(u)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 1.6, fog: false, sizeAttenuation: true })));
}

buildTextures();
genMap();

// 地面
{
  const t = TEX.floor; t.repeat.set(N, N);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(N * CELL, N * CELL), new THREE.MeshLambertMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2; scene.add(m);
}
// 墙体（InstancedMesh）
let wallMesh;
{
  const cells = []; for (let k = 0; k < N * N; k++) if (grid[k]) cells.push(k);
  const bt = TEX.brick; bt.repeat.set(1, WALL_H / CELL);
  const geo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  wallMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: bt }), cells.length);
  const M = new THREE.Matrix4();
  cells.forEach((k, n) => { M.makeTranslation(c2w(k % N), WALL_H / 2, c2w((k / N) | 0)); wallMesh.setMatrixAt(n, M); });
  wallMesh.instanceMatrix.needsUpdate = true; scene.add(wallMesh);
  // 墙顶霓虹金属条
  const capGeo = new THREE.BoxGeometry(CELL + 0.1, 0.25, CELL + 0.1);
  const cap = new THREE.InstancedMesh(capGeo, new THREE.MeshLambertMaterial({ map: TEX.metal, emissive: 0x0a3040 }), cells.length);
  cells.forEach((k, n) => { M.makeTranslation(c2w(k % N), WALL_H + 0.12, c2w((k / N) | 0)); cap.setMatrixAt(n, M); });
  cap.instanceMatrix.needsUpdate = true; scene.add(cap);
}
// 零星霓虹灯柱点光（气氛）
const neonLights = [];
for (let i = 0; i < 10; i++) {
  const k = openCells[(rnd() * openCells.length) | 0];
  const col = [0x00e0ff, 0xff2080, 0x60ff80, 0xffa020][i % 4];
  const l = new THREE.PointLight(col, 2.2, 18, 1.2); l.position.set(c2w(k % N), 3.2, c2w((k / N) | 0)); scene.add(l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
  bulb.position.copy(l.position); scene.add(bulb);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x222830 }));
  pole.position.set(l.position.x, 1.6, l.position.z); scene.add(pole);
  neonLights.push({ l, base: 2.2, ph: rnd() * 6 });
}

// ============================================================
//  玩家与武器
// ============================================================
const player = {
  pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, maxHp: 100,
  onGround: true, mag: 12, magSize: 12, reloading: 0, fireCd: 0, score: 0, kills: 0, radius: 0.45, eye: 1.7,
  bob: 0, stepT: 0, alive: true
};
const keys = {};
let firing = false;
// 枪模型
const gun = new THREE.Group();
{
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2e38, emissive: 0x0a0c10 }), mid = new THREE.MeshLambertMaterial({ color: 0x5a6274, emissive: 0x101318 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x00e0ff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.5), mid); body.position.set(0, -0.02, -0.1); gun.add(body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), dark); barrel.position.set(0, 0.05, -0.5); gun.add(barrel);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), dark); handle.position.set(0, -0.2, 0.05); handle.rotation.x = 0.25; gun.add(handle);
  const magz = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.08), dark); magz.position.set(0, -0.2, -0.12); gun.add(magz);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), dark); sight.position.set(0, 0.11, -0.25); gun.add(sight);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.02, 0.3), neon); strip.position.set(0, -0.06, -0.1); gun.add(strip);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flash.position.set(0, 0.05, -0.76); flash.visible = false; gun.add(flash); gun.flash = flash;
  gun.position.set(0.32, -0.3, -0.55); camera.add(gun);
  gun.traverse(o => o.layers.set(1));
}
// 灯光对两个渲染层都生效
scene.traverse(o => { if (o.isLight) o.layers.enableAll(); });
let recoil = 0, flashT = 0;

// ============================================================
//  粒子 / 弹道
// ============================================================
const particles = [];
const partGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
const partMats = { spark: new THREE.MeshBasicMaterial({ color: 0xffd060 }), blood: new THREE.MeshBasicMaterial({ color: 0xc01818 }), dust: new THREE.MeshBasicMaterial({ color: 0x8a8a90 }) };
const partPool = [];
function spawnParticles(pos, kind, count, speed, normal) {
  for (let i = 0; i < count; i++) {
    let m = partPool.pop(); if (!m) { m = new THREE.Mesh(partGeo, partMats[kind]); } else m.material = partMats[kind];
    m.position.copy(pos); m.visible = true; scene.add(m);
    const v = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize().multiplyScalar(speed * rr(0.3, 1));
    if (normal) v.add(normal.clone().multiplyScalar(speed * 0.6));
    particles.push({ m, v, life: rr(0.3, 0.7) });
  }
}
const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xff6040, transparent: true, opacity: 0.9 });
function spawnTracer(a, b) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(g, tracerMat.clone()); scene.add(l); tracers.push({ l, life: 0.12 });
}

// ============================================================
//  敌人
// ============================================================
const TYPES = {
  grunt: { hp: 3, speed: 3.2, scale: 1, range: 22, fire: 1.7, dmg: 7, acc: 0.55, score: 100, drop: 0.25 },
  fast: { hp: 2, speed: 5.6, scale: 0.8, range: 14, fire: 1.0, dmg: 6, acc: 0.4, score: 150, drop: 0.2 },
  heavy: { hp: 9, speed: 2.0, scale: 1.3, range: 28, fire: 2.4, dmg: 15, acc: 0.65, score: 300, drop: 0.5 }
};
const enemies = [];
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
const skinMat = new THREE.MeshLambertMaterial({ color: 0x9a8c7c });
const gunMat = new THREE.MeshLambertMaterial({ color: 0x222 });
function makeEnemyMesh(type) {
  const T = TYPES[type], s = T.scale;
  const mat = new THREE.MeshLambertMaterial({ map: TEX.camo[type] });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.42), mat); body.position.y = 1.25; body.name = 'body'; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinMat); head.position.y = 1.92; head.name = 'head'; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), eyeMat); visor.position.set(0, 1.95, 0.19); visor.name = 'head'; g.add(visor);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), mat); helmet.position.y = 2.15; helmet.name = 'head'; g.add(helmet);
  const mkLimb = (w, h, x, y, name) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat); m.position.y = -h / 2; m.name = name; p.add(m); g.add(p); return p; };
  g.legL = mkLimb(0.24, 0.8, -0.2, 0.8, 'body'); g.legR = mkLimb(0.24, 0.8, 0.2, 0.8, 'body');
  g.armL = mkLimb(0.18, 0.7, -0.46, 1.65, 'body'); g.armR = mkLimb(0.18, 0.7, 0.46, 1.65, 'body');
  g.armL.rotation.x = -1.3; g.armR.rotation.x = -1.3;
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.8), gunMat); rifle.position.set(0.1, -0.68, -0.25); rifle.name = 'body'; g.armR.add(rifle);
  g.muzzle = new THREE.Object3D(); g.muzzle.position.set(0.1, -0.68, -0.7); g.armR.add(g.muzzle);
  g.scale.setScalar(s);
  return g;
}
function spawnEnemy(type) {
  let k, tries = 0, x, z;
  do { k = openCells[(rnd() * openCells.length) | 0]; x = c2w(k % N); z = c2w((k / N) | 0); tries++; }
  while (tries < 60 && (Math.hypot(x - player.pos.x, z - player.pos.z) < 14 || (tries < 40 && hasLOS({ x, z }, player.pos))));
  const T = TYPES[type];
  const mesh = makeEnemyMesh(type); mesh.position.set(x, 0, z); scene.add(mesh);
  const e = { type, T, mesh, pos: mesh.position, hp: T.hp, maxHp: T.hp, alert: false, lastSeen: new THREE.Vector3(x, 0, z), wanderT: 0, dir: new THREE.Vector3(), fireCd: rr(0.5, 1.5), huntT: rr(2, 6), dead: false, deadT: 0, walk: 0, moving: false, flashT: 0, hitFlash: 0, radius: 0.45 * T.scale };
  enemies.push(e);
}
const pickups = [];
function spawnMedkit(pos) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshLambertMaterial({ map: TEX.med, emissive: 0x401010 })); g.add(box);
  g.position.set(pos.x, 0.4, pos.z); scene.add(g); pickups.push({ g, t: rnd() * 6 });
}

// ============================================================
//  波次
// ============================================================
let wave = 0, toSpawn = 0, spawnT = 0, waveBreak = 0;
function startWave() {
  wave++; UI.wave.textContent = wave;
  toSpawn = 4 + wave * 2; spawnT = 0.5;
  showMsg(`第 ${wave} 波`, wave === 1 ? '敌人来了，守住！' : `${toSpawn} 名敌人逼近`);
  SFX.wave();
}
function pickType() {
  const r = rnd();
  if (wave >= 3 && r < 0.12 + wave * 0.02) return 'heavy';
  if (wave >= 2 && r < 0.45) return 'fast';
  return 'grunt';
}
let msgT = 0;
function showMsg(a, b) { UI.msg.textContent = a; UI.sub.textContent = b || ''; UI.msg.style.opacity = 1; UI.sub.style.opacity = 1; msgT = 2.6; }

// ============================================================
//  输入
// ============================================================
let state = 'start'; // start | playing | paused | over
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && state === 'playing') reload();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousedown', e => { if (state === 'playing' && e.button === 0) firing = true; });
addEventListener('mouseup', e => { if (e.button === 0) firing = false; });
addEventListener('mousemove', e => {
  if (state !== 'playing') return;
  player.yaw -= e.movementX * 0.0022; player.pitch -= e.movementY * 0.0022;
  player.pitch = clamp(player.pitch, -1.45, 1.45);
});
UI.overlay.addEventListener('click', () => {
  if (state === 'over') { location.reload(); return; }
  SFX.init();
  canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    UI.overlay.style.display = 'none';
    if (state === 'start') { state = 'playing'; startWave(); }
    else if (state === 'paused') state = 'playing';
  } else if (state === 'playing') {
    state = 'paused'; firing = false;
    UI.obox.innerHTML = '<h1>已暂停</h1><p>点击继续</p>';
    UI.overlay.style.display = 'flex';
  }
});
document.addEventListener('pointerlockerror', () => { UI.obox.innerHTML = '<h1>无法锁定鼠标</h1><p>请在浏览器中直接打开本文件再试（部分 iframe 会禁止指针锁定）</p>'; });

// ============================================================
//  战斗逻辑
// ============================================================
const raycaster = new THREE.Raycaster();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3();
function reload() {
  if (player.reloading > 0 || player.mag === player.magSize) return;
  player.reloading = 1.1; UI.reload.textContent = '换弹中…'; SFX.reload();
}
function fire() {
  if (player.reloading > 0 || player.fireCd > 0) return;
  if (player.mag <= 0) { SFX.empty(); player.fireCd = 0.3; reload(); return; }
  player.mag--; player.fireCd = 0.14; recoil = 1; flashT = 0.05; muzzleLight.intensity = 3;
  gun.flash.visible = true; gun.flash.rotation.z = rnd() * 6.28; gun.flash.scale.setScalar(rr(0.7, 1.3));
  SFX.shoot(); UI.mag.textContent = player.mag;
  for (const e of enemies) if (!e.dead && e.pos.distanceTo(player.pos) < 30) e.alert = true;
  // 射线：轻微散布
  camera.getWorldDirection(_dir);
  const spread = 0.012 + (player.vel.length() > 1 ? 0.02 : 0);
  _dir.x += rr(-spread, spread); _dir.y += rr(-spread, spread); _dir.z += rr(-spread, spread); _dir.normalize();
  camera.getWorldPosition(_v);
  raycaster.set(_v, _dir); raycaster.far = 120;
  const wallHit = raycaster.intersectObject(wallMesh)[0];
  const wallD = wallHit ? wallHit.distance : 1e9;
  let best = null;
  for (const e of enemies) {
    if (e.dead) continue;
    const hits = raycaster.intersectObject(e.mesh, true);
    if (hits.length && hits[0].distance < wallD && (!best || hits[0].distance < best.hit.distance)) best = { e, hit: hits[0] };
  }
  if (best) {
    const head = best.hit.object.name === 'head';
    const dmg = head ? 2 : 1;
    best.e.hp -= dmg; best.e.hitFlash = 0.12; best.e.alert = true; best.e.lastSeen.copy(player.pos);
    spawnParticles(best.hit.point, 'blood', head ? 14 : 8, 3, best.hit.face ? best.hit.face.normal.clone().transformDirection(best.hit.object.matrixWorld) : null);
    UI.hit.style.opacity = 1; setTimeout(() => UI.hit.style.opacity = 0, 80);
    if (best.e.hp <= 0) killEnemy(best.e, head); else head ? SFX.headshot() : SFX.hit();
  } else if (wallHit) {
    spawnParticles(wallHit.point, 'spark', 6, 4, wallHit.face.normal);
    spawnParticles(wallHit.point, 'dust', 4, 1.5, wallHit.face.normal);
    SFX.wallHit();
  }
}
function killEnemy(e, head) {
  e.dead = true; e.deadT = 0; e.alert = false;
  const bonus = head ? 50 : 0;
  player.score += e.T.score + bonus; player.kills++;
  UI.score.textContent = player.score; UI.kills.textContent = player.kills;
  if (head) { SFX.headshot(); showFloat('爆头 +' + (e.T.score + bonus)); } else showFloat('+' + e.T.score);
  SFX.enemyDie();
  if (rnd() < e.T.drop) spawnMedkit(e.pos);
}
let floatT = 0;
function showFloat(t) { UI.sub.textContent = t; UI.sub.style.opacity = 1; floatT = 0.9; }
function damagePlayer(d) {
  if (!player.alive) return;
  player.hp -= d; UI.dmg.style.opacity = 1; setTimeout(() => UI.dmg.style.opacity = 0.0, 120);
  SFX.hurt(); updateHp();
  if (player.hp <= 0) { player.alive = false; gameOver(); }
}
function updateHp() {
  const h = Math.max(0, player.hp); UI.hpv.textContent = h | 0; UI.hpb.style.width = (h / player.maxHp * 100) + '%';
  UI.hpb.style.background = h < 30 ? 'linear-gradient(90deg,#f00,#f44)' : 'linear-gradient(90deg,#e33,#f84)';
}
function gameOver() {
  state = 'over'; firing = false; SFX.die();
  setTimeout(() => {
    document.exitPointerLock();
    UI.obox.innerHTML = `<h1>阵亡</h1><h2>MISSION FAILED</h2><div class="stat">分数 ${player.score} &nbsp;·&nbsp; 击杀 ${player.kills} &nbsp;·&nbsp; 坚持到第 ${wave} 波</div><div class="go">点击重新开始</div>`;
    UI.overlay.style.display = 'flex';
  }, 900);
}

// ============================================================
//  敌人 AI
// ============================================================
function updateEnemy(e, dt) {
  const T = e.T, m = e.mesh;
  if (e.dead) {
    e.deadT += dt;
    m.rotation.x = Math.min(1.5, e.deadT * 4) * -1;
    if (e.deadT > 1.6) { m.position.y -= dt * 1.5; }
    if (e.deadT > 3) { scene.remove(m); enemies.splice(enemies.indexOf(e), 1); }
    return;
  }
  _v.subVectors(player.pos, e.pos); _v.y = 0;
  const dist = _v.length();
  const sees = dist < 45 && hasLOS(e.pos, player.pos);
  if (sees) { e.alert = true; e.lastSeen.copy(player.pos); }
  if (!e.alert) { e.huntT -= dt; if (e.huntT <= 0) e.alert = true; }
  e.moving = false;
  let target = null;
  if (e.alert) {
    if (sees) { if (dist > T.range * 0.45) target = e.lastSeen; }
    else target = flowStep(e.pos) || e.lastSeen;
    if (target) { _v2.subVectors(target, e.pos); _v2.y = 0; if (_v2.length() < 0.3) target = null; }
  }
  if (target) { e.dir.copy(_v2).normalize(); e.moving = true; }
  else if (!e.alert) {
    e.wanderT -= dt;
    if (e.wanderT <= 0) { e.wanderT = rr(1.5, 3.5); const a = rnd() * 6.283; e.dir.set(Math.sin(a), 0, Math.cos(a)); if (rnd() < 0.3) e.dir.set(0, 0, 0); }
    if (e.dir.lengthSq() > 0) e.moving = true;
  }
  if (e.moving) {
    const spd = T.speed * (e.alert ? 1 : 0.5);
    const before = e.pos.clone();
    e.pos.addScaledVector(e.dir, spd * dt);
    collide(e.pos, e.radius);
    // 敌人之间推开
    for (const o of enemies) { if (o === e || o.dead) continue; _v2.subVectors(e.pos, o.pos); _v2.y = 0; const d = _v2.length(), min = e.radius + o.radius; if (d < min && d > 1e-4) e.pos.addScaledVector(_v2.normalize(), (min - d) * 0.5); }
    // 与玩家不重叠
    _v2.subVectors(e.pos, player.pos); _v2.y = 0; { const d = _v2.length(), min = e.radius + player.radius + 0.1; if (d < min && d > 1e-4) e.pos.addScaledVector(_v2.normalize(), min - d); }
    if (before.distanceToSquared(e.pos) < 1e-6) { e.wanderT = 0; }
    e.walk += dt * spd * 2.2;
  }
  // 朝向
  const face = (sees || e.alert) ? Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z) : (e.moving ? Math.atan2(e.dir.x, e.dir.z) : m.rotation.y);
  let dy = face - m.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); m.rotation.y += dy * Math.min(1, dt * 8);
  // 动画
  const sw = e.moving ? Math.sin(e.walk) * 0.6 : 0;
  m.legL.rotation.x = sw; m.legR.rotation.x = -sw; m.armL.rotation.x = -1.3 - sw * 0.3;
  m.position.y = e.moving ? Math.abs(Math.sin(e.walk)) * 0.06 : 0;
  // 受击闪白
  if (e.hitFlash > 0) { e.hitFlash -= dt; m.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(e.hitFlash > 0 ? 0x802020 : 0x000000); }); }
  // 开火
  e.fireCd -= dt;
  if (sees && dist < T.range && e.fireCd <= 0 && player.alive) {
    e.fireCd = T.fire * rr(0.7, 1.3);
    const moveP = clamp(player.vel.length() / 9, 0, 1);
    const p = clamp(T.acc - dist / 60 - moveP * 0.25, 0.08, 0.85);
    const hit = rnd() < p;
    const from = m.muzzle.getWorldPosition(new THREE.Vector3());
    const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z);
    if (!hit) { to.x += rr(-1.5, 1.5); to.y += rr(-0.8, 0.8); to.z += rr(-1.5, 1.5); }
    spawnTracer(from, to);
    SFX.enemyShoot(clamp(1 - dist / 50, 0.2, 1));
    if (hit) damagePlayer(T.dmg * rr(0.8, 1.2));
  }
}

// ============================================================
//  主循环
// ============================================================
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { UI.fps.textContent = (fpsN / fpsAcc | 0) + ' FPS'; fpsAcc = 0; fpsN = 0; }
  // 霓虹闪烁
  for (const n of neonLights) n.l.intensity = n.base * (0.8 + 0.2 * Math.sin(t * 7 + n.ph) * Math.sin(t * 3.1 + n.ph));

  if (state === 'playing' || state === 'over') {
    // ---- 玩家移动 ----
    if (player.alive) {
      const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const sprint = keys.ShiftLeft || keys.ShiftRight;
      const spd = sprint ? 9 : 5.5;
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      _v.set(-sy * fwd + cy * str, 0, -cy * fwd - sy * str);
      if (_v.lengthSq() > 0) _v.normalize().multiplyScalar(spd);
      const accel = player.onGround ? 12 : 3;
      player.vel.x += (_v.x - player.vel.x) * Math.min(1, dt * accel);
      player.vel.z += (_v.z - player.vel.z) * Math.min(1, dt * accel);
      if (keys.Space && player.onGround) { player.vel.y = 7; player.onGround = false; SFX.jump(); }
      player.vel.y -= 20 * dt;
      player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt; player.pos.y += player.vel.y * dt;
      if (player.pos.y <= 0) { if (!player.onGround) SFX.land(); player.pos.y = 0; player.vel.y = 0; player.onGround = true; }
      collide(player.pos, player.radius);
      // 脚步
      const hs = Math.hypot(player.vel.x, player.vel.z);
      if (player.onGround && hs > 1) { player.bob += dt * hs * 1.6; player.stepT -= dt * hs; if (player.stepT <= 0) { player.stepT = 3.6; SFX.step(); } }
      else player.bob += dt * 2;
      const bobA = player.onGround ? Math.min(1, hs / 6) : 0;
      camera.position.set(player.pos.x, player.pos.y + player.eye + Math.sin(player.bob * 2) * 0.035 * bobA, player.pos.z);
      camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.y = player.yaw; camera.rotation.x = player.pitch; camera.rotation.z = Math.sin(player.bob) * 0.006 * bobA;
      // 武器
      player.fireCd -= dt;
      if (player.reloading > 0) { player.reloading -= dt; gun.rotation.x = -Math.sin(Math.min(1, (1.1 - player.reloading) / 1.1) * Math.PI) * 0.9; if (player.reloading <= 0) { player.mag = player.magSize; UI.mag.textContent = player.mag; UI.reload.textContent = 'R 换弹'; } }
      else { gun.rotation.x = 0; if (firing) fire(); }
      recoil *= Math.pow(0.001, dt);
      gun.position.set(0.32 + Math.sin(player.bob) * 0.01 * bobA, -0.3 + Math.abs(Math.sin(player.bob * 2)) * 0.012 * bobA + recoil * 0.03, -0.55 + recoil * 0.12);
      gun.rotation.x += recoil * 0.25;
      flashT -= dt; if (flashT <= 0) gun.flash.visible = false;
      muzzleLight.intensity *= Math.pow(0.0005, dt);
    }
    // ---- 波次 ----
    const alive = enemies.filter(e => !e.dead).length;
    UI.alive.textContent = alive + toSpawn;
    if (state === 'playing') {
      if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0 && alive < 9 + wave) { spawnEnemy(pickType()); toSpawn--; spawnT = rr(0.8, 1.8); } }
      else if (alive === 0) { waveBreak += dt; if (waveBreak > 3.5) { waveBreak = 0; startWave(); } else if (waveBreak < dt * 2) showMsg('本波肃清', '下一波即将到来'); }
    }
    // ---- 敌人 ----
    flowT -= dt; if (flowT <= 0) { flowT = 0.3; buildFlow(); }
    for (let i = enemies.length - 1; i >= 0; i--) updateEnemy(enemies[i], dt);
    // ---- 拾取 ----
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.t += dt; p.g.rotation.y += dt * 1.5; p.g.position.y = 0.4 + Math.sin(p.t * 3) * 0.08;
      if (player.alive && p.g.position.distanceTo(new THREE.Vector3(player.pos.x, 0.4, player.pos.z)) < 1.3) {
        player.hp = Math.min(player.maxHp, player.hp + 35); updateHp(); SFX.pickup(); showFloat('+35 生命');
        scene.remove(p.g); pickups.splice(i, 1);
      }
    }
    // ---- 粒子 ----
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt);
      if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
      if (p.life <= 0) { scene.remove(p.m); partPool.push(p.m); particles.splice(i, 1); }
    }
    for (let i = tracers.length - 1; i >= 0; i--) { const tr = tracers[i]; tr.life -= dt; tr.l.material.opacity = tr.life / 0.12; if (tr.life <= 0) { scene.remove(tr.l); tr.l.geometry.dispose(); tracers.splice(i, 1); } }
    // ---- 文本 ----
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) { UI.msg.style.opacity = 0; UI.sub.style.opacity = 0; } }
    if (floatT > 0) { floatT -= dt; if (floatT <= 0 && msgT <= 0) UI.sub.style.opacity = 0; }
    drawMinimap();
  }
  // 两遍渲染：先画世界，清深度后再画手里的枪，避免枪穿墙
  renderer.clear();
  camera.layers.set(0); renderer.render(scene, camera);
  renderer.clearDepth();
  const bg = scene.background; scene.background = null;
  camera.layers.set(1); renderer.render(scene, camera);
  scene.background = bg; camera.layers.set(0);
}
function drawMinimap() {
  const S = 160, sc = S / N; const g = mapCtx;
  g.clearRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,200,255,0.35)';
  for (let k = 0; k < N * N; k++) if (grid[k]) g.fillRect((k % N) * sc, ((k / N) | 0) * sc, sc, sc);
  for (const p of pickups) { g.fillStyle = '#4f4'; g.fillRect(w2c(p.g.position.x) * sc + 1, w2c(p.g.position.z) * sc + 1, sc - 2, sc - 2); }
  for (const e of enemies) { if (e.dead) continue; g.fillStyle = e.alert ? '#f33' : '#f93'; g.beginPath(); g.arc((e.pos.x / CELL + N / 2) * sc, (e.pos.z / CELL + N / 2) * sc, 2.2, 0, 6.3); g.fill(); }
  const px = (player.pos.x / CELL + N / 2) * sc, pz = (player.pos.z / CELL + N / 2) * sc;
  g.save(); g.translate(px, pz); g.rotate(-player.yaw);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.5, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill(); g.restore();
}
if (location.hash === '#test') window.__dbg = { player, enemies, hasLOS, get wave() { return wave; } };
updateHp();
camera.position.set(0, player.eye, 0);
tick();
})();
