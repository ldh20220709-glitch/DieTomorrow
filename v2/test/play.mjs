// 冒烟测试：加载 → 开始 → 走动/开火/开镜/换弹 → 切断中继站 → 撤离 → 结算，逐步截图
import { launch, sleep } from './cdp.mjs';
const [file, out] = process.argv.slice(2);
const b = await launch({ port: 9341, w: 800, h: 450 });
// 软件渲染帧率低，等待一律按游戏内时间计
const gwait = async sec => { const t = await b.ev('__g.t'); await b.waitFor(`__g.t >= ${t + sec}`, 300000); };
await b.cmd('Page.addScriptToEvaluateOnNewDocument', { source: `
  let __locked = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => __locked });
  HTMLCanvasElement.prototype.requestPointerLock = function(){ __locked = this; setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10); };
  Document.prototype.exitPointerLock = function(){ __locked = null; setTimeout(()=>document.dispatchEvent(new Event('pointerlockchange')),10); };` });
const t0 = Date.now();
await b.cmd('Page.navigate', { url: 'file://' + file });
console.log('ready', await b.waitFor('window.__g && __g.state === "ready"', 240000), ((Date.now() - t0) / 1000).toFixed(1) + 's');
await sleep(1500); await b.shot(`${out}/p0-title.png`);
const st = () => b.ev(`JSON.stringify({s:__g.state,hp:Math.round(__g.PLAYER.hp),pos:[__g.PLAYER.pos.x,__g.PLAYER.pos.y,__g.PLAYER.pos.z].map(v=>+v.toFixed(1)),alive:__g.Enemies.alive(),kills:__g.PLAYER.kills,shots:__g.PLAYER.shots,hits:__g.PLAYER.hits,mag:__g.Weapon.ammo[__g.Weapon.cur].mag,phase:__g.MISSION.phase,cut:__g.MISSION.cut,hold:+__g.MISSION.holdT.toFixed(1),fps:fps.textContent,obj:objS.textContent})`);
const click = async () => { await b.cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 225, button: 'left', clickCount: 1 }); await b.cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 225, button: 'left', clickCount: 1 }); };
const key = (code, down) => b.ev(`dispatchEvent(new KeyboardEvent('${down ? 'keydown' : 'keyup'}',{code:'${code}'}))`);
const mouse = (btn, down) => b.ev(`dispatchEvent(new MouseEvent('${down ? 'mousedown' : 'mouseup'}',{button:${btn}}))`);
// 把准星对准最近的活着的敌人
const aimNearest = () => b.ev(`(()=>{const P=__g.PLAYER;let best=null,bd=1e9;for(const e of __g.Enemies.list){if(e.dead)continue;const d=e.pos.distanceTo(P.pos);if(d<bd){bd=d;best=e;}}if(!best)return -1;const dx=best.pos.x-P.pos.x,dz=best.pos.z-P.pos.z;P.yaw=Math.atan2(-dx,-dz);P.pitch=Math.atan2(1.25-(P.pos.y+P.eye),Math.hypot(dx,dz));P.rec=0;return +bd.toFixed(1);})()`);
await click(); await gwait(1.5);
console.log('start', await st()); await b.shot(`${out}/p1-start.png`);
await key('KeyW', true); await gwait(2.5); await key('KeyW', false);
console.log('walk', await st());
await mouse(0, true); await gwait(0.9); await b.shot(`${out}/p2-fire.png`); await mouse(0, false);
await mouse(2, true); await gwait(0.7); await b.shot(`${out}/p3-ads.png`); await mouse(2, false);
await key('KeyR', true); await key('KeyR', false); await gwait(0.7); await b.shot(`${out}/p4-reload.png`); await gwait(2.2);
console.log('fired', await st());
// 传送到一个敌人 14m 外并交火
// 传送到一个对敌人有视线的位置并交火
console.log('combat pos', await b.ev(`(()=>{const P=__g.PLAYER;for(const e of __g.Enemies.list){if(e.dead)continue;for(let k=0;k<40;k++){const a=Math.random()*6.28,x=e.pos.x+Math.cos(a)*13,z=e.pos.z+Math.sin(a)*13;if(navFree(x,z)&&losClear(new THREE.Vector3(x,1.6,z),new THREE.Vector3(e.pos.x,1.3,e.pos.z))){P.pos.set(x,0,z);return [x,z].map(v=>+v.toFixed(1));}}}return null;})()`));
for (let i = 0; i < 40; i++) { const d = await aimNearest(); if (i === 0) console.log('nearest', d); await mouse(0, true); await gwait(0.18); if (i === 1) await b.shot(`${out}/p5-combat.png`); const k = await b.ev('__g.PLAYER.kills'); if (k >= 2) break; }
await mouse(0, false);
console.log('combat', await st()); await b.shot(`${out}/p6-after.png`);
// 中继站：传送过去长按 E
await b.ev(`__g.PLAYER.hp=100;(()=>{const r=__g.WORLD.relays[0];__g.PLAYER.pos.set(r.pos.x,0,r.pos.z+0.6);__g.PLAYER.yaw=0;__g.PLAYER.pitch=0;})()`);
await gwait(0.4); await b.shot(`${out}/p7-relay.png`);
await key('KeyE', true); await gwait(4.2); await key('KeyE', false);
console.log('relay1', await st()); await b.shot(`${out}/p8-relaydown.png`);
await b.ev(`__g.PLAYER.hp=100;__g.cut(__g.WORLD.relays[1]);__g.cut(__g.WORLD.relays[2]);`);
await gwait(0.6); console.log('all cut', await st());
await b.ev(`__g.PLAYER.hp=100;__g.PLAYER.pos.set(__g.WORLD.extract.x,0,__g.WORLD.extract.z+3);__g.PLAYER.yaw=0;__g.PLAYER.pitch=0.3;`);
await gwait(1.5); console.log('hold', await st());
await b.ev(`__g.MISSION.holdT=9;`);
for (let i = 0; i < 6; i++) { await gwait(1.0); await b.ev(`__g.PLAYER.hp=100;`); if (i === 4) await b.shot(`${out}/p9-heli.png`); }
await gwait(3.5); console.log('end', await st());
await gwait(3.5); await b.shot(`${out}/p10-end.png`);
console.log('overlay', await b.ev(`overlay.style.display + ' | ' + obox.innerText.replace(/\\n+/g,' / ')`));
console.log(b.logs.filter(l => !l.startsWith('NET: file')).join('\n') || 'NO LOGS');
b.close();
