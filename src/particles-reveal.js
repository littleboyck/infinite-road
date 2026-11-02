/**
 * particles-reveal.js —— 「粒子聚合 → 上色 → 凝结成实体」插件
 * ============================================================================
 *
 * 把 demo/particles.js 里那套效果抽成一个与页面无关的模块：
 * 不再自己建 renderer / scene / camera / rAF，也不碰任何 DOM，
 * 直接挂到调用方已有的 three.js 场景里，由调用方每帧驱动 update()。
 *
 * 【用法】
 *   import { createParticleReveal } from './particles-reveal.js';
 *
 *   const reveal = createParticleReveal({ scene, camera, renderer, car: state.car });
 *   reveal.play();                         // 播一轮（车体会被粒子替代）
 *   // 每帧：
 *   reveal.update();                       // 内部自己读 performance.now()
 *   // 结束会回调 onFinish；不想播完也可以 reveal.stop()
 *
 * 【一轮的时间线】（默认参数，5.0 + 2.6 + 2.0 + 5.0 ≈ 14.6 s）
 *   0.0 ~ 5.0 s   聚合    粒子按 aOrder 从上方逐段落位
 *   5.0 ~ 7.6 s   上色    扫光前沿扫过 → 黑白 → 灰白 → 低饱和 → 车漆
 *   7.0 ~ 12.0 s  凝结    实体用噪声 discard 长出来，粒子同步消失
 *
 * 【和 demo 的差别】
 *   - 不接管相机（demo 里有 autoCam 环绕运镜）
 *   - 不渲染（demo 自己 renderer.render）
 *   - 不读 HUD / 不绑控件
 *   - 地面粒子默认 0（viaduct_web 主场景没有地面网格）
 *   - 播完自动收尾：车体恢复可见、粒子藏起来、材质保持 uDissolve=1.06 的「全实心」
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ 着色器片段 */
// 噪声：粒子和实体共用同一套， dissolves 边界才能严丝合缝
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

const VERTEX_SHADER = /* glsl */ `
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
        // 地面亮度系数：1.0 = 与车身同亮度；地面是平铺的大平面，
        // 掠射角下每像素覆盖的粒子少，稍微提亮才和车身粒子一个观感
        const float GROUND_BOOST = 1.3;
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
        if (uDissolve > 0.001 && aCar > 0.5) {
          float pNz = dissolveMask(position * uNoiseScale);
          vAlpha *= step(uDissolve + 0.03, pNz);   // 比实体略早退场，避免叠出白斑
        }
      }
    `;

const FRAGMENT_SHADER = /* glsl */ `
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
    `;

/* ------------------------------------------------------------------ 状态默认值 */
const DEFAULTS = {
  // 规模
  carCount: 320000,
  groundCount: 0,        // 主场景没有地面：默认不撒地面粒子
  groundRadius: 9,

  // 时间（ms）
  duration: 5000,        // 聚合时长
  dissolveDuration: 5000,// 凝结时长
  holdAfterPaint: 2000,  // 上色完成后再等多久开始凝结
  sweepPeriod: 7000,     // 扫光一轮周期

  // 运动
  entry: [0, 0, -1],     // 轴向推进方向（车头 +Z → 车尾 -Z）
  beats: 1,
  entryMode: 0,          // 0 轴向 / 1 外→里 / 2 里→外
  easeMode: 0,           // 0 匀速 / 1 缓出 / 2 缓入 / 3 缓入缓出
  travel: 0.3,

  // 视觉
  size: 0.008,
  contrast: 1.2,
  blending: 'additive',   // 'additive'（发光感，适合夜景）/ 'normal'（保留车漆本色）

  // 扫光
  sweep: true,
  sweepW: 0.08,
  sweepGain: 1.15,

  // 起播时跳过多少聚合进度（0 = 从零开始）—— 加载遮罩淡出约 0.9 s，
  // DAO 0.35 让用户第一眼看到的就是一团已经成形的粒子云，而不是空屏
  startProgress: 0.35,
};

/**
 * 创建粒子聚合效果。
 * @param {object} opts
 * @param {THREE.Scene} opts.scene
 * @param {THREE.Camera} opts.camera
 * @param {THREE.WebGLRenderer} opts.renderer
 * @param {THREE.Object3D} opts.car          车体根节点（播的时候整体隐藏）
 * @param {number} [opts.carCount]           车身粒子数
 * @param {number} [opts.groundCount]        地面粒子数（0 = 不撒）
 * @param {number} [opts.loop]               是否循环播放（默认 false）
 * @param {(name:string)=>void} [opts.onPhase] 阶段变化回调
 * @param {()=>void} [opts.onFinish]         一轮播完回调
 */
export function createParticleReveal(opts = {}) {
  const {
    scene, camera, renderer, car,
    extras = null,          // 跟着车体一起「先隐藏 → 凝结时一起长出来」的实体（如地面）
    loop = false,
    onPhase = null,
    onFinish = null,
  } = opts;
  if (!scene || !camera || !renderer || !car) {
    throw new Error('createParticleReveal: 需要 scene / camera / renderer / car');
  }

  const state = {
    ...DEFAULTS,
    ...opts,
    colorDuration: 2600,
    dissolveT: 0,
    dissolveOn: false,
    dissolveStart: 0,
    progressOneAt: 0,
    colorT: 0,
    colorFront: 1e9,
    paintDoneAt: 0,
    progress: 0,
    paused: false,
    count: 0,
    startedAt: 0,
    buildMs: 0,
    phase: 'idle',
  };
  state.count = state.carCount + state.groundCount;

  /* ---------------------------------------------------------- 实体溶解材质 */
  // 粒子与实体共用同一个 uDissolve：实体长出来的地方粒子同步消失
  const dissolveU = {
    uDissolve: { value: 1.06 },   // 默认 1.06 = 全实心（未播放时车体正常显示）
    uNoiseScale: { value: 4.0 },
  };
  // 凝结时的「逐渐显影」：实体先半透明（透出后面的粒子），随 dissolveT 到不透明
  const alphaU = { uAlpha: { value: 1 } };
  const patchedMats = new Set();

  function patchDissolveMaterial(mat) {
    if (!mat || mat.userData.__revealPatched) return;
    mat.userData.__revealPatched = true;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDissolve = dissolveU.uDissolve;
      shader.uniforms.uNoiseScale = dissolveU.uNoiseScale;
      shader.uniforms.uAlpha = alphaU.uAlpha;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>',
          '#include <common>\nvarying vec3 vWPos;\nuniform float uDissolve;\nuniform float uNoiseScale;\nuniform float uAlpha;\n' + NOISE_GLSL)
        .replace('#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nfloat dNz = dissolveMask(vWPos * uNoiseScale);\nif (dNz > uDissolve - 0.002) discard;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\nfloat dEdge = 1.0 - smoothstep(0.0, 0.07, abs(dNz - uDissolve));\n'
          + 'dEdge *= smoothstep(0.0, 0.08, uDissolve) * (1.0 - smoothstep(0.90, 1.0, uDissolve));\n'
          + 'totalEmissiveRadiance += vec3(0.75, 0.85, 1.0) * dEdge * 0.55;')
        .replace('#include <opaque_fragment>',
          '#include <opaque_fragment>\n'
          + 'gl_FragColor.a *= uAlpha;');
    };
    mat.needsUpdate = true;
  }

  /** 把车体材质一次性都打上溶解补丁（凝结阶段开始前调用） */
  function patchAllMaterials() {
    for (const mesh of solidMeshes) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        patchDissolveMaterial(m);
        if (m) patchedMats.add(m);
      }
    }
  }

  /**
   * 幽灵模式：凝结过程中把车体材质设为半透明（alpha 由 uAlpha 控制），
   * 让实体像「显影」一样浮出来，而不是一下子变成不透明的色块。
   * 结束时必须还原，否则会一直走半透明排序通道。
   */
  const ghostPrev = new Map();
  function setGhostMode(on) {
    for (const mat of patchedMats) {
      if (on) {
        if (!ghostPrev.has(mat)) {
          ghostPrev.set(mat, { transparent: mat.transparent, depthWrite: mat.depthWrite });
        }
        mat.transparent = true;
        // depthWrite 保持 true：半透明的车身照样写深度，
        // 否则地面阴影平面（MultiplyBlending）会盖到车身上把它压暗，
        // 到凝结结束切回不透明那一帧就会「突然变亮」
        mat.depthWrite = true;
        mat.needsUpdate = true;
      } else {
        const prev = ghostPrev.get(mat);
        if (!prev) continue;
        mat.transparent = prev.transparent;
        mat.depthWrite = prev.depthWrite;
        mat.needsUpdate = true;
        ghostPrev.delete(mat);
      }
    }
    alphaU.uAlpha.value = on ? alphaU.uAlpha.value : 1;
  }

  /* ---------------------------------------------------------- 车身采样 */
  const meshList = [];
  car.traverse((o) => { if (o.isMesh) meshList.push(o); });

  // 额外实体（地面等）：不参与粒子采样，但跟着车体一起隐藏 / 凝结 / 显形
  const extraMeshList = [];
  if (extras) {
    const roots = Array.isArray(extras) ? extras : [extras];
    for (const root of roots) {
      if (!root) continue;
      if (root.isMesh) extraMeshList.push(root);
      else root.traverse((o) => { if (o.isMesh) extraMeshList.push(o); });
    }
  }
  const solidMeshes = meshList.concat(extraMeshList);
  car.updateWorldMatrix(true, true);
  const carBox = new THREE.Box3().setFromObject(car);
  const carRadius = carBox.getSize(new THREE.Vector3()).length() * 0.5;
  const carCenter = carBox.getCenter(new THREE.Vector3());

  function sampleCar(count, positions, normals, offset, colors) {
    const triPos = [], triNrm = [], triArea = [], triCol = [];
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    const tmpCol = new THREE.Color();
    for (const mesh of meshList) {
      const geo = mesh.geometry;
      const pos = geo.attributes.position;
      if (!pos) continue;
      let mc = new THREE.Color(0.55, 0.55, 0.58);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mm of mats) { if (mm && mm.color) { mc.copy(mm.color); break; } }
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
        const j = 0.88 + Math.random() * 0.24;
        colors[k * 3] = triCol[co] * j;
        colors[k * 3 + 1] = triCol[co + 1] * j;
        colors[k * 3 + 2] = triCol[co + 2] * j;
      }
    }
  }

  /** 地面：圆盘内均匀撒点（sqrt 修正，否则点会往圆心堆） */
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

  /* ---------------------------------------------------------- 拼粒子几何 */
  let points = null;
  let orderAttr = null;
  let posArray = null;

  /** 计算每颗粒子的出场顺序 aOrder（地面先铺满、车体随后，两组串行） */
  function computeOrder() {
    if (!orderAttr || !posArray) return;
    const d = state.entry;
    const P = posArray, n = state.count, carN = state.carCount;
    let cmin = Infinity, cmax = -Infinity;
    for (const x of [carBox.min.x, carBox.max.x])
      for (const y of [carBox.min.y, carBox.max.y])
        for (const z of [carBox.min.z, carBox.max.z]) {
          const t = d[0] * x + d[1] * y + d[2] * z;
          if (t < cmin) cmin = t;
          if (t > cmax) cmax = t;
        }
    const gr = state.groundRadius || 9;
    const horiz = Math.hypot(d[0], d[2]);
    const gmin = horiz < 1e-4 ? 0 : -gr * horiz;
    const gmax = horiz < 1e-4 ? 0 : gr * horiz;

    const arr = orderAttr.array;
    for (let i = 0; i < n; i++) {
      let o;
      if (state.entryMode === 0) {
        const t = d[0] * P[i * 3] + d[1] * P[i * 3 + 1] + d[2] * P[i * 3 + 2];
        o = i < carN
          ? (t - cmin) / Math.max(1e-4, cmax - cmin)
          : (t - gmin) / Math.max(1e-4, gmax - gmin);
      } else {
        const dx = P[i * 3], dy = P[i * 3 + 1] - carCenter.y, dz = P[i * 3 + 2];
        const dn = Math.min(1, Math.hypot(dx, dy, dz) / Math.max(0.5, carRadius));
        o = state.entryMode === 1 ? 1 - dn : dn;
      }
      o = o < 0 ? 0 : (o > 1 ? 1 : o);
      arr[i] = i < carN ? (0.55 + o * 0.45) : (o * 0.55);
    }
    orderAttr.needsUpdate = true;
  }

  function build() {
    const t0 = performance.now();
    const carN = state.carCount | 0;
    const groundN = state.groundCount | 0;
    const count = carN + groundN;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    sampleCar(carN, positions, normals, 0, colors);
    for (let i = carN; i < count; i++) {
      const g = 0.16 + Math.random() * 0.06;
      colors[i * 3] = g; colors[i * 3 + 1] = g; colors[i * 3 + 2] = g * 1.05;
    }
    if (groundN > 0) sampleGround(groundN, positions, normals, carN, state.groundRadius);

    const carMask = new Float32Array(count);
    carMask.fill(1, 0, carN);

    const delayAttr = new Float32Array(count);
    const seedAttr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      delayAttr[i] = Math.random();
      seedAttr[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aDelay', new THREE.BufferAttribute(delayAttr, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seedAttr, 1));
    geo.setAttribute('aCar', new THREE.BufferAttribute(carMask, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    orderAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
    geo.setAttribute('aOrder', orderAttr);
    posArray = positions;
    state.count = count;
    computeOrder();
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius *= 3;

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: state.blending === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: state.size },
        uProj: { value: 1000 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uLightDir: { value: new THREE.Vector3(0.42, 0.84, 0.34).normalize() },
        uTint: { value: new THREE.Color(0xe7edf8) },
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
        uCenter: { value: carCenter.clone() },
        uMaxDist: { value: Math.max(carRadius, 0.5) },
        uSweep: { value: -99 },
        uSweepW: { value: 0.08 },
        uSweepGain: { value: 0.0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.name = 'ParticleReveal';
    pts.visible = false;
    scene.add(pts);
    state.buildMs = performance.now() - t0;
    return pts;
  }

  function disposePoints() {
    if (!points) return;
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
    points = null;
  }

  function rebuild() {
    disposePoints();
    state.count = state.carCount + state.groundCount;
    points = build();
    return points;
  }

  /* ---------------------------------------------------------- 播放控制 */
  function setPhase(name) {
    if (state.phase === name) return;
    state.phase = name;
    onPhase?.(name);
  }

  function showCar(solid = true) {
    for (const m of solidMeshes) m.visible = true;
    dissolveU.uDissolve.value = solid ? 1.06 : 0;
    alphaU.uAlpha.value = 1;
    setGhostMode(false);
  }

  function hideCar() {
    for (const m of solidMeshes) m.visible = false;
  }

  function reset() {
    state.colorFront = 1e9;
    state.paintDoneAt = 0;
    state.dissolveOn = false;
    state.dissolveT = 0;
    state.dissolveStart = 0;
    state.progressOneAt = 0;
    state.progress = 0;
    state.paused = false;
    state.colorT = 0;
    dissolveU.uDissolve.value = 0;
    alphaU.uAlpha.value = 1;
    setGhostMode(false);
    if (points) {
      points.visible = true;
      points.material.uniforms.uProgress.value = 0;
    }
  }

  /**
   * 预热：在「载入遮罩」后面先把凝结阶段要用的东西跑一遍。
   * 凝结开始那一帧如果才去编译车体的着色器 / 上传贴图，会卡 200 ms 左右，
   * 这里先把 uDissolve 设为 0（全部 discard，画不出任何像素），
   * 把车体临时显形渲染一帧，管线就算走完了，之后凝结只是改 uniform + 翻 visible。
   */
  function prewarm(rendererRef, sceneRef, cameraRef) {
    if (!rendererRef || !sceneRef || !cameraRef) return false;
    patchAllMaterials();
    const wasVisible = solidMeshes.map((m) => m.visible);
    const prevDissolve = dissolveU.uDissolve.value;
    const prevCount = rendererRef.info?.render?.calls ?? 0;
    dissolveU.uDissolve.value = 0;          // 0 = 全部 discard → 看不见
    for (const m of solidMeshes) m.visible = true;
    try {
      rendererRef.render(sceneRef, cameraRef);      // 编译「不透明」版本
      setGhostMode(true);                           // 再编译「半透明」版本，凝结开始时零开销
      rendererRef.render(sceneRef, cameraRef);
      setGhostMode(false);
    } catch (err) {
      console.warn('[particles-reveal] 预热渲染失败：', err);
    }
    solidMeshes.forEach((m, i) => { m.visible = wasVisible[i]; });
    dissolveU.uDissolve.value = prevDissolve;
    return (rendererRef.info?.render?.calls ?? 0) !== prevCount;
  }

  /** 重新开始一轮：车体交给粒子，粒子从头聚合 */
  function play() {
    if (!points) rebuild();
    hideCar();
    reset();
    // 起播进度：默认直接跳过开头那一段「几乎看不见」的稀疏阶段，
    // 首帧就能看到一团有形状的粒子云，再慢慢收拢成车。
    const skip = Math.min(0.5, Math.max(0, state.startProgress || 0));
    state.startedAt = performance.now() - skip * state.duration;
    active = true;
    setPhase('aggregate');
  }

  /** 中止播放，恢复实体车 */
  function stop() {
    active = false;
    // 车体粒子会被 uDissolve=1.06 抹掉，地面粒子保留
    if (points) points.visible = state.groundCount > 0;
    patchAllMaterials();
    showCar(true);
    setPhase('idle');
  }

  /** 直接跳到某一进度（0~1），调试用 */
  function setProgress(p) {
    state.paused = true;
    state.progress = Math.max(0, Math.min(1, p));
    state.startedAt = performance.now() - state.progress * state.duration;
    if (!active) play();
    state.paused = true;
  }

  /* ---------------------------------------------------------- 每帧推进 */
  let active = false;

  function sweepPosition(now) {
    const per = Math.max(800, state.sweepPeriod);
    const ph = ((now - state.startedAt) % per) / per;
    return 3.4 - ph * 6.8;
  }

  /**
   * 每帧调用一次。返回 true 表示还在播放（方便调用方跳过别的逻辑）。
   */
  function update() {
    if (!active || !points) return false;
    const now = performance.now();

    if (!state.paused) {
      const raw = Math.min(1, (now - state.startedAt) / state.duration);
      state.progress = raw;
      const paintAt = state.paintDoneAt ? (state.paintDoneAt - state.startedAt) : state.duration;
      const cycleMs = paintAt + state.holdAfterPaint + state.dissolveDuration + 600;
      const dissolved = state.dissolveOn && state.dissolveT >= 1;
      if (raw >= 1 && state.loop && dissolved && now - state.startedAt > cycleMs) play();
    }

    const hPx = renderer.domElement.clientHeight || 760;
    const fovRad = (camera.fov * Math.PI) / 180;
    const u = points.material.uniforms;
    u.uProj.value = (hPx * 0.5) / Math.tan(fovRad * 0.5);
    u.uProgress.value = state.progress;
    u.uTime.value = now / 1000;
    u.uPixelRatio.value = renderer.getPixelRatio();
    // 聚合初期粒子散得开、显得稀薄，先放大一点保证一上来就能看见云；
    // 越接近成形越回到设定尺寸
    const ramp = 1 + 1.6 * Math.pow(1 - state.progress, 2);
    u.uSize.value = state.size * ramp;
    u.uEntry.value.set(state.entry[0], state.entry[1], state.entry[2]);

    // 顺序区间按入口方向投影包围盒
    {
      const d = state.entry, m = carBox.min, M = carBox.max;
      let mn = Infinity, mx = -Infinity;
      for (const x of [m.x, M.x]) for (const y of [m.y, M.y]) for (const z of [m.z, M.z]) {
        const t = d[0] * x + d[1] * y + d[2] * z;
        if (t < mn) mn = t;
        if (t > mx) mx = t;
      }
      u.uOrderMin.value = mn; u.uOrderMax.value = mx;
    }
    u.uMode.value = state.entryMode;
    u.uBeats.value = state.beats;
    u.uEaseMode.value = state.easeMode;
    u.uTravel.value = state.travel;
    u.uContrast.value = state.contrast;
    u.uDensity.value = Math.min(1.8, Math.max(0.45, Math.sqrt(200000 / Math.max(1, state.count))));

    // 扫光 + 上色：前沿只前进不后退
    const sweepPos = sweepPosition(now);
    if (state.sweep && state.progress >= 0.6) state.colorFront = Math.min(state.colorFront, sweepPos);
    if (!state.sweep && state.progress >= 0.6) state.colorFront = -2.2;
    u.uColorFront.value = state.colorFront;
    state.colorT = 1 - Math.min(1, Math.max(0, (state.colorFront + 3.4) / 6.8));
    u.uColorT.value = state.colorT;
    u.uSweep.value = sweepPos;
    u.uSweepW.value = state.sweepW;
    {
      const gp = Math.min(1, Math.max(0, (state.progress - 0.60) / 0.08));
      const gate = gp * gp * (3 - 2 * gp);
      u.uSweepGain.value = state.sweep ? (state.sweepGain ?? 1.15) * gate : 0.0;
    }

    // 聚合完成时刻
    if (state.progress >= 0.999 && !state.progressOneAt) {
      state.progressOneAt = now;
      setPhase('paint');
    }

    // 吸附前摇
    if (state.progressOneAt) {
      const el = now - state.progressOneAt;
      u.uSuck.value = Math.min(1, Math.max(0, (el - 1400) / 600));
    } else {
      u.uSuck.value = 0;
    }

    // 上色完成判定
    if (state.progress >= 0.6 && state.colorFront <= -2.2 && !state.paintDoneAt) state.paintDoneAt = now;

    // 触发凝结
    if (state.paintDoneAt && now - state.paintDoneAt >= state.holdAfterPaint) {
      if (!state.dissolveOn) {
        state.dissolveOn = true;
        state.dissolveStart = now;
        patchAllMaterials();
        setGhostMode(true);            // 半透明显影
        for (const m of solidMeshes) m.visible = true;
        setPhase('dissolve');
      }
      state.dissolveT = Math.min(1, (now - state.dissolveStart) / Math.max(200, state.dissolveDuration));
      if (state.dissolveT >= 1 && points) points.visible = false;
      dissolveU.uDissolve.value = state.dissolveT >= 0.999 ? 1.06 : state.dissolveT;
      // 实体先半透明地显影，随 dissolveT 线性回到不透明（车漆颜色全程保持本色）
      alphaU.uAlpha.value = state.dissolveT >= 1 ? 1 : (0.18 + 0.82 * state.dissolveT);
    } else {
      state.dissolveT = 0;
      dissolveU.uDissolve.value = 0;
      alphaU.uAlpha.value = 1;
    }

    // 凝结结束：撤销半透明，回到完全实体
    if (state.dissolveOn && state.dissolveT >= 1) setGhostMode(false);

    // 播完收尾
    if (state.dissolveT >= 1) {
      if (!state.loop) {
        active = false;
        // 车体粒子已被 uDissolve 全部抹掉；地面粒子要留着当「永久地面」
        if (points) points.visible = state.groundCount > 0;
        setPhase('done');
        onFinish?.();
        return false;
      }
    }
    return true;
  }

  /* ---------------------------------------------------------- 释放 */
  function dispose() {
    active = false;
    disposePoints();
    showCar(true);
    orderAttr = null;
    posArray = null;
  }

  return {
    play,
    prewarm,
    stop,
    update,
    setProgress,
    rebuild,
    dispose,
    get active() { return active; },
    get phase() { return state.phase; },
    get progress() { return state.progress; },
    get points() { return points; },
    state,
    /** 只读快照，方便调试 */
    getSnapshot() {
      return {
        phase: state.phase,
        active,
        progress: +state.progress.toFixed(3),
        colorT: +state.colorT.toFixed(3),
        dissolveT: +state.dissolveT.toFixed(3),
        count: state.count,
        buildMs: Math.round(state.buildMs),
      };
    },
  };
}
