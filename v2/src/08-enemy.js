// ======================= 08 ENEMIES =======================
const ETYPE = {
  rifleman: { hp: 100, speed: 3.3, range: 48, burst: [2, 4], gap: 0.13, rest: [1.0, 2.0], dmg: 7, acc: 0.55, react: 0.55, camo: 'camoUrban', vest: 0x3a3d33, score: 100 },
  gunner: { hp: 190, speed: 2.4, range: 55, burst: [5, 8], gap: 0.1, rest: [1.6, 2.6], dmg: 6, acc: 0.45, react: 0.8, camo: 'camoUrban', vest: 0x1e2022, score: 200, big: 1.08 },
  rusher: { hp: 80, speed: 5.4, range: 20, burst: [4, 6], gap: 0.08, rest: [0.7, 1.3], dmg: 5, acc: 0.5, react: 0.35, camo: 'camoMC', vest: 0x4a4232, score: 150 }
};
// 关节姿态：py 髋高 / sp 脊柱 / hd 头 / hl hr 髋 / kl kr 膝 / sl sr 肩(前后) / slz srz 肩(内外) / el er 肘 / gp 枪口俯仰
const POSE = (() => {
  const stand = { py: 0.95, sp: -0.05, hd: 0, hl: 0.05, hr: -0.05, kl: -0.05, kr: -0.05, sr: -0.35, srz: -0.3, er: 2.15, sl: 1.24, slz: 0.68, el: 0.15, gp: 0 };
  const mk = o => Object.assign({}, stand, o);
  return {
    stand,
    patrol: mk({ gp: -0.45, sl: 1.0, el: 0.45, sr: -0.25, er: 1.85 }),
    run: mk({ py: 0.92, sp: -0.3, hd: 0.2, gp: -0.3, sl: 1.05, el: 0.4 }),
    crouch: mk({ py: 0.52, sp: -0.1, hl: 1.45, kl: -1.5, hr: -0.15, kr: -1.45 }),
    hide: mk({ py: 0.34, sp: -0.75, hd: 0.5, hl: 1.9, kl: -2.3, hr: 1.9, kr: -2.3, gp: 0.3 }),
    dead: mk({ sp: 0.15, hd: -0.3, hl: 0.15, hr: -0.2, kl: -0.35, kr: -0.1, sr: 0.5, srz: 1.0, er: 0.35, sl: 0.3, slz: -1.0, el: 0.3, gp: -1.3 })
  };
})();
const Enemies = (() => {
  const list = [], pickups = [];
  let root, MAT, flowT = 0;
  const _a = V(), _b = V(), _c2 = V(), _eye = V(), _tg = V(), _lo = V(), _hi = V();
  const UV = 0.55;
  function init() {
    root = new THREE.Group(); scene.add(root);
    GEO.sph = new THREE.SphereGeometry(0.5, 14, 10); GEO.dome = new THREE.SphereGeometry(0.5, 14, 7, 0, TAU, 0, Math.PI * 0.56);
    MAT = {
      skin: std({ color: 0x8a6a52, roughness: 0.8 }),
      bala: std({ color: 0x1c1d1f, roughness: 0.95, normalMap: TEX.camoUrban.normal }),
      helmet: std({ color: 0x3a3e38, roughness: 0.7, metalness: 0.2, normalMap: TEX.paintN }),
      cap: std({ color: 0x5a4e38, roughness: 0.95, normalMap: TEX.camoMC.normal }),
      scarf: std({ color: 0x6e6248, roughness: 1, normalMap: TEX.camoMC.normal }),
      gear: std({ color: 0x121314, roughness: 0.7, metalness: 0.2 }),
      gun: std({ color: 0x18191a, roughness: 0.42, metalness: 0.75 }),
      furn: std({ color: 0x2a2b28, roughness: 0.8, metalness: 0.1 }),
      boot: std({ color: 0x1a1612, roughness: 0.85 }),
      glove: std({ color: 0x25221d, roughness: 0.9 }),
      pack: std({ color: 0x33362c, roughness: 0.95, normalMap: TEX.camoUrban.normal }),
      visor: std({ color: 0x050607, roughness: 0.08, metalness: 0.95 }),
      lamp: basic({ color: new THREE.Color(8, 0.8, 0.4) }),
      camoUrban: std({ map: TEX.camoUrban.map, normalMap: TEX.camoUrban.normal, roughness: 0.92 }),
      camoMC: std({ map: TEX.camoMC.map, normalMap: TEX.camoMC.normal, roughness: 0.92 }),
      vest: {}
    };
    for (const k in ETYPE) MAT.vest[k] = std({ color: ETYPE[k].vest, roughness: 0.85, normalMap: TEX.camoUrban.normal });
    MAT.ammoBox = std({ color: 0x4a5236, roughness: 0.7, metalness: 0.3, normalMap: TEX.paintN });
    MAT.medBox = std({ map: textTex(64, 64, (g, w, h) => { g.fillStyle = '#e4e4e0'; g.fillRect(0, 0, w, h); g.fillStyle = '#c22'; g.fillRect(26, 10, 12, 44); g.fillRect(10, 26, 44, 12); }), roughness: 0.6 });
    MAT.pickGeo = new THREE.BoxGeometry(0.45, 0.22, 0.3);
  }
  // 人形：髋 → 大腿/小腿、脊柱 → 头/上臂/前臂/枪。每根骨骼下的零件按材质合并，控制绘制调用
  function makeModel(type) {
    const T = ETYPE[type], cam = MAT[T.camo], vest = MAT.vest[type], D = MAT.gear, G = MAT.gun;
    const heavy = type === 'gunner', light = type === 'rusher';
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const bone = (parent, x, y, z) => { const b = new THREE.Group(); b.position.set(x, y, z); parent.add(b); return b; };
    const B = new Builder(), fin = b => B.build(b, true, true);
    const bx = (mat, x, y, z, sx, sy, sz, rx = 0, rz = 0, ry = 0) => B.box(mat, x, y, z, sx, sy, sz, ry, rx, rz, UV);
    const cy = (mat, x, y, z, r, h, rx = 0, rz = 0, geo = GEO.cyl8) => B.cyl(mat, x, y, z, r, h, geo, UV, rx, rz);
    const sp = (mat, x, y, z, sx, sy, sz, geo = GEO.sph) => B.geo(mat, geo, x, y, z, 0, 0, sx, sy, sz);
    // 髋部
    const hips = bone(g, 0, 0.95, 0);
    bx(cam, 0, 0, 0, 0.33, 0.2, 0.21); bx(D, 0, 0.085, 0, 0.35, 0.05, 0.23);
    bx(D, 0, 0.085, -0.118, 0.05, 0.04, 0.012);
    bx(vest, -0.19, 0.01, 0.02, 0.05, 0.14, 0.12); bx(vest, 0.19, 0.03, 0.06, 0.05, 0.1, 0.08);
    bx(MAT.pack, 0, 0.0, 0.135, 0.22, 0.14, 0.07);
    fin(hips);
    const legs = [];
    for (const s of [-1, 1]) {
      const thigh = bone(hips, s * 0.095, -0.06, 0);
      cy(cam, 0, -0.21, 0, 0.083, 0.44); sp(cam, 0, 0, 0, 0.17, 0.17, 0.18);
      if (s === 1) { bx(D, 0.088, -0.2, 0, 0.04, 0.17, 0.1); bx(G, 0.1, -0.13, 0.005, 0.03, 0.06, 0.035); bx(D, 0, -0.14, 0, 0.18, 0.025, 0.18); bx(D, 0, -0.25, 0, 0.175, 0.025, 0.175); }
      else { bx(vest, -0.09, -0.19, 0, 0.045, 0.13, 0.1); bx(D, 0, -0.16, 0, 0.18, 0.025, 0.18); }
      fin(thigh);
      const shin = bone(thigh, 0, -0.44, 0);
      sp(cam, 0, 0, 0, 0.15, 0.15, 0.16);
      bx(D, 0, -0.01, -0.068, 0.12, 0.14, 0.04); bx(D, 0, 0.0, -0.085, 0.09, 0.09, 0.02);
      cy(cam, 0, -0.19, 0, 0.063, 0.3); bx(cam, 0, -0.14, 0.035, 0.1, 0.16, 0.06);
      cy(MAT.boot, 0, -0.35, 0, 0.07, 0.13); bx(MAT.boot, 0, -0.405, -0.05, 0.115, 0.075, 0.25);
      bx(D, 0, -0.44, -0.05, 0.12, 0.022, 0.26); bx(D, 0, -0.33, -0.072, 0.07, 0.09, 0.012);
      fin(shin);
      legs.push({ thigh, shin });
    }
    // 躯干
    const spine = bone(hips, 0, 0.1, 0);
    bx(cam, 0, 0.08, 0, 0.31, 0.18, 0.2);
    bx(vest, 0, 0.32, 0, 0.37, 0.36, 0.25); bx(vest, 0, 0.36, -0.132, 0.28, 0.24, 0.03); bx(vest, 0, 0.36, 0.132, 0.28, 0.26, 0.03);
    for (const x of [-0.105, 0, 0.105]) { bx(vest, x, 0.2, -0.155, 0.09, 0.13, 0.055); bx(G, x, 0.275, -0.155, 0.062, 0.035, 0.028); bx(D, x, 0.245, -0.185, 0.03, 0.05, 0.006); }
    bx(vest, 0.03, 0.42, -0.152, 0.15, 0.08, 0.025);
    bx(D, -0.125, 0.43, -0.158, 0.055, 0.11, 0.04); B.rod(D, V(-0.14, 0.48, -0.16), V(-0.155, 0.74, -0.13), 0.006, UV);
    for (const s of [-1, 1]) { bx(vest, s * 0.115, 0.505, 0, 0.075, 0.03, 0.25); bx(vest, s * 0.19, 0.3, 0, 0.03, 0.24, 0.18); sp(cam, s * 0.225, 0.5, 0, 0.135, 0.13, 0.145); }
    cy(MAT.bala, 0, 0.56, 0, 0.052, 0.1);
    bx(MAT.pack, 0, 0.34, 0.2, heavy ? 0.32 : 0.27, heavy ? 0.4 : 0.32, heavy ? 0.17 : 0.13);
    if (!light) { cy(MAT.pack, 0, 0.535, 0.2, 0.055, 0.27, 0, Math.PI / 2); bx(D, -0.09, 0.4, 0.27, 0.025, 0.3, 0.012); bx(D, 0.09, 0.4, 0.27, 0.025, 0.3, 0.012); bx(MAT.pack, 0, 0.26, 0.28, 0.17, 0.13, 0.04); }
    if (heavy) { bx(vest, 0, 0.56, 0.02, 0.2, 0.07, 0.2); bx(vest, 0, 0.1, -0.12, 0.2, 0.14, 0.03); for (const s of [-1, 1]) bx(vest, s * 0.255, 0.44, 0, 0.05, 0.15, 0.17); }
    else bx(vest, 0, 0.11, -0.115, 0.12, 0.1, 0.025);
    fin(spine);
    // 头
    const head = bone(spine, 0, 0.66, 0);
    sp(MAT.bala, 0, 0, 0, 0.2, 0.235, 0.215);
    bx(MAT.skin, 0, 0.015, -0.094, 0.125, 0.045, 0.03);
    bx(MAT.skin, 0, -0.02, -0.108, 0.03, 0.045, 0.02);
    if (light) {
      sp(MAT.cap, 0, 0.035, 0.005, 0.225, 0.2, 0.235, GEO.dome); bx(MAT.cap, 0, 0.045, -0.14, 0.15, 0.012, 0.09);
      cy(MAT.scarf, 0, -0.105, 0, 0.09, 0.08); bx(MAT.scarf, 0.03, -0.15, -0.07, 0.1, 0.09, 0.03);
      bx(MAT.visor, 0, 0.018, -0.108, 0.135, 0.032, 0.012);
    } else {
      sp(MAT.helmet, 0, 0.02, 0.005, 0.275, 0.285, 0.295, GEO.dome);
      cy(MAT.helmet, 0, 0.018, 0.005, 0.139, 0.022, 0, 0, GEO.cyl12);
      bx(D, 0, 0.115, -0.128, 0.05, 0.05, 0.025); bx(D, 0, 0.13, -0.15, 0.035, 0.03, 0.03);
      for (const s of [-1, 1]) { bx(D, s * 0.137, 0.055, 0.0, 0.014, 0.028, 0.13); cy(D, s * 0.118, -0.012, 0.012, 0.042, 0.035, 0, Math.PI / 2); }
      B.rod(D, V(-0.115, -0.03, 0), V(-0.045, -0.065, -0.1), 0.006, UV);
      bx(MAT.visor, 0, 0.022, -0.108, 0.155, 0.052, 0.025); bx(D, 0, 0.022, -0.02, 0.222, 0.028, 0.2);
      bx(D, 0, -0.085, 0.0, 0.016, 0.03, 0.17);
      if (heavy) { bx(MAT.visor, 0, -0.005, -0.128, 0.19, 0.13, 0.01, 0.12); bx(vest, 0, -0.1, 0.02, 0.2, 0.06, 0.2); }
    }
    bx(MAT.lamp, 0.1, 0.105, -0.07, 0.025, 0.025, 0.025);
    fin(head);
    // 手臂
    const arms = [];
    for (const s of [-1, 1]) {
      const upper = bone(spine, s * 0.235, 0.5, 0);
      cy(cam, 0, -0.13, 0, 0.053, 0.27); bx(vest, s * 0.05, -0.09, 0, 0.012, 0.07, 0.07);
      fin(upper);
      const fore = bone(upper, 0, -0.27, 0);
      sp(cam, 0, 0, 0, 0.1, 0.1, 0.1); bx(D, 0, -0.005, 0.045, 0.085, 0.1, 0.035);
      cy(cam, 0, -0.12, 0, 0.044, 0.22); cy(MAT.glove, 0, -0.225, 0, 0.047, 0.05);
      bx(MAT.glove, 0, -0.285, 0, 0.07, 0.09, 0.085); bx(D, 0, -0.275, 0.044, 0.05, 0.05, 0.012);
      if (s === -1) bx(D, 0, -0.19, 0, 0.1, 0.03, 0.1);
      fin(fore);
      arms.push({ upper, fore });
    }
    // 步枪 / 机枪
    const gun = bone(spine, 0.16, 0.4, -0.17);
    const bl = heavy ? 0.14 : 0;
    bx(G, 0, 0, -0.02, 0.045, 0.072, 0.3); bx(G, 0, 0.042, -0.14, 0.022, 0.012, 0.42);
    bx(MAT.furn, 0, -0.002, -0.3, 0.043, 0.052, 0.27);
    for (let z = -0.4; z < -0.19; z += 0.035) bx(G, 0, -0.002, z, 0.047, 0.014, 0.014);
    cy(G, 0, 0.003, -0.5 - bl / 2, 0.0105, 0.16 + bl, Math.PI / 2); cy(G, 0, 0.003, -0.6 - bl, 0.017, 0.055, Math.PI / 2);
    bx(G, 0, 0.04, -0.42, 0.01, 0.045, 0.012);
    bx(G, 0, 0.068, -0.05, 0.036, 0.042, 0.09); bx(MAT.visor, 0, 0.068, -0.097, 0.028, 0.032, 0.004); bx(G, 0, 0.045, -0.05, 0.02, 0.014, 0.05);
    bx(MAT.furn, 0, -0.075, 0.06, 0.032, 0.095, 0.042, -0.3);
    bx(G, 0, -0.045, 0.0, 0.008, 0.008, 0.07);
    bx(G, 0, -0.005, 0.15, 0.022, 0.03, 0.12); bx(MAT.furn, 0, -0.012, 0.235, 0.036, 0.055, 0.16); bx(D, 0, -0.022, 0.32, 0.04, 0.115, 0.02);
    if (heavy) { bx(vest, 0, -0.1, -0.09, 0.1, 0.13, 0.13); bx(G, 0.03, -0.02, -0.09, 0.05, 0.02, 0.06); B.rod(G, V(-0.02, -0.02, -0.42), V(-0.03, -0.05, -0.2), 0.007, UV); B.rod(G, V(0.02, -0.02, -0.42), V(0.03, -0.05, -0.2), 0.007, UV); bx(G, 0, 0.055, -0.27, 0.016, 0.03, 0.1); }
    else { bx(G, 0, -0.095, -0.085, 0.03, 0.14, 0.056, 0.2); bx(G, 0, -0.165, -0.1, 0.034, 0.012, 0.062, 0.2); }
    B.rod(D, V(-0.02, -0.02, -0.38), V(-0.07, -0.16, 0.0), 0.006, UV); B.rod(D, V(-0.07, -0.16, 0.0), V(-0.02, -0.01, 0.28), 0.006, UV);
    fin(gun);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.003, -0.64 - bl); gun.add(muzzle);
    g.scale.setScalar(T.big || 1);
    return { g, hips, spine, head, legs, arms, gun, muzzle, j: Object.assign({}, POSE.stand), sway: 0 };
  }
  function applyPose(e, dt, target, k = 9) {
    const m = e.m, j = m.j, a = 1 - Math.exp(-k * dt);
    for (const key in j) j[key] += (target[key] - j[key]) * a;
    // 步态叠加
    const amp = e.dead ? 0 : clamp(e.speedNow / 3, 0, 1.25), run = e.poseName === 'run';
    const sw = Math.sin(e.walk) * amp * (run ? 0.95 : 0.6), cw = Math.cos(e.walk);
    const low = j.py < 0.7 ? 0.35 : 1;
    m.hips.position.y = j.py + Math.abs(cw) * 0.035 * amp * low - (run ? 0.02 : 0);
    m.hips.rotation.y = sw * 0.12; m.hips.rotation.z = cw * 0.03 * amp;
    m.legs[0].thigh.rotation.x = j.hl + sw * low; m.legs[1].thigh.rotation.x = j.hr - sw * low;
    m.legs[0].shin.rotation.x = j.kl - Math.max(0, -Math.sin(e.walk - 0.9)) * amp * (run ? 1.5 : 0.85) * low;
    m.legs[1].shin.rotation.x = j.kr - Math.max(0, Math.sin(e.walk - 0.9)) * amp * (run ? 1.5 : 0.85) * low;
    m.sway = damp(m.sway, 0, 7, dt);
    const sx = j.sp + e.aimPitch * 0.55;
    m.spine.rotation.set(sx + m.sway * 0.25, -sw * 0.15 + m.sway * 0.4, Math.sin(e.walk * 0.5) * 0.02);
    m.head.rotation.set(j.hd - (sx - POSE.stand.sp) * 0.6, sw * 0.1 + e.look, 0);
    const bob = run ? sw * 0.25 : sw * 0.06;
    m.arms[0].upper.rotation.set(j.sl + bob, 0, j.slz); m.arms[0].fore.rotation.x = j.el;
    m.arms[1].upper.rotation.set(j.sr - bob, 0, j.srz); m.arms[1].fore.rotation.x = j.er;
    m.gun.rotation.set(j.gp + e.aimPitch * 0.45, run ? 0.25 : 0, run ? 0.2 : 0);
  }
  function spawn(type, x, z, o = {}) {
    const T = ETYPE[type], m = makeModel(type);
    m.g.position.set(x, 0, z); root.add(m.g);
    const e = {
      type, T, m, pos: m.g.position, hp: T.hp, dead: false, deadT: 0, yaw: mr(0, TAU),
      state: o.alert ? 'hunt' : 'patrol', mode: 'advance', modeT: 0, cover: null, coverT: mr(0, 1.5), expT: 0, blindT: 0, peekCrouch: false,
      home: V(x, 0, z), wp: null, wpT: 0, poseName: 'stand', aimPitch: 0, look: 0, lookT: 0,
      sees: false, losT: Math.random() * 0.25, lastSeen: V(), aim: 0,
      burst: 0, shotT: mr(0.5, 1.5), strafe: 0, strafeT: 0, walk: mr(0, 6), speedNow: 0, hitT: 0, stuck: 0, prev: V(x, 0, z), r: 0.32 * (T.big || 1)
    };
    if (o.alert) e.lastSeen.copy(PLAYER.pos);
    m.g.rotation.y = e.yaw;
    list.push(e); return e;
  }
  // 射线与人形的命中检测：头部球体 + 躯干竖直圆柱 + 腿部圆柱（随姿态高度变化）
  function rayCyl(o, d, cx, cz, r, y0, y1, maxT) {
    const ox = o.x - cx, oz = o.z - cz, A = d.x * d.x + d.z * d.z;
    if (A < 1e-9) return -1;
    const Bq = 2 * (ox * d.x + oz * d.z), C = ox * ox + oz * oz - r * r, D = Bq * Bq - 4 * A * C;
    if (D < 0) return -1;
    const sq = Math.sqrt(D);
    for (const t of [(-Bq - sq) / (2 * A), (-Bq + sq) / (2 * A)]) { if (t <= 0 || t > maxT) continue; const y = o.y + d.y * t; if (y >= y0 && y <= y1) return t; }
    return -1;
  }
  function raySphere(o, d, c, r, maxT) {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, D = b * b - cc;
    if (D < 0) return -1; const t = -b - Math.sqrt(D); return t > 0 && t < maxT ? t : -1;
  }
  function raycast(o, d, maxT) {
    let best = maxT, hit = null;
    for (const e of list) {
      if (e.dead) continue;
      const s = e.T.big || 1, hy = e.m.hips.position.y * s;
      e.m.head.getWorldPosition(_c2);
      let t = raySphere(o, d, _c2, 0.155 * s, best); if (t > 0) { best = t; hit = { e, zone: 'head' }; }
      // 躯干：髋到颈，弯腰时圆柱中心随头部前移
      const cx = (e.pos.x + _c2.x) / 2, cz = (e.pos.z + _c2.z) / 2;
      t = rayCyl(o, d, cx, cz, 0.27 * s, hy - 0.08, Math.max(hy + 0.2, _c2.y - 0.1), best); if (t > 0) { best = t; hit = { e, zone: 'body' }; }
      t = rayCyl(o, d, e.pos.x, e.pos.z, 0.21 * s, 0.0, hy - 0.08, best); if (t > 0) { best = t; hit = { e, zone: 'leg' }; }
    }
    if (hit) hit.point = o.clone().addScaledVector(d, best);
    return hit;
  }
  function damage(e, dmg, head, dir) {
    if (e.dead) return false;
    e.hp -= dmg; e.hitT = 0.25; e.m.sway = (Math.random() < 0.5 ? -1 : 1) * (head ? 1 : 0.6);
    if (e.state === 'patrol') { e.state = 'hunt'; e.mode = 'advance'; e.coverT = 0; }
    else if (e.mode === 'peek') e.modeT = Math.min(e.modeT, 0.35); // 被压制，缩回掩体
    e.lastSeen.copy(PLAYER.pos); e.aim = Math.max(e.aim, e.T.react * 0.5);
    if (e.hp <= 0) { kill(e, head, dir); return true; }
    return false;
  }
  function kill(e, head, dir) {
    e.dead = true; e.deadT = 0; e.fallDir = Math.atan2(dir.x, dir.z); e.cover = null;
    PLAYER.kills++; if (head) PLAYER.heads++;
    HUD.feed(head ? `爆头击杀 +${e.T.score + 50}` : `击杀 +${e.T.score}`);
    SFX.enemyDie(e.pos);
    const r = Math.random();
    if (r < 0.45) dropPickup('ammo', e.pos); else if (r < 0.62) dropPickup('med', e.pos);
    noise(e.pos, 25);
  }
  function dropPickup(kind, p) {
    const m = new THREE.Mesh(MAT.pickGeo, kind === 'ammo' ? MAT.ammoBox : MAT.medBox);
    m.position.set(p.x + mr(-0.4, 0.4), 0.11, p.z + mr(-0.4, 0.4)); m.rotation.y = mr(0, TAU); m.castShadow = true; root.add(m);
    pickups.push({ kind, m, t: 0 });
  }
  // 听到枪声：范围内敌人进入搜索
  function noise(p, radius) {
    for (const e of list) if (!e.dead && e.state === 'patrol' && e.pos.distanceTo(p) < radius) { e.state = 'hunt'; e.lastSeen.copy(PLAYER.pos); }
  }
  function alertAll() { for (const e of list) if (!e.dead) { e.state = 'hunt'; e.lastSeen.copy(PLAYER.pos); } }
  // 选刷怪点：远离玩家、不在视线内、可达
  function findSpawn(minD = 32, maxD = 80) {
    for (let i = 0; i < 80; i++) {
      const x = rr(NAV.x0 + 3, NAV.x0 + NAV.w - 3), z = rr(-46, 62);
      if (!navFree(x, z)) continue;
      const c = navCell(x, z); if (NAV.dist[c] < 0) continue;
      const d = Math.hypot(x - PLAYER.pos.x, z - PLAYER.pos.z); if (d < minD || d > maxD) continue;
      if (i < 60 && losClear(_a.set(x, 1.5, z), camera.position)) continue;
      return V(x, 0, z);
    }
    return null;
  }
  // 直线可走（按导航格采样）
  function walkable(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.7);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!navFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  // 找掩体：高掩体（完全挡住，侧移探头）优先，其次矮掩体（蹲下躲、站起打）
  function findCover(e) {
    const P = PLAYER.pos; let best = null, bs = -1e9;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, r = mr(2, 11), x = e.pos.x + Math.cos(a) * r, z = e.pos.z + Math.sin(a) * r;
      if (!navFree(x, z)) continue;
      const dP = Math.hypot(x - P.x, z - P.z); if (dP < 9 || dP > e.T.range) continue;
      if (losClear(_lo.set(x, 0.5, z), _eye)) continue;
      let type, peek = null;
      if (losClear(_hi.set(x, 1.5, z), _eye)) type = 'low';
      else {
        const px = -(P.z - z) / dP, pz = (P.x - x) / dP;
        for (const [s, d] of [[1, 1.3], [-1, 1.3], [1, 2.1], [-1, 2.1]]) {
          const qx = x + px * s * d, qz = z + pz * s * d;
          if (navFree(qx, qz) && losClear(_hi.set(qx, 1.5, qz), _eye)) { peek = V(qx, 0, qz); break; }
        }
        if (!peek) continue; type = 'high';
      }
      if (!walkable(e.pos.x, e.pos.z, x, z)) continue;
      let sc = (type === 'high' ? 3 : 2) - r * 0.22 - Math.abs(dP - 24) * 0.04;
      for (const o of list) if (o !== e && !o.dead && o.cover && Math.hypot(o.cover.pos.x - x, o.cover.pos.z - z) < 1.8) sc -= 5;
      if (sc > bs) { bs = sc; best = { pos: V(x, 0, z), peek, type }; }
    }
    return best;
  }
  function shoot(e, dist) {
    const T = e.T;
    e.m.muzzle.getWorldPosition(_a);
    const moving = clamp(PLAYER.speed / 6, 0, 1);
    let p = T.acc * clamp(1.15 - dist / 60, 0.25, 1) * (1 - moving * 0.35) * (1 - PLAYER.crouch * 0.25) * (1 - PLAYER.prone * 0.45) * clamp(e.aim / (T.react + 0.6), 0.3, 1);
    if (e.poseName === 'crouch') p *= 1.15;
    if (PLAYER.hp < 35) p *= 0.75; // 低血量时给玩家喘息
    const hit = Math.random() < p;
    _tg.set(PLAYER.pos.x, camera.position.y - 0.25, PLAYER.pos.z);
    if (!hit) {
      _b.subVectors(_tg, _a).normalize(); _c2.crossVectors(_b, Y_AXIS).normalize();
      _tg.addScaledVector(_c2, mr(0.5, 1.6) * (Math.random() < 0.5 ? -1 : 1)).add(_b.multiplyScalar(mr(4, 20))); _tg.y += mr(-0.6, 0.8);
      if (dist < 40 && Math.random() < 0.5) SFX.whiz(camera.position.clone().addScaledVector(_c2, 1));
    }
    FX.tracer(_a, _tg, true); FX.light(_a, 3, 0.05, 6, 0xffa050);
    FX.spawn('flash', _a, _b.set(0, 0, 0), { size: 0.35, life: 0.05 });
    SFX.enemyShot(_a);
    if (hit) Game.hurt(T.dmg * mr(0.8, 1.25), e.pos);
  }
  function update(dt, now, freeze) {
    // 调试：冻结 AI，仅摆姿态（用于截图）
    if (freeze) { for (const e of list) { if (!e.frozen) continue; e.poseName = e.dbgPose || 'stand'; e.speedNow = e.poseName === 'run' ? 4 : 0; e.walk += dt * 8; applyPose(e, dt, POSE[e.poseName]); } return; }
    flowT -= dt; if (flowT <= 0) { flowT = 0.4; buildFlow(PLAYER.pos.x, PLAYER.pos.z); }
    _eye.copy(camera.position);
    const stealth = 1 - PLAYER.crouch * 0.3 - PLAYER.prone * 0.5;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i], m = e.m, T = e.T;
      if (e.dead) {
        e.deadT += dt;
        const k = Math.min(1, e.deadT * 2.4);
        // 以脚为支点顺着子弹方向倒下（YXZ：先转向再绕自身 X 轴倾倒）
        m.g.rotation.set(k * k * 1.5, e.fallDir, 0); e.speedNow = 0; e.aimPitch = 0; e.look = 0;
        applyPose(e, dt, POSE.dead, 7);
        m.g.position.y = k * k * 0.12;
        if (e.deadT > 14) m.g.position.y -= (e.deadT - 14) * 0.3;
        if (e.deadT > 17) { root.remove(m.g); list.splice(i, 1); }
        continue;
      }
      _b.subVectors(PLAYER.pos, e.pos); _b.y = 0; const dist = Math.max(_b.length(), 0.01);
      // 视线检测（分帧），从实际头部位置出发：躲在掩体后就真的看不见
      e.losT -= dt;
      if (e.losT <= 0) {
        e.losT = 0.2 + Math.random() * 0.08;
        m.head.getWorldPosition(_a); _a.y += 0.03;
        let fov = true;
        if (e.state === 'patrol') { const fd = Math.atan2(-_b.x, -_b.z), dy = Math.atan2(Math.sin(fd - e.yaw - e.look), Math.cos(fd - e.yaw - e.look)); fov = Math.abs(dy) < 1.15 || dist < 5 * stealth; }
        e.sees = PLAYER.alive && dist < (e.state === 'patrol' ? 42 * stealth : 75) && fov && losClear(_a, _eye);
      }
      if (e.sees) { if (e.state === 'patrol') { e.state = 'hunt'; e.mode = 'advance'; e.aim = -0.3; } e.lastSeen.copy(PLAYER.pos); e.aim += dt; } else e.aim = Math.max(0, e.aim - dt * 0.5);
      // ---- 行为决策 ----
      let mx = 0, mz = 0, spd = 0, pose = 'stand', canShoot = false;
      const goTo = (p, s) => { const dx = p.x - e.pos.x, dz = p.z - e.pos.z, L = Math.hypot(dx, dz); if (L > 0.35) { mx = dx / L; mz = dz / L; spd = s; } return L; };
      if (e.state === 'patrol') {
        pose = 'patrol';
        e.wpT -= dt;
        if (!e.wp || e.wpT <= 0 || e.pos.distanceTo(e.wp) < 0.6) {
          e.wpT = mr(4, 9);
          for (let k = 0; k < 10; k++) { const x = e.home.x + mr(-9, 9), z = e.home.z + mr(-9, 9); if (navFree(x, z) && walkable(e.pos.x, e.pos.z, x, z)) { e.wp = V(x, 0, z); break; } }
          if (Math.random() < 0.35) { e.wpT = mr(1.5, 3); e.wp = e.pos.clone(); }
        }
        if (e.wp) goTo(e.wp, 1.3);
        // 站岗时左右张望
        e.lookT -= dt; if (e.lookT <= 0) { e.lookT = mr(1.5, 4); e.lookTo = spd ? 0 : mr(-0.9, 0.9); }
        e.look = damp(e.look, spd ? 0 : (e.lookTo || 0), 3, dt);
      } else {
        e.look = damp(e.look, 0, 8, dt);
        e.coverT -= dt;
        if (dist < 6 && e.mode !== 'advance') { e.mode = 'advance'; e.cover = null; e.coverT = 4; }
        if (e.mode === 'advance') {
          canShoot = true;
          if (e.type !== 'rusher' && e.sees && e.coverT <= 0 && dist > 7) {
            const c = findCover(e);
            if (c) { e.cover = c; e.mode = 'toCover'; e.modeT = 6; } else e.coverT = mr(2.5, 4);
          }
          const want = e.sees ? (dist > T.range * 0.6 ? 1 : dist < 7 && e.type !== 'rusher' ? -1 : 0) : 1;
          if (want === 1) {
            const f = e.sees && dist < 12 ? null : flowDir(e.pos.x, e.pos.z);
            if (f) { mx = f.x; mz = f.z; } else { mx = _b.x / dist; mz = _b.z / dist; }
            spd = T.speed * (e.sees ? 0.85 : 1);
            if (!e.sees || e.type === 'rusher') pose = 'run';
          } else if (want === -1) { mx = -_b.x / dist; mz = -_b.z / dist; spd = T.speed * 0.6; }
          // 交火时左右横移，原地时偶尔蹲姿射击
          if (e.sees) {
            e.strafeT -= dt; if (e.strafeT <= 0) { e.strafeT = mr(0.8, 2); e.strafe = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); e.peekCrouch = Math.random() < 0.6; }
            if (e.strafe) { const sx = -_b.z / dist * e.strafe, sz = _b.x / dist * e.strafe; mx = mx * 0.5 + sx; mz = mz * 0.5 + sz; spd = Math.max(spd, T.speed * 0.55); const L = Math.hypot(mx, mz); mx /= L; mz /= L; }
            else if (want === 0 && e.peekCrouch && e.type !== 'rusher') pose = 'crouch';
          }
        } else if (e.mode === 'toCover') {
          pose = 'run';
          const L = goTo(e.cover.pos, T.speed * 1.2);
          e.modeT -= dt;
          if (L <= 0.45) { e.mode = 'hide'; e.modeT = mr(0.6, 1.6); e.expT = 0; }
          else if (e.modeT <= 0) { e.mode = 'advance'; e.cover = null; e.coverT = 3; }
        } else if (e.mode === 'hide') {
          pose = 'hide';
          if (goTo(e.cover.pos, T.speed * 0.7) > 0.35) pose = 'crouch';
          e.modeT -= dt;
          // 躲着还能看见玩家，说明被绕侧了
          if (e.sees) { e.expT += dt; if (e.expT > 1.0) { e.mode = 'advance'; e.cover = null; e.coverT = mr(1.5, 3); } } else e.expT = 0;
          if (e.mode === 'hide' && e.modeT <= 0) { e.mode = 'peek'; e.modeT = mr(2.2, 4); e.blindT = 0; e.peekCrouch = e.cover.type === 'high' && Math.random() < 0.5; }
        } else if (e.mode === 'peek') {
          canShoot = true; pose = e.peekCrouch ? 'crouch' : 'stand';
          goTo(e.cover.peek || e.cover.pos, T.speed * 0.7);
          if (!e.sees) { e.blindT += dt; if (e.blindT > 3) { e.mode = 'advance'; e.cover = null; e.coverT = mr(3, 5); } } else e.blindT = 0;
          e.modeT -= dt;
          if (e.mode === 'peek' && e.modeT <= 0 && e.burst <= 0) { e.mode = 'hide'; e.modeT = mr(1, 2.4); e.expT = 0; }
        }
      }
      if (e.hitT > 0) { e.hitT -= dt; spd *= 0.4; }
      e.poseName = pose;
      e.speedNow = damp(e.speedNow, spd, 8, dt);
      if (e.speedNow > 0.05 && (mx || mz)) {
        e.prev.copy(e.pos);
        e.pos.x += mx * e.speedNow * dt; e.pos.z += mz * e.speedNow * dt;
        for (const o of list) { if (o === e || o.dead) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d2 = dx * dx + dz * dz, mn = e.r + o.r + 0.2; if (d2 < mn * mn && d2 > 1e-6) { const d = Math.sqrt(d2), k = (mn - d) / d * 0.5; e.pos.x += dx * k; e.pos.z += dz * k; } }
        { const dx = e.pos.x - PLAYER.pos.x, dz = e.pos.z - PLAYER.pos.z, d2 = dx * dx + dz * dz, mn = e.r + 0.55; if (d2 < mn * mn && d2 > 1e-6) { const d = Math.sqrt(d2), k = (mn - d) / d; e.pos.x += dx * k; e.pos.z += dz * k; } }
        collideCircle(e.pos, e.r, 0, 1.8);
        e.pos.y = 0;
        const moved = e.pos.distanceTo(e.prev);
        e.walk += moved * (pose === 'run' ? 2.6 : 3.4);
        if (moved < e.speedNow * dt * 0.2) { e.stuck += dt; if (e.stuck > 1) { e.wp = null; e.strafe = -e.strafe; e.stuck = 0; if (e.mode === 'toCover') { e.mode = 'advance'; e.cover = null; e.coverT = 2; } } } else e.stuck = 0;
      }
      // 朝向：交火/躲藏时面向玩家，否则面向移动方向
      const facePlayer = e.state === 'hunt' && pose !== 'run' && (e.sees || dist < 25 || e.mode !== 'advance');
      const face = facePlayer ? Math.atan2(-(e.lastSeen.x - e.pos.x), -(e.lastSeen.z - e.pos.z)) : (mx || mz) ? Math.atan2(-mx, -mz) : e.yaw;
      e.yaw += Math.atan2(Math.sin(face - e.yaw), Math.cos(face - e.yaw)) * Math.min(1, dt * 7);
      m.g.rotation.set(0, e.yaw, 0);
      e.aimPitch = damp(e.aimPitch, e.state === 'hunt' && e.sees && canShoot ? clamp(Math.atan2(_eye.y - 0.3 - (m.hips.position.y + 0.5), dist), -0.5, 0.5) : 0, 6, dt);
      applyPose(e, dt, POSE[pose], pose === 'hide' || pose === 'crouch' ? 7 : 9);
      // 开火
      e.shotT -= dt;
      if (canShoot && e.state === 'hunt' && e.sees && PLAYER.alive && dist < T.range && e.aim > T.react && e.shotT <= 0 && pose !== 'run') {
        if (e.burst <= 0) e.burst = Math.round(mr(T.burst[0], T.burst[1]));
        shoot(e, dist); e.burst--;
        e.shotT = e.burst > 0 ? T.gap : mr(T.rest[0], T.rest[1]);
      } else if (!e.sees) e.burst = 0;
    }
    // 拾取物
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.t += dt;
      if (p.t > 60) { root.remove(p.m); pickups.splice(i, 1); continue; }
      if (PLAYER.alive && Math.hypot(p.m.position.x - PLAYER.pos.x, p.m.position.z - PLAYER.pos.z) < 1.2) {
        if (p.kind === 'ammo') { Weapon.addAmmo(1); HUD.feed('弹药 +'); }
        else { if (PLAYER.hp >= 100) continue; PLAYER.hp = Math.min(100, PLAYER.hp + 40); HUD.feed('生命 +40'); }
        SFX.pickup(); root.remove(p.m); pickups.splice(i, 1);
      }
    }
  }
  const alive = () => list.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
  return { init, spawn, raycast, damage, noise, alertAll, findSpawn, update, alive, list, pickups };
})();
