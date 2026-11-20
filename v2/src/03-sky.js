// ======================= 03 SKY / OCEAN / LIGHTS =======================
const SKY_GLSL = `
uniform vec3 uSunDir; uniform vec3 uFogColor; uniform vec3 uSunFog; uniform vec3 uZenith; uniform float uTime;
float sHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(sHash(i), sHash(i+vec2(1.0,0.0)), f.x), mix(sHash(i+vec2(0.0,1.0)), sHash(i+vec2(1.0,1.0)), f.x), f.y); }
float sFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * sNoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
vec3 skyColor(vec3 d, float disk){
  float sd = max(dot(d, uSunDir), 0.0);
  float h = d.y;
  vec3 horizon = mix(uFogColor, uSunFog, pow(sd, 6.0));
  vec3 col = mix(horizon, uZenith, smoothstep(0.0, 0.5, max(h, 0.0)));
  col += uSunFog * 0.55 * pow(sd, 28.0) + vec3(1.0, 0.62, 0.35) * 0.22 * pow(sd, 3.0) * smoothstep(-0.05, 0.3, h + 0.1);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.06) * 0.9 + vec2(uTime * 0.003, uTime * 0.001);
    float base = sFbm(uv * 0.55);
    float c = smoothstep(0.48, 0.78, base) * smoothstep(0.0, 0.12, h);
    float detail = sFbm(uv * 2.7);
    float lit = pow(sd, 3.0);
    vec3 cc = mix(vec3(0.30, 0.30, 0.34), vec3(2.2, 1.25, 0.62), lit) * (0.65 + 0.55 * detail);
    cc = mix(cc, horizon, smoothstep(0.25, 0.0, h) * 0.7);
    col = mix(col, cc, c * 0.85);
  }
  col = mix(col, vec3(0.05, 0.05, 0.055), smoothstep(0.0, -0.12, h) * (1.0 - disk * 0.0));
  col += vec3(60.0, 42.0, 24.0) * smoothstep(0.99935, 0.99965, sd) * disk;
  return col;
}`;
function makeSkyMat(disk = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: SUN_DIR }, uFogColor: { value: COL.fog }, uSunFog: { value: COL.sunFog }, uZenith: { value: COL.zenith }, uTime: U.time },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_GLSL + `\nvarying vec3 vDir; void main(){ vec3 d = normalize(vDir); gl_FragColor = vec4(skyColor(d, ${disk.toFixed(1)}), 1.0);\n#include <encodings_fragment>\n}`,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
}
const SKY = {};
function buildSky() {
  // 主场景天空穹顶（layer 2：不参与遮挡图）
  const mat = makeSkyMat(1);
  SKY.dome = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), mat);
  SKY.dome.layers.set(2); SKY.dome.frustumCulled = false; SKY.dome.renderOrder = -10; scene.add(SKY.dome);
  // 遮挡图用的天空场景
  SKY.occScene = new THREE.Scene();
  SKY.occDome = new THREE.Mesh(SKY.dome.geometry, mat); SKY.occDome.frustumCulled = false; SKY.occScene.add(SKY.occDome);

  // 环境光照（PMREM）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), makeSkyMat(1)));
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(80, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.07, 0.065, 0.06) }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -1.5; envScene.add(gnd);
  SKY.env = pmrem.fromScene(envScene, 0.02, 0.1, 300).texture;
  scene.environment = SKY.env;
  pmrem.dispose();

  // 海面
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: SUN_DIR }, uFogColor: { value: COL.fog }, uSunFog: { value: COL.sunFog }, uZenith: { value: COL.zenith }, uTime: U.time, uFogDensity: { value: scene.fog.density }, uSunCol: { value: COL.sun } },
    vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: SKY_GLSL + `
      uniform float uFogDensity; uniform vec3 uSunCol; varying vec3 vWorld;
      vec2 wv(vec2 p, vec2 d, float k, float a, float t){ float ph = dot(p, d) * k + t * sqrt(9.8 * k); return d * (a * k * cos(ph)); }
      void main(){
        vec2 p = vWorld.xz; float t = uTime;
        float dist = length(vWorld - cameraPosition);
        vec2 g = wv(p, normalize(vec2(0.8, 0.6)), 0.35, 0.22, t) + wv(p, normalize(vec2(-0.5, 0.86)), 0.6, 0.12, t)
               + wv(p, normalize(vec2(0.2, -0.98)), 1.3, 0.05, t) + wv(p, normalize(vec2(-0.9, -0.3)), 2.4, 0.025, t);
        float fade = exp(-dist * 0.004);
        vec2 q = p * 0.6 + vec2(t * 0.4, t * 0.25);
        float e = 0.15;
        float n0 = sFbm(q), nx = sFbm(q + vec2(e, 0.0)), nz = sFbm(q + vec2(0.0, e));
        g += vec2(nx - n0, nz - n0) / e * 0.18 * fade;
        g *= mix(0.35, 1.0, fade);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(vWorld - cameraPosition);
        vec3 r = reflect(v, n); r.y = abs(r.y) + 0.01;
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
        vec3 refl = skyColor(normalize(r), 0.0);
        vec3 deep = vec3(0.012, 0.03, 0.04) + uSunFog * 0.012;
        vec3 col = mix(deep, refl, fres);
        float sr = max(dot(r, uSunDir), 0.0);
        col += uSunCol * (pow(sr, 900.0) * 90.0 + pow(sr, 90.0) * 2.0);
        float ff = 1.0 - exp(-uFogDensity * dist);
        col = mix(col, mix(uFogColor, uSunFog, pow(max(dot(v, uSunDir), 0.0), 6.0)), ff);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  SKY.ocean = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), oceanMat);
  SKY.ocean.rotation.x = -Math.PI / 2; SKY.ocean.position.y = -2.2; SKY.ocean.frustumCulled = false;
  scene.add(SKY.ocean);

  // 太阳与补光
  SKY.sun = new THREE.DirectionalLight(COL.sun, 3.4);
  SKY.sun.castShadow = true;
  SKY.sun.shadow.mapSize.set(2048, 2048);
  const sc = SKY.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 600;
  SKY.sun.shadow.bias = -0.0004; SKY.sun.shadow.normalBias = 0.045;
  scene.add(SKY.sun, SKY.sun.target);
  SKY.hemi = new THREE.HemisphereLight(new THREE.Color(0.42, 0.50, 0.64), new THREE.Color(0.20, 0.17, 0.14), 0.32);
  scene.add(SKY.hemi);
  // 固定数量的点光源池（避免灯光数量变化导致着色器重编译）
  SKY.pl = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffb060, 0, 16, 2); scene.add(l); return l; });

  // 空气浮尘（逆光时发亮）
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) pos[i] = Math.random() * 40;
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  SKY.dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: { uCam: { value: camera.position }, uTime: U.time, uSunDir: { value: SUN_DIR }, uScale: { value: innerHeight } },
    vertexShader: `uniform vec3 uCam; uniform float uTime; uniform float uScale; uniform vec3 uSunDir; varying float vB;
      void main(){ vec3 p = mod(position + vec3(uTime * 0.25, sin(uTime * 0.2 + position.x) * 0.3, uTime * 0.12) - uCam + 20.0, 40.0) - 20.0 + uCam;
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vec3 dir = normalize(p - cameraPosition); float d = length(p - cameraPosition);
        vB = (0.06 + 2.4 * pow(max(dot(dir, uSunDir), 0.0), 10.0)) * smoothstep(20.0, 8.0, d) * smoothstep(0.3, 1.5, d);
        gl_PointSize = uScale * 0.0045 / max(-mv.z, 0.1) * 2.0; }`,
    fragmentShader: `varying float vB; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * vB * a, 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  }));
  SKY.dust.frustumCulled = false; SKY.dust.layers.set(3); scene.add(SKY.dust);

  // 海鸥
  SKY.birds = [];
  const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0, -0.25, 0.25, 0, 0.35], 3));
  wingG.computeVertexNormals();
  const bm = basic({ color: 0x1a1a1c, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Group();
    const l = new THREE.Mesh(wingG, bm), r = new THREE.Mesh(wingG, bm); r.scale.x = -1;
    b.add(l, r); b.scale.setScalar(1.4); b.layers.set(3); l.layers.set(3); r.layers.set(3);
    scene.add(b);
    SKY.birds.push({ g: b, l, r, cx: rr(-80, 60), cz: rr(-140, -60), rad: rr(15, 40), h: rr(28, 55), sp: rr(0.15, 0.3) * (rnd() < 0.5 ? 1 : -1), ph: rr(0, TAU) });
  }
}
const _sR = V(), _sU = V(), _sC = V();
function updateSky(dt, t) {
  SKY.dome.position.copy(camera.position);
  SKY.occDome.position.copy(camera.position);
  SKY.ocean.position.x = camera.position.x; SKY.ocean.position.z = camera.position.z;
  // 阴影相机跟随玩家并按纹素对齐，避免阴影边缘闪烁
  const ts = 120 / 2048;
  _sR.crossVectors(Y_AXIS, SUN_DIR).normalize(); _sU.crossVectors(SUN_DIR, _sR);
  const p = camera.position;
  const a = Math.round(p.dot(_sR) / ts) * ts, b = Math.round(p.dot(_sU) / ts) * ts, c = p.dot(SUN_DIR);
  _sC.copy(_sR).multiplyScalar(a).addScaledVector(_sU, b).addScaledVector(SUN_DIR, c);
  SKY.sun.target.position.copy(_sC); SKY.sun.position.copy(_sC).addScaledVector(SUN_DIR, 300);
  for (const bd of SKY.birds) {
    bd.ph += dt * bd.sp;
    const x = bd.cx + Math.cos(bd.ph) * bd.rad, z = bd.cz + Math.sin(bd.ph) * bd.rad;
    bd.g.position.set(x, bd.h + Math.sin(bd.ph * 3) * 2, z);
    bd.g.rotation.y = -bd.ph - (bd.sp > 0 ? 0 : Math.PI);
    const f = Math.sin(t * 7 + bd.ph * 10) * 0.6;
    bd.l.rotation.z = f; bd.r.rotation.z = -f;
  }
}
