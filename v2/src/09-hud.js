// ======================= 09 HUD =======================
const HUD = (() => {
  const hc = $('hudc'), g = hc.getContext('2d');
  let W = 1, H = 1, dpr = 1, hitT = 0, hitKill = false, hitHead = false, radioT = 0, bannerT = 0;
  const dmgDirs = [], radioQ = [], markers = [];
  const _hp = V();
  function resize() { dpr = Math.min(devicePixelRatio, 2); W = innerWidth; H = innerHeight; hc.width = W * dpr; hc.height = H * dpr; }
  function show(on) { $('hud').classList.toggle('on', on); }
  function ammo(mag, res, name, low) { $('mag').textContent = mag; $('res').textContent = '/ ' + res; $('wname').textContent = name; $('mag').classList.toggle('low', low); }
  function hp(v) { const b = $('hpb'); b.style.width = clamp(v, 0, 100) + '%'; b.style.background = v < 35 ? 'var(--red)' : 'var(--hud)'; }
  function objective(t, s) { $('objT').textContent = t; $('objS').textContent = s || ''; }
  let lastPrompt = null;
  function prompt(html) { if (html === lastPrompt) return; lastPrompt = html; const p = $('prompt'); if (html) { p.innerHTML = html; p.style.opacity = 1; } else p.style.opacity = 0; }
  function feed(t) { const f = $('feed'), d = document.createElement('div'); d.textContent = t; f.appendChild(d); setTimeout(() => d.remove(), 1500); while (f.children.length > 3) f.firstChild.remove(); }
  function radio(who, txt, dur = 4.5) { radioQ.push({ who, txt, dur }); }
  function banner(t, s, dur = 3.5) { const b = $('banner'); b.querySelector('.t').textContent = t; b.querySelector('.s').textContent = s || ''; b.style.opacity = 1; bannerT = dur; }
  function hitmark(kill, head) { hitT = kill ? 0.35 : 0.18; hitKill = kill; hitHead = head; }
  function hurtFrom(p) { dmgDirs.push({ p: p.clone(), t: 1.2 }); if (dmgDirs.length > 6) dmgDirs.shift(); }
  function setMarkers(arr) { markers.length = 0; markers.push(...arr); }
  function update(dt) {
    // 无线电字幕队列
    if (radioT > 0) { radioT -= dt; if (radioT <= 0) $('radio').style.opacity = 0; }
    else if (radioQ.length) { const r = radioQ.shift(); const el = $('radio'); el.querySelector('.who').textContent = r.who; el.querySelector('.txt').textContent = r.txt; el.style.opacity = 1; radioT = r.dur; SFX.radio(); }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').style.opacity = 0; }
    hitT -= dt;
    for (let i = dmgDirs.length - 1; i >= 0; i--) { dmgDirs[i].t -= dt; if (dmgDirs[i].t <= 0) dmgDirs.splice(i, 1); }
    draw();
  }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!PLAYER.alive || !$('hud').classList.contains('on')) return;
    const cx = W / 2, cy = H / 2;
    g.lineCap = 'round';
    // 准星：腰射时随散布扩张，开镜时隐藏（使用枪上的瞄具）
    const a = 1 - Weapon.ads * 1.6;
    if (a > 0 && !PLAYER.sprint) {
      const gap = 5 + Weapon.spread * H * 0.9;
      g.globalAlpha = a; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3.5;
      const lines = () => { g.beginPath(); g.moveTo(cx - gap - 8, cy); g.lineTo(cx - gap, cy); g.moveTo(cx + gap, cy); g.lineTo(cx + gap + 8, cy); g.moveTo(cx, cy + gap); g.lineTo(cx, cy + gap + 8); g.moveTo(cx, cy - gap - 8); g.lineTo(cx, cy - gap); g.stroke(); };
      lines(); g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 1.5; lines();
      g.fillStyle = '#fff'; g.fillRect(cx - 1, cy - 1, 2, 2); g.globalAlpha = 1;
    }
    // 换弹进度环
    if (Weapon.reloading) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + Weapon.reloadK * TAU); g.stroke(); }
    // 命中标记
    if (hitT > 0) {
      const s = hitKill ? 11 : 8, o = 5;
      g.strokeStyle = hitKill ? '#ff3b30' : hitHead ? '#ffb347' : '#fff'; g.lineWidth = hitKill ? 2.5 : 2; g.globalAlpha = clamp(hitT * 6, 0, 1);
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + sx * o, cy + sy * o); g.lineTo(cx + sx * (o + s), cy + sy * (o + s)); }
      g.stroke(); g.globalAlpha = 1;
    }
    // 受击方向
    for (const d of dmgDirs) {
      const ang = Math.atan2(d.p.x - PLAYER.pos.x, d.p.z - PLAYER.pos.z), rel = ang - Math.atan2(-Math.sin(PLAYER.yaw), -Math.cos(PLAYER.yaw));
      const r = Math.min(W, H) * 0.17;
      g.save(); g.translate(cx, cy); g.rotate(-rel);
      g.globalAlpha = clamp(d.t, 0, 1) * 0.85; g.strokeStyle = '#ff3b30'; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, r, -Math.PI / 2 - 0.28, -Math.PI / 2 + 0.28); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
    // 罗盘
    const cw = Math.min(460, W * 0.4), top = 28;
    const heading = ((-PLAYER.yaw * 180 / Math.PI) % 360 + 360) % 360;
    g.save(); g.beginPath(); g.rect(cx - cw / 2, top - 14, cw, 40); g.clip();
    g.font = '600 11px "DIN Alternate","Bahnschrift",sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(232,238,242,.85)'; g.strokeStyle = 'rgba(232,238,242,.55)'; g.lineWidth = 1;
    const ppd = cw / 120;
    for (let deg = Math.floor(heading - 70); deg <= heading + 70; deg++) {
      if (deg % 15) continue;
      const x = cx + (deg - heading) * ppd, dd = ((deg % 360) + 360) % 360;
      const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd];
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + (lbl ? 7 : 4)); g.stroke();
      if (lbl) g.fillText(lbl, x, top - 3); else if (dd % 45 === 0) { g.globalAlpha = 0.55; g.fillText(dd, x, top - 3); g.globalAlpha = 1; }
    }
    for (const mk of markers) {
      const bd = ((Math.atan2(mk.p.x - PLAYER.pos.x, -(mk.p.z - PLAYER.pos.z)) * 180 / Math.PI) + 360) % 360;
      let dd = bd - heading; dd = ((dd + 540) % 360) - 180;
      const x = cx + clamp(dd, -60, 60) * ppd;
      g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(x, top + 10); g.lineTo(x + 4, top + 14); g.lineTo(x, top + 18); g.lineTo(x - 4, top + 14); g.fill();
    }
    g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx, top + 9); g.lineTo(cx - 4, top + 15); g.lineTo(cx + 4, top + 15); g.fill();
    // 世界目标标记
    for (const mk of markers) {
      _hp.copy(mk.p).project(camera);
      const behind = _hp.z > 1;
      let x = (_hp.x * 0.5 + 0.5) * W, y = (-_hp.y * 0.5 + 0.5) * H;
      if (behind) { x = W - x; y = H - 40; }
      const m = 50; const off = behind || x < m || x > W - m || y < m || y > H - m;
      x = clamp(x, m, W - m); y = clamp(y, m + 30, H - m);
      const dist = Math.hypot(mk.p.x - PLAYER.pos.x, mk.p.z - PLAYER.pos.z);
      const near = !off && Math.hypot(x - cx, y - cy) < 60;
      g.globalAlpha = near ? 0.35 : 0.95;
      g.strokeStyle = '#ffb347'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.stroke();
      if (mk.k != null && mk.k > 0) { g.fillStyle = 'rgba(255,179,71,.6)'; g.beginPath(); g.moveTo(x, y + 9); g.lineTo(x + 9 * Math.min(1, mk.k * 2), y + 9 - 9 * Math.min(1, mk.k * 2)); g.lineTo(x - 9 * Math.min(1, mk.k * 2), y + 9 - 9 * Math.min(1, mk.k * 2)); g.fill(); }
      g.font = '600 11px "DIN Alternate","Bahnschrift",sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText(mk.label, x, y - 15); g.fillStyle = 'rgba(232,238,242,.7)'; g.fillText(Math.round(dist) + ' m', x, y + 23);
      g.globalAlpha = 1;
    }
  }
  return { resize, show, ammo, hp, objective, prompt, feed, radio, banner, hitmark, hurtFrom, setMarkers, update };
})();
