import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const file = process.argv[2], out = process.argv[3];
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9333', '--window-size=1280,720', '--no-first-run', '--mute-audio',
  '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'fpsprof-')), '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40; i++) { try { const j = await (await fetch('http://127.0.0.1:9333/json')).json(); const p = j.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const logs = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Network.requestWillBeSent') logs.push('NET: ' + d.params.request.url.slice(0, 80)); };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const shot = async name => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(r.result.data, 'base64')); };
const key = async (type, code, k) => cmd('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) });
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Network.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `
  let __locked = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => __locked });
  HTMLCanvasElement.prototype.requestPointerLock = function(){ __locked = this; setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10); };
  Document.prototype.exitPointerLock = function(){ __locked = null; setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10); };` });
await cmd('Page.navigate', { url: 'file://' + file });
await sleep(2500);
await shot('1-start.png');
await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await sleep(1500);
await shot('2-wave.png');
// 转一圈找敌人 + 前进 + 开火
await key('keyDown', 'KeyW', 'w');
for (let i = 0; i < 30; i++) { await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640 + (i % 2), y: 360 }); await ev(`document.dispatchEvent(new MouseEvent('mousemove',{movementX:25,movementY:0}))`); await sleep(60); }
await key('keyUp', 'KeyW', 'w');
await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await sleep(700);
await shot('3-firing.png');
await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await key('keyDown', 'KeyR', 'r'); await key('keyUp', 'KeyR', 'r');
for (let k = 0; k < 4; k++) { await sleep(5000); await shot("5-t" + k + ".png"); console.log("T" + k, await ev(`JSON.stringify({alive:alive.textContent,hp:hpv.textContent})`)); }
await shot('4-later.png');
const hud = await ev(`JSON.stringify({wave:wave.textContent,score:score.textContent,alive:alive.textContent,hp:hpv.textContent,mag:mag.textContent,fps:fps.textContent,overlay:overlay.style.display})`);
console.log('HUD', hud);
console.log(logs.join('\n') || 'NO CONSOLE OUTPUT');
ws.close(); chrome.kill();
