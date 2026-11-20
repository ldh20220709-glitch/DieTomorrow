// 临时预览入口：只渲染场景，用 window.__cam 控制机位
(async () => {
  const prog = (t, p) => { $('ldt').textContent = t; $('ldb').style.width = (p * 100) + '%'; };
  await genAllTextures(prog);
  buildMaterials(); buildSky(); buildWorld();
  const gunScene = new THREE.Scene(), gunCam = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
  function resize() { const pr = Math.min(devicePixelRatio, 1.5); renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); Post.resize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr)); renderer.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr), false); }
  resize();
  $('overlay').style.display = 'none';
  window.__cam = (x, y, z, yaw, pitch) => { camera.position.set(x, y, z); camera.rotation.set(pitch, yaw, 0); };
  window.__cam(0, 1.65, 42, 0, 0.05);
  const clock = new THREE.Clock();
  window.__frames = 0;
  (function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05); U.time.value += dt;
    camera.updateMatrixWorld(); updateFogUniforms(); updateSky(dt, U.time.value);
    Post.render(gunScene, gunCam, { damage: 0, lowHp: 0, flash: 0, ads: 0 });
    window.__frames++;
  })();
})().catch(e => { console.error(e.stack || e); });
