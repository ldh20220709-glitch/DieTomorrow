// 标题画面与开场横幅截图
import { launch } from './cdp.mjs';
const [file, out] = process.argv.slice(2);
const b = await launch({ port: 9343, w: 1280, h: 720 });
await b.cmd('Page.addScriptToEvaluateOnNewDocument', { source: `let __l=null;Object.defineProperty(Document.prototype,'pointerLockElement',{get:()=>__l});HTMLCanvasElement.prototype.requestPointerLock=function(){__l=this;setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10);};` });
await b.cmd('Page.navigate', { url: 'file://' + file });
await b.waitFor('window.__g && __g.state === "ready"', 240000);
await b.waitFor(`__frames > ${await b.ev('__frames') + 3}`); await b.shot(`${out}/t0-title.png`);
await b.cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await b.cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await b.waitFor('__g.state === "playing" && __g.t > 1.2'); await b.shot(`${out}/t1-banner.png`);
console.log(b.logs.filter(l => !l.startsWith('NET: file')).join('\n') || 'NO LOGS'); b.close();
