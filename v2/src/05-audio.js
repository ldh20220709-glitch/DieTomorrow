// ======================= 05 AUDIO =======================
const SFX = (() => {
  let ctx = null, master = null, nbuf = null, ambG = null;
  const _ar = V(), _ad = V();
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(comp);
    nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 环境：海浪（低通褐噪声 + 慢速起伏）与风
    ambG = ctx.createGain(); ambG.gain.value = 0.0; ambG.connect(master);
    const wave = src(true), wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 380;
    const wg = ctx.createGain(); wg.gain.value = 0.22; wave.connect(wl).connect(wg).connect(ambG); wave.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.14; lfo.connect(lg).connect(wg.gain); lfo.start();
    const wind = src(true), wb = ctx.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 700; wb.Q.value = 0.6;
    const wn = ctx.createGain(); wn.gain.value = 0.05; wind.connect(wb).connect(wn).connect(ambG); wind.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05; const lg2 = ctx.createGain(); lg2.gain.value = 300; lfo2.connect(lg2).connect(wb.frequency); lfo2.start();
    ambG.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
  }
  function src(loop = false) { const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = loop; return s; }
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function tone(type, f0, f1, dur, vol, t, out = master) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.003, vol, dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(dur, c0, c1, vol, t, type = 'lowpass', out = master, q = 0.7) {
    const n = src(); const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(c0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, c1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.002, vol, dur); n.connect(f).connect(g).connect(out);
    n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
  }
  // 3D：按相机朝向做声像与距离衰减（远处再加低通）
  function at(pos, ref = 10) {
    _ad.subVectors(pos, camera.position); const dist = _ad.length();
    _ar.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const pan = ctx.createStereoPanner(); pan.pan.value = clamp(_ad.dot(_ar) / Math.max(dist, 1), -1, 1) * 0.85;
    const g = ctx.createGain(); g.gain.value = ref / (ref + dist);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + dist / 25), 900, 18000);
    lp.connect(g).connect(pan).connect(master);
    return { node: lp, dist };
  }
  const ok = () => !!ctx;
  const T = () => ctx.currentTime;
  return {
    init, ok,
    rifle() { if (!ok()) return; const t = T(); burst(0.22, 5200, 180, 0.9, t); tone('triangle', 150, 38, 0.14, 0.75, t); burst(0.05, 9000, 4000, 0.35, t, 'highpass'); burst(0.6, 900, 120, 0.16, t + 0.03); },
    pistol() { if (!ok()) return; const t = T(); burst(0.16, 4200, 300, 0.75, t); tone('triangle', 220, 60, 0.1, 0.6, t); burst(0.04, 9000, 5000, 0.3, t, 'highpass'); burst(0.45, 800, 150, 0.12, t + 0.03); },
    enemyShot(pos) { if (!ok()) return; const t = T(), a = at(pos, 14); burst(0.2, 3600, 160, 0.9, t, 'lowpass', a.node); tone('square', 300, 70, 0.1, 0.25, t, a.node); burst(0.7, 700, 100, 0.25, t + 0.04 + a.dist / 340, 'lowpass', a.node); },
    whiz(pos) { if (!ok()) return; const t = T(), a = at(pos, 2); burst(0.12, 2600, 900, 0.5, t, 'bandpass', a.node, 3); },
    impact(pos, mat) {
      if (!ok()) return; const t = T(), a = at(pos, 6);
      if (mat === 'metal') { tone('sine', mr(1800, 3200), mr(900, 1500), 0.16, 0.18, t, a.node); burst(0.05, 6000, 2000, 0.3, t, 'highpass', a.node); }
      else if (mat === 'wood') burst(0.08, 1500, 300, 0.4, t, 'lowpass', a.node);
      else burst(0.07, 3000, 500, 0.35, t, 'lowpass', a.node);
    },
    flesh(pos) { if (!ok()) return; const t = T(), a = at(pos, 6); burst(0.08, 900, 200, 0.6, t, 'lowpass', a.node); },
    hit() { if (!ok()) return; const t = T(); tone('square', 1500, 1100, 0.035, 0.12, t); },
    headshot() { if (!ok()) return; const t = T(); tone('sine', 2100, 1500, 0.07, 0.25, t); tone('sine', 2800, 2000, 0.09, 0.18, t + 0.04); },
    kill() { if (!ok()) return; const t = T(); tone('sine', 900, 600, 0.12, 0.2, t + 0.05); },
    enemyDie(pos) { if (!ok()) return; const t = T(), a = at(pos, 6); tone('sawtooth', 240, 70, 0.35, 0.18, t, a.node); burst(0.25, 600, 120, 0.4, t + 0.25, 'lowpass', a.node); },
    hurt() { if (!ok()) return; const t = T(); burst(0.14, 700, 120, 0.7, t); tone('sine', 120, 50, 0.2, 0.6, t); },
    die() { if (!ok()) return; const t = T(); tone('sine', 220, 30, 1.6, 0.6, t); burst(1.2, 600, 40, 0.5, t); ambG.gain.linearRampToValueAtTime(0.15, t + 2); },
    reload(kind) {
      if (!ok()) return; const t = T(), k = kind === 'pistol' ? 0.7 : 1;
      burst(0.05, 2500, 900, 0.35, t + 0.15 * k); tone('square', 600, 400, 0.03, 0.12, t + 0.17 * k);
      burst(0.06, 3500, 1200, 0.4, t + 0.95 * k); tone('square', 900, 700, 0.03, 0.18, t + 0.97 * k);
      burst(0.05, 5000, 2000, 0.45, t + 1.55 * k, 'highpass'); tone('square', 1300, 900, 0.03, 0.2, t + 1.56 * k);
    },
    empty() { if (!ok()) return; const t = T(); tone('square', 1700, 1500, 0.03, 0.15, t); },
    swap() { if (!ok()) return; const t = T(); burst(0.08, 2000, 600, 0.3, t); tone('square', 800, 600, 0.03, 0.12, t + 0.12); },
    step(sprint) { if (!ok()) return; const t = T(); burst(0.06, sprint ? 900 : 650, 120, sprint ? 0.22 : 0.14, t); burst(0.03, 4000, 2000, 0.03, t + 0.01, 'highpass'); },
    land() { if (!ok()) return; const t = T(); burst(0.14, 500, 70, 0.45, t); },
    beep(p = 1) { if (!ok()) return; const t = T(); tone('sine', 880 * p, 880 * p, 0.06, 0.12, t); },
    relayDown(pos) { if (!ok()) return; const t = T(), a = at(pos, 8); burst(0.5, 6000, 300, 0.6, t, 'lowpass', a.node); tone('sawtooth', 600, 40, 0.9, 0.3, t, a.node); for (let i = 0; i < 4; i++) burst(0.04, 8000, 3000, 0.25, t + 0.1 + i * 0.13, 'highpass', a.node); },
    radio() { if (!ok()) return; const t = T(); burst(0.12, 3000, 1500, 0.12, t, 'bandpass', master, 2); tone('square', 1400, 1400, 0.04, 0.05, t + 0.12); },
    pickup() { if (!ok()) return; const t = T(); [660, 990].forEach((f, i) => tone('sine', f, f, 0.08, 0.18, t + i * 0.06)); },
    alarm() { if (!ok()) return; const t = T(); for (let i = 0; i < 3; i++) { tone('square', 520, 520, 0.22, 0.07, t + i * 0.5); tone('square', 390, 390, 0.22, 0.07, t + i * 0.5 + 0.25); } },
    heli(on) { if (!ok()) return; const t = T(); for (let i = 0; i < 30; i++) burst(0.09, 300, 80, on * (0.15 + i / 60), t + i * 0.12); },
    win() { if (!ok()) return; const t = T(); [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.5, 0.18, t + i * 0.18)); }
  };
})();
