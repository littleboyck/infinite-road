/**
 * sky.js —— 程序化天空穹顶 + 环境反射（不依赖任何贴图，完全离线）
 *
 * 天空用一个大球（跟随相机移动）配 ShaderMaterial 做竖直渐变，
 * 片段着色器输出前手动挂上 three 的 tonemapping / colorspace 片段，
 * 这样它和其他几何走同一条色调映射曲线，地平线处不会出现色差接缝。
 */
import * as THREE from 'three';

/** 天空默认色调 */
export const SKY = {
  top: 0x060c15,
  horizon: 0x3a4d63,
  bottom: 0x1b232d,
};

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;

    // 地平线以上：地平线色 → 顶部深色
    // 更长的过渡区间：从地平线到天顶缓慢过渡，避免明显的色带/断层
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.46, y));
    // 地平线以下：稍微压暗，做出一点点地面雾
    col = mix(col, uBottom, smoothstep(0.0, -0.30, y));

    // 一轮很淡的暖色光晕，给天空一点方向感
    float sun = pow(max(dot(dir, normalize(uSunDir)), 0.0), 6.0);
    col += uSunColor * sun * 0.055;

    // 轻微抖动，避免大面积渐变出现色带
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * 2.4 / 255.0;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * 创建跟随相机的天空穹顶。
 * @param {{sunDir: THREE.Vector3, sunColor: THREE.Color}} opts
 */
export function createSky(opts = {}) {
  const sunDir = (opts.sunDir ?? new THREE.Vector3(0.72, 0.42, 0.28)).clone().normalize();
  const sunColor = opts.sunColor ?? new THREE.Color(0xffd9a8);

  const geometry = new THREE.SphereGeometry(900, 48, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: true,
    uniforms: {
      uTop: { value: new THREE.Color(SKY.top) },
      uHorizon: { value: new THREE.Color(SKY.horizon) },
      uBottom: { value: new THREE.Color(SKY.bottom) },
      uSunDir: { value: sunDir },
      uSunColor: { value: sunColor },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'SkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = true;

  return {
    mesh,
    sunDir,
    sunColor,
    uniforms: material.uniforms,
    /** 运行时换配色（时段切换） */
    setPalette(p) {
      if (p.top !== undefined) material.uniforms.uTop.value.set(p.top);
      if (p.horizon !== undefined) material.uniforms.uHorizon.value.set(p.horizon);
      if (p.bottom !== undefined) material.uniforms.uBottom.value.set(p.bottom);
      if (p.sunColor !== undefined) material.uniforms.uSunColor.value.set(p.sunColor);
      if (p.sunDir) material.uniforms.uSunDir.value.copy(p.sunDir);
    },
    /** 每帧让穹顶跟着相机走，保证永远包住视点 */
    update(camera) {
      mesh.position.copy(camera.position);
    },
  };
}

/**
 * 用一个小场景烘一张 PMREM 环境贴图，给车漆和桥面金属提供反射。
 * 没有 HDR 资产也能得到干净的冷蓝天空 + 两道柔和光板的高光。
 */
export function createEnvironment(renderer, scene, palette = {}) {
  const envScene = new THREE.Scene();
  const cTop = palette.envTop ?? 0x16293f;
  const cHorizon = palette.envHorizon ?? 0x6b86a3;
  const cBottom = palette.envBottom ?? 0x10151c;
  const keyRGB = palette.envKey ?? [2.1, 1.96, 1.8];
  const fillRGB = palette.envFill ?? [0.55, 0.85, 1.35];

  // 渐变天空球
  const sphereGeo = new THREE.SphereGeometry(30, 32, 16);
  const sphereMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(cTop) },
      uHorizon: { value: new THREE.Color(cHorizon) },
      uBottom: { value: new THREE.Color(cBottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        vec3 col = mix(uHorizon, uTop, smoothstep(-0.05, 0.7, dir.y));
        col = mix(col, uBottom, smoothstep(0.0, -0.4, dir.y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(sphereGeo, sphereMat));

  // 主光板（暖白，偏车身上方，制造一条长高光）
  const key = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(keyRGB[0], keyRGB[1], keyRGB[2]) })
  );
  key.position.set(13, 18, 9);
  key.lookAt(0, 0, 0);
  envScene.add(key);

  // 副光板（冷蓝，从另一侧补一点轮廓）
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(fillRGB[0], fillRGB[1], fillRGB[2]) })
  );
  fill.position.set(-16, 7, -10);
  fill.lookAt(0, 0, 0);
  envScene.add(fill);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader?.();
  const rt = pmrem.fromScene(envScene, 0.03, 0.1, 120);

  const prev = scene.environment;
  scene.environment = rt.texture;
  if (prev) prev.dispose();

  // 释放临时资源
  sphereGeo.dispose();
  sphereMat.dispose();
  key.geometry.dispose();
  key.material.dispose();
  fill.geometry.dispose();
  fill.material.dispose();
  pmrem.dispose();

  return rt.texture;
}
