/**
 * main.js —— 无限直线公路跟车漫游
 *
 * 结构：
 *   1. 渲染器 / 场景 / 相机基础设置
 *   2. 载入车辆模型（car.glb，带进度）
 *   3. 车体局部坐标系下的相机机位（车永远固定在画面里）
 *   4. HUD 交互
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createSky, createEnvironment } from './sky.js?v=20261102w';
import { createParticleReveal } from './particles-reveal.js?v=20261102a';

// ------------------------------------------------------------------ 常量
const ASSETS = {
  car: './assets/car.glb',
};

const UP = new THREE.Vector3(0, 1, 0);
const MAX_ANISO = 8;

const DEG = Math.PI / 180;
const WHEEL_RADIUS = 0.36;      // 车轮半径（m），滚动角速度 = 车速 / 半径
const WHEELBASE = 2.706;        // 轴距：前轴 +1.325，后轴 -1.381
const MAX_STEER = 20 * DEG;     // 前轮最大转向角
const STEER_GAIN = 14;          // 视觉夸张系数：真实几何转向角只有 1° 左右，看不出来
const SPIN_AXIS = new THREE.Vector3(1, 0, 0);   // 车轮轴线（车辆局部 X）

// 行驶轨迹在车道内的缓弧摆动：车不是笔直贴着车道中线走，而是在车道里画一段
// 很缓的弧（横向 ±0.10 m，一个完整波 80 m），全程稳稳在车道中途。
const WEAVE_AMP = 0.10;              // 横向摆幅（m）
const WEAVE_LEN = 80;                // 一个完整 S 的长度（m）
const WEAVE_K = (2 * Math.PI) / WEAVE_LEN;

/** 相机机位：偏移都写在车辆局部坐标系里（x=右, y=上, z=前） */
const CAM_MODES = [
  {
    // 主驾侧：机位在驾驶员这一侧（+X = 左 = 主驾），默认水平角 90°；
    // pos.z 为正 + yaw 90° 绕车旋转后正好落在车身左侧、驾驶员肩高附近。
    name: '主驾侧',
    pos: { x: 0, y: 1.30, z: 5.2 },
    look: { x: 0, y: 0.82, z: 0.0 },
    yaw: 90,
    fov: 55,
  },
  {
    name: '跟车后视',
    pos: { x: 0, y: 2.55, z: -6.0 },      // 默认高度不变；向上拖动可降到约 1.2 m
    look: { x: 0, y: 0.70, z: 0.0 },       // 看向车身中心 → 车始终位于画面正中
    yaw: 0,                                // 该机位的默认水平角（度）
    fov: 50,
  },
  {
    // 副驾侧前：车身右侧（副驾侧）斜前方 3/4 视角
    name: '副驾侧前',
    pos: { x: 0.85, y: 1.12, z: 6.6 },
    look: { x: -0.35, y: 0.66, z: 0.2 },
    yaw: -45,                              // 默认绕车转 -45°，得到斜前方 3/4 视角
    fov: 40,
  },
  {
    name: '高位全景',
    pos: { x: -2.6, y: 6.0, z: -11.6 },
    look: { x: 0, y: 0.70, z: 0.0 },        // 看向车身中心 → 车位于画面正中
    yaw: 0,
    fov: 50,
  },
  {
    // 主驾视角：相机坐在主驾座位的眼点，朝车头看（仪表台 + 前风挡）；
    // 偏移量的 x 走「车右」基向量，所以主驾（车左，+X）要取负值。
    name: '主驾视角',
    pos: { x: -0.36, y: 1.15, z: -0.62 },
    look: { x: -0.36, y: 0.78, z: 8.0 },
    yaw: 0,
    fov: 76,
    // 车内视角：相机位置固定，拖动只在原地转头（不限角度）
    lookAround: true,
  },
];

// ------------------------------------------------------------------ 调试 / 错误收集
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + String(e.reason)));

// ------------------------------------------------------------------ DOM
const els = {
  app: document.getElementById('app'),
  loader: document.getElementById('loader'),
  loaderBar: document.getElementById('loader-bar-fill'),
  loaderStatus: document.getElementById('loader-status'),
  brand: document.getElementById('brand'),
  panel: document.getElementById('panel'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  btnPlay: document.getElementById('btn-play'),
  playIco: document.getElementById('play-ico'),
  playLabel: document.getElementById('play-label'),
  speed: document.getElementById('speed'),
  speedVal: document.getElementById('speed-val'),
  camYaw: document.getElementById('camyaw'),
  camYawVal: document.getElementById('camyaw-val'),
  camPitch: document.getElementById('campitch'),
  camPitchVal: document.getElementById('campitch-val'),
  camDist: document.getElementById('camdist'),
  camDistVal: document.getElementById('camdist-val'),
  envLight: document.getElementById('envlight'),
  envLightVal: document.getElementById('envlight-val'),
  sunLight: document.getElementById('sunlight'),
  sunLightVal: document.getElementById('sunlight-val'),
  camSeg: document.getElementById('cam-seg'),
  orbitSeg: document.getElementById('orbit-seg'),
  orbitState: document.getElementById('orbit-state'),
  particlesSeg: document.getElementById('particles-seg'),
  particlesState: document.getElementById('particles-state'),
  camName: document.getElementById('cam-name'),
  curSpeed: document.getElementById('cur-speed'),
  odometer: document.getElementById('odometer'),
  btnCollapse: document.getElementById('btn-collapse'),
  todSeg: document.getElementById('tod-seg'),
  todName: document.getElementById('tod-name'),
  doorSeg: document.getElementById('door-seg'),
  camReturnSeg: document.getElementById('cam-return-seg'),
  camReturnState: document.getElementById('cam-return-state'),
  engineSeg: document.getElementById('engine-seg'),
  engineState: document.getElementById('engine-state'),
  doorState: document.getElementById('door-state'),
};

// ------------------------------------------------------------------ 渲染器
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
els.app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.12, 2600);
camera.position.set(0, 3, -8);

// ------------------------------------------------------------------ 全景查看器（OrbitControls）
// 上面的机位是「焊在车上」的：只能绕车转、不能缩放/平移。
// 这里备一套标准 OrbitControls 接管相机：左键环绕、滚轮缩放，target 平滑跟随车辆，
// 边开边看整条无限公路。默认关闭，不影响原有交互。
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;
// 按「设计插件视口」的手感来：左键环绕、右键平移、滚轮缩放，俯仰不设限
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.9;
controls.zoomSpeed = 1.0;
controls.panSpeed = 1.0;
controls.screenSpacePanning = true;        // 平移沿屏幕平面走（和 Blender/编辑器一致）
controls.enablePan = true;
controls.minDistance = 0.6;
controls.maxDistance = 2400;               // 能一路飞过穹顶（半径 900）再从外面看回来
controls.minPolarAngle = 0;                // 可以完全仰视 / 俯视
controls.maxPolarAngle = Math.PI;
controls.target.set(0, 1, 0);

// 环境反射（PMREM 天空）
// 穹顶网格不加入场景：背景直接用纯色，车漆的反射仍由环境贴图提供。
const sky = createSky({ sunDir: new THREE.Vector3(0.72, 0.42, 0.28) });
scene.background = new THREE.Color(0x0a111a);   // 与页面底色一致
createEnvironment(renderer, scene);
// 环境贴图（PMREM 天空）本身很亮，会整体抬高材质的环境光；这里压到 0.45
scene.environmentIntensity = 0.6;

// ------------------------------------------------------------------ 时段预设
// 每一项同时控制：天空三道渐变色、太阳方向/颜色/强度、半球光、轮廓光、
// 曝光、环境贴图强度，以及烘环境贴图用的小场景配色。
const PRESETS = {
  dawn: {
    label: '拂晓',
    sky: { top: 0x232849, horizon: 0x9d6a5e, bottom: 0x171a24, sunColor: 0xffb894 },
    sunDir: [0.62, 0.10, 0.42],       // 极低的太阳，偏暖
    sun: { color: 0xffb894, intensity: 1.2 },
    hemi: { sky: 0x8b9cc4, ground: 0x38332c, intensity: 0.85 },
    rim: { color: 0x8aa6d8, intensity: 0.95 },
    env: { envTop: 0x1b2340, envHorizon: 0x8a6a74, envBottom: 0x12141b,
           envKey: [1.5, 1.15, 1.0], envFill: [0.5, 0.62, 1.0] },
    bounce: 1.9,
    bounceColor: 0x9a8272,
    exposure: 1.05,
    envIntensity: 0.9,
  },
  morning: {
    label: '清晨',
    sky: { top: 0x0b2c58, horizon: 0x5a92c8, bottom: 0x121923, sunColor: 0xfff2d8 },
    sunDir: [0.55, 0.52, 0.36],
    sun: { color: 0xfff1d8, intensity: 1.95 },
    hemi: { sky: 0x86b2da, ground: 0x3c4650, intensity: 0.9 },
    rim: { color: 0x93b6d8, intensity: 1.0 },
    env: { envTop: 0x122a46, envHorizon: 0x5b8dc2, envBottom: 0x10161d,
           envKey: [2.2, 2.15, 2.05], envFill: [0.55, 0.85, 1.45] },
    bounce: 2.6,
    bounceColor: 0x9aa0a6,
    exposure: 1.0,
    envIntensity: 0.85,
  },
  dusk: {
    label: '黄昏',
    sky: { top: 0x232038, horizon: 0xc27a4c, bottom: 0x14161c, sunColor: 0xffb070 },
    sunDir: [0.72, 0.20, 0.28],
    sun: { color: 0xffc08a, intensity: 1.5 },
    hemi: { sky: 0x8a8ba8, ground: 0x50483e, intensity: 0.7 },
    rim: { color: 0x86b0e0, intensity: 0.85 },
    env: { envTop: 0x2a2438, envHorizon: 0xa8704a, envBottom: 0x141219,
           envKey: [1.9, 1.5, 1.2], envFill: [0.5, 0.72, 1.2] },
    bounce: 2.2,
    bounceColor: 0x8a7a68,
    exposure: 0.95,
    envIntensity: 0.6,
  },
  night: {
    label: '夜晚',
    sky: { top: 0x03060c, horizon: 0x101a26, bottom: 0x070a0e, sunColor: 0x9fb8e0 },
    sunDir: [0.45, 0.40, -0.55],      // 冷色月光，从另一侧打
    sun: { color: 0xa8c2ec, intensity: 0.62 },
    hemi: { sky: 0x2a3c56, ground: 0x1b1e22, intensity: 0.5 },
    rim: { color: 0x6f93c4, intensity: 0.55 },
    env: { envTop: 0x050a12, envHorizon: 0x111b27, envBottom: 0x05070a,
           envKey: [0.35, 0.42, 0.55], envFill: [0.16, 0.24, 0.4] },
    bounce: 0.9,
    bounceColor: 0x2d3644,
    exposure: 1.3,
    envIntensity: 0.45,
  },
};

// ------------------------------------------------------------------ 灯光
const hemi = new THREE.HemisphereLight(0x9dbde2, 0x171b22, 0.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffedd8, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(3072, 3072);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 220;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.05;
sun.shadow.radius = 2;
scene.add(sun);
scene.add(sun.target);

// 背侧冷色轮廓光，让车从远处暗背景里跳出来
const rim = new THREE.DirectionalLight(0x86b0e0, 0.85);
scene.add(rim);
scene.add(rim.target);

// 地面反弹补光：从下往上打，专门照亮朝下的面（车底、轮拱），否则车底会黑成一块
const bounce = new THREE.DirectionalLight(0x8a7a68, 0.35);
bounce.position.set(0, -40, 0);
bounce.target.position.set(0, 0, 0);
scene.add(bounce);
scene.add(bounce.target);

// 地面是粒子、没有实体地板，单独放一块「只画影子」的圆盘来接住车的投影。
// ShadowMaterial 只在被遮挡处出颜色，其余像素完全透明，所以看不见地板本身；
// renderOrder 排在粒子之后，影子会压在粒子地面上，而不是被粒子盖掉。
// 用 MultiplyBlending 把阴影「乘」到已有画面上（粒子也是半透明叠加，
// 普通 NormalBlending 的黑色阴影压在近黑的场景里根本看不出来）：
// 亮处输出 1.0 → 画面不变；阴影里输出 1-opacity → 把底下的粒子地面压暗。
// 影子强度：0 = 完全看不见，1 = 正常。凝结阶段随进度线性长出来，避免「啪」一下出现
const shadowFade = { value: 0 };

const shadowMat = new THREE.ShadowMaterial({ opacity: 0.72 });
shadowMat.blending = THREE.MultiplyBlending;
shadowMat.transparent = true;
shadowMat.depthWrite = false;
shadowMat.onBeforeCompile = (shader) => {
  shader.uniforms.uShadowFade = shadowFade;
  shader.fragmentShader = 'uniform float uShadowFade;\n' + shader.fragmentShader
    .replace('#include <tonemapping_fragment>', '')
    .replace('#include <colorspace_fragment>', '')
    .replace(
      'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
      'float sh = 1.0 - getShadowMask();\n\tgl_FragColor = vec4( vec3( mix( 1.0, 1.0 - opacity * uShadowFade, sh ) ), 1.0 );'
    );
};
const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(48, 64), shadowMat);
shadowCatcher.name = 'ShadowCatcher';
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.001;
shadowCatcher.receiveShadow = true;
shadowCatcher.renderOrder = 10;
scene.add(shadowCatcher);

// 车底「接触阴影」：跟太阳方向无关的软阴影，保证从任何角度看车都稳稳落在地面上
// （上面那块 ShadowMaterial 是真实投影，太阳在车后方时会被车身自己挡住）。
// 同样用 MultiplyBlending：白 = 不变，灰 = 压暗，所以画在粒子地面之上也没问题。
function makeContactShadowTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0.0, '#3c3c3c');
  grd.addColorStop(0.34, '#6e6e6e');
  grd.addColorStop(0.62, '#b4b4b4');
  grd.addColorStop(0.84, '#e6e6e6');
  grd.addColorStop(1.0, '#ffffff');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
const contactMat = new THREE.MeshBasicMaterial({
  map: makeContactShadowTexture(),
  blending: THREE.MultiplyBlending,
  depthWrite: false,
  toneMapped: false,
});
contactMat.onBeforeCompile = (shader) => {
  shader.uniforms.uShadowFade = shadowFade;
  shader.fragmentShader = 'uniform float uShadowFade;\n' + shader.fragmentShader.replace(
    '#include <map_fragment>',
    '#include <map_fragment>\n\tdiffuseColor.rgb = mix( vec3( 1.0 ), diffuseColor.rgb, uShadowFade );'
  );
};
const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 7.6), contactMat);
contactShadow.name = 'ContactShadow';
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = 0.0008;
contactShadow.renderOrder = 9;
scene.add(contactShadow);

// ------------------------------------------------------------------ 应用时段预设
let currentPreset = 'dusk';
function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  currentPreset = name;

  // 太阳方向（天空里的太阳光晕、平行光、轮廓光的基准方向）
  sunDir.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize();

  // 恢复各时段原本的调色：天空三段色，不再做整体偏移
  sky.setPalette({
    top: p.sky.top,
    horizon: p.sky.horizon,
    bottom: p.sky.bottom,
    sunColor: p.sky.sunColor,
    sunDir,
  });
  // 三盏灯
  sun.color.setHex(p.sun.color);
  sun.intensity = p.sun.intensity;
  hemi.color.setHex(p.hemi.sky);
  hemi.groundColor.setHex(p.hemi.ground);
  hemi.intensity = p.hemi.intensity;
  rim.color.setHex(p.rim.color);
  rim.intensity = p.rim.intensity;
  bounce.color.setHex(p.bounceColor ?? 0x8a7a68);
  bounce.intensity = p.bounce ?? 0.35;

  // 曝光 + 环境光强度（滑杆同步到该预设的值）
  renderer.toneMappingExposure = p.exposure;
  setEnvLight(p.envIntensity);
  setSunLight(p.sun.intensity);

  // 重烘环境贴图（车漆反射的底色也跟着变）
  createEnvironment(renderer, scene, p.env);

  // UI 同步
  if (els.todName) els.todName.textContent = p.label;
  if (els.todSeg) {
    for (const b of els.todSeg.querySelectorAll('button')) {
      b.classList.toggle('active', b.dataset.tod === name);
    }
  }
  updateLights();
}
window.__viaductApplyPreset = applyPreset;
// 供外部/调试直接控制灯光强度（0..1.5 / 0..3）
window.__viaductSetLight = (env, sunI) => {
  if (typeof env === 'number') setEnvLight(env);
  if (typeof sunI === 'number') setSunLight(sunI);
};

// ------------------------------------------------------------------ 状态
const RUN_ACCEL = 4.5;   // 启动后的线性加速度（m/s²）：0 → 100 km/h 约 6.2 s
const RUN_BRAKE = 10.0;  // 熄火后的线性减速度（m/s²）：100 km/h → 静止约 2.8 s
const STARTUP_CRANK = 3.4; // 启动阶段时长（秒）：这期间只是“打火”，车轮不转，结束后才线性起步

const state = {
  car: null,

  travel: 0,        // 累计行驶距离（只用来滚路面标线）
  odometer: 0,      // 累计里程
  playing: false,          // 默认熄火：车停着、轮胎不转，点「启动」才开始
  startupLeft: 0,          // 启动阶段剩余时间（>0 表示正在打火，车轮不动）
  speedSetKmh: 100,        // 设定车速（滑杆真实值，不受声波律动影响）
  speedTarget: 100 / 3.6,  // m/s（内部一律用 m/s，界面显示 km/h）
  speedNow: 0,      // m/s
  camMode: 0,
  orbitView: false,   // true = OrbitControls 接管相机（全景查看）
  camDist: 6.0,     // 镜头后拉距离（m），滑杆可调
  camAutoReturn: true,  // 松手后相机是否自动回到机位默认角度（控制台「相机回正」开关）

  carBody: null,     // 车身组（车轮之外的部件）
  wheels: [],        // 四个车轮节点 { node, baseQuat, front }
  wheelSpin: 0,      // 车轮累计滚动角（rad）
  steer: 0,          // 前轮当前转向角（rad）
};

const rig = {
  ox: CAM_MODES[0].pos.x, oy: CAM_MODES[0].pos.y, oz: CAM_MODES[0].pos.z,
  lx: CAM_MODES[0].look.x, ly: CAM_MODES[0].look.y, lz: CAM_MODES[0].look.z,
  fov: CAM_MODES[0].fov,
};

// 机位切换过渡：把「当前画面」当作起点，用缓入缓出的匀速曲线插值到新机位。
// 曲线用 smoothstep（3t²-2t³）：两端加减速对称、中段速度恒定，观感上接近「匀速直线」。
const camTween = {
  active: false,       // 是否正在做机位过渡
  t: 0,                // 0..1 进度
  dur: 0.85,           // 过渡时长（秒）
  // 圆弧过渡用的极坐标：r=水平半径，a=方位角，h=高度（相机 / 看向点各一组）
  r0: 0, a0: 0, h0: 0, lr0: 0, la0: 0, lh0: 0, fov0: 0,
  r1: 0, a1: 0, h1: 0, lr1: 0, la1: 0, lh1: 0, fov1: 0,
  da: 0,               // 方位角增量（已折算到最近一圈）
  dla: 0,              // 看向点方位角增量
  fromYaw: 0,          // 起始水平角（rad，仅用于读数动画）
  toYaw: 0,            // 目标水平角（rad）
  fromPitch: 0,        // 起始俯仰（rad）
  target: null,        // 过渡终点的 rig 快照
};

const carPos = new THREE.Vector3();
// 退出全景模式时，从原镜头位置回到车载机位的过渡量
const _prevCam = new THREE.Vector3();
let camBlend = 0;
const camLook = new THREE.Vector3();

// 鼠标环绕：水平方向 360° 自由旋转（不设限），垂直 0~30°，松手回到基准角度位
const PITCH_MAX = THREE.MathUtils.degToRad(30);        // 垂直：抬起最多 30°
const PITCH_MIN = THREE.MathUtils.degToRad(8.5);       // 垂直：可下压到约 8.5°（相机高度约 1.2 m）
const PITCH_SENS = 0.0016;                             // 垂直弧度/像素（30° 约拖 327 px，比水平更慢）
const PITCH_RATE = THREE.MathUtils.degToRad(50);       // 垂直跟随为线性：50°/s 恒定速率
const ORBIT_SENS = 0.0035;                             // 水平弧度/像素（可连续拖动绕车转圈）
const LOOK_PITCH_MAX = 85 * DEG;                       // 车内转头时俯仰的上限（防万向锁）
// 垂直方向的硬保险：相机与车的极角必须落在 10° ~ 170° 之间
const POLAR_MIN = THREE.MathUtils.degToRad(10);
const POLAR_MAX = THREE.MathUtils.degToRad(170);
const orbit = {
  yaw: 0,            // 当前实时水平角
  pitch: 0,          // 当前实时俯仰角（>0 相机抬高）
  yawTarget: 0,      // 拖动目标
  pitchTarget: 0,
  dragging: false,
  startX: 0,
  startY: 0,
  startYaw: 0,
  startPitch: 0,
  returning: false,
  returnYawTarget: 0,
  returnPitch: 0,
  returnElapsed: 0,
  returnDur: 0.5,
  baseYaw: 0,        // 当前基准水平角（滑杆设定；鼠标松手后同步为拖到的方向）
  basePitch: 0,      // 基准俯仰角（没有滑杆，恒为 0：俯仰只靠拖动）
};
const sunDir = sky.sunDir.clone();

// ------------------------------------------------------------------ 加载进度
// 车辆资产 0..1
const progress = { car: 0 };

function overallProgress() {
  return progress.car;
}

function setProgressUI(text) {
  const pct = Math.max(0, Math.min(1, overallProgress()));
  els.loaderBar.style.width = (pct * 100).toFixed(1) + '%';
  if (text) els.loaderStatus.textContent = text;
}

function onAssetProgress(key, label) {
  return (e) => {
    if (e && e.lengthComputable && e.total > 0) progress[key] = e.loaded / e.total;
    else progress[key] = Math.max(progress[key], 0.25);
    setProgressUI(`${label} ${Math.round(progress[key] * 100)}%`);
  };
}

function loadGLTF(url, onProgress) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => loader.load(url, resolve, onProgress, reject));
}

// ------------------------------------------------------------------ 资产安装
/**
 * 车玻璃 / 灯罩材质的本地修正。
 * car.glb 里车玻璃用了无贴图的 GlassMtl（glTF 默认 metallic=1、baseColor=白），
 * 在 three 里会渲染成一块不透明白板；这里按材质名替换成深色半透明玻璃。
 */
function makeCarGlass(kind) {
  const base = {
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.6,
    metalness: 0,
    transmission: 0,
  };
  if (kind === 'red') {
    return new THREE.MeshPhysicalMaterial({
      ...base,
      color: 0x2a0505,
      emissive: new THREE.Color(0x9a1414),
      emissiveIntensity: 0.55,
      roughness: 0.14,
      opacity: 0.88,
    });
  }
  if (kind === 'amber') {
    return new THREE.MeshPhysicalMaterial({
      ...base,
      color: 0x2e1802,
      emissive: new THREE.Color(0x9a5c0a),
      emissiveIntensity: 0.45,
      roughness: 0.16,
      opacity: 0.88,
    });
  }
  // 挡风玻璃 / 侧窗 / 后窗
  return new THREE.MeshPhysicalMaterial({
    ...base,
    color: 0x0c1319,
    roughness: 0.07,
    opacity: 0.34,
    envMapIntensity: 1.25,
    clearcoat: 0.8,
    clearcoatRoughness: 0.05,
  });
}

function configureCar(root) {
  const maxAniso = Math.min(MAX_ANISO, renderer.capabilities.getMaxAnisotropy());
  const materialCache = new Map(); // 原材质 → 替换后的材质，避免重复创建

  const glassCache = {};
  const getGlass = (kind) => (glassCache[kind] ??= makeCarGlass(kind));

  const fixMaterial = (m) => {
    if (!m) return m;
    if (materialCache.has(m)) return materialCache.get(m);

    let out = m;
    if (m.name === 'GlassMtl' || m.name === 'GlassSideTint') {
      out = getGlass('main');
    } else if (m.name === 'GlassRed') {
      out = getGlass('red');
    } else if (m.name === 'GlassAmber') {
      out = getGlass('amber');
    } else if (m.name === 'LightA') {
      // 大灯：不要发白，给一点暖色的灯罩底光
      m.emissive = new THREE.Color(0xffe6bd);
      m.emissiveIntensity = 0.6;
      m.color.setHex(0x1b1b19);
      m.roughness = 0.18;
      m.envMapIntensity = 1.1;
    } else if (m.name === 'LicensePlateDefaultA') {
      m.emissiveIntensity = 0.18;
    }

    if (out === m) {
      out.envMapIntensity = m.name === 'OEMPaint' ? 1.6 : 1.05;
      if (m.map) m.map.anisotropy = maxAniso;
      if (m.normalMap) m.normalMap.anisotropy = maxAniso;
    } else {
      if (out.map) out.map.anisotropy = maxAniso;
    }
    out.needsUpdate = true;
    materialCache.set(m, out);
    return out;
  };

  root.traverse((o) => {
    if (!o.isMesh) return;
    // Blender 里原本 hide_render 的车窗内壳，直接不渲染
    if (o.name === 'WindowInside') {
      o.visible = false;
      return;
    }
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false; // 车始终在画面里，省掉逐帧包围盒计算

    if (Array.isArray(o.material)) {
      o.material = o.material.map(fixMaterial);
    } else {
      o.material = fixMaterial(o.material);
    }
    if (/^(Window|Light)/.test(o.name)) o.renderOrder = 2;
  });

  // 车身与车轮分离：四个车轮留在 CarRoot 下（只滚动/转向，始终贴地），
  // 其余所有部件放进 CarBody 组，晃动与侧倾只作用在车身上（悬挂感）
  const carRoot = root.getObjectByName('CarRoot') ?? root;
  const body = new THREE.Group();
  body.name = 'CarBody';
  const wheels = [];
  for (const child of [...carRoot.children]) {
    if (/^Wheel\d+A_[LR][FR]$/.test(child.name)) {
      const front = child.position.z > 0;
      // 轮子几何中心相对节点原点有偏移（沿着轮轴 ±0.038 m），先归零，
      // 否则绕轴旋转会带出细微的摆动；同时取出这支轮子真正的轮轴方向
      if (child.geometry) {
        child.geometry = child.geometry.clone();
        child.geometry.computeBoundingBox();
        const c = child.geometry.boundingBox.getCenter(new THREE.Vector3());
        child.geometry.translate(-c.x, -c.y, -c.z);
        child.position.add(c.clone().applyQuaternion(child.quaternion));
      }
      const axle = new THREE.Vector3(1, 0, 0).applyQuaternion(child.quaternion).normalize();
      // 高速模糊圆盘：法线转到轮轴方向，随轮子一起转（图案近似旋转对称，看不出来）
      const { tex, geo } = wheelBlurAssets();
      // 圆盘贴在轮辐外表面两侧（轮胎半宽 0.164），否则会被轮辋挡在里面看不见
      const blurs = [];
      for (const sgn of [1, -1]) {
        const blur = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            map: tex, transparent: true, opacity: 0, depthWrite: false,
            side: THREE.DoubleSide, toneMapped: false,
          })
        );
        blur.name = 'WheelBlur';
        blur.rotation.y = Math.PI / 2;
        blur.position.x = sgn * 0.172;
        blur.renderOrder = 6;
        blur.frustumCulled = false;
        blur.visible = false;
        child.add(blur);
        blurs.push(blur);
      }
      wheels.push({ node: child, baseQuat: child.quaternion.clone(), front, axle, blurs });
      continue;
    }
    body.add(child);
  }
  carRoot.add(body);
  state.carBody = body;
  state.wheels = wheels;
}

// ------------------------------------------------------------------ 车门
// car.glb 是整体焊接网格、没有独立车门节点，这里按“连通块”（一个岛 = 一块独立曲面）
// 从车身几何里把左右车门（门板 + 侧窗 + 门内饰板 + 后视镜）整块挑出来，
// 挂到铰链枢轴上，由控制台按钮开关。
const DOOR_HINGE_X = 0.80;            // 铰链轴所在的车辆本地 x（门与车身接缝处，靠外板）
const DOOR_HINGE_Z = 0.74;            // 铰链轴所在的车辆本地 z（车门前沿接缝）
const DOOR_OPEN_DEG = 45;             // 全开角度（角度太大时门板内侧会挡住座舱视线）
const DOOR_REGION = {                 // 左侧车门在车辆本地坐标下的包围盒
  x: [0.55, 1.20],
  y: [0.10, 1.35],
  z: [-0.95, 0.92],
};
const doorRig = {
  L: { pivot: null, open: false, angle: 0 },
  R: { pivot: null, open: false, angle: 0 },
};

/**
 * 额外的排除规则：坐标盒里还混着座椅、B 柱内饰、门槛贴片等「不是车门」的岛。
 * 车门内侧部件都贴着门板（x 更靠外）；这些非车门件往往更靠车内侧（x 更小）
 * 或者高过车窗上沿、低于门槛。
 */
function doorIslandAllowed(meshName, box) {
  // 只让「门皮 / 侧窗 / 后视镜 / 门内饰板」跟着门走；
  // 铭牌、门槛贴片、门内小装饰件保持不动（它们看着像门，其实是车身附件）。
  const DOOR_MESHES = /^(Paint|Window_Geo_lodA|Window_Geo_lodA_3|GlassInside|Carbon1|Interior_Geo_lodA001|Interior_Geo_lodA001_1|Interior_Geo_lodA001_2|Grille2|Coloured|Base)$/;
  if (!DOOR_MESHES.test(meshName)) return false;

  // 左右门在 x 上是镜像的，用「离车身中轴最近的那一面」来统一判断，
  // 否则右门（x 全为负）会一直被当成「偏内」而整块丢掉。
  const innerX = Math.min(Math.abs(box.min.x), Math.abs(box.max.x));

  // 比门内饰板更靠内的（座椅、中控一侧的件）不属于车门
  if (/^Interior/.test(meshName) && innerX < 0.62) return false;
  // 比门框更靠内的 Coloured（中控/座椅一侧）不属于车门
  if (meshName === 'Coloured' && innerX < 0.66) return false;
  // 门皮里混着一块沿门槛走的长条（下裙板），它不属于车门，开门时会像块板子甩出去
  if (meshName === 'Paint' && box.max.y < 0.55) return false;
  // 门内饰板最下沿那条长条形饰条（门槛/下部密封条）属于车内件，不跟着门走
  if (/^Interior/.test(meshName) && box.max.y < 0.40) return false;
  // Grille2 里混着窗沿那条细条（y≈0.93），它是车身饰条，不属于车门
  if (meshName === 'Grille2' && box.min.y > 0.85) return false;
  // 门后上角、贴着 B 柱的那块小内饰件（门锁/安全带护罩）属于车内件
  if (/^Interior/.test(meshName) && box.min.x > 0.58 && box.max.x < 0.72 && box.min.y > 0.88 && box.max.z < -0.75) return false;
  return true;
}

/**
 * 一个岛（连通块）是否落在车门区域内；side = +1 左（主驾），-1 右（副驾）。
 * zMax 可以按部件单独给：门皮/门框允许一直伸到前缘接缝，内饰板只到门洞后沿，
 * 否则会把仪表台、中控这些车内件也拉进车门。
 */
function doorRegionHit(min, max, side, zMax) {
  const x0 = side > 0 ? DOOR_REGION.x[0] : -DOOR_REGION.x[1];
  const x1 = side > 0 ? DOOR_REGION.x[1] : -DOOR_REGION.x[0];
  return min.x > x0 && max.x < x1 &&
         min.y > DOOR_REGION.y[0] && max.y < DOOR_REGION.y[1] &&
         min.z > DOOR_REGION.z[0] && max.z < (zMax === undefined ? DOOR_REGION.z[1] : zMax);
}

/** 用三角形顶点索引构建连通块（并查集），返回每个顶点所属岛 id */
function buildIslandIds(vertexCount, triVerts) {
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < triVerts.length; i += 3) {
    const a = find(triVerts[i]), b = find(triVerts[i + 1]), c = find(triVerts[i + 2]);
    if (b !== a) parent[b] = a;
    if (c !== find(a)) parent[find(c)] = find(a);
  }
  const ids = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) ids[i] = find(i);
  return ids;
}

/** 从几何体里按三角形子集生成新的（无索引）几何体，属性逐项拷贝 */
function subsetGeometry(geo, triVerts) {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const attr = geo.attributes[name];
    const size = attr.itemSize;
    const src = attr.array;
    // 顶点色在 glTF 里是归一化的整型（0~255），拷进 Float32Array 时必须还原成 0~1，
    // 否则颜色会被乘上 255，门板直接曝成一片白。
    let scale = 1;
    if (attr.normalized && !(src instanceof Float32Array)) {
      if (src instanceof Uint8Array || src instanceof Int8Array) scale = 1 / (src instanceof Int8Array ? 127 : 255);
      else if (src instanceof Uint16Array) scale = 1 / 65535;
      else if (src instanceof Int16Array) scale = 1 / 32767;
    }
    const arr = new Float32Array(triVerts.length * size);
    for (let t = 0; t < triVerts.length; t++) {
      const v = triVerts[t];
      for (let c = 0; c < size; c++) arr[t * size + c] = src[v * size + c] * scale;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size, false));
  }
  return out;
}

/** 把车模按车门区域切分：车身保留剩余三角形，车门挂到铰链枢轴上 */
function installCarDoors(holder) {
  holder.updateWorldMatrix(true, true);
  const carInv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const toCar = new THREE.Matrix4();
  const v3 = new THREE.Vector3();

  // 铰链轴就压在「车门 + 车身」的那条前缘接缝上（车辆本地系：+X 左、+Z 车头），
  // 这样开门时车门绕自己的前缘缝线转，而不是绕车身中轴线甩出去。
  for (const side of ['L', 'R']) {
    const pivot = new THREE.Group();
    pivot.name = side === 'L' ? 'DoorPivotL' : 'DoorPivotR';
    pivot.position.set(side === 'L' ? DOOR_HINGE_X : -DOOR_HINGE_X, 0, DOOR_HINGE_Z);
    holder.add(pivot);
    doorRig[side].pivot = pivot;
  }
  const toPivot = {
    L: new THREE.Matrix4().makeTranslation(-DOOR_HINGE_X, 0, -DOOR_HINGE_Z),
    R: new THREE.Matrix4().makeTranslation(DOOR_HINGE_X, 0, -DOOR_HINGE_Z),
  };

  const meshes = [];
  holder.traverse((o) => {
    if (o.isMesh && !/^DoorPart_/.test(o.name) && !/^DoorPivot/.test(o.parent?.name || '')) meshes.push(o);
  });

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    if (!geo || !geo.attributes.position) continue;
    const pos = geo.attributes.position;
    const n = pos.count;
    let triVerts;
    if (geo.index) triVerts = geo.index.array;
    else {
      triVerts = new Uint32Array(n);
      for (let i = 0; i < n; i++) triVerts[i] = i;
    }
    if (triVerts.length < 3) continue;

    // 每个顶点换到车辆本地坐标，顺便统计每个岛的包围盒
    toCar.copy(carInv).multiply(mesh.matrixWorld);
    const ids = buildIslandIds(n, triVerts);
    const boxes = new Map();
    for (let i = 0; i < n; i++) {
      const id = ids[i];
      let box = boxes.get(id);
      if (!box) { box = { min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity) }; boxes.set(id, box); }
      v3.fromBufferAttribute(pos, i).applyMatrix4(toCar);
      box.min.min(v3);
      box.max.max(v3);
    }

    const bodyTris = [];
    const sideTris = { L: [], R: [] };
    // 记录「三角形 -> 岛包围盒」的对应，供拾取工具显示零件所属岛的范围
    const islIndex = new Map();
    const islBoxes = [];
    const sideTriIsland = { L: [], R: [] };
    const islandIdxOf = (id) => {
      let k = islIndex.get(id);
      if (k === undefined) {
        const bb = boxes.get(id);
        k = islBoxes.length;
        islIndex.set(id, k);
        islBoxes.push({ min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] });
      }
      return k;
    };
    let moved = 0;
    for (let t = 0; t < triVerts.length; t += 3) {
      const a = triVerts[t], b = triVerts[t + 1], c = triVerts[t + 2];
      const box = boxes.get(ids[a]);
      let target = null;
      if (box && doorIslandAllowed(mesh.name, box)) {
        // 只有门皮和侧窗玻璃能一直伸到门洞前缘（否则门前沿会露缝）；
        // 门框、门内饰板都停在 0.80，再往前是仪表台/中控一侧的车内件。
        const zMax = /^(Paint|Window_Geo_lodA|Window_Geo_lodA_3|GlassInside)$/.test(mesh.name)
          ? DOOR_REGION.z[1]
          : 0.80;
        for (const side of ['L', 'R']) {
          if (doorRegionHit(box.min, box.max, side === 'L' ? 1 : -1, zMax)) { target = side; break; }
        }
      }
      if (target) { sideTris[target].push(a, b, c); sideTriIsland[target].push(islandIdxOf(ids[a])); moved++; }
      else bodyTris.push(a, b, c);
    }
    if (!moved) continue;

    // 车门几何：顶点烘到车辆本地系，再平移到枢轴局部系
    for (const side of ['L', 'R']) {
      if (!sideTris[side].length) continue;
      const doorGeo = subsetGeometry(geo, sideTris[side]);
      doorGeo.applyMatrix4(toPivot[side].clone().multiply(toCar));
      doorGeo.computeBoundingSphere();
      const doorMesh = new THREE.Mesh(doorGeo, mesh.material);
      doorMesh.name = 'DoorPart_' + (side === 'L' ? 'L_' : 'R_') + mesh.name;
      doorMesh.castShadow = mesh.castShadow;
      doorMesh.receiveShadow = mesh.receiveShadow;
      doorMesh.userData.islBoxes = islBoxes;
      doorMesh.userData.islOfTri = sideTriIsland[side];
      doorRig[side].pivot.add(doorMesh);
    }

    // 车身：只保留剩下的三角形
    if (!bodyTris.length) {
      mesh.removeFromParent();
      continue;
    }
    if (geo.index) {
      const idx = new Uint32Array(bodyTris);
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
    } else {
      const bodyGeo = subsetGeometry(geo, bodyTris);
      mesh.geometry = bodyGeo;
    }
  }

  // 门板内侧可能朝内，给车门材质补成双面（只克隆一次，别影响车身）
  for (const side of ['L', 'R']) {
    doorRig[side].pivot.traverse((o) => {
      if (!o.isMesh || !o.material || o.material.userData.doorCloned) return;
      const mat = o.material.clone();
      mat.side = THREE.DoubleSide;
      mat.userData.doorCloned = true;
      o.material = mat;
    });
  }

  updateDoorHud();
}

/** 开/关某扇车门（L 主驾 / R 副驾） */
function setDoorOpen(side, open) {
  const rig = doorRig[side];
  if (!rig || !rig.pivot) return;
  rig.open = !!open;
  if (els.doorSeg) {
    for (const b of els.doorSeg.querySelectorAll('button[data-door]')) {
      if (b.dataset.door === side) b.classList.toggle('active', rig.open);
    }
  }
  updateDoorHud();
}

function updateDoorHud() {
  if (!els.doorState) return;
  const l = doorRig.L.open, r = doorRig.R.open;
  els.doorState.textContent = l && r ? '两门已开' : l ? '主驾已开' : r ? '副驾已开' : '全部关闭';
}

function toggleDoor(side) {
  setDoorOpen(side, !doorRig[side].open);
}

function updateDoors(dt) {
  const k = 1 - Math.exp(-(dt || 0.016) * 6.5);
  for (const side of ['L', 'R']) {
    const rig = doorRig[side];
    if (!rig.pivot) continue;
    // 左侧车门向车外（+x）摆开 → 负角；右侧镜像
    const target = rig.open ? (side === 'L' ? -1 : 1) * DOOR_OPEN_DEG * DEG : 0;
    rig.angle += (target - rig.angle) * k;
    rig.pivot.rotation.y = rig.angle;
  }
}

// 首次加载就直接进入粒子 → 实体车的序列（不再先闪一下实体车）
const AUTO_PARTICLES = true;

// ------------------------------------------------------------------ 启动
async function boot() {
  setProgressUI('正在载入车辆模型…');

  await loadGLTF(ASSETS.car, onAssetProgress('car', '载入车辆模型')).then((gltf) => {
    const root = gltf.scene;
    configureCar(root);
    const holder = new THREE.Group();
    holder.name = 'Car';
    holder.add(root);
    state.car = holder;
    scene.add(holder);
    installCarDoors(holder);
    progress.car = 1;
  });

  // 3) 默认开播的粒子聚合：必须在第一帧渲染之前就接管车体，
  //    否则淡入后会有「先露一下实体车、再变粒子」的闪帧。
  if (AUTO_PARTICLES) {
    setProgressUI('正在聚合粒子…');
    const reveal = ensureParticleReveal();
    if (reveal) {
      // 先在遮罩后面把凝结阶段的着色器/贴图跑热，避免凝结开始那一帧卡顿
      reveal.prewarm(renderer, scene, camera);
      reveal.play();
      // 聚合阶段车体还没出来，影子强度置 0（凝结时由 tick 线性拉起来）
      shadowFade.value = 0;
      updateParticlesUI();
    }
  }

  // 4) 第一帧前把着色器编译掉，避免淡入后卡一下
  setProgressUI('正在准备场景…');
  if (renderer.compileAsync) {
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      /* 忽略：部分驱动不支持并行编译，直接进渲染即可 */
    }
  }

  // 4) 初始位置
  updateCarTransform(0);
  updateCameraRig(0.016, true);
  updateLights();

  setProgressUI('准备就绪');
  renderer.setAnimationLoop(null);
  renderer.render(scene, camera);

  // 5) 淡入
  requestAnimationFrame(() => {
    renderer.domElement.classList.add('is-ready');
    els.loader.classList.add('is-hidden');
    els.brand.classList.add('is-ready');
    els.panel.classList.add('is-ready');
  });

  lastTime = performance.now();
  renderer.setAnimationLoop(tick);
}

// ------------------------------------------------------------------ 每帧更新
const _qWheelSpin = new THREE.Quaternion();
const _qWheelSteer = new THREE.Quaternion();

// ── 高速轮胎动感模糊 ───────────────────────────────────────────────
// 车轮 28 m/s 时约 12 转/秒，60fps 下每帧转 0.21 圈，12 根辐条会撞出
// 频闪（车轮效应），看起来比实际慢好几倍。叠一张随速度淡入的模糊圆盘，
// 把频闪盖掉、读成"转得很快"。
let _wheelBlurTex = null;
let _wheelBlurGeo = null;
function wheelBlurAssets() {
  if (_wheelBlurTex) return { tex: _wheelBlurTex, geo: _wheelBlurGeo };
  const S = 512, R = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  // 把辐条画出来再整体模糊，得到角向拖影
  g.filter = 'blur(13px)';
  g.translate(R, R);
  // 轮辋面（暗灰，转动时糊成一片）
  g.beginPath(); g.arc(0, 0, R * 0.90, 0, Math.PI * 2);
  g.fillStyle = 'rgba(46, 50, 57, 0.42)'; g.fill();
  // 12 组双辐条
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (const off of [-0.055, 0.055]) {
      g.save(); g.rotate(a + off);
      g.beginPath();
      g.moveTo(0, R * 0.24);
      g.lineTo(0, R * 0.88);
      g.lineWidth = R * 0.055;
      g.strokeStyle = 'rgba(150, 157, 170, 0.34)';
      g.stroke();
      g.restore();
    }
  }
  // 轮胎侧壁外圈（更暗，压住边缘）
  g.beginPath(); g.arc(0, 0, R * 0.97, 0, Math.PI * 2);
  g.lineWidth = R * 0.17; g.strokeStyle = 'rgba(12, 14, 18, 0.90)'; g.stroke();
  // 中心轮毂
  g.beginPath(); g.arc(0, 0, R * 0.26, 0, Math.PI * 2);
  g.fillStyle = 'rgba(22, 25, 30, 0.52)'; g.fill();
  g.filter = 'none';

  _wheelBlurTex = new THREE.CanvasTexture(cv);
  _wheelBlurTex.colorSpace = THREE.SRGBColorSpace;
  _wheelBlurTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  _wheelBlurGeo = new THREE.CircleGeometry(WHEEL_RADIUS * 0.985, 48);
  return { tex: _wheelBlurTex, geo: _wheelBlurGeo };
}

function updateCarTransform(dt) {
  const car = state.car;
  if (!car) return;

  const s = state.travel;

  // 车道内的缓弧摆动：r(s) = A·sin(k·s)。前面没有真弯道可看，这点摆动让画面不死板。
  const wPh = WEAVE_K * s;
  const weave = WEAVE_AMP * Math.sin(wPh);                         // 横向偏移
  const weaveSlope = WEAVE_AMP * WEAVE_K * Math.cos(wPh);          // dr/ds
  const weaveCurv = WEAVE_AMP * WEAVE_K * WEAVE_K * Math.sin(wPh); // -r''(s)

  // 前轮顺着摆动打一点方向（角度很小，只是让车头看起来在微调）
  const steerTarget = THREE.MathUtils.clamp(
    Math.atan(WHEELBASE * weaveCurv) * STEER_GAIN,
    -MAX_STEER,
    MAX_STEER
  );
  // 转向有一点点延迟，看起来像真的打方向
  state.steer += (steerTarget - state.steer) * (1 - Math.exp(-dt * 5));

  // 车轮滚动角：ω = v / R；暂停时 v 视为 0，轮子停住（滑杆设定的车速保留，恢复播放接着转）
  const vWheel = state.speedNow;   // 直接跟车速：熄火后车速线性降到 0，轮子自然停转
  state.wheelSpin = (state.wheelSpin + (vWheel / WHEEL_RADIUS) * dt) % (Math.PI * 2);
  if (state.wheels.length) {
    _qWheelSteer.setFromAxisAngle(UP, state.steer);
    for (const w of state.wheels) {
      // 绕这支轮子自己的轮轴转（轮轴在车体坐标系里略微倾斜，用父空间 X 会摆）
      _qWheelSpin.setFromAxisAngle(w.axle, state.wheelSpin);
      if (w.blurs) {
        const t = THREE.MathUtils.smoothstep(vWheel, 6, 20);
        for (const b of w.blurs) {
          b.material.opacity = t * 0.82;
          b.visible = t > 0.02;
        }
      }
      if (w.front) {
        // 前轮：先滚动，再绕垂直轴打方向
        w.node.quaternion
          .copy(_qWheelSteer)
          .multiply(_qWheelSpin)
          .multiply(w.baseQuat);
      } else {
        w.node.quaternion.copy(_qWheelSpin).multiply(w.baseQuat);
      }
    }
  }

  // 世界不动、车在动：车永远停在原点附近，只做横向摆动（glTF 里 right = -X）
  carPos.set(-weave, 0.012, 0);
  car.position.copy(carPos);
  car.rotation.set(0, -Math.atan(weaveSlope), 0);
}
function updateOrbit(dt) {
  if (orbit.dragging) {
    // 跟手：快速但平滑地追到目标角度
    const kd = 1 - Math.exp(-dt * 16);
    orbit.yaw += (orbit.yawTarget - orbit.yaw) * kd;
    // 俯仰与水平用同一条跟手曲线：拖多少跟多少，不做速率限幅
    orbit.pitch += (orbit.pitchTarget - orbit.pitch) * kd;
    // 拖动时让「视角 Y」的读数跟着实时变化（滑杆本身保持基准值）
    if (els.camPitchVal) els.camPitchVal.textContent = (orbit.pitch / DEG).toFixed(1);
  } else if (orbit.returning) {
    // 松手后线性回到基准角度位：水平角沿最近的等价角归位，俯仰回到基准
    orbit.returnElapsed += dt;
    const t = Math.min(orbit.returnElapsed / orbit.returnDur, 1);
    orbit.yaw = orbit.returnYaw + (orbit.returnYawTarget - orbit.returnYaw) * t;
    orbit.pitch = orbit.returnPitch + (orbit.basePitch - orbit.returnPitch) * t;
    syncYawReadout(orbit.yaw);
    if (t >= 1) {
      orbit.yaw = orbit.yawTarget = orbit.returnYawTarget;
      orbit.pitch = orbit.basePitch;
      orbit.returning = false;
      syncYawReadout(orbit.yaw);
    }
  }
}

function startOrbitReturn(yawTarget, dur) {
  // 拖动时角度不设限，松手后统一回到基准角度位（水平取最近的等价角）
  const dYaw = yawTarget - orbit.yaw;
  const dPitch = orbit.basePitch - orbit.pitch;
  orbit.yawTarget = yawTarget;
  orbit.pitchTarget = orbit.basePitch;
  if (Math.abs(dYaw) > 1e-4 || Math.abs(dPitch) > 1e-4) {
    orbit.returning = true;
    orbit.returnYaw = orbit.yaw;
    orbit.returnYawTarget = yawTarget;
    orbit.returnPitch = orbit.pitch;
    orbit.returnElapsed = 0;
    orbit.returnDur = dur;
  } else {
    orbit.yaw = yawTarget;
    orbit.pitch = orbit.basePitch;
    orbit.returning = false;
  }
}

/** 滑杆轨道填充色（0..1） */
function updateSliderFill(el, ratio) {
  if (!el) return;
  el.style.setProperty('--fill', `${THREE.MathUtils.clamp(ratio, 0, 1) * 100}%`);
}

if (els.envLight) els.envLight.addEventListener('input', () => setEnvLight(Number(els.envLight.value)));
if (els.sunLight) els.sunLight.addEventListener('input', () => setSunLight(Number(els.sunLight.value)));

// 速度滑杆的填充（0–220 km/h）
function setSpeedFill() {
  const v = Number(els.speed.value);
  updateSliderFill(els.speed, v / 220);
}

// 环境光强度（0–1.5）
function setEnvLight(v) {
  const val = THREE.MathUtils.clamp(Number(v), 0, 1.5);
  scene.environmentIntensity = val;
  if (els.envLightVal) els.envLightVal.textContent = val.toFixed(2);
  if (els.envLight && Number(els.envLight.value) !== val) els.envLight.value = String(val);
  if (els.envLight) updateSliderFill(els.envLight, val / 1.5);
}

// 主光（太阳）强度（0–3）
function setSunLight(v) {
  const val = THREE.MathUtils.clamp(Number(v), 0, 3);
  sun.intensity = val;
  if (els.sunLightVal) els.sunLightVal.textContent = val.toFixed(2);
  if (els.sunLight && Number(els.sunLight.value) !== val) els.sunLight.value = String(val);
  if (els.sunLight) updateSliderFill(els.sunLight, val / 3);
}

// ------------------------------------------------------------------ 播放 / 机位 / 相机跟随
function updatePlayButton() {
  if (!els.btnPlay) return;
  if (els.playIco) {
    els.playIco.classList.toggle('pause', state.playing);
    els.playIco.classList.toggle('play', !state.playing);
  }
  if (els.playLabel) els.playLabel.textContent = state.playing ? '熄火' : '启动';
  els.btnPlay.title = state.playing ? '熄火（空格）' : '启动（空格）';
  if (els.statusText) {
    els.statusText.textContent = !state.playing ? '已熄火' : state.startupLeft > 0 ? '启动中' : '运行中';
  }
  if (els.statusDot) els.statusDot.classList.toggle('paused', !state.playing);
}

function setPlaying(v) {
  const was = state.playing;
  state.playing = !!v;
  // 启动：先进入“打火”阶段（STARTUP_CRANK 秒内车轮不转），之后才线性加速
  state.startupLeft = state.playing && !was ? STARTUP_CRANK : 0;
  updatePlayButton();
  if (state.playing && !was) engineStart();
}

// ---- 主驾机位联动：点「主驾视角」时先开主驾车门 → 移机位 → 到位后关门
const DOOR_CAM_MODE = 4;
const DOOR_CAM_OPEN_HOLD = 0.62;    // 等车门摆到位的时间（秒）
const DOOR_CAM_CLOSE_DELAY = 0.12;  // 机位到位后稍等一下再关门
let doorCamSeq = null;              // { phase: 'open' | 'move', t }

function updateDoorCamSeq(dt) {
  if (!doorCamSeq) return;
  doorCamSeq.t += dt || 0;
  if (doorCamSeq.phase === 'open') {
    if (doorCamSeq.t >= DOOR_CAM_OPEN_HOLD) {
      doorCamSeq.phase = 'move';
      doorCamSeq.t = 0;
      applyCamMode(DOOR_CAM_MODE);
    }
    return;
  }
  // move：等机位过渡结束（相机到位）后关门
  if (!camTween.active && doorCamSeq.t >= DOOR_CAM_CLOSE_DELAY) {
    setDoorOpen('L', false);
    doorCamSeq = null;
  }
}

/**
 * 全景查看器开关。
 * 打开：OrbitControls 接管相机，target 平滑跟随车辆，可自由环绕/缩放；
 * 关闭：交还车载机位，镜头用一小段过渡追回车位（不会硬切）。
 */
function setOrbitView(on) {
  const next = !!on;
  if (next === state.orbitView) return;
  state.orbitView = next;
  controls.enabled = next;
  camTween.active = false;
  if (next) {
    // 切到编辑器式视口：拉到一个 3/4 高位，车和周围整片场景一起入画
    controls.target.copy(carPos).addScaledVector(UP, 1.0);
    const d = 22, az = 40 * DEG, polar = 68 * DEG;
    camera.position.set(
      controls.target.x + d * Math.sin(polar) * Math.sin(az),
      controls.target.y + d * Math.cos(polar),
      controls.target.z + d * Math.sin(polar) * Math.cos(az),
    );
    controls.update();
    camBlend = 0;
  } else {
    camBlend = 1;   // 交给 tick 里的混合，平滑追回车载机位
  }
  if (els.orbitState) els.orbitState.textContent = next ? '开' : '关';
  if (els.orbitSeg) {
    for (const b of els.orbitSeg.querySelectorAll('button[data-orbit]')) {
      b.classList.toggle('active', (b.dataset.orbit === '1') === next);
    }
  }
}

function setCamMode(i, opts = {}) {
  const mode = CAM_MODES[i];
  if (!mode) return;
  // 切到别的机位时取消未完成的联动
  if (doorCamSeq && i !== DOOR_CAM_MODE) doorCamSeq = null;
  // 点「主驾视角」：先开主驾车门，等门摆开后再移机位（到位后自动关门）
  if (i === DOOR_CAM_MODE && !opts.skipDoorSeq && !doorCamSeq) {
    doorCamSeq = { phase: 'open', t: 0 };
    setDoorOpen('L', true);
    return;
  }
  applyCamMode(i);
}

function applyCamMode(i) {
  const mode = CAM_MODES[i];
  if (!mode) return;
  if (state.orbitView) setOrbitView(false);   // 点机位按钮 = 回到车载视角
  state.camMode = i;
  if (els.camName) els.camName.textContent = mode.name;
  if (els.camSeg) {
    for (const b of els.camSeg.querySelectorAll('button[data-mode]')) {
      b.classList.toggle('active', Number(b.dataset.mode) === i);
    }
  }
  // 每个机位有自己的默认水平角（侧前低机位 = -45°）：切机位时平滑过渡过去，而不是瞬移
  startCamTween(mode);
}

// 相机“刚体环绕”：先绕车心偏航，再对相机与看向点施加同一个四元数做俯仰，
// 保证两者相对车心的几何关系不变（车不会飘出画面，相机也不会钻到桥面下）。
const _oV1 = new THREE.Vector3();
const _oV2 = new THREE.Vector3();
const _oV3 = new THREE.Vector3();
const _qYaw = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const CAM_MIN_HEIGHT = 0.55;   // 相机离桥面的最低高度
const CAM_DIST_DEFAULT = 6.0;  // 镜头后拉距离的基准值（与「跟车后视」机位的 pos.z 一致）
const CAM_DIST_MIN = 6.0;
const CAM_DIST_MAX = 12.0;

function applyOrbitAroundCar(pos, look) {
  if (Math.abs(orbit.yaw) > 1e-6) {
    _qYaw.setFromAxisAngle(UP, orbit.yaw);
    pos.sub(carPos).applyQuaternion(_qYaw).add(carPos);
    look.sub(carPos).applyQuaternion(_qYaw).add(carPos);
  }
  if (Math.abs(orbit.pitch) > 1e-6) {
    const vHor = _oV1.copy(pos).sub(carPos);
    if (vHor.lengthSq() > 1e-8) {
      const axis = _oV2.crossVectors(vHor, UP);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        const polar = Math.acos(THREE.MathUtils.clamp(_oV3.copy(vHor).normalize().y, -1, 1));
        const target = THREE.MathUtils.clamp(polar - orbit.pitch, POLAR_MIN, POLAR_MAX);
        _qPitch.setFromAxisAngle(axis, polar - target);
        pos.sub(carPos).applyQuaternion(_qPitch).add(carPos);
        look.sub(carPos).applyQuaternion(_qPitch).add(carPos);
      }
    }
  }
  const minY = carPos.y + CAM_MIN_HEIGHT;
  if (pos.y < minY) pos.y = minY;
}

// 镜头距离滑杆：沿机位自身「水平偏移」的方向整体缩放半径。
// 之前只对 pos.z < 0 的机位生效（后视/全景），侧面/斜前方机位（主驾侧、副驾侧前）调了没反应。
function camDistOffset(px, pz) {
  const d = state.camDist - CAM_DIST_DEFAULT;
  if (!d) return [px, pz];
  const r = Math.hypot(px, pz);
  if (r < 1e-3) return [px, pz];              // 正上方机位没有水平方向，不缩放
  const k = Math.max(1.0, r + d) / r;         // 至少保留 1 m，别把相机拉到车心里
  return [px * k, pz * k];
}

// 某个机位在当前镜头距离下的目标 rig（含 fov），过渡与稳态共用同一份计算
function camModeRig(mode) {
  let ox = mode.pos.x;
  let oz = mode.pos.z;
  if (!mode.lookAround) [ox, oz] = camDistOffset(ox, oz);
  return {
    ox,
    oy: mode.pos.y,
    oz,
    lx: mode.look.x,
    ly: mode.look.y,
    lz: mode.look.z,
    fov: mode.fov,
  };
}

// 把「水平面上的偏移」拆成半径 + 方位角：方位角 = atan2(ox, oz)，
// 相机环绕角 orbit.yaw 等价于让方位角整体 +yaw，所以两者可以直接相加。
function rigPolar(ox, oz) {
  // 注意：装配时世界偏移是 (-ox, oy, oz)，所以方位角要按 atan2(-ox, oz) 取
  return { r: Math.hypot(ox, oz), a: Math.atan2(-ox, oz) };
}

const TAU = Math.PI * 2;
function wrapPi(a) {
  return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

// 切机位时把「当前画面」固定为起点，绕车做一次圆弧过渡（而不是直线穿过车身）。
// 做法：相机与看向点的偏移都换成 (半径, 方位角, 高度)，半径与高度线性插值、
// 方位角走最近的等价角 —— 相机于是沿一个以车为圆心的圆弧扫过去，形成环绕感。
function startCamTween(mode) {
  const to = camModeRig(mode);
  const yawTarget = (mode.yaw == null ? 0 : mode.yaw) * DEG;

  const p0 = rigPolar(rig.ox, rig.oz);
  const l0 = rigPolar(rig.lx, rig.lz);
  const p1 = rigPolar(to.ox, to.oz);
  const l1 = rigPolar(to.lx, to.lz);

  orbit.baseYaw = yawTarget;
  orbit.basePitch = 0;
  orbit.yawTarget = yawTarget;
  orbit.pitchTarget = 0;
  orbit.returning = false;
  orbit.dragging = false;

  camTween.active = true;
  camTween.t = 0;
  camTween.fromYaw = orbit.yaw;
  camTween.toYaw = orbit.yaw + wrapPi(yawTarget - orbit.yaw);
  camTween.fromPitch = orbit.pitch;
  // 起点：当前可见的方位角（含环绕角）；终点：新机位的方位角（含该机位默认水平角）
  camTween.r0 = p0.r;   camTween.a0 = p0.a + orbit.yaw;   camTween.h0 = rig.oy;
  camTween.lr0 = l0.r;  camTween.la0 = l0.a + orbit.yaw;  camTween.lh0 = rig.ly;
  camTween.fov0 = rig.fov;
  camTween.r1 = p1.r;   camTween.a1 = p1.a + yawTarget;   camTween.h1 = to.oy;
  camTween.lr1 = l1.r;  camTween.la1 = l1.a + yawTarget;  camTween.lh1 = to.ly;
  camTween.fov1 = to.fov;
  camTween.da = wrapPi(camTween.a1 - camTween.a0);      // 方位角走最近的一圈
  camTween.dla = wrapPi(camTween.la1 - camTween.la0);
  camTween.target = to;
}

function updateCameraRig(dt, snap) {
  const car = state.car;
  if (!car) return;
  const m = CAM_MODES[state.camMode] || CAM_MODES[0];
  // 镜头距离滑杆：沿机位水平偏移方向缩放半径（所有车外机位都生效）
  let oxTarget = m.pos.x;
  let ozTarget = m.pos.z;
  if (!m.lookAround) [oxTarget, ozTarget] = camDistOffset(oxTarget, ozTarget);

  if (camTween.active && !snap) {
    camTween.t = Math.min(camTween.t + (dt || 0.016) / camTween.dur, 1);
    const t = camTween.t;
    const e = t * t * (3 - 2 * t);          // smoothstep：两端缓、中段匀速
    const r = camTween.r0 + (camTween.r1 - camTween.r0) * e;
    const a = camTween.a0 + camTween.da * e;
    const h = camTween.h0 + (camTween.h1 - camTween.h0) * e;
    const lr = camTween.lr0 + (camTween.lr1 - camTween.lr0) * e;
    const la = camTween.la0 + camTween.dla * e;
    const lh = camTween.lh0 + (camTween.lh1 - camTween.lh0) * e;
    // 圆弧上的位置直接写成「局部偏移」交给后面的统一装配（此时环绕角置 0）
    rig.ox = -r * Math.sin(a);
    rig.oz = r * Math.cos(a);
    rig.oy = h;
    rig.lx = -lr * Math.sin(la);
    rig.lz = lr * Math.cos(la);
    rig.ly = lh;
    rig.fov = camTween.fov0 + (camTween.fov1 - camTween.fov0) * e;
    orbit.yaw = 0;
    orbit.pitch = 0;
    // 只有读数做动画，实际角度由方位角承担
    syncYawReadout(camTween.fromYaw + (camTween.toYaw - camTween.fromYaw) * e);
    if (t >= 1) {
      camTween.active = false;
      const g = camTween.target;
      rig.ox = g.ox; rig.oy = g.oy; rig.oz = g.oz;
      rig.lx = g.lx; rig.ly = g.ly; rig.lz = g.lz;
      rig.fov = g.fov;
      orbit.yaw = orbit.yawTarget = orbit.baseYaw;
      orbit.pitch = 0;
      syncYawReadout(orbit.yaw);
      syncPitchReadout(orbit.basePitch);   // 机位自带的默认俯仰（0）同步回滑杆
    }
  } else {
  const k = snap ? 1 : 1 - Math.exp(-(dt || 0.016) * 5.2);
  rig.ox += (oxTarget - rig.ox) * k;
  rig.oy += (m.pos.y - rig.oy) * k;
  rig.oz += (ozTarget - rig.oz) * k;
  rig.lx += (m.look.x - rig.lx) * k;
  rig.ly += (m.look.y - rig.ly) * k;
  rig.lz += (m.look.z - rig.lz) * k;
  rig.fov += (m.fov - rig.fov) * k;
  }

  const yaw = car.rotation.y;
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  const fx = sy, fz = cy;           // 车辆前方（+Z）
  const rx = -cy, rz = sy;          // 车辆右方（-X）

  camera.position.copy(carPos)
    .addScaledVector(new THREE.Vector3(rx, 0, rz), rig.ox)
    .addScaledVector(UP, rig.oy)
    .addScaledVector(new THREE.Vector3(fx, 0, fz), rig.oz);

  camLook.copy(carPos)
    .addScaledVector(new THREE.Vector3(rx, 0, rz), rig.lx)
    .addScaledVector(UP, rig.ly)
    .addScaledVector(new THREE.Vector3(fx, 0, fz), rig.lz);

  if (m.lookAround) {
    // 车里不能像车外那样绕车转（会转到座椅/车顶上去），改成站在原地转头：
    // 相机固定在机位，只把「看向方向」按 orbit.yaw / orbit.pitch 旋转。
    if (Math.abs(orbit.yaw) > 1e-6 || Math.abs(orbit.pitch) > 1e-6) {
      const dir = _oV1.copy(camLook).sub(camera.position);
      if (Math.abs(orbit.yaw) > 1e-6) {
        _qYaw.setFromAxisAngle(UP, orbit.yaw);
        dir.applyQuaternion(_qYaw);
      }
      if (Math.abs(orbit.pitch) > 1e-6) {
        _oV2.crossVectors(dir, UP);
        if (_oV2.lengthSq() > 1e-8) {
          _oV2.normalize();
          _qPitch.setFromAxisAngle(_oV2, orbit.pitch);
          dir.applyQuaternion(_qPitch);
        }
      }
      camLook.copy(camera.position).add(dir);
    }
  } else {
    applyOrbitAroundCar(camera.position, camLook);
  }

  if (Math.abs(camera.fov - rig.fov) > 1e-3) {
    camera.fov = rig.fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(camLook);
}

// 三盏灯都跟着车走：太阳/轮廓光用方向光，位置只是为了让阴影相机包住车
const _vSun = new THREE.Vector3();
function updateLights() {
  sun.position.copy(carPos).addScaledVector(sunDir, 70);
  sun.target.position.copy(carPos);
  sun.target.updateMatrixWorld();

  _vSun.copy(sunDir).multiplyScalar(-1).addScaledVector(UP, 0.35).normalize();
  rim.position.copy(carPos).addScaledVector(_vSun, 45).addScaledVector(UP, 12);
  rim.target.position.copy(carPos);
  rim.target.updateMatrixWorld();

  bounce.position.copy(carPos).addScaledVector(UP, -45);
  bounce.target.position.copy(carPos);
  bounce.target.updateMatrixWorld();
}

// ------------------------------------------------------------------ 鼠标环绕交互
function onPointerDown(e) {
  if (state.orbitView) return;   // 全景模式下交给 OrbitControls
  if (e.button !== undefined && e.button !== 0) return;
  camTween.active = false;   // 手动拖视角时立刻接管，不再走机位过渡
  orbit.dragging = true;
  orbit.returning = false;
  orbit.startX = e.clientX;
  orbit.startY = e.clientY;
  orbit.startYaw = orbit.yaw;
  orbit.startPitch = orbit.pitch;
  orbit.yawTarget = orbit.yaw;
  orbit.pitchTarget = orbit.pitch;
  renderer.domElement.style.cursor = 'grabbing';
}

function onPointerMove(e) {
  if (!orbit.dragging) return;
  const dx = e.clientX - orbit.startX;
  const dy = e.clientY - orbit.startY;
  const mode = CAM_MODES[state.camMode] || CAM_MODES[0];
  // 水平：一般机位不设限，可以一直拖着绕车转圈（多圈也可以）；
  // 车内机位声明了 yawLimit，只在默认角度附近小幅环视，避免把方向盘/仪表台转出画面。
  const rawYaw = orbit.startYaw - dx * ORBIT_SENS;
  orbit.yawTarget = mode.yawLimit == null
    ? rawYaw
    : THREE.MathUtils.clamp(rawYaw, orbit.baseYaw - mode.yawLimit, orbit.baseYaw + mode.yawLimit);
  // 垂直：一般机位向下拖抬到 30°、向上拖可降到约 1.2 m（-PITCH_MIN）；车内机位不受此限
  // （车内是原地转头，垂直可到 ±85°），松手都回到默认角度
  const pitchMax = mode.pitchLimit == null ? PITCH_MAX : mode.pitchLimit;
  const pitchMin = mode.pitchLimit == null ? PITCH_MIN : mode.pitchLimit;
  orbit.pitchTarget = mode.lookAround
    // 车内抬头/低头不受机位高度限制，只防万向锁
    ? THREE.MathUtils.clamp(orbit.startPitch + dy * PITCH_SENS, -LOOK_PITCH_MAX, LOOK_PITCH_MAX)
    : THREE.MathUtils.clamp(
      orbit.startPitch + dy * PITCH_SENS, orbit.basePitch - pitchMin, orbit.basePitch + pitchMax);
  syncYawReadout(orbit.yawTarget);
}

function onPointerUp() {
  if (!orbit.dragging) return;
  orbit.dragging = false;
  renderer.domElement.style.cursor = 'grab';
  // 水平角：拖到哪都不设限，松手后沿最近的等价角回到当前默认角度位
  const TAU = Math.PI * 2;
  const turns = Math.round((orbit.yaw - orbit.baseYaw) / TAU);
  const backYaw = orbit.baseYaw + turns * TAU;
  const dYaw = Math.abs(backYaw - orbit.yaw) / Math.PI;
  const dPitch = Math.abs(orbit.pitch - orbit.basePitch) / PITCH_MAX;
  const ratio = Math.min(1, Math.max(dYaw, dPitch));
  syncYawReadout(orbit.yaw);
  if (!state.camAutoReturn) return;   // 关掉「相机回正」：松手就停在当前角度
  startOrbitReturn(backYaw, 0.30 + 0.30 * ratio);
}

renderer.domElement.style.cursor = 'grab';
renderer.domElement.style.touchAction = 'none';
renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('pointercancel', onPointerUp);
window.addEventListener('pointerup', onPointerUp);

// 视角滑杆：设定“基准视角”，鼠标拖动在这个基准之上叠加
function setBaseView(yawDeg, keepYaw = false, pitchDeg = 0) {
  camTween.active = false;   // 手调水平/俯仰角时打断机位过渡，避免和过渡抢角度
  // 水平角是自由角度：-180° ~ +180° 都能停，鼠标拖动还能继续绕整圈
  const yaw = keepYaw ? orbit.yaw : THREE.MathUtils.clamp(Number(yawDeg), -180, 180) * DEG;
  // 俯仰角：滑杆 0~30° 设定基准，拖动在此基础上叠加（向下最多 +30°，向上最多回到 1.2 m 左右）
  const pitch = THREE.MathUtils.clamp(Number(pitchDeg) || 0, 0, 30) * DEG;
  orbit.baseYaw = yaw;
  orbit.basePitch = pitch;
  if (!keepYaw) orbit.yaw = orbit.yawTarget = yaw;
  orbit.pitch = orbit.pitchTarget = pitch;
  orbit.returning = false;
  if (!keepYaw) orbit.dragging = false;
  syncYawReadout(yaw);
  syncPitchReadout(pitch);
}

/** 把俯仰基准角写回滑杆/读数/填充色 */
function syncPitchReadout(rad) {
  const deg = rad / DEG;
  if (els.camPitch) {
    els.camPitch.value = deg.toFixed(1);
    updateSliderFill(els.camPitch, deg / 30);
  }
  if (els.camPitchVal) els.camPitchVal.textContent = deg.toFixed(1);
}

/** 把（可能超出一圈的）水平角换算到 -180°~180° 写回滑杆与读数 */
function syncYawReadout(rad) {
  const deg = ((rad / DEG + 180) % 360 + 360) % 360 - 180;
  if (els.camYaw) {
    els.camYaw.value = deg.toFixed(1);
    updateSliderFill(els.camYaw, (deg + 180) / 360);
  }
  if (els.camYawVal) els.camYawVal.textContent = deg.toFixed(1);
}

// ------------------------------------------------------------------ 面板折叠
const PANEL_KEY = 'viaduct.panelCollapsed';
function setPanelCollapsed(collapsed) {
  els.panel.classList.toggle('collapsed', !!collapsed);
  if (els.btnCollapse) {
    // 箭头方向交给 CSS（.caret 旋转），这里只更新无障碍文案
    els.btnCollapse.title = collapsed ? '展开控制台' : '收起控制台';
    els.btnCollapse.setAttribute('aria-label', collapsed ? '展开控制台' : '收起控制台');
  }
  try {
    localStorage.setItem(PANEL_KEY, collapsed ? '1' : '0');
  } catch { /* 隐私模式忽略 */ }
}

// ------------------------------------------------------------------ 每帧
let lastTime = 0;
function tick(now) {
  const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.1) || 0.016;
  lastTime = now;

  // 启动阶段：原地打火，车轮不动；打火结束后才线性加速
  if (state.startupLeft > 0) {
    state.startupLeft = Math.max(0, state.startupLeft - dt);
    if (state.startupLeft === 0) updatePlayButton();
  }
  const cranking = state.startupLeft > 0;
  // 车速：启动后从 0 线性加速到目标车速；熄火后线性减到 0
  const vTarget = state.playing && !cranking ? state.speedTarget : 0;
  const vRate = state.playing && !cranking ? RUN_ACCEL : RUN_BRAKE;
  const vDiff = vTarget - state.speedNow;
  const vStep = vRate * dt;
  state.speedNow =
    Math.abs(vDiff) <= vStep ? vTarget : state.speedNow + Math.sign(vDiff) * vStep;
  const ds = state.speedNow * dt;
  state.travel += ds;
  state.odometer += ds;

  updateCarTransform(dt);
  updateDoors(dt);
  updateDoorCamSeq(dt);
  updateEngine(dt);
  updateSpeedWave(dt);
  updateOrbit(dt);
  if (state.orbitView) {
    // 全景查看器：完全交给 OrbitControls，target 不再被拽回车（否则平移/拉远会被顶回去）
    controls.update();
  } else {
    _prevCam.copy(camera.position);
    updateCameraRig(dt, false);
    // 刚从全景模式切回来：从原镜头位置平滑追到车载机位
    if (camBlend > 0) {
      camBlend = Math.max(0, camBlend - dt * 1.7);
      camera.position.lerpVectors(camera.position, _prevCam, camBlend * camBlend);
      camera.lookAt(camLook);
    }
  }
  updateLights();

  // 粒子聚合（插件自管时间线；播完自己收尾）
  if (particleReveal && particleReveal.active) particleReveal.update();

  // 车影的可见度跟着凝结进度线性增加：粒子阶段 0 → 凝结 0..1 → 结束后常满
  if (particleReveal) {
    const ph = particleReveal.phase;
    shadowFade.value = (ph === 'aggregate' || ph === 'paint')
      ? 0
      : (ph === 'dissolve' ? particleReveal.state.dissolveT : 1);
  }

  // HUD
  if (els.curSpeed) els.curSpeed.textContent = (state.speedNow * 3.6).toFixed(1);
  if (els.odometer) els.odometer.textContent = (state.odometer / 1000).toFixed(2);

  renderer.render(scene, camera);
}

els.speed.addEventListener('pointerdown', () => { speedDragging = true; });
window.addEventListener('pointerup', () => {
  speedDragging = false;
  if (els.speed) {
    els.speed.value = String(state.speedSetKmh);
    updateSliderFill(els.speed, state.speedSetKmh / 220);
  }
});
els.speed.addEventListener('input', () => {
  // 滑杆读数是 km/h，内部换算成 m/s
  state.speedSetKmh = Number(els.speed.value);
  state.speedTarget = state.speedSetKmh / 3.6;
  els.speedVal.textContent = state.speedSetKmh.toFixed(1);
  setSpeedFill();
});


els.btnPlay.addEventListener('click', () => setPlaying(!state.playing));
if (els.btnCollapse) {
  els.btnCollapse.addEventListener('click', () => {
    setPanelCollapsed(!els.panel.classList.contains('collapsed'));
  });
}
if (els.camYaw) {
  els.camYaw.addEventListener('input', () => setBaseView(els.camYaw.value, false, els.camPitch ? els.camPitch.value : 0));
}
if (els.camPitch) {
  els.camPitch.addEventListener('input', () => setBaseView(els.camYaw ? els.camYaw.value : 0, false, els.camPitch.value));
}
// 恢复上次的折叠状态
try {
  setPanelCollapsed(localStorage.getItem(PANEL_KEY) === '1');
} catch { /* 忽略 */ }
// 启动时先套用默认时段（清晨）：天空/环境/曝光一起就位
applyPreset('morning');

// 启动时就位到默认机位（默认 = 主驾侧）：直接摆好相机与水平角，不做飞入动画
{
  const bootMode = CAM_MODES[state.camMode] || CAM_MODES[0];
  const bootRig = camModeRig(bootMode);
  rig.ox = bootRig.ox; rig.oy = bootRig.oy; rig.oz = bootRig.oz;
  rig.lx = bootRig.lx; rig.ly = bootRig.ly; rig.lz = bootRig.lz;
  rig.fov = bootRig.fov;
  setBaseView(bootMode.yaw == null ? 0 : bootMode.yaw);
}

// 镜头距离滑杆（Z 轴后拉距离）
function syncCamDist(value) {
  camTween.active = false;   // 拖镜头距离时直接跟随，不叠加过渡
  state.camDist = THREE.MathUtils.clamp(Number(value), CAM_DIST_MIN, CAM_DIST_MAX);
  if (els.camDist) {
    els.camDist.value = state.camDist.toFixed(1);
    updateSliderFill(els.camDist, (state.camDist - CAM_DIST_MIN) / (CAM_DIST_MAX - CAM_DIST_MIN));
  }
  if (els.camDistVal) els.camDistVal.textContent = state.camDist.toFixed(1);
}
if (els.camDist) {
  els.camDist.addEventListener('input', () => syncCamDist(els.camDist.value));
}
syncCamDist(els.camDist ? els.camDist.value : CAM_DIST_DEFAULT);

/** 同步「相机回正」开关的按钮高亮与读数 */
function syncCamAutoReturn() {
  if (els.camReturnSeg) {
    for (const b of els.camReturnSeg.querySelectorAll('button[data-return]')) {
      b.classList.toggle('active', (b.dataset.return === '1') === state.camAutoReturn);
    }
  }
  if (els.camReturnState) els.camReturnState.textContent = state.camAutoReturn ? '开' : '关';
}

if (els.camReturnSeg) {
  els.camReturnSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-return]');
    if (!btn) return;
    state.camAutoReturn = btn.dataset.return === '1';
    if (!state.camAutoReturn) orbit.returning = false;  // 关掉时别再往回收
    syncCamAutoReturn();
  });
}
syncCamAutoReturn();

els.camSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (btn) setCamMode(Number(btn.dataset.mode));
});

if (els.orbitSeg) {
  els.orbitSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-orbit]');
    if (btn) setOrbitView(btn.dataset.orbit === '1');
  });
}

// ------------------------------------------------------------------ 粒子聚合
// demo/particles.js 那套「聚合 → 上色 → 凝结」效果，通过 src/particles-reveal.js 复用。
// 这里只负责：懒创建（首次点击才 build，省掉 320k 粒子的采样时间）、按钮状态、每帧 update。
let particleReveal = null;

const PHASE_TEXT = {
  aggregate: '聚合中',
  paint: '上色中',
  dissolve: '凝结中',
  done: '完成',
  idle: '待命',
};

function updateParticlesUI() {
  const playing = particleReveal ? (particleReveal.active || particleReveal.phase === 'dissolve') : false;
  if (els.particlesState) {
    els.particlesState.textContent = particleReveal
      ? (PHASE_TEXT[particleReveal.phase] || '待命')
      : '待命';
  }
  if (els.particlesSeg) {
    for (const b of els.particlesSeg.querySelectorAll('button[data-particles]')) {
      b.classList.toggle('active', (b.dataset.particles === '1') === playing);
    }
  }
}

function ensureParticleReveal() {
  if (particleReveal || !state.car) return particleReveal;
  particleReveal = createParticleReveal({
    groundCount: 200000,       // 地面粒子：地面只以粒子形式存在，不凝结成实体
    groundRadius: 9,
    scene,
    camera,
    renderer,
    car: state.car,
    carCount: 320000,
    loop: false,
    onPhase: () => updateParticlesUI(),
    onFinish: () => updateParticlesUI(),
  });
  return particleReveal;
}

function setParticles(on) {
  const next = !!on;
  if (!next) {
    particleReveal?.stop();
    shadowFade.value = 1;
    updateParticlesUI();
    return;
  }
  // 新一轮聚合：车体消失，影子从 0 重新长出来
  shadowFade.value = 0;
  const reveal = ensureParticleReveal();
  if (!reveal) return;
  reveal.play();
  updateParticlesUI();
}

if (els.particlesSeg) {
  els.particlesSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-particles]');
    if (btn) setParticles(btn.dataset.particles === '1');
  });
}

// 车门按钮（主驾 / 副驾，点一下开/关）
if (els.doorSeg) {
  els.doorSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-door]');
    if (btn) toggleDoor(btn.dataset.door);
  });
}

// 时段按钮（拂晓 / 清晨 / 黄昏 / 夜晚）
if (els.todSeg) {
  els.todSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tod]');
    if (btn) applyPreset(btn.dataset.tod);
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    setPlaying(!state.playing);
  } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= CAM_MODES.length) {
    setCamMode(Number(e.key) - 1);
  } else if (e.key === 'v' || e.key === 'V') {
    setOrbitView(!state.orbitView);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 初始化 HUD 文本
els.speedVal.textContent = (state.speedTarget * 3.6).toFixed(1);
state.speedSetKmh = state.speedTarget * 3.6;
els.speed.value = String(Math.round(state.speedTarget * 3.6));
setSpeedFill();
updatePlayButton();

// ------------------------------------------------------------------ 引擎声（WebAudio）
// 音源：Freesound「Lotus Elise start rev idle」（victormalloy，CC0）
// 0–27 s 是点火/原地轰油，27 s 之后是稳定的怠速段 —— 拿 30–40 s 那段做无缝循环。
const ENGINE_URL = './assets/audio/lotus_elise_start_rev_idle_preview.mp3';
const ENGINE_IDLE_START = 30.0;
const ENGINE_IDLE_LEN = 10.0;
const ENGINE_IGNITION_LEN = 3.4;      // 点火那一下取 0–3.4 s
const ENGINE_CROSSFADE = 0.08;       // 循环接缝交叉淡化（s）


const engine = {
  intent: true,       // 用户是否想要声音（控制台开关）
  ctx: null,
  analyser: null,     // 用来取声波幅度（给车速滑杆做律动）
  wave: null,
  master: null,       // 总音量（暂停/关闭时淡出）
  loopSrc: null,
  loopGain: null,
  buffer: null,
  starting: false,
};

/** 把 30–40 s 的稳态段拷出来，并在接缝处做等功率交叉淡化，得到一个真正无缝的循环 */
function buildIdleLoop(ctx, buffer) {
  const sr = buffer.sampleRate;
  const ch = buffer.numberOfChannels;
  const start = Math.floor(ENGINE_IDLE_START * sr);
  const len = Math.floor(ENGINE_IDLE_LEN * sr);
  const xf = Math.floor(ENGINE_CROSSFADE * sr);
  const loop = ctx.createBuffer(ch, len, sr);
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c);
    const dst = loop.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = src[start + i] || 0;
    // 结尾 xf 个样本与开头 xf 个样本交叉：dst[len-xf+i] 混入 dst[i]
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      const a = Math.cos(t * Math.PI * 0.5);   // 尾部权重
      const b = Math.sin(t * Math.PI * 0.5);   // 头部权重
      const tail = dst[len - xf + i];
      const head = dst[i];
      dst[len - xf + i] = tail * a + head * b;
    }
  }
  return loop;
}

async function engineStart() {
  if (engine.starting || !state.car) return;
  engine.starting = true;
  try {
    if (!engine.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      engine.ctx = new AC();
      engine.master = engine.ctx.createGain();
      engine.master.gain.value = 0;
      engine.master.connect(engine.ctx.destination);
    }
    await engine.ctx.resume();
    if (!engine.analyser) {
      engine.analyser = engine.ctx.createAnalyser();
      engine.analyser.fftSize = 1024;
      engine.analyser.smoothingTimeConstant = 0.35;
      engine.master.connect(engine.analyser);      // 分出一路给分析器（不影响出声）
      engine.wave = new Uint8Array(engine.analyser.fftSize);
    }
    if (!engine.buffer) {
      const res = await fetch(ENGINE_URL);
      const arr = await res.arrayBuffer();
      engine.buffer = await engine.ctx.decodeAudioData(arr);
    }
    const ctx = engine.ctx;
    // 点火（只放一次）
    const ig = ctx.createBufferSource();
    ig.buffer = engine.buffer;
    const igGain = ctx.createGain();
    igGain.gain.value = 0.9;
    ig.connect(igGain).connect(engine.master);
    ig.start(0, 0, ENGINE_IGNITION_LEN);

    // 怠速循环
    const loopBuf = buildIdleLoop(ctx, engine.buffer);
    const src = ctx.createBufferSource();
    src.buffer = loopBuf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g).connect(engine.master);
    src.start(ctx.currentTime + 0.05);
    engine.loopSrc = src;
    engine.loopGain = g;

    engine.master.gain.setTargetAtTime(1, ctx.currentTime, 0.35);   // 淡入
  } catch (err) {
    console.warn('[engine] 音频启动失败', err);
    errors.push('engine: ' + String(err && err.message ? err.message : err));
  } finally {
    engine.starting = false;
  }
}

function engineStop() {
  const ctx = engine.ctx;
  if (!ctx) return;
  if (engine.master) engine.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  const src = engine.loopSrc;
  const g = engine.loopGain;
  engine.loopSrc = null;
  engine.loopGain = null;
  if (src) {
    src.stop(ctx.currentTime + 0.6);   // 等淡出后再停
    src.onended = () => { try { src.disconnect(); g && g.disconnect(); } catch { /* 忽略 */ } };
  }
}

/** 每帧：按车速调音高与音量；暂停时淡出到静音 */
function updateEngine(dt) {
  const ctx = engine.ctx;
  if (!ctx || !engine.loopSrc || !engine.loopGain || !engine.master) return;
  const sp = Math.max(0, state.speedNow);                 // m/s
  const k = Math.min(sp / 30, 1);                          // 0（静止）→ 1（108 km/h 以上）
  const rate = 0.94 + k * 0.42;                            // 怠速音高 → 约 1.36 倍（≈ 转速拉的更高）
  const vol = state.playing ? (0.34 + k * 0.42) : 0;       // 暂停时静音
  const t = ctx.currentTime;
  engine.loopSrc.playbackRate.setTargetAtTime(rate, t, 0.25);
  engine.loopGain.gain.setTargetAtTime(vol, t, 0.18);
  engine.master.gain.setTargetAtTime(engine.intent && state.playing ? 1 : (engine.intent ? 0 : 0), t, 0.3);

}

/** 当前声波幅度（0..1，RMS），熄火或没声音时为 0 */
function engineAmplitude() {
  if (!engine.analyser || !engine.loopSrc) return 0;
  engine.analyser.getByteTimeDomainData(engine.wave);
  const w = engine.wave;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < w.length; i += 4) {
    const v = (w[i] - 128) / 128;
    sum += v * v;
    n++;
  }
  const rms = Math.sqrt(sum / Math.max(n, 1));
  return Math.min(1, rms * 24);
}

/** 车速滑杆随引擎声波轻微“呼吸”：只改滑杆显示位置，不动真实设定值 */
let speedWaveLevel = 0;
let speedDragging = false;
function updateSpeedWave(dt) {
  if (!els.speed) return;
  const amp = state.playing ? engineAmplitude() : 0;
  speedWaveLevel += (amp - speedWaveLevel) * Math.min(1, dt * 14);
  const jitter = speedDragging ? 0 : speedWaveLevel * 14;   // 声波驱动：最多约 +14 km/h 的律动（只影响显示）
  // 待启动（熄火）时滑杆归 0：还没起步就不该显示巡航设定值；只有真的在跑/正在拖动时才落到设定值上
  const base = state.playing || speedDragging ? state.speedSetKmh : 0;
  const shown = Math.max(0, Math.min(220, base + jitter));
  if (Math.abs(Number(els.speed.value) - shown) > 0.05) {
    els.speed.value = shown.toFixed(2);
    updateSliderFill(els.speed, shown / 220);
  }
  if (els.speedVal) {
    const label = state.playing || speedDragging ? state.speedSetKmh : 0;
    const text = label.toFixed(1);
    if (els.speedVal.textContent !== text) els.speedVal.textContent = text;
  }
}

/** 控制台「引擎声」开关 */
function setEngineIntent(on) {
  engine.intent = !!on;
  if (els.engineSeg) {
    for (const b of els.engineSeg.querySelectorAll('button[data-engine]')) {
      b.classList.toggle('active', (b.dataset.engine === '1') === engine.intent);
    }
  }
  if (els.engineState) els.engineState.textContent = engine.intent ? '开' : '关';
  if (engine.intent) engineStart();
  else engineStop();
}

// 浏览器要求用户手势后才能出声：第一次点击/按键时把声音接上（控制台开关本身也算手势）
function armEngineOnFirstGesture() {
  let done = false;
  const kick = () => {
    if (done) return;
    done = true;
    if (engine.intent && state.playing) engineStart();
  };
  window.addEventListener('pointerdown', kick, { once: true, capture: true });
  window.addEventListener('keydown', kick, { once: true, capture: true });
}

if (els.engineSeg) {
  els.engineSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-engine]');
    if (!btn) return;
    setEngineIntent(btn.dataset.engine === '1');
  });
}

// ------------------------------------------------------------------ 零件拾取（按 P 开启，点一下要排查的零件）
// 排查「这块到底属于哪个门部件」用：按 P 打开拾取，点零件，屏幕顶部会显示
// 网格名 + 车辆本地坐标（+X 左、+Z 车头）。把这两行发我就能精确定位。
let pickOn = false;
const pickRay = new THREE.Raycaster();
const pickNdc = new THREE.Vector2();
let pickTip = null;
let pickHl = null;          // 当前高亮的「岛」叠加网格

function clearPickHighlight() {
  if (!pickHl) return;
  pickHl.geometry.dispose();
  pickHl.material.dispose();
  pickHl.removeFromParent();
  pickHl = null;
}

/** 找出被点中的三角形所属的「岛」里所有三角形（岛的编号来自切门时记录的 islOfTri） */
function islandTrisOf(mesh, triIndex) {
  const geo = mesh.geometry;
  const ud = mesh.userData || {};
  if (ud.islOfTri) {
    const k = ud.islOfTri[triIndex];
    const out = [];
    for (let t = 0; t < ud.islOfTri.length; t++) if (ud.islOfTri[t] === k) out.push(t);
    return out;
  }
  // 车身网格：按 index 的连通块现算一次
  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!idx) return [triIndex];
  const parent = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    uni(a, b); uni(b, c);
  }
  const root = find(idx.getX(triIndex * 3));
  const out = [];
  for (let t = 0; t < idx.count / 3; t++) if (find(idx.getX(t * 3)) === root) out.push(t);
  return out;
}

/** 用一层加法混合的叠加网格把选中的「岛」点亮，方便肉眼确认选中的是哪一块 */
function highlightIsland(mesh, triIndex) {
  clearPickHighlight();
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const idx = geo.index;
  const tris = islandTrisOf(mesh, triIndex);
  if (!tris.length) return;
  const arr = [];
  const v = new THREE.Vector3();
  const push = (vi) => {
    v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
    arr.push(v.x, v.y, v.z);
  };
  for (const t of tris) {
    if (idx) { push(idx.getX(t * 3)); push(idx.getX(t * 3 + 1)); push(idx.getX(t * 3 + 2)); }
    else { push(t * 3); push(t * 3 + 1); push(t * 3 + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2fe8c0,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });
  const hl = new THREE.Mesh(g, mat);
  hl.name = 'PickHighlight';
  hl.renderOrder = 999;
  hl.frustumCulled = false;
  scene.add(hl);
  pickHl = hl;
}
function showPickTip(text) {
  if (!pickTip) {
    pickTip = document.createElement('div');
    pickTip.style.cssText = 'position:fixed;left:50%;top:76px;transform:translateX(-50%);z-index:99;' +
      'padding:8px 14px;border-radius:8px;background:rgba(8,12,18,.92);' +
      'border:1px solid rgba(150,190,230,.35);color:#dbe7f2;' +
      'font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;pointer-events:none';
    document.body.appendChild(pickTip);
  }
  pickTip.textContent = text;
  pickTip.style.display = 'block';
  clearTimeout(pickTip._t);
  pickTip._t = setTimeout(() => { pickTip.style.display = 'none'; }, 15000);
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!pickOn || !state.car) return;
  const r = renderer.domElement.getBoundingClientRect();
  pickNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pickRay.setFromCamera(pickNdc, camera);
  const hits = pickRay.intersectObject(state.car, true);
  if (!hits.length) { showPickTip('没点到零件'); return; }
  const hit = hits[0];
  highlightIsland(hit.object, hit.faceIndex);
  const inv = new THREE.Matrix4().copy(state.car.matrixWorld).invert();
  const p = hit.point.clone().applyMatrix4(inv);
  let extra = '';
  // 点到车门零件时，顺带报出它所属「岛」的包围盒（写排除规则时直接用这组数）
  const ud = hit.object.userData || {};
  if (ud.islBoxes && ud.islOfTri && typeof hit.faceIndex === 'number') {
    const k = ud.islOfTri[hit.faceIndex];
    const bb = ud.islBoxes[k];
    if (bb) {
      extra = '\n岛包围盒: x ' + bb.min[0].toFixed(2) + '..' + bb.max[0].toFixed(2) +
        ', y ' + bb.min[1].toFixed(2) + '..' + bb.max[1].toFixed(2) +
        ', z ' + bb.min[2].toFixed(2) + '..' + bb.max[2].toFixed(2);
      console.log('[pick-island]', hit.object.name, bb);
    }
  }
  showPickTip('零件: ' + hit.object.name + '\n车本地: ' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ', ' + p.z.toFixed(2) + extra);
  console.log('[pick]', hit.object.name, p.toArray().map((x) => +x.toFixed(3)));
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P') return;
  pickOn = !pickOn;
  if (!pickOn) clearPickHighlight();
  showPickTip(pickOn ? '零件拾取：已开启，点一下要排查的零件' : '零件拾取：已关闭');
});

// ------------------------------------------------------------------ 调试接口（供自动化测试读取）
window.__viaduct = {
  THREE,
  renderer,
  scene,
  camera,
  state,
  camModes: CAM_MODES, // 调试用：可在控制台临时调机位参数
  orbitControls: controls, // 全景查看器的 OrbitControls 实例
  setOrbitView,
  get particles() { return particleReveal; },
  get shadowFade() { return shadowFade.value; },
  setParticles,
  get errors() {
    return errors;
  },
  getSnapshot() {
    return {
      ready: !!state.car,
      travel: state.travel,
      odometer: state.odometer,
      speedNow: state.speedNow,
      camMode: state.camMode,
      orbitView: state.orbitView,
      orbitYaw: orbit.yaw,
      camPos: camera.position.toArray(),
      camLook: camLook.toArray(),
      orbitPitch: orbit.pitch,
      orbitPitchDeg: +(orbit.pitch * 180 / Math.PI).toFixed(2),
      orbitDragging: orbit.dragging,
      carPos: state.car ? state.car.position.toArray() : null,
      carYaw: state.car ? state.car.rotation.y : null,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      errors: errors.slice(),
    };
  },
  setPlaying,
  setCamMode,
  applyPreset,
  engine,          // 引擎声：调试/自动化用（ctx 状态、循环源、增益）
  setEngineIntent,
};

// ------------------------------------------------------------------ go
armEngineOnFirstGesture();
boot().catch((err) => {
  console.error(err);
  errors.push(String(err && err.stack ? err.stack : err));
  els.loaderStatus.textContent = '加载失败：' + (err && err.message ? err.message : err);
  els.loaderBar.style.width = '100%';
  els.loaderBar.style.background = '#e06666';
});
