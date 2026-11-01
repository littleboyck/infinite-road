/**
 * plan-d.js —— 方案 D：真·渐进路径追踪（three-gpu-pathtracer）
 *
 * 和方案 B 的区别：
 *   B 是「一次光栅 + 往上糊噪点」，噪点是假的时间曲线；
 *   D 是每帧真的多投一次光线的采样，噪点由 1/√N 自然收敛，没有可以调的「噪点幅度」。
 *
 * 所以你在这里看到的大麻点，是 φ（相位/抖动）真实积累出来的，
 * 阴影、反射、玻璃的噪点各自按自己的方差衰减，不会整屏同步变干净。
 */
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { buildScene } from './scene.js';

const canvas = document.getElementById('view');
const hud = {
  samples: document.getElementById('hud-samples'),
  target: document.getElementById('hud-target'),
  time: document.getElementById('hud-time'),
  rate: document.getElementById('hud-rate'),
  bar: document.getElementById('hud-bar'),
  state: document.getElementById('hud-state'),
  res: document.getElementById('hud-res'),
};

const { renderer, scene, camera, controls, resize, sky } = await buildScene(canvas, {
  forPathtracer: true,
});

// ------------------------------------------------------------------ 路径追踪器
const pt = new WebGLPathTracer(renderer);
pt.bounces = 8;                 // 最大弹射次数
pt.filteredGlossyFactor = 1.5;  // 压一下高光萤火虫
pt.minSamples = 2;              // 前 2 个采样就先把画面显示出来（所以一开始就是满屏大噪点）
pt.renderDelay = 0;
pt.fadeDuration = 0;
pt.renderToCanvas = true;
pt.synchronizeRenderSize = true;
pt.renderScale = 1;

const state = {
  target: 128,
  building: true,
  startedAt: 0,
  doneAt: 0,
};

hud.state.textContent = '正在构建 BVH…（车是 50 万面）';

// 让上面这句话先画到屏幕上，再开工
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const t0 = performance.now();
pt.setScene(scene, camera);      // 建 BVH + 打图集，比较重
const buildMs = performance.now() - t0;

state.building = false;
state.startedAt = performance.now();
hud.res.textContent = Math.round(buildMs) + ' ms';
const { w, h } = resize();
hud.state.textContent = '追踪中…';

// ------------------------------------------------------------------ 相机变化：等停稳再重建
let lastChange = 0;
let cameraDirty = false;
let dragging = false;
let paused = false;

controls.addEventListener('start', () => { dragging = true; });
controls.addEventListener('change', () => {
  lastChange = performance.now();
  cameraDirty = true;
});
controls.addEventListener('end', () => {
  dragging = false;
  lastChange = performance.now();
});

const targetSel = document.getElementById('in-target');
state.target = Number(targetSel.value);
targetSel.addEventListener('change', () => {
  state.target = Number(targetSel.value);
  restart();
});
document.getElementById('btn-reset').addEventListener('click', restart);

function restart() {
  pt.reset();
  state.startedAt = performance.now();
  state.doneAt = 0;
}

window.addEventListener('resize', () => {
  resize();
  pt.setScene(scene, camera);   // 尺寸变了要重建一次
  restart();
});

// ------------------------------------------------------------------ 主循环
let lastSamples = 0;
let lastSampleTime = performance.now();

function tick(now) {
  controls.update();

  // 相机停稳 180ms 后再重建，避免阻尼过程中疯狂 reset
  if (cameraDirty && !dragging && now - lastChange > 180) {
    cameraDirty = false;
    pt.updateCamera();
    restart();
  }

  // 拖动时暂停积累，省算力、拖得顺
  if (!paused && !dragging && !state.building && pt.samples < state.target) {
    pt.renderSample();
  }

  const s = pt.samples;
  if (s !== lastSamples) {
    lastSamples = s;
    lastSampleTime = now;
  }
  if (s >= state.target && !state.doneAt) {
    state.doneAt = now;
    hud.state.textContent = '已收敛（' + state.target + ' 采样）';
  }

  hud.samples.textContent = String(Math.floor(Math.min(s, state.target)));
  hud.target.textContent = String(state.target);
  hud.bar.style.width = Math.min(100, (s / state.target) * 100).toFixed(1) + '%';
  const elapsed = ((state.doneAt || now) - state.startedAt) / 1000;
  hud.time.textContent = elapsed.toFixed(2) + ' s';
  if (s > 0) {
    const perSample = ((state.doneAt || now) - state.startedAt) / Math.max(1, s);
    hud.rate.textContent = perSample.toFixed(1) + ' ms/采样';
  }
  if (!state.doneAt && s < state.target) hud.state.textContent = '追踪中…';

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ------------------------------------------------------------------ 给对比页用
window.__planD = {
  restart,
  pause() { paused = true; },
  resume() { paused = false; state.startedAt = performance.now() - 1; },
  get state() {
    return { samples: pt.samples, target: state.target, done: !!state.doneAt };
  },
};
window.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'reset') restart();
  if (e.data.type === 'pause') paused = true;
  if (e.data.type === 'resume') paused = false;
});
