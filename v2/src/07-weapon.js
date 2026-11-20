// ======================= 07 PLAYER WEAPON =======================
const gunScene = new THREE.Scene();
const gunCam = new THREE.PerspectiveCamera(50, 1, 0.01, 20);
gunScene.add(gunCam);
const PLAYER = {
  pos: V(), vel: V(), yaw: 0, pitch: 0, hp: 100, alive: true, onGround: true, crouch: 0, prone: 0, proneOn: false, eye: 1.62, sprint: false, speed: 0,
  lastHurt: -99, kills: 0, heads: 0, shots: 0, hits: 0, rec: 0, swayX: 0, swayY: 0, bob: 0, land: 0
};
const WDEF = [
  { id: 'carbine', name: 'MK-7 卡宾枪 · 全自动', mag: 30, reserve: 150, rate: 0.085, auto: true, dmg: 34, head: 2.4, hip: 0.028, adsSpread: 0.0025, bloom: 0.006, kickP: 0.012, kickY: 0.004, reload: 2.1, adsFov: 48, hipPos: V(0.13, -0.155, -0.30), adsPos: V(0, -0.1165, -0.2), range: 300 },
  { id: 'pistol', name: 'P-9 手枪 · 半自动', mag: 15, reserve: 60, rate: 0.13, auto: false, dmg: 45, head: 2.2, hip: 0.02, adsSpread: 0.004, bloom: 0.01, kickP: 0.022, kickY: 0.006, reload: 1.45, adsFov: 58, hipPos: V(0.12, -0.14, -0.32), adsPos: V(0, -0.0565, -0.27), range: 150 }
];

const Weapon = (() => {
  const G = [];
  let cur = 0, fireCd = 0, reloadT = 0, swapT = 0, ads = 0, kick = 0, bloom = 0, flashT = 0, lastShot = -9, prevTrig = false, sunVis = 1, sunCheck = 0;
  let sunL, hemi, gunLight;
  const ammo = WDEF.map(d => ({ mag: d.mag, reserve: d.reserve }));
  const _o = V(), _dd = V(), _mz = V(), _sv = V();

  function mats() {
    return {
      metal: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.42, metalness: 0.8 }),
      poly: new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.75, metalness: 0.1 }),
      tan: new THREE.MeshStandardMaterial({ color: 0x6f6048, roughness: 0.8, metalness: 0.05 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x2d2a25, roughness: 0.9, metalness: 0, normalMap: TEX.camoMC.normal }),
      sleeve: new THREE.MeshStandardMaterial({ map: TEX.camoMC.map, normalMap: TEX.camoMC.normal, roughness: 0.95, metalness: 0 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x223322, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.25 }),
      dot: new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 0.8, 0.5) })
    };
  }
  function hands(B, m, l, r) {
    B.box(m.glove, l.x, l.y, l.z, 0.055, 0.05, 0.1, 0, 0.15, 0, 0.1);
    B.beam(m.sleeve, V(l.x - 0.01, l.y - 0.03, l.z + 0.04), V(l.x - 0.13, l.y - 0.2, l.z + 0.38), 0.075, 0.075, 0.3);
    B.box(m.glove, r.x, r.y, r.z, 0.05, 0.075, 0.065, 0, 0.3, 0, 0.1);
    B.beam(m.sleeve, V(r.x + 0.01, r.y - 0.03, r.z + 0.04), V(r.x + 0.11, r.y - 0.2, r.z + 0.36), 0.08, 0.08, 0.3);
  }
  function buildCarbine(m) {
    const g = new THREE.Group(), B = new Builder();
    B.box(m.metal, 0, 0.035, -0.05, 0.05, 0.06, 0.30, 0, 0, 0, 0.2);
    B.box(m.poly, 0, -0.012, -0.02, 0.046, 0.045, 0.2, 0, 0, 0, 0.2);
    B.box(m.tan, 0, 0.035, -0.34, 0.06, 0.06, 0.29, 0, 0, 0, 0.2);
    for (let z = -0.45; z < -0.22; z += 0.03) B.box(m.poly, 0, 0.035, z, 0.064, 0.012, 0.012, 0, 0, 0, 0.2);
    B.cyl(m.metal, 0, 0.035, -0.56, 0.011, 0.18, GEO.cyl12, 0.2, Math.PI / 2, 0);
    B.cyl(m.metal, 0, 0.035, -0.67, 0.017, 0.06, GEO.cyl12, 0.2, Math.PI / 2, 0);
    B.cyl(m.metal, 0, 0.04, 0.14, 0.016, 0.18, GEO.cyl12, 0.2, Math.PI / 2, 0);
    B.box(m.tan, 0, 0.012, 0.21, 0.046, 0.075, 0.17, 0, 0, 0, 0.2);
    B.box(m.poly, 0, -0.005, 0.305, 0.05, 0.12, 0.03, 0, 0, 0, 0.2);
    B.box(m.poly, 0, -0.07, 0.05, 0.034, 0.1, 0.045, 0, -0.3, 0, 0.2);
    B.box(m.metal, 0, -0.05, -0.02, 0.008, 0.008, 0.07, 0, 0, 0, 0.2);
    B.box(m.metal, 0, 0.072, -0.2, 0.024, 0.012, 0.5, 0, 0, 0, 0.2);
    // 红点镜
    B.box(m.metal, 0, 0.085, -0.04, 0.032, 0.016, 0.06, 0, 0, 0, 0.2);
    const sy = 0.1165, sz = -0.045;
    B.box(m.metal, 0, sy - 0.02, sz, 0.04, 0.004, 0.035, 0, 0, 0, 0.2);
    B.box(m.metal, 0, sy + 0.02, sz, 0.04, 0.004, 0.035, 0, 0, 0, 0.2);
    B.box(m.metal, -0.02, sy, sz, 0.004, 0.044, 0.035, 0, 0, 0, 0.2);
    B.box(m.metal, 0.02, sy, sz, 0.004, 0.044, 0.035, 0, 0, 0, 0.2);
    B.box(m.metal, 0.028, sy, sz, 0.008, 0.014, 0.02, 0, 0, 0, 0.2);
    hands(B, m, V(-0.005, 0.0, -0.36), V(0.0, -0.075, 0.055));
    B.build(g, false, false);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.036), m.glass); lens.position.set(0, sy, sz - 0.03); g.add(lens);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0009, 12), m.dot); dot.position.set(0, sy, sz - 0.029); g.add(dot);
    const mag = new THREE.Group(), MB = new Builder();
    MB.box(m.poly, 0, -0.07, 0, 0.03, 0.15, 0.068, 0, -0.18, 0, 0.2); MB.box(m.metal, 0, -0.145, 0.012, 0.034, 0.012, 0.075, 0, -0.18, 0, 0.2);
    MB.build(mag, false, false); mag.position.set(0, -0.025, -0.11); g.add(mag);
    return { g, mag, magHome: mag.position.clone(), muzzle: V(0, 0.035, -0.71) };
  }
  function buildPistol(m) {
    const g = new THREE.Group(), B = new Builder();
    B.box(m.metal, 0, 0.03, -0.08, 0.03, 0.035, 0.19, 0, 0, 0, 0.2);
    for (let z = -0.01; z < 0.01; z += 0.006) B.box(m.poly, 0, 0.03, z, 0.032, 0.03, 0.002, 0, 0, 0, 0.2);
    B.box(m.poly, 0, 0.0, -0.07, 0.028, 0.025, 0.17, 0, 0, 0, 0.2);
    B.box(m.poly, 0, -0.055, 0.0, 0.03, 0.1, 0.045, 0, -0.25, 0, 0.2);
    B.box(m.metal, 0, -0.024, -0.05, 0.006, 0.006, 0.05, 0, 0, 0, 0.2);
    B.box(m.metal, 0, 0.0515, -0.165, 0.004, 0.009, 0.006, 0, 0, 0, 0.2);
    B.box(m.metal, -0.007, 0.0515, 0.0, 0.006, 0.009, 0.008, 0, 0, 0, 0.2);
    B.box(m.metal, 0.007, 0.0515, 0.0, 0.006, 0.009, 0.008, 0, 0, 0, 0.2);
    B.box(m.glove, -0.02, -0.05, 0.0, 0.03, 0.075, 0.07, 0, 0.2, 0, 0.1);
    B.beam(m.sleeve, V(-0.03, -0.08, 0.04), V(-0.16, -0.26, 0.38), 0.075, 0.075, 0.3);
    B.box(m.glove, 0.012, -0.055, 0.012, 0.045, 0.075, 0.06, 0, 0.3, 0, 0.1);
    B.beam(m.sleeve, V(0.02, -0.08, 0.05), V(0.12, -0.26, 0.38), 0.08, 0.08, 0.3);
    B.build(g, false, false);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 6, 0.6) })); dot.position.set(0, 0.0545, -0.1685); g.add(dot);
    const mag = new THREE.Group(), MB = new Builder();
    MB.box(m.metal, 0, -0.05, 0, 0.024, 0.1, 0.035, 0, -0.25, 0, 0.2); MB.box(m.poly, 0, -0.1, 0.013, 0.03, 0.012, 0.045, 0, -0.25, 0, 0.2);
    MB.build(mag, false, false); mag.position.set(0, -0.005, 0.0); g.add(mag);
    return { g, mag, magHome: mag.position.clone(), muzzle: V(0, 0.03, -0.18) };
  }
  function build() {
    const m = mats();
    G.push(buildCarbine(m), buildPistol(m));
    const flashMat = new THREE.SpriteMaterial({ map: TEX.flash, color: new THREE.Color(10, 6, 2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    for (const w of G) {
      w.flash = new THREE.Sprite(flashMat); w.flash.position.copy(w.muzzle).add(V(0, 0, -0.03)); w.flash.visible = false; w.g.add(w.flash);
      w.g.visible = false; gunCam.add(w.g);
    }
    G[0].g.visible = true;
    sunL = new THREE.DirectionalLight(COL.sun, 3.4); sunL.position.copy(SUN_DIR).multiplyScalar(10); gunScene.add(sunL, sunL.target);
    hemi = new THREE.HemisphereLight(new THREE.Color(0.42, 0.50, 0.64), new THREE.Color(0.20, 0.17, 0.14), 0.45); gunScene.add(hemi);
    gunLight = new THREE.PointLight(0xffb060, 0, 3, 2); gunLight.position.set(0.1, -0.05, -0.8); gunCam.add(gunLight);
    gunScene.environment = SKY.env;
    hud();
  }
  const def = () => WDEF[cur];
  function hud() { const a = ammo[cur]; HUD.ammo(a.mag, a.reserve, def().name, a.mag <= Math.ceil(def().mag * 0.25)); }
  function reload() {
    const a = ammo[cur], d = def();
    if (reloadT > 0 || swapT > 0 || a.mag >= d.mag || a.reserve <= 0) return;
    reloadT = d.reload + (a.mag === 0 ? 0.4 : 0); G[cur].reloadMax = reloadT; G[cur].swapped = false; SFX.reload(d.id);
  }
  function swap(i) {
    if (i === cur || i < 0 || i >= WDEF.length || swapT > 0) return;
    reloadT = 0; G[cur].mag.position.copy(G[cur].magHome); G[cur].g.visible = false;
    cur = i; G[cur].g.visible = true; swapT = 0.45; SFX.swap(); hud();
  }
  function addAmmo(frac) {
    WDEF.forEach((d, i) => { ammo[i].reserve = Math.min(d.reserve * 1.5 | 0, ammo[i].reserve + Math.ceil(d.mag * frac)); }); hud();
  }
  function fire(now) {
    const d = def(), a = ammo[cur];
    if (a.mag <= 0) { SFX.empty(); fireCd = 0.25; reload(); return; }
    a.mag--; fireCd = d.rate; lastShot = now; PLAYER.shots++;
    d.id === 'pistol' ? SFX.pistol() : SFX.rifle();
    kick = 1; flashT = 0.045; const w = G[cur]; w.flash.visible = true; w.flash.material.rotation = Math.random() * TAU; w.flash.scale.setScalar(mr(0.1, 0.16) * (d.id === 'pistol' ? 0.7 : 1));
    gunLight.intensity = 4;
    // 弹道
    const moving = clamp(PLAYER.speed / 5, 0, 1);
    const spread = lerp(d.hip, d.adsSpread, ads) + bloom + moving * 0.025 * (1 - ads * 0.7) + (PLAYER.onGround ? 0 : 0.05) - PLAYER.crouch * 0.006 - PLAYER.prone * 0.012;
    bloom = Math.min(bloom + d.bloom * (1 - ads * 0.6), 0.05);
    camera.getWorldDirection(_dd);
    const r = Math.sqrt(Math.random()) * Math.max(0, spread), th = Math.random() * TAU;
    _sv.set(Math.cos(th) * r, Math.sin(th) * r, 0).applyQuaternion(camera.quaternion); _dd.add(_sv).normalize();
    _o.copy(camera.position);
    const wh = raycastWorld(_o, _dd, d.range);
    const maxT = wh ? wh.t : d.range;
    const eh = Enemies.raycast(_o, _dd, maxT);
    const end = eh ? eh.point : wh ? wh.point : _o.clone().addScaledVector(_dd, d.range);
    camera.localToWorld(_mz.set(0.12 * (1 - ads), -0.1 * (1 - ads) - 0.03, -0.75));
    if (d.id !== 'pistol' && PLAYER.shots % 2 === 0) FX.tracer(_mz, end);
    FX.light(_mz, 6, 0.06, 9);
    if (eh) {
      const head = eh.zone === 'head', dmg = d.dmg * (head ? d.head : eh.zone === 'leg' ? 0.75 : 1) * mr(0.9, 1.1);
      PLAYER.hits++;
      const killed = Enemies.damage(eh.e, dmg, head, _dd);
      FX.blood(eh.point, _dd, head); SFX.flesh(eh.point);
      killed ? (head ? SFX.headshot() : SFX.kill()) : (head ? SFX.headshot() : SFX.hit());
      HUD.hitmark(killed, head);
    } else if (wh) { FX.impact(wh.point, wh.normal, wh.mat); SFX.impact(wh.point, wh.mat); }
    Enemies.noise(camera.position, 60);
    // 后坐力
    const kp = d.kickP * (1 - ads * 0.35) * (1 - PLAYER.crouch * 0.3) * (1 - PLAYER.prone * 0.45) * mr(0.8, 1.2);
    PLAYER.pitch += kp; PLAYER.rec += kp; PLAYER.yaw += mr(-1, 1) * d.kickY;
    hud();
  }
  function update(dt, now, inp) {
    const d = def(), a = ammo[cur], w = G[cur];
    fireCd -= dt; bloom = Math.max(0, bloom - dt * 0.06);
    if (swapT > 0) swapT -= dt;
    const busy = reloadT > 0 || swapT > 0;
    ads = damp(ads, inp.ads && !busy && !PLAYER.sprint && PLAYER.alive ? 1 : 0, 14, dt);
    if (inp.reload) reload();
    if (reloadT > 0) {
      reloadT -= dt;
      const k = 1 - reloadT / w.reloadMax;
      w.mag.position.copy(w.magHome);
      if (k > 0.15 && k < 0.5) w.mag.position.y -= ss(0.15, 0.35, k) * 0.25;
      else if (k >= 0.5 && k < 0.75) w.mag.position.y -= (1 - ss(0.5, 0.72, k)) * 0.25;
      if (reloadT <= 0) { const n = Math.min(d.mag - a.mag, a.reserve); a.mag += n; a.reserve -= n; w.mag.position.copy(w.magHome); hud(); }
    }
    const trig = inp.fire && PLAYER.alive;
    if (trig && !busy && !PLAYER.sprint && fireCd <= 0 && (d.auto || !prevTrig)) fire(now);
    else if (trig && !prevTrig && busy) {/* 换弹中忽略 */}
    prevTrig = trig;
    // 后坐力回正
    if (now - lastShot > 0.1 && PLAYER.rec > 0) { const dec = PLAYER.rec * Math.min(1, dt * 7); PLAYER.pitch -= dec; PLAYER.rec -= dec; }
    // 视觉
    kick = damp(kick, 0, 18, dt);
    flashT -= dt; if (flashT <= 0) w.flash.visible = false;
    gunLight.intensity *= Math.pow(0.0001, dt);
    gunCam.quaternion.copy(camera.quaternion);
    const pos = _o.lerpVectors(d.hipPos, d.adsPos, ads);
    const bobA = PLAYER.onGround ? clamp(PLAYER.speed / 5, 0, 1.4) * (1 - ads * 0.85) : 0;
    const sprintK = damp(w.sprintK || 0, PLAYER.sprint && !busy ? 1 : 0, 10, dt); w.sprintK = sprintK;
    w.g.position.set(
      pos.x + Math.sin(PLAYER.bob) * 0.012 * bobA + PLAYER.swayX * (1 - ads * 0.8) + sprintK * 0.04,
      pos.y - Math.abs(Math.cos(PLAYER.bob)) * 0.01 * bobA + PLAYER.swayY * (1 - ads * 0.8) - PLAYER.land * 0.03 - sprintK * 0.05 - (swapT > 0 ? swapT * 0.5 : 0),
      pos.z + kick * (ads > 0.5 ? 0.025 : 0.045));
    let rx = kick * (ads > 0.5 ? 0.02 : 0.07) - sprintK * 0.3, rz = sprintK * 0.5, ry = sprintK * 0.5;
    if (reloadT > 0) { const k = 1 - reloadT / w.reloadMax, e = Math.sin(clamp(k, 0, 1) * Math.PI); rx += e * 0.35; rz += e * 0.55; w.g.position.y -= e * 0.05; }
    w.g.rotation.set(rx, ry, rz);
    // 枪械光照：玩家站在阴影里时压暗太阳光
    sunCheck -= dt;
    if (sunCheck <= 0) { sunCheck = 0.15; sunVis = raycastWorld(camera.position, SUN_DIR, 400, true) ? 0.12 : 1; }
    sunL.intensity = damp(sunL.intensity, 3.4 * sunVis, 6, dt);
    sunL.position.copy(SUN_DIR).multiplyScalar(10);
  }
  return {
    build, update, swap, addAmmo, reload,
    get ads() { return ads; }, get cur() { return cur; }, get reloading() { return reloadT > 0; }, get reloadK() { return reloadT > 0 ? 1 - reloadT / G[cur].reloadMax : 0; },
    get spread() { return lerp(def().hip, def().adsSpread, ads) + bloom + clamp(PLAYER.speed / 5, 0, 1) * 0.025 * (1 - ads * 0.7); },
    def, ammo
  };
})();
