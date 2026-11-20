// 人物特写：冻结 AI，隐藏武器与 HUD，逐个姿态截图
import { launch, sleep } from './cdp.mjs';
const [file, out] = process.argv.slice(2);
const b = await launch({ port: 9342, w: 1280, h: 720 });
await b.cmd('Page.addScriptToEvaluateOnNewDocument', { source: `
  let __locked = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => __locked });
  HTMLCanvasElement.prototype.requestPointerLock = function(){ __locked = this; setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10); };
  Document.prototype.exitPointerLock = function(){ __locked = null; };` });
await b.cmd('Page.navigate', { url: 'file://' + file });
await b.waitFor('window.__g && __g.state === "ready"', 240000);
const gwait = async sec => { const t = await b.ev('__g.t'); await b.waitFor(`__g.t >= ${t + sec}`, 300000); };
await b.cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await b.cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await b.waitFor('__g.state === "playing"');
// 三个兵种并排站在出生点南侧的空地上，面朝镜头（+Z）
await b.ev(`(()=>{const B={x:0,z:38};['rifleman','gunner','rusher'].forEach((t,i)=>{const e=__g.Enemies.spawn(t,B.x+(i-1)*1.25,B.z);e.yaw=Math.PI;e.m.g.rotation.y=Math.PI;e.frozen=true;});__g.freeze=true;__g.photo(true);})()`);
const cam = (x, z, yaw, pitch, crouch = 0) => b.ev(`(()=>{const P=__g.PLAYER;P.pos.set(${x},0,${z});P.yaw=${yaw};P.pitch=${pitch};})()`);
const shots = [
  ['m0-front', 'stand', 0, 41.6, 0, -0.17],
  ['m1-close', 'stand', 0.4, 39.9, 0.2, -0.1],
  ['m2-side', 'stand', -3.6, 38, -Math.PI / 2, -0.17],
  ['m3-back', 'stand', 0, 34.6, Math.PI, -0.17],
  ['m4-crouch', 'crouch', 1.5, 41.3, 0.4, -0.3],
  ['m5-hide', 'hide', 1.5, 41.3, 0.4, -0.33],
  ['m6-run', 'run', -2.6, 40.6, -0.75, -0.2],
  ['m7-patrol', 'patrol', 1.8, 41.2, 0.5, -0.2],
];
for (const [name, pose, x, z, yaw, pitch] of shots) {
  await b.ev(`__g.poseAll('${pose}')`); await cam(x, z, yaw, pitch);
  await gwait(0.9); await b.shot(`${out}/${name}.png`); console.log(name);
}
console.log(b.logs.filter(l => !l.startsWith('NET: file')).join('\n') || 'NO LOGS');
b.close();
