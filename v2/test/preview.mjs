import { launch, sleep } from './cdp.mjs';
const [file, out, ...views] = process.argv.slice(2);
const b = await launch();
const t0 = Date.now();
await b.cmd('Page.navigate', { url: 'file://' + file });
const ok = await b.waitFor('window.__frames > 3', 180000);
console.log('ready', ok, ((Date.now() - t0) / 1000).toFixed(1) + 's');
for (let i = 0; i < views.length; i++) {
  await b.ev(`window.__cam(${views[i]})`);
  const f0 = await b.ev('window.__frames'); await b.waitFor(`window.__frames > ${f0 + 2}`, 60000);
  const t1 = Date.now(); const f1 = await b.ev('window.__frames'); await sleep(1500); const f2 = await b.ev('window.__frames');
  console.log('view', i, 'fps≈', ((f2 - f1) / ((Date.now() - t1) / 1000)).toFixed(1));
  await b.shot(`${out}/v${i}.png`);
}
console.log(b.logs.join('\n') || 'NO LOGS');
b.close();
