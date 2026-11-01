/**
 * particles.js —— 全场景粒子聚合 → 上色 → 凝结成实体
 * ============================================================================
 *
 * 【一句话】整个场景（车 + 地面）先只由 40 万颗粒子表达，粒子从上方逐段落位、
 * 被一条扫光点亮并上色、最后粒子被表面「吃掉」、实体车从斑块里长出来。
 *
 * 【阶段与总时长】（默认参数，5.0 + 2.0 + 5.0 + 0.6 = 12.6 s / 轮）
 *
 *   0.0 ~ 5.0 s   聚合（duration）      粒子按 aOrder 顺序从上方落入目标位置
 *   5.0 ~ 7.6 s   上色（colorDuration）  扫光前沿扫过 → 黑白 → 灰白 → 低饱和 → 车漆
 *   6.4 ~ 7.0 s   吸附前摇（B）         边界一圈粒子内收、变亮、缩小
 *   7.0 ~ 12.0 s  凝结（dissolveDuration）实体 discard 噪声生长，粒子同步消失
 *   12.0 ~ 12.6 s 停留                   循环模式下 0.6 s 后 restart()
 *
 * 【数据流】
 *   1. buildScene() 载入 car.glb → 只为取几何，所有 mesh 立刻 visible = false
 *   2. sampleCar()/sampleGround() 采样出粒子：position / normal / color / seed
 *   3. computeOrder() 把「谁先落」写进 aOrder 属性（车/地面各自归一化后串行）
 *   4. 一个 THREE.Points + ShaderMaterial 承担全部动画与着色（见下方顶点着色器）
 *   5. tick() 每帧推进 uProgress / uDissolve / uColorFront 等 uniform
 *   6. 凝结阶段给每个材质 patchDissolveMaterial() 注入 discard，让实体从噪声里长出来
 *
 * 【关键常量速查】
 *   duration            聚合时长           5000（滑杆可调 1~10 s）
 *   dissolveDuration    凝结时长           5000（硬编码，无滑杆）
 *   colorDuration       上色过程时长       2600（由扫光前沿驱动，非纯时间）
 *   uNoiseScale         溶解噪声尺度       4.0（越大斑块越碎）
 *   uSweepW / Gain      扫光宽度/亮度      0.08 / 1.15（60% 进度后淡入）
 *   size / contrast     粒子大小/明暗对比  0.008 / 1.2
 *   travel              下落高度           0.3（越大从越高处落）
 *   beats               节拍数             1 = 连续推进，>1 分批
 *   groundCount/carCount 地面/车身粒子数   8 万 / 32 万
 *
 * 【调试接口】window.__particles = { get state(), set(obj), setProgress, pause,
 *             resume, restart, setSweep }；window.__dbg = { scene, camera, car, carBox }
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

const { renderer, scene, camera, controls, resize, car } = await buildScene(canvas);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

// 深色底 + 去雾：点云要干净的背景，亮点才立得住
scene.background = new THREE.Color(0x05070b);
scene.fog = null;

car.updateWorldMatrix(true, true);
const carBox = new THREE.Box3().setFromObject(car);
const carRadius = carBox.getSize(new THREE.Vector3()).length() * 0.5;

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
  // fbm 的值集中在中段，映射到 0~1 才有「从无到有」的完整过程
  float dissolveMask(vec3 p) {
    return clamp((fbm3(p) - 0.28) / 0.44, 0.0, 1.0);
  }
`;

// ==================================================================
// 粒子 → 实体：噪声溶解
// 实体用 fbm3 噪声做 discard，粒子用同一套噪声做消失，
// 两者阈值同步 → 边界严丝合缝，像粒子「补」成了表面。
// ==================================================================
const dissolveU = {
  uDissolve: { value: 0 },      // 0 = 全粒子态，1 = 全实体
  uNoiseScale: { value: 4.0 },   // 噪声尺度：越大斑块越碎
  uFade: { value: 0 },
};

/**
 * 给实体材质注入「噪声溶解」：用 onBeforeCompile 往 three 的着色器里塞代码，
 * 不改几何、不复制材质，所有原有 PBR/paint/glass 表现都保留。
 *
 * 思路（A）：
 *   1. 顶点阶段把世界坐标 vWPos 传下去（不用局部坐标，否则移动车就错位）；
 *   2. 片元阶段算 dissolveMask(vWPos * uNoiseScale) → 每个像素一个 0~1 的噪声值；
 *   3. `if (dNz > uDissolve - 0.002) discard;`
 *      uDissolve=0 → 全丢（纯粒子态）；uDissolve=1 → 全补（实体态）；
 *      -0.002 是为了让 uDissolve=0 时一个像素都不剩（噪声被 clamp 到正好 0 的洞）。
 *   4. 边缘高光：靠近阈值的一薄层加自发光（冷暖交界处的光晕），
 *      并乘 smoothstep 让它在溶解两端自动消失，避免 100% 后残留白斑。
 *
 * 粒子和实体用的是**同一套** NOISE_GLSL / 同一个 uDissolve，
 * 所以「实体长出来的边界」和「粒子消失的边界」严丝合缝。
 */
function patchDissolveMaterial(mat) {
  if (!mat || mat.userData.__dissolvePatched) return;
  mat.userData.__dissolvePatched = true;
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
               '#include <clipping_planes_fragment>\nfloat dNz = dissolveMask(vWPos * uNoiseScale);\nif (dNz > uDissolve - 0.002) discard;   // -0.002：保证 uDissolve=0 时一个像素都不留')
      .replace('#include <emissivemap_fragment>',
               '#include <emissivemap_fragment>\nfloat dEdge = 1.0 - smoothstep(0.0, 0.07, abs(dNz - uDissolve));\ndEdge *= smoothstep(0.0, 0.08, uDissolve) * (1.0 - smoothstep(0.90, 1.0, uDissolve));\ntotalEmissiveRadiance += vec3(0.75, 0.85, 1.0) * dEdge * 0.55;');
  };
  mat.needsUpdate = true;
}

// ------------------------------------------------------------------ 采样
const meshList = [];
car.traverse((o) => { if (o.isMesh) meshList.push(o); });
// 实体不参与渲染：整个场景只由粒子表达
for (const m of meshList) m.visible = false;
// 地面（CircleGeometry 大盘子）不按三角面采样（面太大），单独用圆盘撒点
const groundMeshes = [];
scene.traverse((o) => {
  if (o.isMesh && !meshList.includes(o)) groundMeshes.push(o);
});
for (const g of groundMeshes) g.visible = false;

/**
 * 车身采样：按**三角面面积加权**撒点，保证小面（缝线、饰条）也有粒子。
 *   1. 先把所有网格的三角形摊平，累加面积做前缀和（类似 CDF）；
 *   2. 每个粒子随机取一个 [0, totalArea) 的位置，二分找到所属三角形；
 *   3. 用重心坐标在三角形内均匀取一点 → position；
 *   4. 法线用三角形的面法线；颜色取该网格材质的 base color（车漆/碳纤维/玻璃各不相同）；
 *   5. aNormal 供着色器打光用，aColor 在「上色」阶段决定车漆色相。
 */
function sampleCar(count, positions, normals, offset, colors) {
  const triPos = [], triNrm = [], triArea = [], triCol = [];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const tmpCol = new THREE.Color();
  for (const mesh of meshList) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    if (!pos) continue;
    // 取这个网格材质的基础色（glb 的 MeshPhysicalMaterial.color）
    let mc = new THREE.Color(0.55, 0.55, 0.58);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mm of mats) {
      if (!mm) continue;
      if (mm.color) { mc.copy(mm.color); break; }
    }
    const nrm = geo.attributes.normal;
    const idx = geo.index;
    const mw = mesh.matrixWorld;
    const triCount = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      vA.fromBufferAttribute(pos, i0).applyMatrix4(mw);
      vB.fromBufferAttribute(pos, i1).applyMatrix4(mw);
      vC.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      const cr = vB.clone().sub(vA).cross(vC.clone().sub(vA));
      const area = cr.length() * 0.5;
      if (!(area > 1e-10)) continue;
      triPos.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
      if (nrm) {
        const n0 = new THREE.Vector3().fromBufferAttribute(nrm, i0).normalize();
        const n1 = new THREE.Vector3().fromBufferAttribute(nrm, i1).normalize();
        const n2 = new THREE.Vector3().fromBufferAttribute(nrm, i2).normalize();
        triNrm.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
      } else {
        const fn = cr.normalize();
        triNrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z);
      }
      triArea.push(area);
      triCol.push(mc.r, mc.g, mc.b);
    }
  }
  if (!triArea.length) return;

  const nTri = triArea.length;
  const cum = new Float64Array(nTri);
  let total = 0;
  for (let i = 0; i < nTri; i++) { total += triArea[i]; cum[i] = total; }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const p = new THREE.Vector3(), n = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const r = Math.random() * total;
    let lo = 0, hi = nTri - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
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
    const k = offset + i;
    const lift = 0.001 + Math.random() * 0.004;
    positions[k * 3] = p.x + n.x * lift;
    positions[k * 3 + 1] = p.y + n.y * lift;
    positions[k * 3 + 2] = p.z + n.z * lift;
    normals[k * 3] = n.x;
    normals[k * 3 + 1] = n.y;
    normals[k * 3 + 2] = n.z;
    if (colors) {
      const co = lo * 3;
      // 每颗粒子在面颜色上做一点随机浮动，避免整片死板
      const j = 0.88 + Math.random() * 0.24;
      colors[k * 3] = triCol[co] * j;
      colors[k * 3 + 1] = triCol[co + 1] * j;
      colors[k * 3 + 2] = triCol[co + 2] * j;
    }
  }
}

/**
 * 地面采样：圆盘内均匀撒点（sqrt 修正，否则点会往圆心堆）。
 *   法线恒为 +Y；颜色写中性深灰；aCar=0 供着色器区分（地面不参与扫光/上色/吸附）。
 *   radius 用 9 而不是地面的 60，让粒子集中在镜头看得见的范围。
 */
function sampleGround(count, positions, normals, offset, radius) {
  for (let i = 0; i < count; i++) {
    const r = radius * Math.sqrt(Math.random());
    const th = Math.random() * Math.PI * 2;
    const k = offset + i;
    positions[k * 3] = Math.cos(th) * r;
    positions[k * 3 + 1] = 0.0015;
    positions[k * 3 + 2] = Math.sin(th) * r;
    normals[k * 3] = 0;
    normals[k * 3 + 1] = 1;
    normals[k * 3 + 2] = 0;
  }
}

// ------------------------------------------------------------------ 状态
/**
 * 全部可调状态。改这里的默认值 = 改页面初始表现；
 * 同时注意 particles.html 里对应控件的 value 也要一致，否则会被控件初始化时覆盖。
 *
 * 分类：规模 / 时间 / 运动 / 视觉 / 特效（扫光+上色+凝结）/ 运行时
 */
const state = {
  // ---- 规模 ----------------------------------------------------------
  carCount: 320000,      // 车身粒子数（按三角面面积加权采样）
  groundCount: 80000,    // 地面粒子数（圆盘随机撒点，半径 9）
  count: 400000,         // 总数 = carCount + groundCount（tick 里用作密度补偿基准）

  // ---- 时间（单位 ms）------------------------------------------------
  duration: 5000,        // 聚合时长：0 → 100% 粒子落位（滑杆 in-dur 可调 1~10 s）
  colorDuration: 2600,   // 上色过程时长（实际由「扫光前沿」推进，此值仅作节奏参考）
  dissolveDuration: 5000,// 凝结时长：粒子 → 实体（硬编码，无滑杆）
  dissolveT: 0,          // 凝结进度 0~1（tick 每帧算，1 = 完全实体）
  dissolveOn: false,     // 是否已进入凝结阶段（progress=1 后固定延迟 2 s 置 true）
  dissolveStart: 0,      // 凝结开始的时间戳
  progressOneAt: 0,      // progress 首次达到 1 的时间戳（后续吸附/凝结都以此为零点）
  colorT: 0,             // 上色进度 0~1（仅供 HUD/调试；着色器用的是 uColorFront）
  colorFront: 1e9,       // 扫光前沿到达过的最小 Z 坐标（只减不增 → 上过的色不重上）
  paintDoneAt: 0,        // 光带真正扫过车尾（colorFront ≤ -2.2）的时刻
  holdAfterPaint: 2000,  // 上色完成后再等多久才开始凝结（ms）
  sweepPeriod: 7000,     // 扫光一轮的周期（ms）：必须够短，否则光带扫不到车尾

  // ---- 运动 ----------------------------------------------------------
  entry: [0, 0, -1],     // 顺序推进方向：默认车头(+Z) → 车尾(-Z)；下落方向恒为竖直向下
  beats: 1,              // 节拍数：1 = 连续推进；>1 = 把顺序切成 N 段一段一段落
  entryMode: 0,          // 入场方式：0 = 轴向；1 = 外→里；2 = 里→外
  easeMode: 0,           // 速度曲线：0 = 匀速；1 = 缓出；2 = 缓入；3 = 缓入缓出
  travel: 0.3,           // 下落高度（世界单位）：越大越像从高处砸下来
  spread: 6.5,           // 旧参数（径向散开半径），保留兼容
  progress: 0,           // 聚合进度 0~1

  // ---- 视觉 ----------------------------------------------------------
  size: 0.008,           // 粒子基准尺寸（世界单位，实际再乘亮度/随机数）
  contrast: 1.2,         // 明暗对比：对 lum 做 pow()，>1 压暗部（与 HTML 滑块默认值一致）
  autoCam: true,         // 缓慢环绕运镜（参考视频里镜头一直在动）
  paused: false,         // 暂停（调试用，setProgress 时置 true）

  // ---- 特效：扫光 / 上色 / 凝结 --------------------------------------
  sweep: true,           // 扫光总开关
  sweepW: 0.08,          // 光带宽度（世界单位）；边界另由 max(w*2.2, 0.62) 软化
  sweepGain: 1.15,       // 光带亮度增益（60% 进度后才淡入）
  sweepAt: null,         // 调试：把扫光钉在某个世界 Z 上（null = 自动扫）
  sweepGate: 1,          // 60% 门控后的实际增益倍数（tick 写，HUD/调试用）
  doneAt: null,          // 预留：完成时刻

  // ---- 运行时 --------------------------------------------------------
  startedAt: performance.now(),
  fps: 0,
  buildMs: 0,            // 上一轮粒子构建耗时（ms）
  loop: true,            // 循环播放（等凝结完成后才重启）
};

let points = null;

/**
 * 计算每个粒子的「出场顺序」aOrder ∈ [0,1]，写进 geometry 属性。
 * 顺序决定：谁先落位（小的先落）。
 *
 * 轴向模式（entryMode=0）：
 *   把位置投影到入口方向 d 上得到标量 t = dot(p, d)，
 *   再在**各自的分组**里归一化：
 *     车  → 用车包围盒 8 个角投影出的 [cmin, cmax]
 *     地面 → 用圆盘直径投影出的 [gmin, gmax]
 *   （早期只用车的包围盒归一化，地面被 clamp 到 0/1，全挤进第一拍/最后一拍 ← bug）
 *
 * 径向模式（1=外→里 / 2=里→外）：用「到场景中心的距离 / carRadius」归一化。
 *
 * 串行化：地面最终映射到 [0, 0.55]，车体映射到 [0.55, 1] ——
 * 让地面先铺满、车体随后落，两组不并行（用户明确要求）。
 */
// 顺序值：轴向按各组自己的投影区间归一化（车用地包围盒、地面用圆盘），
// 否则地面会被夹到 0/1，全挤进第一拍和最后一拍（原来的 bug）
function computeOrder() {
  const st = state;
  if (!st.orderAttr) return;
  const d = st.entry;
  const P = st.posArray, n = st.count, carN = st.carCount;
  let cmin = Infinity, cmax = -Infinity;
  for (const x of [carBox.min.x, carBox.max.x])
    for (const y of [carBox.min.y, carBox.max.y])
      for (const z of [carBox.min.z, carBox.max.z]) {
        const t = d[0] * x + d[1] * y + d[2] * z;
        if (t < cmin) cmin = t;
        if (t > cmax) cmax = t;
      }
  const gr = st.groundRadius || 9;
  const horiz = Math.hypot(d[0], d[2]);
  let gmin, gmax;
  if (horiz < 1e-4) { gmin = gmax = 0; }
  else { gmin = -gr * horiz; gmax = gr * horiz; }

  const arr = st.orderAttr.array;
  for (let i = 0; i < n; i++) {
    let o;
    if (st.entryMode === 0) {
      const t = d[0] * P[i * 3] + d[1] * P[i * 3 + 1] + d[2] * P[i * 3 + 2];
      o = i < carN
        ? (t - cmin) / Math.max(1e-4, cmax - cmin)
        : (t - gmin) / Math.max(1e-4, gmax - gmin);
    } else {
      const dx = P[i * 3], dy = P[i * 3 + 1] - 0.62, dz = P[i * 3 + 2];
      const dn = Math.min(1, Math.hypot(dx, dy, dz) / Math.max(0.5, carRadius));
      o = st.entryMode === 1 ? 1 - dn : dn;
    }
    o = o < 0 ? 0 : (o > 1 ? 1 : o);
    // 地面先铺满（占前 55% 的进度），车体随后跟进 —— 不要两组并行
    arr[i] = i < carN ? (0.55 + o * 0.45) : (o * 0.55);
  }
  st.orderAttr.needsUpdate = true;
}

/**
 * 构建全部粒子 + 材质。这是唯一一处「重活」，改变粒子数/入场方式时要重建（约 100~200 ms）。
 *
 * 产物：
 *   geometry 属性  position / normal / aColor / aSeed / aOrder / aCar
 *   ShaderMaterial  uniforms 一大组（运动、扫光、上色、溶解、吸附）
 *   返回 THREE.Points（AdditiveBlending + depthWrite=false）
 *
 * 为什么用 Points 而不是实例化小球：
 *   40 万点只要一次 draw call；加性混合下重叠自然形成体积感；
 *   点的世界尺寸在着色器里按透视算（gl_PointSize），所以近大远小是对的。
 */
function build(carCount, groundCount) {
  const t0 = performance.now();
  const count = carCount + groundCount;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  sampleCar(carCount, positions, normals, 0, colors);
  // 地面：中性深灰
  for (let i = carCount; i < count; i++) {
    const g = 0.16 + Math.random() * 0.06;
    colors[i * 3] = g; colors[i * 3 + 1] = g; colors[i * 3 + 2] = g * 1.05;
  }
  sampleGround(groundCount, positions, normals, carCount, 9);

  const carMask = new Float32Array(count);
  carMask.fill(1, 0, carCount);   // 车 = 1，地面 = 0

  const delayAttr = new Float32Array(count);
  const seedAttr = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    delayAttr[i] = Math.random();
    seedAttr[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  // 注意：aOrder 在 geo 建好后由 computeOrder() 填
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(delayAttr, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seedAttr, 1));
  geo.setAttribute('aCar', new THREE.BufferAttribute(carMask, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  // aOrder：每颗粒子的顺序值，在 JS 里按「车 / 地面」各自归一化后写入
  const orderAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
  geo.setAttribute('aOrder', orderAttr);
  state.posArray = positions;
  state.count = count;
  state.carCount = carCount;
  state.orderAttr = orderAttr;
  geo.computeBoundingSphere();
  geo.boundingSphere.radius *= 3;
  computeOrder();

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: state.size },
      uProj: { value: 1000 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uLightDir: { value: new THREE.Vector3(0.42, 0.84, 0.34).normalize() },
      uTint: { value: new THREE.Color(0xe7edf8) },   // 单色：冷白
      uContrast: { value: state.contrast },
      uDensity: { value: 1.0 },
      uSuck: { value: 0 },
      uDissolve: dissolveU.uDissolve,
      uNoiseScale: dissolveU.uNoiseScale,
      uRadius: { value: carRadius },
      uEntry: { value: new THREE.Vector3(1, 0, 0) },
      uTravel: { value: state.travel },
      uOrderMin: { value: carBox.min.x },
      uOrderMax: { value: carBox.max.x },
      
      uMode: { value: 0 },
      uEaseMode: { value: 0 },
      uBeats: { value: 1 },
      uColorT: { value: 0 },
      uColorFront: { value: 1e9 },
      uColorBand: { value: 0.55 },
      uCenter: { value: new THREE.Vector3(0, 0.62, 0) },
      uMaxDist: { value: Math.max(carRadius, 0.5) },
      uSweep: { value: -99 },
      uSweepW: { value: 0.08 },
      uSweepGain: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3  aNormal;
      attribute float aDelay;
      attribute float aSeed;
      attribute float aCar;        // 1 = 车体，0 = 地面
      attribute float aOrder;      // 0~1：该粒子的节拍顺序
      attribute vec3  aColor;      // 车漆基础色（地面为深灰）

      uniform float uProgress;
      uniform float uTime;
      uniform float uSize;
      uniform float uProj;
      uniform float uPixelRatio;
      uniform vec3  uLightDir;
      uniform vec3  uTint;
      uniform float uContrast;
      ${NOISE_GLSL}
      uniform float uDensity;
      uniform float uDissolve;
      uniform float uNoiseScale;
      uniform float uRadius;
      uniform float uSweep;
      uniform float uSweepW;
      uniform float uSweepGain;
      uniform vec3  uEntry;
      uniform float uTravel;
      uniform float uOrderMin;
      uniform float uOrderMax;
      uniform float uMode;
      uniform float uEaseMode;
      uniform float uBeats;
      uniform float uColorT;
      uniform float uColorFront;
      uniform float uColorBand;
      uniform vec3  uCenter;
      uniform float uMaxDist;
      uniform float uSuck;      // B：吸附强度 0~1

      varying vec3  vColor;
      varying float vAlpha;

      void main() {
        // ==== [1] 顺序 + 起点 ==============================================
        // order 来自 JS 算好的 aOrder；start 是「粒子起飞的位置」
        // 轴向模式：起点在目标位置正上方（统一竖直下落）
        // 径向模式：起点沿法向外扩 / 从中心长出来
        // ---- 入场方式
        vec3 start;
        float order;

        order = aOrder;   // 顺序在 JS 里算好（车/地面各自归一化）

        if (uMode < 0.5) {
          // 轴向推进：运动统一竖直下落
          float drop = uTravel * (0.55 + 0.9 * aSeed);
          start = position + vec3(0.0, drop, 0.0) + vec3((aSeed - 0.5) * 0.35, 0.0, (fract(aSeed * 13.0) - 0.5) * 0.35);
        } else {
          // 径向：相对场景中心
          vec3 radial = position - uCenter;
          vec3 dirOut = normalize(radial + vec3(0.0, 0.0001, 0.0));
          float dn = clamp(length(radial) / max(0.001, uMaxDist), 0.0, 1.0);

          if (uMode < 1.5) {
            // 外 → 里：外层先落位，波前往里收
            order = 1.0 - dn;
            start = position + dirOut * (uTravel * 0.42 * (0.55 + 0.9 * aSeed));
          } else {
            // 里 → 外：从中心附近长出来
            order = dn;
            start = uCenter + dirOut * uTravel * 0.15;
          }
        }

        // ==== [2] 节拍 / 延迟 ==============================================
        // 把 [0,1] 的顺序切成 N 段：第 n 段整体晚 (n-1)/N 的进度才出发，
        // 于是视觉上是「一片接一片往下落」；beats=1 时退化成连续推进。
        // 节拍：把顺序切成 N 段，一段一段地往下落，段与段之间留 delay
        float lag, dur;
        if (uBeats > 1.5) {
          float seg = 1.0 / uBeats;
          float bi  = floor(order * uBeats);
          lag = bi * seg;             // 拍序：第 n 拍紧接着第 n-1 拍
          dur = seg;                  // 每拍正好占一格 → 拍与拍首尾相接，中间不留空档
        } else {
          lag = order * 0.55;
          dur = 0.45;
        }
        float p = clamp((uProgress - lag) / max(0.02, dur), 0.0, 1.0);

        // ==== [3] 缓动 + 位移 ==============================================
        // 用缓动曲线把线性进度 p 映射成位置插值系数 e，再 mix(start, position, e)
        // ---- 运动方式
        float e;
        if (uEaseMode < 0.5)      e = p;                                  // 匀速
        else if (uEaseMode < 1.5) e = 1.0 - pow(1.0 - p, 3.0);            // 缓出
        else if (uEaseMode < 2.5) e = p * p;                              // 缓入
        else                      e = p * p * (3.0 - 2.0 * p);             // 缓入缓出

        vec3 pos = mix(start, position, e);

        // 进入途中只做微小横向抖动，保持“线性”观感
        float sw = sin(uTime * 1.1 + aSeed * 21.0) * (1.0 - e) * 0.05;
        pos.y += sw;
        pos.z += sw * 0.5;

        // ==== [4] B · 吸附 =================================================
        // 只处理「即将被溶解吃掉」的一圈（dS 接近 0 且 >0）：
        // 沿法线内收 5cm、变亮、缩小 → 表面像有吸力把粒子吸进去
        // ---- B：吸附。溶解边界前方一圈粒子被吸向表面并缩小，像被表面「吃掉」
        float suckBand = 0.0;
        if (uSuck > 0.001 && aCar > 0.5) {
          float pNzS = dissolveMask(position * uNoiseScale);
          float dS   = pNzS - uDissolve;                       // >0 = 还没被吃
          float b    = exp(-pow(dS / 0.12, 2.0)) * step(0.0, dS);
          suckBand = b * uSuck;
          pos += normalize(aNormal) * (-0.05 * suckBand);      // 沿法线内收
        }

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;

        // ==== [5] 单色光照 =================================================
        // 整个画面只有一种色相（uTint 冷白），明暗 = key + fill + rim + 天空环境
        // 体积感全靠明暗，不靠颜色区分材质
        // ---- 单色：颜色只有一个 hue，明暗全部来自光照（三点光 + 边缘光）
        vec3 nrm = normalize(aNormal);
        vec3 V = normalize(-mv.xyz);
        vec3 Lkey = normalize(uLightDir);
        vec3 Lfill = normalize(vec3(-0.55, 0.25, -0.60));
        float key = max(0.0, dot(nrm, Lkey));
        float fill = max(0.0, dot(nrm, Lfill));
        float rim = pow(1.0 - max(0.0, dot(V, nrm)), 2.6);
        float lum = 0.055 + key * 0.78 + fill * 0.26 + rim * 0.85 + 0.10; // 0.10 = 天空环境光
        lum = pow(clamp(lum, 0.0, 2.0), uContrast);
        lum = min(lum, 1.05);   // 压高光，避免顶部糊成一片白
        lum *= mix(1.5, 1.0, e);    // 飞行中略亮
        lum += suckBand * 1.2;      // 被吸附的点更亮，形成收缩的亮边

        // ==== [6] 扫光（呼吸灯带）==========================================
        // 沿车长 Z 轴扫过的一条高斯亮带，只点亮车身；
        // 宽度 uSweepW 与软边 soft 解耦：宽度再窄，边缘也至少铺开 0.62 个世界单位
        // 扫光：沿着世界 X 扫过的一条亮带，经过的点会被提亮
        // 扫光只作用在车体上；车长沿 Z 轴，车头 +Z → 车尾 -Z
        if (uSweepGain > 0.001 && aCar > 0.5) {
          float dist = abs(position.z - uSweep);
          // 2.2 倍宽的软过渡：边界不再是一条硬线
          // 过渡尺度和宽度解耦：宽度再窄，边缘也至少铺开 0.62 个世界单位
          float soft = max(uSweepW * 2.2, 0.62);
          float band = exp(-pow(dist / soft, 2.0));
          float breath = 0.75 + 0.25 * sin(uTime * 1.6);
          lum += band * uSweepGain * breath * (0.7 + 0.6 * aSeed);
        }

        // ==== [7] 点大小 ===================================================
        // gl_PointSize = 世界尺寸 × 透视系数 / 深度 → 近大远小；
        // 亮的粒子画得更大，形成点云自然的疏密层次
        // 亮的粒子画得更大 → 点云自然的疏密层次
        float worldSize = uSize * (0.55 + aSeed * 0.9) * (0.62 + 0.75 * min(lum, 1.6));
        worldSize *= (1.0 - 0.6 * suckBand);   // 吸附时收缩
        gl_PointSize = max(1.0, worldSize * uProj * uPixelRatio / max(0.001, -mv.z));

        // 地面亮度 = 车身（系数 1.0），全程恒定（不随上色/扫光变化）
        // 地面亮度系数：1.0 = 与车身同亮度（串行落地方案，地面不参与扫光/上色）
        const float GROUND_BOOST = 1.0;
        float boost = mix(GROUND_BOOST, 1.0, aCar);
        vec3 mono = uTint * lum * 1.15 * boost;

        // ==== [8] 上色（被扫光前沿驱动）====================================
        // ct 由「粒子 Z 与前沿 uColorFront 的距离」决定，前沿只前进不后退，
        // 所以扫光来回扫也不会把已经上好的颜色重刷一遍。
        // 只有车身参与（aCar>0.5）；地面永远保持单色，避免扫过时突然变暗
        // 凝聚完成后的上色过程：
        //   0 ~ 0.30  黑白（纯灰，靠亮度提亮）
        //   0.30 ~ 0.60 灰白
        //   0.60 ~ 0.85 低饱和色
        //   0.85 ~ 1.00 正常车漆色
        // 上色由扫光前沿决定：前沿扫到哪，哪块开始上色；前沿只前进不后退，
        // 所以扫光来回扫也不会覆盖已经上好的颜色。
        // 只有车体参与上色；地面恒定保持单色，避免扫光扫过时突然变暗
        float ct = (aCar > 0.5)
          ? clamp((position.z - uColorFront) / max(0.05, uColorBand), 0.0, 1.0)
          : 0.0;
        float lift = mix(0.92, 1.45, smoothstep(0.0, 0.55, ct));
        vec3  gray = vec3(lum * lift * boost);
        // 车漆基础色在 glb 里是「线性空间的深色」（比如绿漆 ≈ 0.03/0.10/0.08），
        // 直接用会变成近黑，所以先按色相归一化再上亮度。
        float mx = max(aColor.r, max(aColor.g, aColor.b));
        vec3  hue = aColor / max(1e-3, mx);
        hue = clamp(mix(vec3(1.0), hue, 1.45), 0.0, 3.0);   // 提饱和度，点云上更容易看出色相
        vec3  carCol = hue * (0.55 + 1.10 * min(lum, 1.6)) * boost;
        vec3  gndCol = aColor * (0.9 + 1.2 * min(lum, 1.6)) * boost;
        vec3  full = mix(gndCol, carCol, aCar);
        vec3  low  = mix(gray, full, 0.42);

        vec3 col = gray;
        col = mix(col, low,  smoothstep(0.55, 0.72, ct));   // 上低饱和
        col = mix(col, full, smoothstep(0.82, 1.00, ct));   // 回到正常色
        vColor = mix(mono, col, step(0.001, ct));
        // ==== [9] 透明度 + 溶解退场 ========================================
        // 1) 还没出发的粒子几乎不可见（e=0 时 alpha≈0.07），下落过程中渐亮
        // 2) 与实体共用 dissolveMask：实体长出来的地方，粒子同步消失
        //    +0.03 让粒子比实体略早退场，避免边界处叠出白斑
        // 还没轮到的粒子几乎不可见（e=0），开始下落才亮起来
        vAlpha = mix(0.07, 0.46, e) * (0.55 + 0.45 * aSeed) * uDensity;
        // 与实体同一套噪声：实体长出来的地方，粒子同步消失
        if (uDissolve > 0.001) {
          float pNz = dissolveMask(position * uNoiseScale);
          vAlpha *= step(uDissolve + 0.03, pNz);   // 比实体略早退场，避免叠出白斑
        }
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3  vColor;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d);
        if (r2 > 0.25) discard;
        // 圆点内做高斯衰减：像高斯泼溅的 splat，而不是硬边圆盘；
        // 叠加（AdditiveBlending）后，密集处亮、稀疏处暗 → 体积感
        // 高斯衰减：像高斯泼溅的 splat，而不是硬边圆点
        float a = exp(-r2 * 14.0) * vAlpha;
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  state.buildMs = performance.now() - t0;
  return pts;
}

function rebuild() {
  if (points) {
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
    points = null;
  }
  state.count = state.carCount + state.groundCount;
  points = build(state.carCount, state.groundCount);
  restart();
}

/**
 * 重置到第一帧（换参数、点「重新聚合」、循环重启都会走这里）。
 * 注意：这里不能碰 `u`（uniforms 对象在下面才定义，会撞 TDZ），
 * 吸附强度 uSuck 由 tick 在 progressOneAt 为空时自动归零。
 */
function restart() {
  state.colorFront = 1e9;
  state.paintDoneAt = 0;
  state.dissolveOn = false;
  state.dissolveT = 0;
  state.dissolveStart = 0;
  state.progressOneAt = 0;   // uSuck 由 tick 在 progressOneAt 为空时自动归零
  dissolveU.uDissolve.value = 0;
  for (const m of meshList) m.visible = false;
  if (points) points.visible = true;
  state.startedAt = performance.now();
  state.progress = 0;
  state.paused = false;
  if (points) points.material.uniforms.uProgress.value = 0;
}

// ------------------------------------------------------------------ 控件
const $ = (id) => document.getElementById(id);
const carCountSel = $('in-carcount');
const groundCountSel = $('in-groundcount');
const durRange = $('in-dur');
const spreadRange = $('in-spread');
const dirSel = $('in-dir');
const easeSel = $('in-ease');
const beatsRange = $('in-beats');
const sizeRange = $('in-size');
const contrastRange = $('in-contrast');
const sweepWRange = $('in-sweepw');
const fuseRange = $('in-fuse');
const sweepChk = $('in-sweep');
const loopChk = $('in-loop');
const progressRange = $('in-progress');

if (carCountSel) state.carCount = Number(carCountSel.value);
if (groundCountSel) state.groundCount = Number(groundCountSel.value);
state.count = state.carCount + state.groundCount;
if (durRange) state.duration = Number(durRange.value);
if (fuseRange) state.dissolveDuration = Number(fuseRange.value);
if (spreadRange) state.travel = Number(spreadRange.value);
if (dirSel) {
  if (dirSel.value === 'in') state.entryMode = 1;
  else if (dirSel.value === 'out') state.entryMode = 2;
  else { state.entryMode = 0; state.entry = dirSel.value.split(',').map(Number); }
}
if (easeSel) state.easeMode = Number(easeSel.value);
if (beatsRange) state.beats = Number(beatsRange.value);
if (sizeRange) state.size = Number(sizeRange.value);
if (contrastRange) state.contrast = Number(contrastRange.value);
if (loopChk) state.loop = loopChk.checked;
if (sweepWRange) state.sweepW = Number(sweepWRange.value);
if (sweepChk) state.sweep = sweepChk.checked;

const onCountChange = () => {
  state.carCount = Number(carCountSel.value);
  state.groundCount = Number(groundCountSel.value);
  state.count = state.carCount + state.groundCount;
  hud.count.textContent = state.count.toLocaleString();
  hud.state.textContent = '重建粒子…';
  rebuild();
};
carCountSel?.addEventListener('change', onCountChange);
groundCountSel?.addEventListener('change', onCountChange);
durRange?.addEventListener('input', () => { state.duration = Number(durRange.value); restart(); });
fuseRange?.addEventListener('input', () => {
  state.dissolveDuration = Number(fuseRange.value);
  // 已经凝结完（或正在凝结）时改时长 → 重开一轮，避免停在中间状态
  if (state.dissolveOn) restart();
});
spreadRange?.addEventListener('input', () => {
  state.travel = Number(spreadRange.value);
});
dirSel?.addEventListener('change', () => {
  if (dirSel.value === 'in') state.entryMode = 1;
  else if (dirSel.value === 'out') state.entryMode = 2;
  else { state.entryMode = 0; state.entry = dirSel.value.split(',').map(Number); }
  computeOrder();
  restart();
});
easeSel?.addEventListener('change', () => {
  state.easeMode = Number(easeSel.value);
  restart();
});
beatsRange?.addEventListener('input', () => {
  state.beats = Number(beatsRange.value);
  restart();
});
sizeRange?.addEventListener('input', () => { state.size = Number(sizeRange.value); });
contrastRange?.addEventListener('input', () => { state.contrast = Number(contrastRange.value); });
loopChk?.addEventListener('change', () => { state.loop = loopChk.checked; restart(); });
sweepWRange?.addEventListener('input', () => { state.sweepW = Number(sweepWRange.value); });
sweepChk?.addEventListener('change', () => { state.sweep = sweepChk.checked; });
$('btn-reset')?.addEventListener('click', restart);
progressRange?.addEventListener('input', () => {
  state.paused = true;
  state.progress = Number(progressRange.value) / 100;
  state.startedAt = performance.now() - state.progress * state.duration;
});

// ------------------------------------------------------------------ 主循环
rebuild();
hud.count.textContent = state.count.toLocaleString();
resize();
window.addEventListener('resize', () => resize());

let last = performance.now();
let fpsAcc = 0, fpsFrames = 0;

/**
 * 主循环：相机 → 进度 → uniforms → 触发凝结 → HUD。
 *
 * 一帧里按顺序做 5 件事：
 *   1. 相机（自动环绕 or OrbitControls）
 *   2. 推进聚合进度 progress；循环模式下等「凝结完成」再重启
 *   3. 写 uniforms：uProgress / uSweep / uColorFront / uSuck / uDissolve …
 *   4. 状态机：progress 到 1 → 记 progressOneAt → +1.4s 起吸附 → +2.0s 起凝结
 *   5. HUD 数字
 */
function tick(now) {
  const dt = Math.min(64, now - last);
  last = now;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 500) {
    state.fps = Math.round((fpsFrames * 1000) / fpsAcc);
    fpsAcc = 0; fpsFrames = 0;
    hud.fps.textContent = state.fps + ' fps';
  }

  // 扫光位置：相位以 state.startedAt 为零点，所以每次 restart（循环）都从车头 +3.4 重新扫
  const sweepPosNow = () => {
    if (state.sweepAt != null) return state.sweepAt;
    const per = Math.max(800, state.sweepPeriod);
    const ph = ((now - state.startedAt) % per) / per;   // 每轮从 0 开始
    return 3.4 - ph * 6.8;                               // +3.4（车头）→ −3.4（车尾）
  };

  if (state.autoCam) {
    // 缓慢环绕 + 轻微呼吸，参考视频的镜头运动
    const t = now * 0.00013;
    const R = 7.6 + Math.sin(t * 1.7) * 0.45;
    const h = 1.85 + Math.sin(t * 1.1) * 0.16;
    camera.position.set(Math.cos(t) * R, h, Math.sin(t) * R);
    camera.lookAt(0, 0.55, 0);
  } else {
    controls.update();
  }

  if (!state.paused) {
    const raw = Math.min(1, (now - state.startedAt) / state.duration);
    state.progress = raw;
    // 循环重启要等上色演完（否则 2.6s 的上色会被 1.4s 的重启打断）
    // 循环：必须等「实体凝结完成」才开始下一轮
    // 时间线 = 聚合(duration) + 触发延迟(2000) + 融合(dissolveDuration) + 收尾余量(600)
    const paintAt = state.paintDoneAt ? (state.paintDoneAt - state.startedAt) : state.duration;
    const cycleMs = paintAt + state.holdAfterPaint + state.dissolveDuration + 600;
    const dissolved = state.dissolveOn && state.dissolveT >= 1;
    if (raw >= 1 && state.loop && dissolved && now - state.startedAt > cycleMs) restart();
  }

  if (points) {
    const hPx = renderer.domElement.clientHeight || 760;
    const fovRad = (camera.fov * Math.PI) / 180;
    const u = points.material.uniforms;
    u.uProj.value = (hPx * 0.5) / Math.tan(fovRad * 0.5);
    u.uProgress.value = state.progress;
    u.uTime.value = now / 1000;
    u.uPixelRatio.value = renderer.getPixelRatio();
    u.uSize.value = state.size;
    u.uEntry.value.set(state.entry[0], state.entry[1], state.entry[2]);
    // 顺序区间按「入口方向」投影包围盒，换轴也不会错
    {
      const d = state.entry, m = carBox.min, M = carBox.max;
      let mn = Infinity, mx = -Infinity;
      for (const x of [m.x, M.x]) for (const y of [m.y, M.y]) for (const z of [m.z, M.z]) {
        const t = d[0] * x + d[1] * y + d[2] * z;
        if (t < mn) mn = t; if (t > mx) mx = t;
      }
      u.uOrderMin.value = mn; u.uOrderMax.value = mx;
    }
    u.uMode.value = state.entryMode;
    u.uBeats.value = state.beats;
    // 上色跟着扫光前沿走：前沿扫过哪，哪就永久上色
    {
      const sweepPos = sweepPosNow();
      if (state.sweep && state.progress >= 0.6) {
        state.colorFront = Math.min(state.colorFront, sweepPos);
      }
      u.uColorFront.value = state.colorFront;
      state.colorT = 1 - Math.min(1, Math.max(0, (state.colorFront + 3.4) / 6.8)); // 仅用于 HUD/调试
    }
    u.uColorT.value = state.colorT;

    // progress 首次到 1 的时刻
    if (state.progress >= 0.999 && !state.progressOneAt) state.progressOneAt = now;

    // B：吸附前摇 —— progress=1 后 1.4s 起，0.6s 内把 uSuck 从 0 推到 1
    if (state.progressOneAt) {
      const el = now - state.progressOneAt;
      u.uSuck.value = Math.min(1, Math.max(0, (el - 1400) / 600));
    } else {
      u.uSuck.value = 0;
    }

    // 上色完成判定：光带真的扫过车尾（colorFront ≤ -2.2）才算上色完成
    // 扫光关掉时视为已完成，避免卡死
    if (!state.sweep && state.progress >= 0.6) state.colorFront = -2.2;
    if (state.progress >= 0.6 && state.colorFront <= -2.2 && !state.paintDoneAt) state.paintDoneAt = now;

    // 触发：上色完成 → 再等 holdAfterPaint → 开始溶解（不再强制补色）
    if (state.paintDoneAt && now - state.paintDoneAt >= state.holdAfterPaint) {
      if (!state.dissolveOn) {
        state.dissolveOn = true;
        state.dissolveStart = now;
        for (const m of meshList) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mm of mats) patchDissolveMaterial(mm);
          m.visible = true;
        }
      }
      state.dissolveT = Math.min(1, (now - state.dissolveStart) / Math.max(200, state.dissolveDuration));
      if (state.dissolveT >= 1 && points) points.visible = false;   // 全部实体化后粒子层彻底关掉
      // 末端超调一点，保证没有任何残留的 discard 洞
      dissolveU.uDissolve.value = state.dissolveT >= 0.999 ? 1.06 : state.dissolveT;
    } else {
      state.dissolveT = 0;
      dissolveU.uDissolve.value = 0;
    }


    state.colorDbg = { tick: (state.colorDbg?.tick||0)+1, p: +state.progress.toFixed(4), ct: +state.colorT.toFixed(3), done: state.doneAt, cv: +state.colorT.toFixed(3) };
    u.uEaseMode.value = state.easeMode;
    u.uTravel.value = state.travel;
    u.uContrast.value = state.contrast;
    // 密度补偿：以 20 万粒子为基准，越多越淡
    // 用平方根而不是线性：点密集时重叠严重，线性会把画面压得太暗
    u.uDensity.value = Math.min(1.8, Math.max(0.45, Math.sqrt(200000 / Math.max(1, state.count))));
    // 扫光位置：从左扫到右，循环
    // 车头 -Y → 车尾 +Y：扫光沿 Y 轴推进
    u.uSweep.value = sweepPosNow();
    u.uSweepW.value = state.sweepW;
    // 呼吸灯只在聚合进度 ≥ 60% 之后才出现（0.60~0.68 淡入）
    {
      const gp = Math.min(1, Math.max(0, (state.progress - 0.60) / 0.08));
      const gate = gp * gp * (3 - 2 * gp);
      state.sweepGate = state.sweep ? gate : 0;   // 暴露出来方便核对
      u.uSweepGain.value = state.sweep ? (state.sweepGain ?? 1.15) * gate : 0.0;
    }
  }

  hud.progress.textContent = (state.progress * 100).toFixed(0) + '%';
  hud.bar.style.width = (state.progress * 100).toFixed(1) + '%';
  hud.time.textContent = ((now - state.startedAt) / 1000).toFixed(2) + ' s';
  hud.state.textContent = state.progress >= 0.999 ? '聚合完成' : '聚合中…';
  if (progressRange && document.activeElement !== progressRange) {
    progressRange.value = String(Math.round(state.progress * 100));
  }

  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// 调试 / 截图
window.__dbg = { scene, camera, car, carBox };
window.__particles = {
  get state() {
    // 注意：这是个只读快照，想改设置用 __particles.set({...})
    return {
      progress: state.progress, count: state.count, fps: state.fps, buildMs: state.buildMs,
      colorT: state.colorT, colorFront: state.colorFront, paintDoneAt: state.paintDoneAt, sweepPeriod: state.sweepPeriod, sweepGate: state.sweepGate, size: state.size, beats: state.beats,
      duration: state.duration, colorDuration: state.colorDuration, paused: state.paused,
      loop: state.loop, autoCam: state.autoCam, entryMode: state.entryMode, easeMode: state.easeMode,
      sweepW: state.sweepW, sweepGain: state.sweepGain, travel: state.travel, contrast: state.contrast,
      dissolveT: state.dissolveT, dissolveOn: state.dissolveOn, dissolveDuration: state.dissolveDuration,
    };
  },
  // 改内部设置（屏幕上的控件也走这条路，调试时方便）
  set(obj) { Object.assign(state, obj); },
  setProgress(p) {
    state.paused = true;
    state.progress = Math.max(0, Math.min(1, p));
    state.startedAt = performance.now() - state.progress * state.duration;
  },
  pause() { state.paused = true; },
  resume() { state.paused = false; state.startedAt = performance.now() - state.progress * state.duration; },
  restart,
  setSweep(x) { state.sweepAt = x; },
  setProgress(p) { state.paused = true; state.progress = Math.max(0, Math.min(1, p)); state.startedAt = performance.now() - state.progress * state.duration; },
};
