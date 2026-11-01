/**
 * scene.js —— 两个 demo 共用的场景（保证 B / D 对比时资产、构图、光照一致）
 *
 * 载入 assets/car.glb，配一块地面 + 一盏主光 + 一盏轮廓光 + 程序化天空环境，
 * 相机与 OrbitControls 也在这里建好，外面只管渲染。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';

const CAR_URL = '../assets/car.glb';

/**
 * 竖直线性渐变 → 等距柱状（equirect）环境贴图，当天空 + IBL 用。
 *
 * 注意：这里用 DataTexture 而不是 CanvasTexture。
 * three-gpu-pathtracer 的 envMapInfo.updateFrom() 读的是 texture.image.data，
 * 给它 HTMLCanvasElement 会直接抛 `Cannot read properties of undefined (reading 'length')`。
 */
const SKY_STOPS = [
  [0.0, 0x1a2a44],   // 天顶
  [0.42, 0x5a7090],
  [0.5, 0xc2d4e8],   // 地平线（亮，漆面靠它出高光）
  [0.58, 0x4a5058],  // 地平线以下（地面反弹）
  [1.0, 0x232830],
];

function skyColorAt(v) {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [p1, c1] = SKY_STOPS[i];
    const [p0, c0] = SKY_STOPS[i - 1];
    if (v <= p1) {
      const k = (v - p0) / Math.max(1e-6, p1 - p0);
      const r = ((c0 >> 16) & 255) + ((((c1 >> 16) & 255) - ((c0 >> 16) & 255)) * k);
      const g = ((c0 >> 8) & 255) + ((((c1 >> 8) & 255) - ((c0 >> 8) & 255)) * k);
      const b = (c0 & 255) + (((c1 & 255) - (c0 & 255)) * k);
      return [r / 255, g / 255, b / 255];
    }
  }
  return [0, 0, 0];
}

function makeSkyTexture() {
  const W = 64;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const [r, g, b] = skyColorAt(v);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ forPathtracer?: boolean }} opts
 */
export async function buildScene(canvas, opts = {}) {
  const forPathtracer = !!opts.forPathtracer;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !forPathtracer,     // 路径追踪自己会收敛抗锯齿，不用 MSAA
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !forPathtracer;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const sky = makeSkyTexture();
  scene.background = sky;

  // 环境光：光栅渲染走 PMREM（three 需要预卷积的立方体格式）；
  // 路径追踪直接采样 equirect 原图。
  if (forPathtracer) {
    scene.environment = sky;
  } else {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromEquirectangular(sky).texture;
    pmrem.dispose();
  }
  scene.environmentIntensity = 2.1;

  // ---------------- 地面
  const groundGeo = new THREE.CircleGeometry(40, 96);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.66, metalness: 0.0 }),
  );
  ground.receiveShadow = !forPathtracer;
  scene.add(ground);

  // ---------------- 灯光
  const sun = new THREE.DirectionalLight(0xffe9d2, 5.2);
  sun.position.set(6.5, 9.0, 4.5);
  sun.castShadow = !forPathtracer;
  if (sun.shadow) {
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 32;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);
  scene.add(sun.target);

  const rim = new THREE.DirectionalLight(0x9fc2ff, 2.2);
  rim.position.set(-7.5, 4.0, -6.5);
  scene.add(rim);

  // 相机这一侧的弱填充，避免车头正面死黑
  const fill = new THREE.DirectionalLight(0xdfe9f7, 0.9);
  fill.position.set(4.0, 3.2, 7.5);
  scene.add(fill);

  // ---------------- 相机 + 控制器
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
  camera.position.set(5.4, 1.85, 5.6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.62, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 2.2;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.497;
  controls.enablePan = false;
  controls.update();

  // ---------------- 车辆
  const gltf = await new GLTFLoader().loadAsync(CAR_URL);
  const car = gltf.scene;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  car.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = !forPathtracer;
    o.receiveShadow = !forPathtracer;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      m.envMapIntensity = 1.15;
      if (m.map) m.map.anisotropy = maxAniso;
      if (m.normalMap) m.normalMap.anisotropy = maxAniso;
      // 车灯：给一点暖色自发光，夜景与路径追踪里都能看出灯亮
      if (m.name === 'LightA') {
        m.emissive = new THREE.Color(0xffe6bd);
        m.emissiveIntensity = 0.8;
      }
      m.needsUpdate = true;
    }
  });
  // 落地：把包围盒最低点压到 y=0
  const box = new THREE.Box3().setFromObject(car);
  car.position.y -= box.min.y;
  scene.add(car);

  // ---------------- 尺寸
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return { w, h };
  }
  resize();

  return { renderer, scene, camera, controls, sun, car, resize, sky };
}
