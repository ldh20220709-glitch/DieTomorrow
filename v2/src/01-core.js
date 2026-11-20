// ======================= 01 CORE =======================
const TAU = Math.PI * 2;
let _seed = 73313;
const rnd = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = a => a[(rnd() * a.length) | 0];
const mr = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = id => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const X_AXIS = V(1, 0, 0), Y_AXIS = V(0, 1, 0), Z_AXIS = V(0, 0, 1);

// ---------- 可平铺值噪声 ----------
const Noise = (() => {
  const P = new Uint8Array(512), G = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; G[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x, y) => G[P[P[x & 255] + (y & 255)]];
  function vn(x, y, px, py) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = h(x0, y0), b = h(x1, y0), c = h(x0, y1), d = h(x1, y1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, oct, px = 256, py = px) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * vn(x * f, y * f, px * f, py * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
  return { vn, fbm };
})();

// ---------- 渲染器 ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
const isGL2 = renderer.capabilities.isWebGL2;
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.12, 3400);
camera.rotation.order = 'YXZ';
camera.layers.enable(2); camera.layers.enable(3);
scene.add(camera);

// ---------- 光照与大气参数（线性 HDR） ----------
const SUN_DIR = V(-0.36, 0.115, -1).normalize();
const COL = {
  fog: new THREE.Color(0.34, 0.36, 0.40),
  sunFog: new THREE.Color(2.5, 1.5, 0.78),
  zenith: new THREE.Color(0.14, 0.20, 0.32),
  sun: new THREE.Color(1.0, 0.72, 0.46)
};
scene.fog = new THREE.FogExp2(COL.fog, 0.0055);

// 方向性高度雾：朝太阳方向雾色变暖变亮，高处雾更稀
const U = {
  sunView: { value: V() }, viewUp: { value: V(0, 1, 0) }, camY: { value: 1.6 },
  sunFog: { value: COL.sunFog }, time: { value: 0 }
};
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\nvarying vec3 vFogPos;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\nvFogPos = mvPosition.xyz;\n#endif';
THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
uniform vec3 fogColor; uniform float fogDensity; varying vec3 vFogPos;
uniform vec3 uSunView; uniform vec3 uViewUp; uniform float uCamY; uniform vec3 uSunFog;
#endif`;
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
float fogD = length(vFogPos);
vec3 fogDir = vFogPos / max(fogD, 1e-4);
float fogWY = uCamY + dot(vFogPos, uViewUp);
float fogH = max(0.0, 0.5 * (uCamY + fogWY));
float fogFactor = 1.0 - exp(-fogDensity * exp(-fogH * 0.035) * fogD);
float fogSun = pow(max(dot(fogDir, uSunView), 0.0), 6.0);
gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, uSunFog, fogSun), fogFactor);
#endif`;
function injectFog(s) { s.uniforms.uSunView = U.sunView; s.uniforms.uViewUp = U.viewUp; s.uniforms.uCamY = U.camY; s.uniforms.uSunFog = U.sunFog; }
function F(m) { m.onBeforeCompile = injectFog; return m; }
const std = p => F(new THREE.MeshStandardMaterial(p));
const basic = p => F(new THREE.MeshBasicMaterial(p));
function updateFogUniforms() {
  const inv = camera.matrixWorldInverse;
  U.sunView.value.copy(SUN_DIR).transformDirection(inv);
  U.viewUp.value.set(0, 1, 0).transformDirection(inv);
  U.camY.value = camera.position.y;
}
