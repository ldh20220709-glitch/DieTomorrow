// ======================= 06 FX：粒子 / 曳光 / 弹孔 / 闪光 =======================
const FX = (() => {
  let root, sprites = [], free = [], tracers = [], decals = [], decalI = 0, lights = [], emitters = [];
  const live = [];
  const _fv = V(), _fq = new THREE.Quaternion();
  function init() {
    root = new THREE.Group(); scene.add(root);
    for (let i = 0; i < 220; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, transparent: true, depthWrite: false, fog: false }));
      sp.visible = false; sp.layers.set(3); root.add(sp); sprites.push(sp); free.push(sp);
    }
    const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0, -0.5);
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 8, 3), fog: false, transparent: true });
    const etm = new THREE.MeshBasicMaterial({ color: new THREE.Color(16, 3, 1.5), fog: false, transparent: true });
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(tg, i < 20 ? tm : etm); m.visible = false; m.layers.set(3); root.add(m); tracers.push({ m, life: 0, enemy: i >= 20 }); }
    const dg = new THREE.PlaneGeometry(0.11, 0.11);
    const dm = std({ map: TEX.hole, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(dg, dm); m.visible = false; root.add(m); decals.push(m); }
    lights = SKY.pl.map(l => ({ l, life: 0, max: 1, peak: 0 }));
  }
  // kind: spark | smoke | dust | blood | flash | ember
  function spawn(kind, pos, vel, o = {}) {
    const sp = free.pop(); if (!sp) return;
    const m = sp.material;
    const add = kind === 'spark' || kind === 'flash' || kind === 'ember';
    m.map = kind === 'smoke' || kind === 'dust' || kind === 'blood' ? TEX.smoke : kind === 'flash' ? TEX.flash : TEX.spark;
    m.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.color.copy(o.color || (kind === 'spark' ? _c.setRGB(9, 5, 2) : kind === 'ember' ? _c.setRGB(6, 1.6, 0.3) : kind === 'blood' ? _c.setRGB(0.25, 0.02, 0.02) : kind === 'flash' ? _c.setRGB(12, 7, 3) : _c.setRGB(0.45, 0.43, 0.4)));
    m.rotation = Math.random() * TAU; m.opacity = o.alpha ?? 1; m.needsUpdate = true;
    sp.position.copy(pos); sp.visible = true;
    const size = o.size ?? (kind === 'spark' ? 0.06 : kind === 'smoke' ? 0.6 : kind === 'dust' ? 0.35 : kind === 'blood' ? 0.25 : 0.5);
    sp.scale.setScalar(size);
    live.push({ sp, kind, vel: vel.clone(), life: o.life ?? (kind === 'spark' ? mr(0.15, 0.4) : kind === 'smoke' ? mr(2, 4) : kind === 'flash' ? 0.06 : mr(0.5, 1.2)), age: 0, size, grow: o.grow ?? (kind === 'smoke' ? 0.9 : kind === 'dust' ? 1.4 : kind === 'blood' ? 0.8 : 0), a0: o.alpha ?? 1, g: o.g ?? (kind === 'spark' || kind === 'blood' ? 9.8 : kind === 'ember' ? 2 : kind === 'smoke' ? -0.4 : 0.3) });
  }
  const _c = new THREE.Color();
  const rv = (s, up = 0) => _fv.set(mr(-1, 1), mr(-1, 1) + up, mr(-1, 1)).normalize().multiplyScalar(s * mr(0.3, 1));
  function impact(p, n, mat) {
    const metal = mat === 'metal';
    for (let i = 0; i < (metal ? 9 : 3); i++) spawn('spark', p, rv(metal ? 7 : 4).addScaledVector(n, metal ? 4 : 2));
    const dc = mat === 'wood' ? _c.setRGB(0.4, 0.3, 0.2) : mat === 'concrete' ? _c.setRGB(0.55, 0.53, 0.5) : _c.setRGB(0.3, 0.3, 0.3);
    for (let i = 0; i < (metal ? 2 : 4); i++) spawn('dust', p, rv(0.8).addScaledVector(n, 1.3), { color: dc, alpha: 0.55, size: mr(0.15, 0.3), life: mr(0.6, 1.3) });
    if (mat !== 'none') decal(p, n);
    light(p, 1.5, 0.05, 4);
  }
  function decal(p, n) {
    const m = decals[decalI++ % decals.length];
    m.position.copy(p).addScaledVector(n, 0.004);
    _fq.setFromUnitVectors(Z_AXIS, n); m.quaternion.copy(_fq); m.rotateZ(Math.random() * TAU);
    m.scale.setScalar(mr(0.8, 1.3)); m.visible = true;
  }
  function blood(p, dir, head) {
    for (let i = 0; i < (head ? 10 : 5); i++) spawn('blood', p, rv(head ? 2.5 : 1.5).addScaledVector(dir, 1.5), { alpha: 0.85, size: mr(0.12, 0.28), life: mr(0.4, 0.9) });
  }
  function tracer(a, b, enemy = false) {
    const t = tracers.find(x => x.life <= 0 && x.enemy === enemy); if (!t) return;
    const L = a.distanceTo(b); if (L < 2) return;
    t.a = a.clone(); t.b = b.clone(); t.L = L; t.d = 0; t.speed = enemy ? 160 : 420; t.life = L / t.speed + 0.02;
    t.m.visible = true; t.m.position.copy(a); t.m.lookAt(b); t.m.scale.set(enemy ? 0.03 : 0.022, enemy ? 0.03 : 0.022, 0.01);
  }
  function light(p, intensity, life, dist = 10, col) {
    let best = lights[0]; for (const l of lights) if (l.life <= 0) { best = l; break; } else if (l.life < best.life) best = l;
    best.l.position.copy(p); best.l.distance = dist; best.peak = intensity; best.life = best.max = life;
    best.l.color.set(col || 0xffb060);
  }
  // 持续冒烟（被破坏的中继站）
  function emitter(p, rate = 6, color = null) { const e = { p: p.clone(), rate, acc: 0, color: color ? new THREE.Color(color) : null }; emitters.push(e); return e; }
  function explode(p) {
    for (let i = 0; i < 40; i++) spawn('spark', p, rv(10, 0.6), { life: mr(0.3, 1.0), size: 0.08 });
    for (let i = 0; i < 12; i++) spawn('ember', p, rv(4, 0.8), { life: mr(0.8, 2), size: 0.1 });
    for (let i = 0; i < 10; i++) spawn('smoke', p, rv(1.5, 0.6), { color: _c.setRGB(0.12, 0.12, 0.12), alpha: 0.8, size: mr(0.8, 1.6), life: mr(2.5, 5) });
    spawn('flash', p, _fv.set(0, 0, 0), { size: 4, life: 0.12 });
    light(p, 40, 0.35, 22);
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const q = live[i]; q.age += dt;
      if (q.age >= q.life) { q.sp.visible = false; free.push(q.sp); live[i] = live[live.length - 1]; live.pop(); continue; }
      const k = q.age / q.life;
      q.vel.y -= q.g * dt;
      if (q.kind === 'smoke' || q.kind === 'dust') q.vel.multiplyScalar(1 - Math.min(1, dt * 1.5));
      q.sp.position.addScaledVector(q.vel, dt);
      if (q.sp.position.y < 0.02 && q.kind !== 'smoke') { q.sp.position.y = 0.02; q.vel.y *= -0.3; q.vel.x *= 0.5; q.vel.z *= 0.5; }
      q.sp.scale.setScalar(q.size * (1 + q.grow * q.age));
      q.sp.material.opacity = q.a0 * (q.kind === 'smoke' ? Math.min(1, q.age * 3) * (1 - k) : 1 - k * k);
    }
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt; t.d += t.speed * dt;
      const len = Math.min(t.enemy ? 4 : 7, t.d, t.L), head = Math.min(t.d, t.L);
      t.m.position.lerpVectors(t.a, t.b, head / t.L); t.m.scale.z = len;
      t.m.lookAt(t.b); // 几何体沿 -Z 延伸，即拖尾在弹头后方
      if (t.life <= 0 || t.d - len >= t.L) { t.life = 0; t.m.visible = false; }
    }
    for (const l of lights) { if (l.life > 0) { l.life -= dt; l.l.intensity = l.peak * Math.max(0, l.life / l.max); } else l.l.intensity = 0; }
    for (const e of emitters) {
      e.acc += dt * e.rate;
      while (e.acc > 1) { e.acc--; spawn('smoke', _fv.set(e.p.x + mr(-0.2, 0.2), e.p.y, e.p.z + mr(-0.2, 0.2)), _fv.clone().set(mr(-0.2, 0.2), mr(0.8, 1.5), mr(-0.2, 0.2)).add(V(0.3, 0, 0.15)), { color: e.color || _c.setRGB(0.1, 0.1, 0.1), alpha: 0.7, size: mr(0.4, 0.8), life: mr(3, 5), grow: 0.7 }); if (!e.color && Math.random() < 0.3) spawn('ember', e.p, rv(1, 1.5), { life: mr(0.5, 1.2) }); }
    }
  }
  return { init, spawn, impact, blood, tracer, light, emitter, explode, update, decal };
})();
