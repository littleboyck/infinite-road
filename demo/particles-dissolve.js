/**
 * particles.js —— 粒子崩解 / 聚合态特效
 *
 * 参考图要点：模型表面被「吃掉」一块，缺口边缘是不规则斑块，粒子（方形 voxel）飞散，
 * 崩解前沿带黄白烧蚀高光。
 *
 * 实现：
 *   1. 表面按面积加权采样 N 个点，每个点存 位置 / 法线 / 3D 噪声值 aNoise / 外飞方向；
 *   2. 用 aNoise 当「侵蚀阈值」：uProgress 0→1 时噪声低的区域先崩，
 *      所以崩解边缘是不规则斑块，而不是整体同时散开；
 *   3. 崩解前沿（local≈0.5）额外加暖色高光 → 烧蚀边缘；
 *   4. 粒子是方块（voxel 感），按深度衰减、按法线打光。
 *
 * 反向播放 = 聚合。实体车 mesh 隐藏，全部由粒子表达。
 */
import * as THREE from 'three';
import { buildScene } from './scene.js';

const canvas = document.getElementById('view');
const hud = {
  progress: document.getElementById('hud-progress'),
  count: document.getElementById('hud-count'),
  time: document.getElementById('hud-time'),
  fps: document.getElementById('hud-fps'),
  bar: document.getElementById('hud-bar'),
  state: document.getElementById('hud-state'),
};

const { renderer, scene, camera, controls, resize, car, sun } = await buildScene(canvas);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

// 实体车保留（由材质里的噪声 discard 负责「消失」），粒子只在被吃掉的地方出现
const carMeshes = [];
car.traverse((o) => {
  if (o.isMesh) {
    o.visible = true;
    carMeshes.push(o);
  }
});

// 实体与粒子共用同一段 GLSL 噪声 → 崩解边界完全对齐
const NOISE_GLSL = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.27, 0.43));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) {
    return 0.62 * vnoise3(p) + 0.26 * vnoise3(p * 2.1 + 13.1) + 0.12 * vnoise3(p * 4.3 + 7.7);
  }
`;

// 实体材质加「噪声侵蚀」：nz < uDissolve 的像素直接 discard，边缘加暖色高光
const dissolveU = {
  uDissolve: { value: 0 },
  uNoiseScale: { value: 2.2 },
};
for (const mesh of carMeshes) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of mats) {
    if (!mat || mat.userData.__dissolve) continue;
    mat.userData.__dissolve = true;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDissolve = dissolveU.uDissolve;
      shader.uniforms.uNoiseScale = dissolveU.uNoiseScale;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>',
                 '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uDissolve;\nuniform float uNoiseScale;\n' + NOISE_GLSL)
        .replace('#include <clipping_planes_fragment>',
                 '#include <clipping_planes_fragment>\nfloat dNz = fbm3(vWPos * uNoiseScale);\nif (dNz < uDissolve) discard;')
        .replace('#include <emissivemap_fragment>',
                 '#include <emissivemap_fragment>\nfloat dEdge = 1.0 - smoothstep(0.0, 0.028, dNz - uDissolve);\ntotalEmissiveRadiance += vec3(1.0, 0.82, 0.5) * dEdge * 1.1;');
    };
    mat.needsUpdate = true;
  }
}

car.updateWorldMatrix(true, true);
const bbox = new THREE.Box3().setFromObject(car);
const carRadius = bbox.getSize(new THREE.Vector3()).length() * 0.5;

// ------------------------------------------------------------------ 3D value noise
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), sz = zf * zf * (3 - 2 * zf);
  const n = (a, b, c) => hash3(xi + a, yi + b, zi + c);
  const c00 = n(0, 0, 0) * (1 - sx) + n(1, 0, 0) * sx;
  const c10 = n(0, 1, 0) * (1 - sx) + n(1, 1, 0) * sx;
  const c01 = n(0, 0, 1) * (1 - sx) + n(1, 0, 1) * sx;
  const c11 = n(0, 1, 1) * (1 - sx) + n(1, 1, 1) * sx;
  const c0 = c00 * (1 - sy) + c10 * sy;
  const c1 = c01 * (1 - sy) + c11 * sy;
  return c0 * (1 - sz) + c1 * sz;
}
function fbm3(x, y, z) {
  return 0.62 * noise3(x, y, z)
    + 0.26 * noise3(x * 2.1 + 13.1, y * 2.1, z * 2.1)
    + 0.12 * noise3(x * 4.3, y * 4.3 + 7.7, z * 4.3);
}

// ------------------------------------------------------------------ 表面面积加权采样
function sampleSurface(count) {
  const triPos = [];
  const triNrm = [];
  const triArea = [];

  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  for (const mesh of carMeshes) {
    const g = mesh.geometry;
    const pos = g.attributes.position;
    if (!pos) continue;
    const nrm = g.attributes.normal;
    const idx = g.index;
    const mw = mesh.matrixWorld;
    const triCount = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      vA.fromBufferAttribute(pos, i0).applyMatrix4(mw);
      vB.fromBufferAttribute(pos, i1).applyMatrix4(mw);
      vC.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      const ab = vB.clone().sub(vA);
      const ac = vC.clone().sub(vA);
      const cr = ab.clone().cross(ac);
      const area = cr.length() * 0.5;
      if (!(area > 1e-9)) continue;
      triPos.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
      if (nrm) {
        const n0 = new THREE.Vector3().fromBufferAttribute(nrm, i0).normalize();
        const n1 = new THREE.Vector3().fromBufferAttribute(nrm, i1).normalize();
        const n2 = new THREE.Vector3().fromBufferAttribute(nrm, i2).normalize();
        triNrm.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
      } else {
        const fn = cr.clone().normalize();
        triNrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
      }
      triArea.push(area);
    }
  }

  const nTri = triArea.length;
  const cum = new Float64Array(nTri);
  let total = 0;
  for (let i = 0; i < nTri; i++) { total += triArea[i]; cum[i] = total; }

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const p = new THREE.Vector3(), n = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = nTri - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    const o = lo * 9;
    a.set(triPos[o], triPos[o + 1], triPos[o + 2]);
    b.set(triPos[o + 3], triPos[o + 4], triPos[o + 5]);
    c.set(triPos[o + 6], triPos[o + 7], triPos[o + 8]);
    na.set(triNrm[o], triNrm[o + 1], triNrm[o + 2]);
    nb.set(triNrm[o + 3], triNrm[o + 4], triNrm[o + 5]);
    nc.set(triNrm[o + 6], triNrm[o + 7], triNrm[o + 8]);

    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    p.copy(a).multiplyScalar(w).addScaledVector(b, u).addScaledVector(c, v);
    n.copy(na).multiplyScalar(w).addScaledVector(nb, u).addScaledVector(nc, v);
    if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
    n.normalize();

    const lift = 0.0015 + Math.random() * 0.005;
    positions[i * 3] = p.x + n.x * lift;
    positions[i * 3 + 1] = p.y + n.y * lift;
    positions[i * 3 + 2] = p.z + n.z * lift;
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  }

  return { positions, normals };
}

// ------------------------------------------------------------------ 状态
const state = {
  count: 160000,
  duration: 3600,
  scatter: 0.5,
  noiseScale: 2.2,
  mode: 'dissolve',   // dissolve = 崩解；aggregate = 聚合
  loop: true,
  paused: false,
  progress: 0,
  startedAt: performance.now(),
  fps: 0,
  buildMs: 0,
};

let points = null;

function build(count) {
  const t0 = performance.now();
  const { positions, normals } = sampleSurface(count);
  const n = count;

  const dirAttr = new Float32Array(n * 3);
  const seedAttr = new Float32Array(n);
  const colorAttr = new Float32Array(n * 3);

  const cBase = new THREE.Color(0x9fc4ff);
  const cDeep = new THREE.Color(0x3f63c8);
  const cHot = new THREE.Color(0xffd98a);
  const tmp = new THREE.Color();

  for (let i = 0; i < n; i++) {
    seedAttr[i] = Math.random();

    const jit = 0.55;
    let dx = normals[i * 3] + (Math.random() - 0.5) * jit;
    let dy = normals[i * 3 + 1] + (Math.random() - 0.5) * jit;
    let dz = normals[i * 3 + 2] + (Math.random() - 0.5) * jit;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dirAttr[i * 3] = dx / dl;
    dirAttr[i * 3 + 1] = dy / dl;
    dirAttr[i * 3 + 2] = dz / dl;

    const k = Math.random();
    if (k > 0.94) tmp.copy(cHot);
    else if (k > 0.55) tmp.copy(cBase);
    else tmp.copy(cDeep);
    const j = 0.8 + Math.random() * 0.45;
    colorAttr[i * 3] = tmp.r * j;
    colorAttr[i * 3 + 1] = tmp.g * j;
    colorAttr[i * 3 + 2] = tmp.b * j;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirAttr, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seedAttr, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colorAttr, 3));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius *= 4;

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 0.010 },
      uProj: { value: 1000 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uScatter: { value: state.scatter },
      uNoiseScale: { value: state.noiseScale },
      uRadius: { value: carRadius },
      uLightDir: { value: (sun ? sun.position.clone() : new THREE.Vector3(3, 6, 4)).normalize() },
    },
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      attribute vec3  aNormal;
      attribute vec3  aDir;
      attribute vec3  aColor;
      attribute float aSeed;

      uniform float uProgress;
      uniform float uTime;
      uniform float uSize;
      uniform float uProj;
      uniform float uPixelRatio;
      uniform float uScatter;
      uniform float uRadius;
      uniform vec3  uLightDir;
      uniform float uNoiseScale;

      varying vec3  vColor;

      ${''}
      varying float vAlpha;

      void main() {
        // 侵蚀：与实体材质用同一噪声 → 斑块边缘完全对齐
        float nz = fbm3(position * uNoiseScale);
        float band = 0.10;
        float local = smoothstep(nz - band, nz + band, uProgress);

        // 崩解后位置：沿法线飞出 + 每颗不同的距离
        vec3 dir = normalize(aDir);
        vec3 away = position + dir * uRadius * uScatter * (0.25 + aSeed * 1.15);

        // 飞行湍流
        float t = uTime * 1.6 + aSeed * 33.0;
        away += vec3(sin(t * 1.7), cos(t * 1.3 + 1.1), sin(t * 0.9 + 2.3))
              * uRadius * 0.16 * local;

        vec3 pos = mix(position, away, local);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;

        // 方形粒子 + 深度衰减（越飞越散，稍微变大）
        float worldSize = uSize * (0.7 + aSeed * 0.7) * (1.0 + 0.5 * local);
        gl_PointSize = max(1.5, worldSize * uProj * uPixelRatio / max(0.001, -mv.z));

        // 本体：法线打光；崩解前沿：暖色烧蚀高光
        vec3 nrm = normalize(aNormal);
        float ndl = max(0.0, dot(nrm, normalize(uLightDir)));
        vec3 lit = aColor * (0.20 + 0.95 * ndl);
        float front = local * (1.0 - local) * 4.0;
        vColor = mix(lit, vec3(1.0, 0.82, 0.5), front * 0.55);

        // 只在已经被「吃掉」的区域显示粒子（实体还在的地方由实体自己画）
        vAlpha = smoothstep(0.0, 0.10, local) * (1.0 - front * 0.12);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3  vColor;
      varying float vAlpha;
      void main() {
        // 方块 voxel（边缘留一点软边）
        vec2 d = abs(gl_PointCoord - 0.5);
        float m = max(d.x, d.y);
        if (m > 0.5) discard;
        float a = smoothstep(0.5, 0.34, m) * vAlpha;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  scene.add(p);

  state.buildMs = performance.now() - t0;
  return p;
}

function rebuild() {
  if (points) {
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
    points = null;
  }
  points = build(state.count);
  restart();
}

function restart() {
  state.startedAt = performance.now();
  state.progress = state.mode === 'dissolve' ? 0 : 1;
  state.paused = false;
  if (points) points.material.uniforms.uProgress.value = state.progress;
}

// ------------------------------------------------------------------ 控件
const $ = (id) => document.getElementById(id);
const countSel = $('in-count');
const durRange = $('in-dur');
const scatterRange = $('in-scatter');
const noiseRange = $('in-noise');
const modeSel = $('in-mode');
const loopChk = $('in-loop');
const progressRange = $('in-progress');

state.count = Number(countSel.value);
state.duration = Number(durRange.value);
state.scatter = Number(scatterRange.value);
state.noiseScale = Number(noiseRange.value);
state.mode = modeSel ? modeSel.value : 'dissolve';
state.loop = loopChk.checked;

countSel.addEventListener('change', () => {
  state.count = Number(countSel.value);
  hud.count.textContent = state.count.toLocaleString();
  hud.state.textContent = '重建粒子…';
  rebuild();
});
durRange.addEventListener('input', () => { state.duration = Number(durRange.value); restart(); });
scatterRange.addEventListener('input', () => { state.scatter = Number(scatterRange.value); });
noiseRange.addEventListener('input', () => {
  state.noiseScale = Number(noiseRange.value);
  hud.state.textContent = '重建粒子…';
  rebuild();
});
modeSel && modeSel.addEventListener('change', () => { state.mode = modeSel.value; restart(); });
loopChk.addEventListener('change', () => { state.loop = loopChk.checked; restart(); });
$('btn-reset').addEventListener('click', restart);
progressRange && progressRange.addEventListener('input', () => {
  state.paused = true;
  state.progress = Number(progressRange.value) / 100;
  state.startedAt = performance.now() - state.progress * state.duration;
});

// ------------------------------------------------------------------ 主循环
let last = performance.now();
let fpsAcc = 0, fpsFrames = 0;

rebuild();
hud.count.textContent = state.count.toLocaleString();
resize();
window.addEventListener('resize', () => resize());

function tick(now) {
  const dt = Math.min(64, now - last);
  last = now;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 500) {
    state.fps = Math.round((fpsFrames * 1000) / fpsAcc);
    fpsAcc = 0; fpsFrames = 0;
    hud.fps.textContent = state.fps + ' fps';
  }

  controls.update();

  if (!state.paused) {
    const raw = Math.min(1, (now - state.startedAt) / state.duration);
    state.progress = state.mode === 'dissolve' ? raw : 1 - raw;
    if (raw >= 1 && state.loop && now - state.startedAt > state.duration + 1200) restart();
  }

  if (points) {
    const hPx = renderer.domElement.clientHeight || 760;
    const fovRad = (camera.fov * Math.PI) / 180;
    const u = points.material.uniforms;
    u.uProj.value = (hPx * 0.5) / Math.tan(fovRad * 0.5);
    u.uProgress.value = state.progress;
    u.uTime.value = now / 1000;
    u.uPixelRatio.value = renderer.getPixelRatio();
    u.uScatter.value = state.scatter;
    u.uNoiseScale.value = state.noiseScale;
    dissolveU.uDissolve.value = state.progress;
    dissolveU.uNoiseScale.value = state.noiseScale;
  }

  const pct = state.mode === 'dissolve' ? state.progress : 1 - state.progress;
  hud.progress.textContent = (pct * 100).toFixed(0) + '%';
  hud.bar.style.width = (pct * 100).toFixed(1) + '%';
  hud.time.textContent = ((now - state.startedAt) / 1000).toFixed(2) + ' s';
  if (state.progress <= 0.002) hud.state.textContent = '实体（尚未崩解）';
  else if (state.progress >= 0.998) hud.state.textContent = '全部崩解';
  else hud.state.textContent = '崩解中…';
  if (progressRange && document.activeElement !== progressRange) {
    progressRange.value = String(Math.round(state.progress * 100));
  }

  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// 调试 / 截图
window.__particles = {
  get state() {
    return { progress: state.progress, count: state.count, fps: state.fps, buildMs: state.buildMs, mode: state.mode };
  },
  setProgress(p) {
    state.paused = true;
    state.progress = Math.max(0, Math.min(1, p));
    state.startedAt = performance.now() - state.progress * state.duration;
  },
  pause() { state.paused = true; },
  resume() { state.paused = false; state.startedAt = performance.now() - state.progress * state.duration; },
  restart,
};
