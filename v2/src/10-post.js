// ======================= 10 POST PROCESSING =======================
const Post = (() => {
  const type = isGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const opt = { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let W = 1, H = 1, rtScene, h = [], q = [], e = [], occ, god;
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const qg = new THREE.BufferGeometry(); qg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(qg); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const sm = (fs, uni) => new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  const bright = sm(`uniform sampler2D tSrc; uniform vec2 uTex; uniform float uTh; varying vec2 vUv;
    void main(){ vec3 c = (texture2D(tSrc, vUv + uTex * vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(-1.0,1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0,1.0)).rgb) * 0.25;
      c = min(c, vec3(60.0)); float l = max(c.r, max(c.g, c.b)); float k = max(l - uTh, 0.0) / max(l, 1e-4); gl_FragColor = vec4(c * k, 1.0); }`,
    { tSrc: { value: null }, uTex: { value: new THREE.Vector2() }, uTh: { value: 1.0 } });
  const down = sm(`uniform sampler2D tSrc; uniform vec2 uTex; varying vec2 vUv;
    void main(){ gl_FragColor = vec4((texture2D(tSrc, vUv + uTex * vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(-1.0,1.0)).rgb + texture2D(tSrc, vUv + uTex * vec2(1.0,1.0)).rgb) * 0.25, 1.0); }`,
    { tSrc: { value: null }, uTex: { value: new THREE.Vector2() } });
  const blur = sm(`uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270;
      c += (texture2D(tSrc, vUv + uDir * 1.3846153).rgb + texture2D(tSrc, vUv - uDir * 1.3846153).rgb) * 0.3162162;
      c += (texture2D(tSrc, vUv + uDir * 3.2307692).rgb + texture2D(tSrc, vUv - uDir * 3.2307692).rgb) * 0.0702703;
      gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  const godM = sm(`uniform sampler2D tOcc; uniform vec2 uSun; uniform float uAspect; varying vec2 vUv;
    void main(){ vec2 uv = vUv; vec2 d = (uv - uSun) * (0.92 / 56.0); float il = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < 56; i++){ uv -= d; vec3 s = texture2D(tOcc, clamp(uv, 0.001, 0.999)).rgb; acc += max(s - 0.9, 0.0) * il; il *= 0.965; }
      float fall = exp(-length((vUv - uSun) * vec2(uAspect, 1.0)) * 1.2);
      gl_FragColor = vec4(acc / 56.0 * fall, 1.0); }`, { tOcc: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } });
  const comp = sm(`uniform sampler2D tScene, tB1, tB2, tB3, tGod, tOcc; uniform vec2 uSun; uniform float uSunVis, uExposure, uBloom, uGod, uTime, uDamage, uLowHp, uFlash, uAspect, uAds;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main(){
      vec2 uv = vUv, cc = uv - 0.5; float r2 = dot(cc, cc);
      vec2 off = cc * r2 * 0.014;
      vec3 col = vec3(texture2D(tScene, uv - off).r, texture2D(tScene, uv).g, texture2D(tScene, uv + off).b);
      vec3 bl = texture2D(tB1, uv).rgb * 0.45 + texture2D(tB2, uv).rgb * 0.7 + texture2D(tB3, uv).rgb * 1.0;
      col += bl * uBloom;
      float occS = 0.0; for (int i = 0; i < 5; i++){ vec2 o = vec2(float(i - 2) * 0.004, float(i - 2) * 0.004 * float(mod(float(i), 2.0) * 2.0 - 1.0)); occS += clamp(texture2D(tOcc, uSun + o).g - 0.9, 0.0, 1.0); }
      float vis = clamp(occS / 5.0 * 1.5, 0.0, 1.0) * uSunVis;
      col += texture2D(tGod, uv).rgb * vec3(1.0, 0.72, 0.45) * uGod * uSunVis;
      vec2 sv = uSun - 0.5;
      for (int k = 0; k < 4; k++){
        float fk = float(k); float t = fk == 0.0 ? -0.55 : fk == 1.0 ? -1.15 : fk == 2.0 ? 0.35 : -1.6;
        float sz = fk == 0.0 ? 0.05 : fk == 1.0 ? 0.11 : fk == 2.0 ? 0.03 : 0.17;
        vec2 gp = 0.5 + sv * t; float d = length((uv - gp) * vec2(uAspect, 1.0));
        vec3 gc = fk == 1.0 ? vec3(0.3, 0.6, 1.0) : fk == 3.0 ? vec3(0.6, 0.4, 1.0) : vec3(1.0, 0.6, 0.3);
        col += gc * smoothstep(sz, sz * 0.75, d) * 0.08 * vis;
      }
      col *= uExposure;
      col = aces(col);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.06 - uLowHp * 0.75);
      col += vec3(-0.012, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.5, l)) + vec3(0.02, 0.008, -0.012) * smoothstep(0.4, 1.0, l);
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));
      col *= 1.0 - r2 * (0.55 + uAds * 0.5);
      float edge = smoothstep(0.08, 0.45, r2);
      col = mix(col, vec3(0.45, 0.0, 0.0), clamp(edge * (uDamage * 0.75 + uLowHp * 0.55), 0.0, 0.85));
      col += uFlash;
      col += (hash(uv * 977.0 + fract(uTime) * 61.0) - 0.5) * 0.04;
      gl_FragColor = vec4(col, 1.0);
    }`, {
    tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, tGod: { value: null }, tOcc: { value: null },
    uSun: { value: new THREE.Vector2() }, uSunVis: { value: 0 }, uExposure: { value: 1.0 }, uBloom: { value: 0.11 }, uGod: { value: 1.0 },
    uTime: U.time, uDamage: { value: 0 }, uLowHp: { value: 0 }, uFlash: { value: 0 }, uAspect: { value: 1 }, uAds: { value: 0 }
  });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  function mk(w, hh) { return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, hh), opt); }
  function resize(w, hh) {
    W = w; H = hh;
    [rtScene, ...h, ...q, ...e, occ, god].forEach(r => r && r.dispose());
    if (isGL2) { rtScene = new THREE.WebGLMultisampleRenderTarget(W, H, { ...opt, depthBuffer: true }); rtScene.samples = 4; }
    else rtScene = new THREE.WebGLRenderTarget(W, H, { ...opt, depthBuffer: true });
    h = [mk(W >> 1, H >> 1), mk(W >> 1, H >> 1)]; q = [mk(W >> 2, H >> 2), mk(W >> 2, H >> 2)]; e = [mk(W >> 3, H >> 3), mk(W >> 3, H >> 3)];
    occ = mk(W >> 2, H >> 2); god = mk(W >> 2, H >> 2);
    comp.uniforms.uAspect.value = godM.uniforms.uAspect.value = W / H;
  }
  function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qs, quadCam); }
  function blurPair(pair, w, hh) {
    blur.uniforms.tSrc.value = pair[0].texture; blur.uniforms.uDir.value.set(1 / w, 0); pass(blur, pair[1]);
    blur.uniforms.tSrc.value = pair[1].texture; blur.uniforms.uDir.value.set(0, 1 / hh); pass(blur, pair[0]);
  }
  const _sp = V();
  function render(gunScene, gunCam, fx) {
    // 1. 世界
    renderer.setRenderTarget(rtScene); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, false);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    // 2. 武器（独立深度）
    renderer.clearDepth(); renderer.render(gunScene, gunCam);
    // 3. 太阳遮挡图：天空 + 黑色几何体
    renderer.setRenderTarget(occ); renderer.clear(true, true, false);
    renderer.render(SKY.occScene, camera);
    const layers = camera.layers.mask; camera.layers.set(0);
    scene.overrideMaterial = black; renderer.render(scene, camera); scene.overrideMaterial = null;
    camera.layers.mask = layers;
    // 太阳屏幕位置
    _sp.copy(camera.position).addScaledVector(SUN_DIR, 1000).project(camera);
    const sx = _sp.x * 0.5 + 0.5, sy = _sp.y * 0.5 + 0.5;
    const facing = _sp.z < 1 ? 1 : 0;
    const vis = facing * clamp(1.6 - Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) * 2.2, 0, 1);
    godM.uniforms.uSun.value.set(sx, sy); comp.uniforms.uSun.value.set(sx, sy); comp.uniforms.uSunVis.value = vis;
    godM.uniforms.tOcc.value = occ.texture; pass(godM, god);
    // 4. 泛光
    bright.uniforms.tSrc.value = rtScene.texture; bright.uniforms.uTex.value.set(1 / W, 1 / H); pass(bright, h[0]);
    blurPair(h, W >> 1, H >> 1);
    down.uniforms.tSrc.value = h[0].texture; down.uniforms.uTex.value.set(2 / W, 2 / H); pass(down, q[0]); blurPair(q, W >> 2, H >> 2);
    down.uniforms.tSrc.value = q[0].texture; down.uniforms.uTex.value.set(4 / W, 4 / H); pass(down, e[0]); blurPair(e, W >> 3, H >> 3); blurPair(e, W >> 3, H >> 3);
    // 5. 合成
    const u = comp.uniforms;
    u.tScene.value = rtScene.texture; u.tB1.value = h[0].texture; u.tB2.value = q[0].texture; u.tB3.value = e[0].texture; u.tGod.value = god.texture; u.tOcc.value = occ.texture;
    Object.assign(u.uDamage, { value: fx.damage }); u.uLowHp.value = fx.lowHp; u.uFlash.value = fx.flash; u.uAds.value = fx.ads;
    pass(comp, null);
  }
  return { resize, render, comp };
})();
