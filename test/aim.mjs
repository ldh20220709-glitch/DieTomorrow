import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const file = process.argv[2], out = process.argv[3];
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--mute-audio', '--remote-debugging-port=9334', '--window-size=1280,720', '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'fpsprof-')), '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws; for (let i = 0; i < 40; i++) { try { const j = await (await fetch('http://127.0.0.1:9334/json')).json(); const p = j.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const logs = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ')); };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const shot = async n => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, n), Buffer.from(r.result.data, 'base64')); };
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `let __l=null;Object.defineProperty(Document.prototype,'pointerLockElement',{get:()=>__l});HTMLCanvasElement.prototype.requestPointerLock=function(){__l=this;setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10)};Document.prototype.exitPointerLock=function(){__l=null;setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10)};` });
await cmd('Page.navigate', { url: 'file://' + file + '#test' });
await sleep(2500);
await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
// 自动瞄准：每 100ms 锁定最近可见敌人（瞄身体或头部），无敌（回满血）以便测试多波
const AIM = `(()=>{const d=window.__dbg,p=d.player;p.hp=100;let best=null,bd=1e9;for(const e of d.enemies){if(e.dead)continue;const dist=Math.hypot(e.pos.x-p.pos.x,e.pos.z-p.pos.z);if(dist<bd&&d.hasLOS(e.pos,p.pos)){bd=dist;best=e;}}
if(!best)return 'none';const h=(${'${HEAD}'})*best.T.scale;const dx=best.pos.x-p.pos.x,dz=best.pos.z-p.pos.z,dy=h-(p.pos.y+p.eye);p.yaw=Math.atan2(-dx,-dz);p.pitch=Math.atan2(dy,Math.hypot(dx,dz));return 'aim';})()`;
let shots = 0;
for (let t = 0; t < 400; t++) {
  const head = t % 3 === 0 ? 1.95 : 1.25;
  const r = await ev(AIM.replace('${HEAD}', head));
  if (r === 'aim') { await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 }); shots++; }
  else await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
  if (t === 60 || t === 200) await shot(`6-aim${t}.png`);
  await sleep(100);
}
await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await shot('7-aim-end.png');
console.log('HUD', await ev(`JSON.stringify({wave:wave.textContent,score:score.textContent,kills:kills.textContent,alive:alive.textContent,mag:mag.textContent,fps:fps.textContent})`), 'aimTicks', shots);
console.log(logs.join('\n') || 'NO CONSOLE OUTPUT');
ws.close(); chrome.kill();
