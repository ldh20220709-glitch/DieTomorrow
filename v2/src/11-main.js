// ======================= 11 MAIN：输入 / 玩家 / 任务 / 主循环 =======================
const keys = {};
const input = { fire: false, ads: false, reload: false, jump: false };
let gameState = 'loading', clockT = 0, startT = 0, mouseDX = 0;
const fxState = { damage: 0, flash: 0, shake: 0 };
const MISSION = { phase: 'relays', cut: 0, holdT: 45, holdMax: 45, dirT: 20, heli: null, smoke: null, endT: 0 };
const RELAY_NAME = ['', 'A', 'B', 'C'];
const _mv = V(), _mf = V();

// ---------- 撤离直升机 ----------
function buildHeli() {
  const g = new THREE.Group(), B = new Builder();
  B.box(M.dark, 0, 0, 0, 2.4, 2.2, 6.5); B.box(M.dark, 0, 0.4, -3.6, 2.0, 1.6, 1.2);
  B.box(M.glass, 0, 0.5, -4.25, 1.8, 1.0, 0.3, 0, 0.3, 0, 1);
  B.box(M.dark, 0, 0.6, 6.5, 0.5, 0.6, 7); B.box(M.dark, 0, 1.8, 9.8, 0.2, 2.4, 1.2);
  B.box(M.dark, 0, 1.4, 0, 1.2, 0.6, 2.0);
  for (const s of [-1, 1]) { B.box(M.galv, s * 1.1, -1.5, 0, 0.1, 0.1, 5.4); B.box(M.galv, s * 1.1, -1.25, -1.5, 0.08, 0.5, 0.08); B.box(M.galv, s * 1.1, -1.25, 1.5, 0.08, 0.5, 0.08); }
  B.build(g, true, false);
  const rotor = new THREE.Group(); rotor.position.y = 1.85; g.add(rotor);
  for (let i = 0; i < 4; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 7.5), M.dark); bl.position.z = 3.75; const p = new THREE.Group(); p.rotation.y = i * Math.PI / 2; p.add(bl); rotor.add(p); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), M.beacon); lamp.position.set(0, -1.1, 0); lamp.layers.set(3); g.add(lamp);
  g.visible = false; scene.add(g);
  return { g, rotor };
}

// ---------- 任务 ----------
function relayMarkers() {
  const mk = [];
  if (MISSION.phase === 'relays') for (const r of WORLD.relays) { if (!r.done) mk.push({ p: V(r.pos.x, 2.4, r.pos.z - 0.6), label: '中继站 ' + RELAY_NAME[r.id], k: r.progress }); }
  else mk.push({ p: V(WORLD.extract.x, 2, WORLD.extract.z), label: '撤离点' });
  HUD.setMarkers(mk);
}
function spawnInitial() {
  buildFlow(PLAYER.pos.x, PLAYER.pos.z);
  const guards = [['rifleman', 'rifleman', 'rusher'], ['rifleman', 'gunner', 'rifleman'], ['rifleman', 'rusher', 'gunner']];
  WORLD.relays.forEach((r, i) => {
    for (const t of guards[i]) {
      for (let k = 0; k < 30; k++) { const x = r.pos.x + rr(-10, 10), z = r.pos.z + rr(-10, 10); if (navFree(x, z) && Math.hypot(x - r.pos.x, z - r.pos.z) > 3) { Enemies.spawn(t, x, z); break; } }
    }
  });
  for (const [x, z] of [[-20, 12], [24, 0], [-44, -36], [48, -30]]) if (navFree(x, z)) Enemies.spawn(pick(['rifleman', 'rusher']), x, z);
}
function reinforce(n, alert = true) {
  for (let i = 0; i < n; i++) {
    if (Enemies.alive() >= 11) return;
    const p = Enemies.findSpawn(); if (!p) return;
    const t = Math.random() < 0.2 ? 'gunner' : Math.random() < 0.45 ? 'rusher' : 'rifleman';
    Enemies.spawn(t, p.x, p.z, { alert });
  }
}
function cutRelay(r) {
  r.done = true; MISSION.cut++;
  r.scrMat.color.setRGB(0.5, 0.03, 0.02); r.lightMat.color.setRGB(0.15, 0.0, 0.0); r.cabMat.color.setHex(0x3a3634);
  const p = V(r.pos.x, 1.4, r.pos.z - 0.4);
  FX.explode(p); FX.emitter(V(r.pos.x, 2.1, r.pos.z - 0.6), 5);
  SFX.relayDown(p); fxState.shake = 0.6;
  HUD.objective('切断三座上行中继站', `中继站 ${MISSION.cut} / 3`);
  Enemies.noise(p, 90);
  if (MISSION.cut === 1) { HUD.radio('灯塔', '第一座下线。敌人察觉了，增援正在赶来。'); setTimeout(() => SFX.alarm(), 1200); reinforce(3); }
  else if (MISSION.cut === 2) { HUD.radio('灯塔', '第二座也断了。还剩最后一座，坚持住。'); reinforce(4); }
  else {
    MISSION.phase = 'extract';
    HUD.banner('中继站全部切断', 'ALL RELAYS DOWN');
    HUD.radio('灯塔', '无人机群失去制导！前往西侧岸桥下的撤离点，直升机待命。', 5.5);
    HUD.objective('前往撤离点', '西侧 · 第一岸桥下');
    MISSION.smoke = FX.emitter(V(WORLD.extract.x, 0.3, WORLD.extract.z), 7, new THREE.Color(0.25, 0.9, 0.35));
    reinforce(4);
  }
  relayMarkers();
}
function updateMission(dt) {
  let promptHtml = null;
  if (MISSION.phase === 'relays') {
    for (const r of WORLD.relays) {
      if (r.done) continue;
      const d = Math.hypot(PLAYER.pos.x - r.pos.x, PLAYER.pos.z - r.pos.z);
      if (d < 2.3) {
        if (keys.KeyE && PLAYER.alive) {
          const before = r.progress; r.progress = Math.min(1, r.progress + dt / 3.2);
          if (Math.floor(before * 8) !== Math.floor(r.progress * 8)) SFX.beep(1 + r.progress * 0.5);
          r.scrMat.color.setRGB(1.6, 1.6 - r.progress, 1.6 - r.progress * 1.4);
          if (r.progress >= 1) { cutRelay(r); continue; }
        }
        promptHtml = `<kbd>E</kbd>长按 切断中继站 ${RELAY_NAME[r.id]}` + (r.progress > 0 ? ` · ${Math.round(r.progress * 100)}%` : '');
      }
    }
    // 持续施压：堆场里的巡逻会补员
    MISSION.dirT -= dt;
    if (MISSION.dirT <= 0) { MISSION.dirT = 22; if (Enemies.alive() < 5 + MISSION.cut) reinforce(1 + MISSION.cut, MISSION.cut > 0); }
  } else if (MISSION.phase === 'extract') {
    const d = Math.hypot(PLAYER.pos.x - WORLD.extract.x, PLAYER.pos.z - WORLD.extract.z);
    if (d < 9) {
      MISSION.phase = 'hold'; MISSION.dirT = 2;
      HUD.radio('灯塔', '收到。“渡鸦”预计 45 秒后抵达，守住撤离区！', 5);
      HUD.banner('坚守撤离区', 'HOLD THE LZ'); SFX.alarm(); Enemies.alertAll();
    }
  } else if (MISSION.phase === 'hold') {
    const d = Math.hypot(PLAYER.pos.x - WORLD.extract.x, PLAYER.pos.z - WORLD.extract.z);
    const inside = d < 13;
    if (inside) MISSION.holdT = Math.max(0, MISSION.holdT - dt);
    else promptHtml = '返回撤离区！';
    HUD.objective('坚守撤离区', inside ? `直升机抵达 ${Math.ceil(MISSION.holdT)} 秒` : '计时暂停 · 返回撤离区');
    MISSION.dirT -= dt;
    if (MISSION.dirT <= 0) { MISSION.dirT = 6.5; reinforce(2); }
    // 直升机进场
    const h = MISSION.heli, k = 1 - MISSION.holdT / 16;
    if (k > 0) {
      if (!h.g.visible) { h.g.visible = true; SFX.heli(0.6); HUD.radio('渡鸦', '渡鸦进场，看到绿烟了。', 3.5); }
      const e = ss(0, 1, k);
      h.g.position.set(WORLD.extract.x + (1 - e) * 30, lerp(70, 7.5, e), lerp(-260, WORLD.extract.z - 2, e));
      h.g.rotation.set(-0.15 * (1 - e) + Math.sin(clockT * 0.8) * 0.02, 0.2 * (1 - e), Math.sin(clockT * 0.6) * 0.03);
    }
    if (MISSION.holdT <= 0 && inside) win();
  }
  if (MISSION.heli && MISSION.heli.g.visible) MISSION.heli.rotor.rotation.y += dt * 28;
  HUD.prompt(promptHtml);
  relayMarkers();
}

// ---------- 玩家 ----------
const Game = {
  hurt(d, from) {
    if (!PLAYER.alive || gameState !== 'playing') return;
    PLAYER.hp -= d; PLAYER.lastHurt = clockT; fxState.damage = Math.min(1, fxState.damage + 0.55 + d / 40);
    HUD.hurtFrom(from); SFX.hurt(); fxState.shake = Math.max(fxState.shake, 0.15);
    if (PLAYER.hp <= 0) die();
  }
};
function die() {
  PLAYER.alive = false; PLAYER.hp = 0; gameState = 'dead'; MISSION.endT = clockT; SFX.die(); HUD.prompt(null);
  HUD.banner('阵亡', 'KIA', 3);
  setTimeout(() => endScreen(false), 2600);
}
function win() {
  MISSION.phase = 'done'; gameState = 'won'; MISSION.endT = clockT; SFX.win(); HUD.prompt(null);
  HUD.banner('任务完成', 'MISSION COMPLETE', 4);
  HUD.radio('灯塔', '干得漂亮。“潮汐断点”行动结束，欢迎回家。', 4);
  setTimeout(() => endScreen(true), 3200);
}
function endScreen(ok) {
  document.exitPointerLock && document.exitPointerLock();
  const t = MISSION.endT - startT, mm = Math.floor(t / 60), sec = Math.floor(t % 60);
  const acc = PLAYER.shots ? Math.round(PLAYER.hits / PLAYER.shots * 100) : 0;
  $('obox').innerHTML = `<h1>${ok ? 'MISSION<br>COMPLETE' : 'MISSION<br>FAILED'}<small>${ok ? '任务完成 · 成功撤离' : '任务失败 · 你阵亡了'}</small></h1>
    <div class="stat">用时 <b>${mm}:${String(sec).padStart(2, '0')}</b><br>中继站 <b>${MISSION.cut} / 3</b><br>击杀 <b>${PLAYER.kills}</b> · 爆头 <b>${PLAYER.heads}</b><br>命中率 <b>${acc}%</b></div>
    <div class="go">点击重新开始</div>`;
  $('overlay').style.display = 'flex'; HUD.show(false);
}
function updatePlayer(dt) {
  const P = PLAYER;
  if (P.alive) {
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const crouchWant = keys.KeyC || keys.ControlLeft;
    if (crouchWant) P.proneOn = false;
    P.crouch = damp(P.crouch, crouchWant ? 1 : 0, 12, dt);
    P.prone = damp(P.prone, P.proneOn ? 1 : 0, 6, dt);
    P.sprint = (keys.ShiftLeft || keys.ShiftRight) && fwd > 0 && !crouchWant && !P.proneOn && !input.fire && !input.ads && P.onGround;
    const spd = (P.sprint ? 7.2 : lerp(lerp(4.6, 2.3, P.crouch), 1.2, P.prone)) * (Weapon.ads > 0.5 ? 0.62 : 1);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    _mv.set(-sy * fwd + cy * str, 0, -cy * fwd - sy * str);
    if (_mv.lengthSq() > 0) _mv.normalize().multiplyScalar(spd);
    const accel = P.onGround ? 13 : 2.5;
    P.vel.x = damp(P.vel.x, _mv.x, accel, dt); P.vel.z = damp(P.vel.z, _mv.z, accel, dt);
    if (input.jump && P.proneOn) P.proneOn = false; // 匍匐时按跳跃 = 起身
    else if (input.jump && P.onGround && P.crouch < 0.5 && P.prone < 0.3) { P.vel.y = 5.6; P.onGround = false; }
  } else { P.vel.x *= 0.9; P.vel.z *= 0.9; }
  input.jump = false;
  P.vel.y -= 18 * dt;
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  const height = lerp(lerp(1.8, 1.25, P.crouch), 0.6, P.prone);
  collideCircle(P.pos, 0.35, P.pos.y, height);
  const gnd = groundAt(P.pos.x, P.pos.z, P.pos.y, 0.35);
  P.pos.y += P.vel.y * dt;
  if (P.pos.y <= gnd) {
    if (!P.onGround && P.vel.y < -3) { P.land = Math.min(1, -P.vel.y / 8); SFX.land(); }
    P.pos.y = gnd; P.vel.y = 0; P.onGround = true;
  } else if (P.pos.y > gnd + 0.06) P.onGround = false;
  P.speed = Math.hypot(P.vel.x, P.vel.z);
  // 镜头
  if (P.onGround && P.speed > 0.5) {
    const prev = P.bob; P.bob += dt * P.speed * 1.75;
    if (Math.floor(prev / Math.PI) !== Math.floor(P.bob / Math.PI)) SFX.step(P.sprint);
  }
  P.land = damp(P.land, 0, 6, dt);
  P.swayX = damp(P.swayX, clamp(-mouseDX * 0.00025, -0.03, 0.03), 8, dt); mouseDX = 0;
  P.swayY = damp(P.swayY, clamp(-P.vel.y * 0.003, -0.02, 0.02), 8, dt);
  const bobA = P.onGround ? clamp(P.speed / 5, 0, 1.4) * (1 - Weapon.ads * 0.8) : 0;
  P.eye = P.alive ? lerp(lerp(1.62, 1.08, P.crouch), 0.4, P.prone) : damp(P.eye, 0.35, 3, dt);
  const sh = fxState.shake; fxState.shake = Math.max(0, sh - dt);
  camera.position.set(P.pos.x, P.pos.y + P.eye + Math.sin(P.bob * 2) * 0.04 * bobA - P.land * 0.12, P.pos.z);
  camera.rotation.set(
    P.pitch + (Math.random() - 0.5) * sh * 0.04,
    P.yaw + (Math.random() - 0.5) * sh * 0.04,
    Math.sin(P.bob) * 0.008 * bobA + (P.alive ? 0 : damp(camera.rotation.z, 0.5, 2, dt)));
  // 回血
  if (P.alive && clockT - P.lastHurt > 5 && P.hp < 100) P.hp = Math.min(100, P.hp + 14 * dt);
  HUD.hp(P.hp);
  // 视野：开镜拉近
  const fov = lerp(72, Weapon.def().adsFov, Weapon.ads) + (P.sprint ? 4 : 0);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = damp(camera.fov, fov, 16, dt); camera.updateProjectionMatrix(); }
}

// ---------- 输入 ----------
addEventListener('keydown', e => {
  if (e.repeat && e.code !== 'KeyE') return;
  keys[e.code] = true;
  if (gameState !== 'playing') return;
  if (e.code === 'Space') input.jump = true;
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'KeyZ') PLAYER.proneOn = !PLAYER.proneOn;
  if (e.code === 'Digit1') Weapon.swap(0);
  if (e.code === 'Digit2') Weapon.swap(1);
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code) || (e.ctrlKey && e.code !== 'KeyR')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousedown', e => { if (gameState !== 'playing') return; if (e.button === 0) input.fire = true; if (e.button === 2) input.ads = true; });
addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; if (e.button === 2) input.ads = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (gameState === 'playing') Weapon.swap(Weapon.cur === 0 ? 1 : 0); }, { passive: true });
addEventListener('mousemove', e => {
  if (gameState !== 'playing' || document.pointerLockElement !== canvas) return;
  const s = 0.0021 * (Weapon.ads > 0.5 ? 0.62 : 1);
  const mx = clamp(e.movementX, -300, 300), my = clamp(e.movementY, -300, 300);
  PLAYER.yaw -= mx * s; PLAYER.pitch = clamp(PLAYER.pitch - my * s, -1.5, 1.5); mouseDX += mx;
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.fire = input.ads = false; });
$('overlay').addEventListener('click', () => {
  if (gameState === 'loading') return;
  if (gameState === 'dead' || gameState === 'won') { location.reload(); return; }
  SFX.init();
  canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    $('overlay').style.display = 'none';
    if (gameState === 'ready') startGame();
    else if (gameState === 'paused') { gameState = 'playing'; HUD.show(true); }
  } else if (gameState === 'playing') {
    gameState = 'paused'; input.fire = input.ads = false; for (const k in keys) keys[k] = false;
    $('obox').innerHTML = `<h1>已暂停<small>PAUSED</small></h1><div class="keys">${KEYS_HTML}</div><div class="go">点击继续</div>`;
    $('overlay').style.display = 'flex'; HUD.show(false);
  }
});
document.addEventListener('pointerlockerror', () => {
  $('obox').innerHTML = '<h1>无法锁定鼠标<small>POINTER LOCK</small></h1><p>请直接用浏览器打开本 HTML 文件后再点击（部分内嵌页面会禁止指针锁定）。</p><div class="go">点击重试</div>';
});
const KEYS_HTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动　<kbd>Shift</kbd> 冲刺　<kbd>C</kbd> 蹲伏　<kbd>Z</kbd> 匍匐　<kbd>Space</kbd> 跳跃<br><kbd>左键</kbd> 射击　<kbd>右键</kbd> 瞄准　<kbd>R</kbd> 换弹　<kbd>1</kbd><kbd>2</kbd> / 滚轮 切枪<br><kbd>E</kbd> 长按交互　<kbd>Esc</kbd> 暂停';

function startGame() {
  gameState = 'playing'; startT = clockT;
  HUD.show(true);
  HUD.banner('潮汐断点', 'OPERATION TIDEBREAK · 第 7 泊位 · 05:40', 3.6);
  HUD.radio('灯塔', '这里是灯塔，“潮汐断点”行动开始。三座上行中继站的坐标已推送到你的 HUD。', 5);
  HUD.radio('灯塔', '堆场里有巡逻队。蹲下或匍匐更不易被发现，到中继站旁长按 E 切断它。', 5);
}

// ---------- 启动 ----------
function resize() {
  const pr = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  gunCam.aspect = camera.aspect; gunCam.updateProjectionMatrix();
  Post.resize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
  renderer.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr), false);
  HUD.resize();
}
(async () => {
  const prog = (t, p) => { $('ldt').textContent = t; $('ldb').style.width = (p * 100) + '%'; };
  await genAllTextures(prog);
  prog('搭建码头', 0.65); await nextFrame();
  buildMaterials(); buildSky();
  prog('布置堆场', 0.75); await nextFrame();
  buildWorld(); FX.init(); Weapon.build(); Enemies.init();
  MISSION.heli = buildHeli();
  PLAYER.pos.copy(WORLD.spawn); PLAYER.yaw = 0; PLAYER.pitch = 0.02;
  spawnInitial();
  prog('编译着色器', 0.88); await nextFrame();
  resize(); addEventListener('resize', resize);
  camera.position.set(PLAYER.pos.x, PLAYER.eye, PLAYER.pos.z); camera.updateMatrixWorld();
  renderer.compile(scene, camera); renderer.compile(gunScene, gunCam);
  HUD.objective('切断三座上行中继站', '中继站 0 / 3'); relayMarkers();
  gameState = 'ready';
  $('obox').innerHTML = `<h1>DIE<br>TOMORROW<small>明日再死</small></h1>
    <div class="op">战役<b>潮汐断点 · OPERATION TIDEBREAK</b></div>
    <div class="brief" style="margin-top:14px"><p>05:40，第 7 泊位。敌方在集装箱堆场里架设了三座卫星上行中继站，为海上的无人机群提供制导。</p>
    <p>潜入堆场，逐一切断中继站，然后到西侧岸桥下的撤离点等待直升机。</p></div>
    <div class="keys">${KEYS_HTML}</div><div class="go">点击开始任务</div>`;
  const clock = new THREE.Clock();
  let fpsAcc = 0, fpsN = 0;
  window.__frames = 0;
  (function loop() {
    requestAnimationFrame(loop);
    const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05);
    U.time.value += dt;
    fpsAcc += rawDt; fpsN++; if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0; }
    const live = gameState === 'playing' || gameState === 'dead' || gameState === 'won';
    if (live) {
      clockT += dt;
      updatePlayer(dt);
      Weapon.update(dt, clockT, input); input.reload = false;
      Enemies.update(dt, clockT, window.__g && window.__g.freeze);
      if (gameState === 'playing') updateMission(dt);
      else if (MISSION.heli && MISSION.heli.g.visible) MISSION.heli.rotor.rotation.y += dt * 28;
      FX.update(dt);
    } else if (gameState === 'ready') {
      // 标题画面：镜头缓慢环视
      const t = U.time.value * 0.05;
      camera.position.set(WORLD.spawn.x + Math.sin(t) * 3, 2.2, WORLD.spawn.z + 2); camera.rotation.set(0.06, Math.sin(t * 0.7) * 0.35, 0);
      Weapon.update(0, clockT, { fire: false, ads: false });
    }
    fxState.damage = Math.max(0, fxState.damage - dt * 1.4);
    HUD.update(dt);
    camera.updateMatrixWorld(); updateFogUniforms(); updateSky(dt, U.time.value);
    Post.render(gunScene, gunCam, { damage: fxState.damage, lowHp: PLAYER.alive ? clamp((45 - PLAYER.hp) / 45, 0, 1) : 1, flash: fxState.flash, ads: Weapon.ads });
    window.__frames++;
  })();
  window.__g = { PLAYER, Enemies, Weapon, MISSION, WORLD, Game, input, keys, get state() { return gameState; }, get t() { return clockT; }, cut: cutRelay, freeze: false, photo(on) { gunCam.visible = !on; HUD.show(!on); }, poseAll(p) { for (const e of Enemies.list) if (e.frozen) e.dbgPose = p; } };
})().catch(e => { console.error(e.stack || e); $('ldt').textContent = '加载失败：' + e.message; });
