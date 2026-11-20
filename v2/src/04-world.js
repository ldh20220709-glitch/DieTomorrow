// ======================= 04 WORLD =======================
const WORLD = { boxes: [], relays: [], beacons: [], extract: V(-84, 0, -42), spawn: V(0, 0, 42) };
function solid(x0, y0, z0, x1, y1, z1, mat = 'metal') {
  WORLD.boxes.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), mat });
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1).toNonIndexed(),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1).toNonIndexed(),
  cyl20: new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1).toNonIndexed()
};
function worldUV(g, s) {
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  let uvA = g.attributes.uv; if (!uvA) { uvA = new THREE.BufferAttribute(new Float32Array(p.length / 3 * 2), 2); g.setAttribute('uv', uvA); }
  const uv = uvA.array;
  for (let i = 0, c = p.length / 3; i < c; i++) {
    const ax = Math.abs(n[i * 3]), ay = Math.abs(n[i * 3 + 1]), az = Math.abs(n[i * 3 + 2]);
    let u, v;
    if (ax >= ay && ax >= az) { u = p[i * 3 + 2] * Math.sign(n[i * 3] || 1); v = p[i * 3 + 1]; }
    else if (ay >= az) { u = p[i * 3]; v = p[i * 3 + 2]; }
    else { u = -p[i * 3] * Math.sign(n[i * 3 + 2] || 1); v = p[i * 3 + 1]; }
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s;
  }
  uvA.needsUpdate = true;
}
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere(); return geo;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = V(), _s = V(), _e = new THREE.Euler(), _d = V();
class Builder {
  constructor() { this.g = new Map(); }
  add(geo, mat, m, uv) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m);
    if (uv) worldUV(g, uv);
    let a = this.g.get(mat); if (!a) { a = []; this.g.set(mat, a); } a.push(g);
  }
  box(mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, uv = 2) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); this.add(GEO.box, mat, _m4, uv);
  }
  beam(mat, a, b, w, h, uv = 2) {
    _d.subVectors(b, a); const L = _d.length(); _q.setFromUnitVectors(Z_AXIS, _d.divideScalar(L));
    _m4.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(w, h, L)); this.add(GEO.box, mat, _m4, uv);
  }
  rod(mat, a, b, r, uv = 1, geo = GEO.cyl8) {
    _d.subVectors(b, a); const L = _d.length(); _q.setFromUnitVectors(Y_AXIS, _d.divideScalar(L));
    _m4.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q, _s.set(r * 2, L, r * 2)); this.add(geo, mat, _m4, uv);
  }
  cyl(mat, x, y, z, r, h, geo = GEO.cyl12, uv = 1, rx = 0, rz = 0) {
    _e.set(rx, 0, rz); _q.setFromEuler(_e); _m4.compose(_p.set(x, y, z), _q, _s.set(r * 2, h, r * 2)); this.add(geo, mat, _m4, uv);
  }
  geo(mat, g, x, y, z, ry = 0, uv = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(0, ry, 0); _q.setFromEuler(_e); _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); this.add(g, mat, _m4, uv);
  }
  build(parent, cast = true, receive = true, layer = 0) {
    const out = [];
    for (const [mat, list] of this.g) {
      const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = cast; m.receiveShadow = receive; m.layers.set(layer);
      parent.add(m); out.push(m);
    }
    this.g.clear(); return out;
  }
}

// ---------- 材质 ----------
const M = {};
function buildMaterials() {
  const paint = (map, metal = 0.25) => std({ map, normalMap: TEX.paintN, roughnessMap: TEX.paintR, metalness: metal, roughness: 1 });
  M.concrete = std({ map: TEX.concrete.map, normalMap: TEX.concrete.normal, roughnessMap: TEX.concrete.rough, roughness: 1, metalness: 0 });
  M.concreteL = std({ map: TEX.concreteLight.map, normalMap: TEX.concreteLight.normal, roughnessMap: TEX.concreteLight.rough, roughness: 1, metalness: 0 });
  M.crane = paint(TEX.crane, 0.3); M.yellow = paint(TEX.yellow); M.dark = paint(TEX.dark, 0.5); M.white = paint(TEX.white, 0.15);
  M.red = paint(TEX.red); M.blue = paint(TEX.blue);
  M.galv = std({ color: 0x8a8f92, roughness: 0.45, metalness: 0.8, normalMap: TEX.paintN, roughnessMap: TEX.paintR });
  M.cable = std({ color: 0x18191a, roughness: 0.55, metalness: 0.6 });
  M.rubber = std({ color: 0x141414, roughness: 0.9, metalness: 0 });
  M.glass = std({ color: 0x0a0e12, roughness: 0.06, metalness: 0.9 });
  M.wood = std({ color: 0x7a5a38, roughness: 0.85, normalMap: TEX.paintN });
  M.cardboard = std({ color: 0x9a7a52, roughness: 0.9 });
  M.hazard = std({ map: TEX.hazard, normalMap: TEX.paintN, roughness: 0.6, metalness: 0.2 });
  M.lamp = basic({ color: new THREE.Color(9, 7, 4.5) });
  M.beacon = basic({ color: new THREE.Color(14, 0.6, 0.3) });
  M.clad = std({ map: TEX.clad.map, normalMap: TEX.clad.normal, roughnessMap: TEX.clad.rough, metalness: 0.4, roughness: 1 });
  M.roller = std({ map: TEX.roller.map, normalMap: TEX.roller.normal, metalness: 0.5, roughness: 0.55 });
  M.hull = std({ map: TEX.hull.map, normalMap: TEX.hull.normal, metalness: 0.35, roughness: 0.6 });
  M.deck = std({ color: 0x4a3f38, normalMap: TEX.paintN, roughnessMap: TEX.paintR, roughness: 1, metalness: 0.3 });
  M.super = std({ map: TEX.super.map, emissiveMap: TEX.super.emissive, emissive: new THREE.Color(2.2, 1.6, 1.0), roughness: 0.5, metalness: 0.1 });
  M.fence = std({ map: TEX.fence, alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.4 });
  M.markY = std({ color: new THREE.Color(0.85, 0.62, 0.08), map: TEX.wear, alphaTest: 0.5, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.markW = std({ color: new THREE.Color(0.85, 0.85, 0.82), map: TEX.wear, alphaTest: 0.5, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.puddle = std({ color: 0x0c0d0e, map: TEX.puddle, transparent: true, roughness: 0.03, metalness: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  M.sign = t => std({ map: t, roughness: 0.6, metalness: 0.1 });
  M.contTop = CONT_VARIANTS.map(v => std({ color: new THREE.Color(v.c[0] * 0.75, v.c[1] * 0.75, v.c[2] * 0.75), normalMap: TEX.paintN, roughnessMap: TEX.contR, roughness: 1, metalness: 0.35 }));
  M.cont = TEX.cont.map((t, i) => {
    const side = std({ map: t.side, normalMap: TEX.contN, roughnessMap: TEX.contR, roughness: 1, metalness: 0.4 });
    const end = std({ map: t.end, normalMap: TEX.contEN, roughness: 0.65, metalness: 0.4 });
    return [end, end, M.contTop[i], M.contTop[i], side, side];
  });
}

// ---------- 集装箱（实例化） ----------
const CL = 12.19, CH = 2.59, CW = 2.44;
const CONT = CONT_VARIANTS.map(() => []);
function addContainer(x, y, z, rot, v = ri(0, CONT_VARIANTS.length - 1), shade = rr(0.82, 1.05)) { CONT[v].push({ x, y, z, rot, shade }); }
function stack(x, z, n, rot = 0, collide = true) {
  for (let k = 0; k < n; k++) addContainer(x + rr(-0.06, 0.06), CH / 2 + k * CH, z + rr(-0.04, 0.04), rot + rr(-0.006, 0.006));
  if (collide && n > 0) { const hx = rot ? CW / 2 : CL / 2, hz = rot ? CL / 2 : CW / 2; solid(x - hx, 0, z - hz, x + hx, n * CH, z + hz, 'metal'); }
}
function buildContainers(root) {
  const geo = new THREE.BoxGeometry(CL, CH, CW);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  CONT.forEach((list, v) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, M.cont[v], list.length);
    list.forEach((it, i) => {
      q.setFromAxisAngle(Y_AXIS, it.rot); m.compose(_p.set(it.x, it.y, it.z), q, _s.set(1, 1, 1)); im.setMatrixAt(i, m);
      im.setColorAt(i, c.setScalar(it.shade));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = im.receiveShadow = true; root.add(im);
  });
}

// ---------- 岸桥 ----------
function crane(B, x0, trolleyZ, hoistY, load, idx, root) {
  const S = M.crane, D = M.dark, Y = M.yellow;
  const zs = -47, zl = -25, lx = 9, top = 31, by = 34.5;
  for (const sx of [-1, 1]) {
    const x = x0 + sx * lx;
    for (const z of [zs, zl]) {
      B.box(D, x, 0.8, z, 5.4, 1.0, 1.5);
      for (const wx of [-2, -0.7, 0.7, 2]) B.cyl(D, x + wx, 0.4, z, 0.4, 0.6, GEO.cyl12, 1, Math.PI / 2, 0);
      B.box(Y, x, 1.5, z, 4.2, 0.5, 1.9);
      B.box(S, x, (1.75 + top) / 2, z, 1.5, top - 1.75, 1.5);
      B.box(M.hazard, x, 3.0, z, 1.56, 2.4, 1.56, 0, 0, 0, 0.7);
      solid(x - 2.7, 0, z - 0.95, x + 2.7, 1.8, z + 0.95, 'metal'); solid(x - 0.8, 0, z - 0.8, x + 0.8, top, z + 0.8, 'metal');
      // 爬梯护笼
      for (let hy = 4; hy < top - 1; hy += 1.2) B.box(D, x + sx * 1.05, hy, z, 0.6, 0.05, 0.6, 0, 0, 0, 1);
      B.box(D, x + sx * 0.9, top / 2 + 1, z - 0.22, 0.04, top - 4, 0.04, 0, 0, 0, 1); B.box(D, x + sx * 0.9, top / 2 + 1, z + 0.22, 0.04, top - 4, 0.04, 0, 0, 0, 1);
    }
    B.box(S, x, 11, (zs + zl) / 2, 1.1, 1.5, zl - zs);
    B.box(S, x, top, (zs + zl) / 2, 1.5, 2.1, zl - zs + 1.6);
    B.beam(S, V(x, 11.8, zs + 0.8), V(x, top - 1.1, zl - 0.8), 0.6, 0.6);
    B.beam(S, V(x, 11.8, zl - 0.8), V(x, top - 1.1, zs + 0.8), 0.6, 0.6);
    B.beam(S, V(x, 1.8, zs + 0.8), V(x, 10.3, zl - 0.8), 0.45, 0.45);
  }
  for (const z of [zs, zl]) B.box(S, x0, top + 0.3, z, lx * 2 + 1.6, 2.5, 1.7);
  // 大梁
  for (const sx of [-1, 1]) {
    const gx = x0 + sx * 3.6;
    B.box(S, gx, by, -48, 1.1, 2.6, 104);
    B.box(D, gx + sx * 0.9, by + 1.32, -48, 0.9, 0.06, 104);
    for (let z = -99.5; z <= 3; z += 2.5) B.box(D, gx + sx * 1.3, by + 1.9, z, 0.05, 1.1, 0.05, 0, 0, 0, 1);
    B.box(D, gx + sx * 1.3, by + 2.45, -48, 0.06, 0.06, 104, 0, 0, 0, 1);
    B.box(D, gx + sx * 1.3, by + 1.9, -48, 0.04, 0.04, 104, 0, 0, 0, 1);
    for (let z = -98; z <= 0; z += 8) B.beam(S, V(gx, by - 1.2, z), V(gx, by + 1.2, z + 4), 0.3, 0.3);
  }
  for (let z = -98; z <= 2; z += 6) B.box(S, x0, by - 1.0, z, 7.2, 0.55, 0.55);
  // A 字架与拉索
  const apexY = 54, apexZ = -36;
  for (const sx of [-1, 1]) {
    const ax = x0 + sx * 2.2;
    B.beam(S, V(x0 + sx * 3.6, by + 1.3, zs), V(ax, apexY, apexZ), 1.0, 1.0);
    B.beam(S, V(x0 + sx * 3.6, by + 1.3, zl), V(ax, apexY, apexZ), 1.0, 1.0);
    for (const tz of [-98, -84, -70]) B.rod(M.cable, V(ax, apexY, apexZ), V(x0 + sx * 3.6, by + 1.3, tz), 0.1);
    B.rod(M.cable, V(ax, apexY, apexZ), V(x0 + sx * 3.6, by + 1.3, 2), 0.13);
  }
  B.box(S, x0, apexY + 0.4, apexZ, 5.6, 1.2, 1.5);
  // 机房
  B.box(M.white, x0, by + 4.3, -3, 8.6, 6.0, 9);
  B.box(D, x0, by + 7.45, -3, 9.0, 0.3, 9.4);
  for (const sx of [-1, 1]) B.box(M.glass, x0 + sx * 4.31, by + 5.2, -3, 0.04, 0.9, 7.6, 0, 0, 0, 1);
  // 小车与司机室
  B.box(S, x0, by - 1.7, trolleyZ, 6.2, 1.7, 5.2);
  B.box(M.white, x0 + 2.3, by - 3.9, trolleyZ + 0.4, 2.3, 2.5, 2.7);
  B.box(M.glass, x0 + 2.3, by - 4.1, trolleyZ - 0.97, 2.1, 1.4, 0.05, 0, 0, 0, 1);
  // 吊具
  for (const dx of [-1.9, 1.9]) for (const dz of [-1.5, 1.5]) B.rod(M.cable, V(x0 + dx, by - 2.5, trolleyZ + dz), V(x0 + dx * 2.6, hoistY + 0.6, trolleyZ + dz * 0.5), 0.035);
  B.box(Y, x0, hoistY + 0.35, trolleyZ, 12.4, 0.55, 2.6);
  B.box(D, x0, hoistY + 0.85, trolleyZ, 3.2, 0.6, 2.0);
  if (load >= 0) addContainer(x0, hoistY - CH / 2, trolleyZ, 0, load, 1);
  // 信标
  for (const p of [[x0, apexY + 1.2, apexZ], [x0 - 3.6, by + 1.5, -99.6], [x0 + 3.6, by + 1.5, -99.6], [x0, by + 7.8, -3]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), M.beacon); b.position.set(...p); b.layers.set(3); root.add(b); WORLD.beacons.push(b);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), M.sign(TEX.signQC[idx])); sign.position.set(x0, top + 0.3, zl + 0.86); root.add(sign);
}

// ---------- 货轮 ----------
function ship(B, root) {
  const z0 = -73.5, half = 11.5, x0 = -100, x1 = 64;
  const shp = new THREE.Shape();
  shp.moveTo(x0, -half); shp.lineTo(x1, -half); shp.quadraticCurveTo(x1 + 14, -half, x1 + 21, 0); shp.quadraticCurveTo(x1 + 14, half, x1, half);
  shp.lineTo(x0, half); shp.quadraticCurveTo(x0 - 5, half, x0 - 5.5, 0); shp.quadraticCurveTo(x0 - 5, -half, x0, -half);
  const g = new THREE.ExtrudeGeometry(shp, { depth: 17, bevelEnabled: false, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); g.translate(0, -7, z0);
  const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
  for (let i = 0; i < p.length / 3; i++) {
    if (Math.abs(n[i * 3 + 1]) < 0.5) { uv[i * 2] = (p[i * 3] + p[i * 3 + 2] * 0.3) / 40; uv[i * 2 + 1] = (p[i * 3 + 1] + 7) / 17; }
    else { uv[i * 2] = p[i * 3] / 2; uv[i * 2 + 1] = p[i * 3 + 2] / 2; }
  }
  const hull = new THREE.Mesh(g, [M.deck, M.hull]); hull.castShadow = true; hull.receiveShadow = true; root.add(hull);
  // 船名
  for (const [x, sc] of [[x1 - 6, 1], [x0 + 18, 0.8]]) {
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(16 * sc, 2 * sc), M.sign(TEX.shipName)); nm.material.transparent = true;
    nm.position.set(x, 6.5, z0 + half + 0.05); root.add(nm);
  }
  // 甲板集装箱
  for (let x = -92; x <= 36; x += 12.8) {
    if (Math.abs(x + 30) < 3) continue;
    for (let r = -4; r <= 4; r++) {
      const tiers = ri(2, 6) - (Math.abs(r) === 4 ? 1 : 0);
      for (let k = 0; k < tiers; k++) addContainer(x, 10 + CH / 2 + k * CH, z0 + r * 2.5, 0);
    }
    B.box(M.dark, x + 6.4, 13, z0, 0.6, 6, 23, 0, 0, 0, 2);
  }
  // 上层建筑
  B.box(M.super, 48, 21, z0, 12, 22, 17, 0, 0, 0, 16);
  B.box(M.white, 48, 31.6, z0, 9, 1.0, 27);
  B.box(M.glass, 44.4, 30.4, z0, 0.1, 1.4, 16.8, 0, 0, 0, 1);
  B.box(M.red, 58.5, 31, z0, 4.5, 6, 6);
  B.box(M.dark, 58.5, 34.4, z0, 4.6, 0.9, 6.1);
  B.box(M.blue, 58.5, 32.2, z0, 4.55, 1.2, 6.05);
  B.rod(M.dark, V(48, 32, z0), V(48, 41, z0), 0.18);
  B.box(M.dark, 48, 39, z0, 0.2, 0.2, 5);
  B.box(M.dark, 48, 41.5, z0, 3.5, 0.15, 0.4);
  // 救生艇
  B.box(M.sign(textTex(4, 4, g => { g.fillStyle = '#e8641c'; g.fillRect(0, 0, 4, 4); })), 52, 24, z0 + 9.2, 7, 2, 2.4);
  // 系泊缆
  for (let x = -80; x <= 50; x += 26) B.rod(M.cable, V(x, 0.7, -50.3), V(x + 6, 9.6, z0 + half - 0.2), 0.06);
}

// ---------- 仓库 ----------
function warehouse(B, root, x0, x1, z0, z1, h, si) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  B.box(M.clad, cx, h / 2, cz, x1 - x0, h, z1 - z0, 0, 0, 0, 4);
  B.box(M.dark, cx, h + 0.45, cz, x1 - x0 + 0.6, 0.9, z1 - z0 + 0.6);
  B.box(M.concreteL, cx, 0.6, z0 - 0.06, x1 - x0, 1.2, 0.2, 0, 0, 0, 4);
  const nd = Math.floor((x1 - x0) / 15);
  for (let i = 0; i < nd; i++) {
    const dx = x0 + (x1 - x0) / nd * (i + 0.5);
    B.box(M.roller, dx, 3.4, z0 - 0.08, 5.6, 6.8, 0.12, 0, 0, 0, 4);
    for (const s of [-1, 1]) { B.box(M.yellow, dx + s * 2.95, 3.45, z0 - 0.2, 0.3, 6.9, 0.3); B.cyl(M.yellow, dx + s * 2.4, 0.6, z0 - 0.9, 0.14, 1.2); }
    B.box(M.dark, dx, 7.15, z0 - 0.3, 6.4, 0.4, 0.6);
    B.box(M.lamp, dx, 8.0, z0 - 0.35, 0.8, 0.2, 0.4);
  }
  for (let x = x0 + 0.5; x <= x1; x += 18) B.cyl(M.dark, x, h / 2, z0 - 0.15, 0.09, h);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), M.sign(TEX.signWH[si])); sg.position.set(x0 + 7, h - 3.2, z0 - 0.04); sg.rotation.y = Math.PI; sg.rotation.y = 0; root.add(sg);
  sg.position.z = z0 - 0.04; sg.lookAt(sg.position.x, sg.position.y, z0 - 10);
  solid(x0, 0, z0 - 0.1, x1, h + 1, z1, 'metal');
}

// ---------- 道具 ----------
let JERSEY_GEO;
function jersey(B, x, z, rot) {
  if (!JERSEY_GEO) {
    const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.08); s.lineTo(0.16, 0.25); s.lineTo(0.08, 0.81); s.lineTo(-0.08, 0.81); s.lineTo(-0.16, 0.25); s.lineTo(-0.3, 0.08); s.closePath();
    JERSEY_GEO = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }); JERSEY_GEO.translate(0, 0, -1.5); JERSEY_GEO.rotateY(Math.PI / 2);
  }
  B.geo(M.concreteL, JERSEY_GEO, x, 0, z, rot, 1.5);
  const along = Math.abs(Math.sin(rot)) < 0.5;
  if (along) solid(x - 1.5, 0, z - 0.3, x + 1.5, 0.81, z + 0.3, 'concrete'); else solid(x - 0.3, 0, z - 1.5, x + 0.3, 0.81, z + 1.5, 'concrete');
}
function barrel(B, x, z, mat, y = 0) {
  B.cyl(mat, x, y + 0.44, z, 0.29, 0.88, GEO.cyl20, 0.5);
  B.cyl(mat, x, y + 0.3, z, 0.3, 0.04, GEO.cyl20, 0.5); B.cyl(mat, x, y + 0.6, z, 0.3, 0.04, GEO.cyl20, 0.5);
}
function pallet(B, x, z, h = 1) {
  for (const dz of [-0.45, 0, 0.45]) B.box(M.wood, x, 0.06, z + dz, 1.2, 0.12, 0.1, 0, 0, 0, 1);
  B.box(M.wood, x, 0.14, z, 1.2, 0.03, 1.0, 0, 0, 0, 1);
  for (let k = 0; k < h; k++) B.box(M.cardboard, x + rr(-0.05, 0.05), 0.15 + 0.3 + k * 0.6, z + rr(-0.05, 0.05), 1.1, 0.58, 0.95, rr(-0.05, 0.05), 0, 0, 1);
  solid(x - 0.6, 0, z - 0.5, x + 0.6, 0.15 + h * 0.6, z + 0.5, 'wood');
}
function truck(B, x, z, v) {
  B.box(M.dark, x - 1, 0.9, z, 12.5, 0.35, 1.0);
  for (const wx of [-6, -4.8, 3.3, 5.3]) for (const s of [-1, 1]) B.cyl(M.rubber, x + wx, 0.5, z + s * 1.05, 0.5, 0.4, GEO.cyl20, 1, Math.PI / 2);
  B.box(M.yellow, x + 4.4, 1.9, z, 2.4, 2.4, 2.5);
  B.box(M.glass, x + 5.62, 2.3, z, 0.05, 1.0, 2.2, 0, 0, 0, 1);
  B.box(M.glass, x + 4.6, 2.3, z + 1.26, 1.6, 0.9, 0.05, 0, 0, 0, 1); B.box(M.glass, x + 4.6, 2.3, z - 1.26, 1.6, 0.9, 0.05, 0, 0, 0, 1);
  B.box(M.dark, x + 3.1, 3.4, z, 0.25, 1.2, 0.25);
  addContainer(x - 2.6, 1.08 + CH / 2, z, 0, v);
  solid(x - 8.7, 0, z - 1.3, x + 5.7, 1.08 + CH, z + 1.3, 'metal');
}
function lightMast(B, x, z) {
  B.box(M.concreteL, x, 0.3, z, 1.2, 0.6, 1.2, 0, 0, 0, 2);
  B.cyl(M.galv, x, 14.6, z, 0.28, 28, GEO.cyl12, 2);
  B.box(M.galv, x, 28.6, z, 3.4, 0.25, 0.25); B.box(M.galv, x, 28.6, z, 0.25, 0.25, 3.4);
  for (const [dx, dz] of [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3], [-0.6, -0.6], [0.6, 0.6]]) { B.box(M.dark, x + dx, 28.95, z + dz, 0.7, 0.45, 0.5); B.box(M.lamp, x + dx, 28.7, z + dz, 0.6, 0.06, 0.4); }
  solid(x - 0.6, 0, z - 0.6, x + 0.6, 28, z + 0.6, 'metal');
}

// ---------- 中继站（目标） ----------
function relay(B, root, x, z, id) {
  B.box(M.concreteL, x, 0.12, z, 3.2, 0.24, 3.2, 0, 0, 0, 2);
  const g = new THREE.Group(); g.position.set(x, 0.24, z); root.add(g);
  const cabMat = std({ color: 0x8d9296, roughness: 0.5, metalness: 0.6, normalMap: TEX.paintN, roughnessMap: TEX.paintR });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.8), cabMat); cab.position.set(0, 0.95, 0.5); cab.castShadow = cab.receiveShadow = true; g.add(cab);
  const scrMat = basic({ map: TEX.screen, color: new THREE.Color(1.6, 1.6, 1.6) });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), scrMat); scr.position.set(0, 1.35, 0.91); g.add(scr);
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.12), M.hazard); warn.position.set(0, 0.25, 0.905); g.add(warn);
  // 天线塔
  const tb = new Builder();
  const H = 7.5;
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) tb.rod(M.galv, V(dx * 1.4, 0, -0.6 + dz * 1.4), V(dx * 0.5, H, -0.6 + dz * 0.5), 0.035);
  for (let y = 0.6; y < H; y += 0.9) { const w = lerp(0.84, 0.3, y / H); tb.box(M.galv, 0, y, -0.6 - w / 2, w, 0.04, 0.04, 0, 0, 0, 1); tb.box(M.galv, 0, y, -0.6 + w / 2, w, 0.04, 0.04, 0, 0, 0, 1); tb.box(M.galv, -w / 2, y, -0.6, 0.04, 0.04, w, 0, 0, 0, 1); tb.box(M.galv, w / 2, y, -0.6, 0.04, 0.04, w, 0, 0, 0, 1); }
  tb.cyl(M.white, 0.35, H - 1.6, -0.6, 0.45, 0.12, GEO.cyl20, 1, Math.PI / 2 - 0.3, 0);
  tb.rod(M.dark, V(0, 0.4, 0.1), V(0, 0.05, -0.6), 0.05);
  tb.build(g);
  const lightMat = basic({ color: new THREE.Color(12, 0.5, 0.3) });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lightMat); lamp.position.set(0, H + 0.15, -0.6); lamp.layers.set(3); g.add(lamp);
  solid(x - 0.7, 0, z + 0.05, x + 0.7, 2.2, z + 0.95, 'metal');
  solid(x - 0.6, 0, z - 1.2, x + 0.6, H, z, 'metal');
  WORLD.relays.push({ id, pos: V(x, 1.2, z + 1.1), g, cab, cabMat, scr, scrMat, lamp, lightMat, done: false, progress: 0 });
}

// ---------- 世界主体 ----------
function buildWorld() {
  const root = new THREE.Group(); scene.add(root);
  const B = new Builder(), BF = new Builder(), BM = new Builder();
  // 地面
  { const g = new THREE.PlaneGeometry(1000, 520).toNonIndexed(); g.rotateX(-Math.PI / 2); g.translate(0, 0, 210); worldUV(g, 4);
    const m = new THREE.Mesh(g, M.concrete); m.receiveShadow = true; root.add(m); }
  // 码头岸线
  B.box(M.concreteL, 0, -1.6, -50.5, 1000, 3.2, 1.0, 0, 0, 0, 4);
  B.box(M.yellow, 0, 0.12, -50.22, 1000, 0.24, 0.55, 0, 0, 0, 2);
  for (let x = -96; x <= 96; x += 14) { B.cyl(M.dark, x, 0.5, -50.1, 0.22, 0.75, GEO.cyl12, 1); B.cyl(M.dark, x, 0.9, -50.1, 0.32, 0.1, GEO.cyl12, 1); }
  for (let x = -95; x <= 95; x += 9) B.box(M.rubber, x, -1.2, -51.15, 1.4, 1.8, 0.4, 0, 0, 0, 1);
  solid(-200, -5, -53, 200, 8, -49.85, 'none');
  // 轨道
  for (const z of [-47, -25]) BM.box(M.galv, 0, 0.02, z, 400, 0.05, 0.22, 0, 0, 0, 1);
  // 岸桥
  crane(B, -42, -72, 21, 1, 0, root);
  crane(B, 0, -37, 7.2, 3, 1, root);
  crane(B, 42, -78, 25, 5, 2, root);
  ship(B, root);
  // 堆场
  const rows = [[-11.6, -9.0], [3.0, 5.6], [17.2, 19.8], [31.0]];
  const slots = [-74, -61.4, -48.8, -23.6, -11, 11, 23.6, 48.8, 61.4, 74];
  const keep = [V(-62, 0, -3), V(8, 0, -36), V(62, 0, 25.4), WORLD.spawn];
  for (const pair of rows) for (const z of pair) for (const x of slots) {
    if (keep.some(k => Math.abs(k.x - x) < 9 && Math.abs(k.z - z) < 4.5)) continue;
    const h = pick(z > 28 ? [0, 1, 1, 2] : [0, 1, 2, 2, 3, 3, 4]);
    stack(x, z, h);
    if (h > 0) for (let k = 0; k < 4; k++) BM.box(M.markW, x + (k < 2 ? -6.4 : 6.4), 0.005, z + (k % 2 ? -1.4 : 1.4), 0.12, 0.01, 0.6, 0, 0, 0, 1);
  }
  stack(-36, 12, 1, Math.PI / 2); stack(36, -3, 2, Math.PI / 2); stack(-4, 24, 1, 0); stack(30, 38, 1, 0);
  // 仓库
  warehouse(B, root, -90, -13, 48, 70, 14, 0);
  warehouse(B, root, 13, 90, 48, 70, 14, 1);
  // 围栏
  const fence = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    BF.box(M.fence, (ax + bx) / 2, 1.3, (az + bz) / 2, L, 2.4, 0.01, -ang, 0, 0, 1);
    for (let t = 0; t <= L; t += 3) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; B.cyl(M.galv, x, 1.35, z, 0.04, 2.7, GEO.cyl8, 1); }
    B.rod(M.galv, V(ax, 2.55, az), V(bx, 2.55, bz), 0.025); B.rod(M.galv, V(ax, 0.15, az), V(bx, 0.15, bz), 0.02);
    solid(Math.min(ax, bx) - 0.15, 0, Math.min(az, bz) - 0.15, Math.max(ax, bx) + 0.15, 4, Math.max(az, bz) + 0.15, 'none');
  };
  fence(-95, -49.8, -95, 48); fence(95, -49.8, 95, 48); fence(-13, 60, 13, 60);
  B.box(M.hazard, 0, 1.0, 59.6, 9, 0.12, 0.12, 0, 0, 0, 0.6);
  // 灯塔
  for (const [x, z] of [[-36, -19], [36, -19], [-36, 40], [36, 40], [-84, 12], [84, 12]]) lightMast(B, x, z);
  // 卡车
  truck(B, 20, -18.5, 0); truck(B, -24, -17.5, 4); truck(B, 44, 12.5, 6); truck(B, -52, 25.2, 2);
  // 水泥隔离墩
  for (const [x, z, r] of [[-6, 13, 0], [-3, 13, 0], [7, 11.5, 0], [-30, 26, Math.PI / 2], [30, 26, 0], [33, 26, 0], [-14, -2.8, 0], [16, -2.5, 0], [56, -2.6, 0], [-46, 39, 0], [-49, 39, 0], [4, -20.5, 0], [-58, -19, 0], [70, -18, Math.PI / 2], [-75, 39, Math.PI / 2], [18, 33, 0]]) jersey(B, x, z, r);
  // 油桶、托盘
  const bm = [M.blue, M.red, M.yellow, M.blue];
  for (const [cx, cz] of [[-58, 41], [52, 41], [-30, -21], [70, 2], [-80, -24], [12, 40]]) {
    for (let i = 0; i < 6; i++) barrel(B, cx + (i % 3) * 0.62 + rr(-0.05, 0.05), cz + Math.floor(i / 3) * 0.62, pick(bm));
    solid(cx - 0.3, 0, cz - 0.3, cx + 1.55, 0.88, cz + 0.95, 'metal');
    pallet(B, cx + 2.6, cz, ri(1, 2)); pallet(B, cx + 2.6, cz + 1.4, ri(0, 2));
  }
  // 地面标线
  for (let x = -94; x < 94; x += 6) BM.box(M.markY, x, 0.005, -18, 3.2, 0.01, 0.15, 0, 0, 0, 1);
  for (let x = -94; x < 94; x += 6) BM.box(M.markY, x, 0.005, 26, 3.2, 0.01, 0.15, 0, 0, 0, 1);
  for (let z = -16; z < 46; z += 6) { BM.box(M.markY, 0, 0.005, z, 0.15, 0.01, 3.2, 0, 0, 0, 1); BM.box(M.markY, -36, 0.005, z, 0.15, 0.01, 3.2, 0, 0, 0, 1); BM.box(M.markY, 36, 0.005, z, 0.15, 0.01, 3.2, 0, 0, 0, 1); }
  BM.box(M.markY, 0, 0.005, -48.9, 1000, 0.01, 0.2, 0, 0, 0, 1);
  for (let i = 0; i < 8; i++) BM.box(M.markW, -5 + i * 1.4, 0.005, 44.5, 0.7, 0.01, 3.5, 0, 0, 0, 1);
  { const t = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), std({ map: TEX.berth, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
    t.rotation.x = -Math.PI / 2; t.position.set(-20, 0.01, -44); t.receiveShadow = true; root.add(t); }
  // 水洼
  for (let i = 0; i < 26; i++) {
    const x = rr(-90, 90), z = rr(-46, 46), s = rr(2, 7);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(s, s * rr(0.6, 1)), M.puddle); pm.rotation.x = -Math.PI / 2; pm.rotation.z = rr(0, TAU);
    pm.position.set(x, 0.012, z); pm.receiveShadow = true; root.add(pm);
  }
  // 中继站
  relay(B, root, -62, -3, 1); relay(B, root, 8, -36, 2); relay(B, root, 62, 25.4, 3);
  // 远处对岸天际线
  const far = new Builder();
  for (let i = 0; i < 60; i++) { const x = rr(-1400, 1400), w = rr(20, 80), h = rr(15, 90); far.box(M.dark, x, h / 2 - 2, rr(-1300, -1100), w, h, rr(20, 60), 0, 0, 0, 20); }
  for (let i = 0; i < 6; i++) { const x = -900 + i * 220 + rr(-40, 40); far.box(M.crane, x, 25, -1050, 4, 50, 4); far.box(M.crane, x, 48, -1070, 4, 4, 70); }
  far.build(root, false, false);
  // 自定义：标线/轨道不投影
  B.build(root); BM.build(root, false, true); BF.build(root, true, false, 3);
  buildContainers(root);
  // 碰撞：地图边界
  solid(-200, -5, 66, 200, 10, 80, 'none');
  buildNav();
}

// ---------- 射线 / 碰撞 ----------
function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT, t1, t2;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return -1; } else { t1 = (b.x0 - ox) / dx; t2 = (b.x1 - ox) / dx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) return -1; } else { t1 = (b.y0 - oy) / dy; t2 = (b.y1 - oy) / dy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return -1; } else { t1 = (b.z0 - oz) / dz; t2 = (b.z1 - oz) / dz; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  return tmin;
}
function raycastWorld(o, d, maxT, skipNone = true) {
  let best = maxT, hit = null;
  for (const b of WORLD.boxes) { if (skipNone && b.mat === 'none') continue; const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, b, best); if (t > 0 && t < best) { best = t; hit = b; } }
  let normal = null, mat = null;
  if (d.y < -1e-6) { const tg = -o.y / d.y; const gz = o.z + d.z * tg; if (tg > 0 && tg < best && gz > -50) { best = tg; hit = { ground: true }; } }
  if (!hit) return null;
  const p = V(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
  if (hit.ground) { normal = V(0, 1, 0); mat = 'concrete'; }
  else {
    const b = hit, e = 0.002;
    if (Math.abs(p.x - b.x0) < e) normal = V(-1, 0, 0); else if (Math.abs(p.x - b.x1) < e) normal = V(1, 0, 0);
    else if (Math.abs(p.y - b.y1) < e) normal = V(0, 1, 0); else if (Math.abs(p.y - b.y0) < e) normal = V(0, -1, 0);
    else if (Math.abs(p.z - b.z0) < e) normal = V(0, 0, -1); else normal = V(0, 0, 1);
    mat = b.mat;
  }
  return { t: best, point: p, normal, mat };
}
function losClear(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
  const ix = dx / L, iy = dy / L, iz = dz / L;
  for (const bx of WORLD.boxes) { if (bx.mat === 'none') continue; const t = rayBox(a.x, a.y, a.z, ix, iy, iz, bx, L); if (t > 0 && t < L) return false; }
  return true;
}
const STEP = 0.45;
function groundAt(x, z, feet, r) {
  let h = z > -49.9 ? 0 : -20;
  for (const b of WORLD.boxes) {
    if (b.mat === 'none') continue;
    if (x > b.x0 - r * 0.7 && x < b.x1 + r * 0.7 && z > b.z0 - r * 0.7 && z < b.z1 + r * 0.7 && b.y1 <= feet + STEP && b.y1 > h) h = b.y1;
  }
  return h;
}
function collideCircle(pos, r, feet, height) {
  for (const b of WORLD.boxes) {
    if (b.y1 <= feet + STEP || b.y0 >= feet + height) continue;
    const nx = clamp(pos.x, b.x0, b.x1), nz = clamp(pos.z, b.z0, b.z1);
    const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
    else {
      const l = pos.x - b.x0, rr_ = b.x1 - pos.x, f = pos.z - b.z0, k = b.z1 - pos.z, m = Math.min(l, rr_, f, k);
      if (m === l) pos.x = b.x0 - r; else if (m === rr_) pos.x = b.x1 + r; else if (m === f) pos.z = b.z0 - r; else pos.z = b.z1 + r;
    }
  }
}

// ---------- 导航网格 + 流场 ----------
const NAV = { x0: -96, z0: -50, w: 192, h: 117 };
function buildNav() {
  const N = NAV.w * NAV.h; NAV.block = new Uint8Array(N); NAV.dist = new Int32Array(N); NAV.q = new Int32Array(N);
  for (const b of WORLD.boxes) {
    if (b.y0 > 1.7 || b.y1 < 0.3) continue;
    const i0 = Math.max(0, Math.floor(b.x0 - 0.45 - NAV.x0)), i1 = Math.min(NAV.w - 1, Math.floor(b.x1 + 0.45 - NAV.x0));
    const j0 = Math.max(0, Math.floor(b.z0 - 0.45 - NAV.z0)), j1 = Math.min(NAV.h - 1, Math.floor(b.z1 + 0.45 - NAV.z0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) NAV.block[j * NAV.w + i] = 1;
  }
  for (let i = 0; i < NAV.w; i++) { NAV.block[i] = 1; NAV.block[(NAV.h - 1) * NAV.w + i] = 1; }
  for (let j = 0; j < NAV.h; j++) { NAV.block[j * NAV.w] = 1; NAV.block[j * NAV.w + NAV.w - 1] = 1; }
}
const navCell = (x, z) => { const i = Math.floor(x - NAV.x0), j = Math.floor(z - NAV.z0); return (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) ? -1 : j * NAV.w + i; };
function navFree(x, z) { const c = navCell(x, z); return c >= 0 && !NAV.block[c]; }
function buildFlow(x, z) {
  const D = NAV.dist, Q = NAV.q, W = NAV.w; D.fill(-1);
  let s = navCell(x, z); if (s < 0) return;
  let qh = 0, qt = 0; D[s] = 0; Q[qt++] = s;
  while (qh < qt) {
    const k = Q[qh++], i = k % W, j = (k / W) | 0, dk = D[k] + 1;
    if (i > 0 && !NAV.block[k - 1] && D[k - 1] < 0) { D[k - 1] = dk; Q[qt++] = k - 1; }
    if (i < W - 1 && !NAV.block[k + 1] && D[k + 1] < 0) { D[k + 1] = dk; Q[qt++] = k + 1; }
    if (j > 0 && !NAV.block[k - W] && D[k - W] < 0) { D[k - W] = dk; Q[qt++] = k - W; }
    if (j < NAV.h - 1 && !NAV.block[k + W] && D[k + W] < 0) { D[k + W] = dk; Q[qt++] = k + W; }
  }
}
const _fl = V();
function flowDir(x, z) {
  let c = navCell(x, z); if (c < 0) return null;
  const W = NAV.w;
  for (let step = 0; step < 3; step++) {
    const here = NAV.dist[c]; if (here <= 0) break;
    let best = here, bc = c;
    for (const o of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]) {
      const n = c + o; if (n < 0 || n >= NAV.dist.length) continue;
      const v = NAV.dist[n]; if (v >= 0 && v < best) {
        if (Math.abs(o) !== 1 && Math.abs(o) !== W) { const ox = (o % W + W) % W === 1 ? 1 : -1; if (NAV.block[c + (o > 0 ? W : -W)] || NAV.block[c + ox]) continue; }
        best = v; bc = n;
      }
    }
    if (bc === c) break; c = bc;
  }
  const tx = NAV.x0 + (c % W) + 0.5, tz = NAV.z0 + ((c / W) | 0) + 0.5;
  _fl.set(tx - x, 0, tz - z); const L = _fl.length(); if (L < 0.05) return null; return _fl.multiplyScalar(1 / L);
}
