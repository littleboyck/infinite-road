# 粒子聚合态特效 · 设计与实现说明

> 车模型从粒子状态「落」进场景 → 单色点云 → 光带扫过上色 → 粒子被表面吸走、实体凝结出来。
> 本文档记录**当前实现**（`demo/particles.js`）的结构、参数、算法和历史取舍，方便后期维护与调参。

最后更新：2026-11-02

---

## 1. 怎么跑起来

```bash
cd /Users/chenkang/Documents/deepseek-harness/default-workspace
python3 viaduct_web/serve.py 8777
# 打开 http://127.0.0.1:8777/demo/particles.html
```

`serve.py` 是一个禁止缓存的静态服务器；改了 js 刷新即可生效。

---

## 2. 一轮动画的阶段时间线

| 阶段 | 默认耗时 | 说明 |
|---|---|---|
| ① 聚合 | 5.0 s | 40 万粒子（车 32 万 + 地面 8 万）从上方落下，按顺序铺满 |
| ② 上色 | 由扫光决定 | 光带从车头扫到车尾，扫过之处永久变成车漆色 |
| ③ 吸附前摇 | 1.4 – 2.0 s | 凝结开始前的 0.6 s 里，贴近边界的粒子被表面微微吸住（方案 B） |
| ④ 凝结 | 5.0 s | 噪声溶解：实体车从斑块里长出来，粒子同步退场 |
| ⑤ 停留 | 0.6 s | 完全实体后停留，再进入下一轮（循环开启时） |

**实测时间线**（headless，默认参数，`paintDoneAt` 驱动）：

```
聚合完成       5.05 s   progress = 1
上色完成       5.86 s   colorFront = -2.29（光带真的扫过车尾）
凝结开始       8.02 s   距上色完成 +2.16 s
凝结结束      12.88 s   实际凝结 4.86 s
```

> 关键点：**凝结不是「聚合完成 + 2 s」**，而是「**光带真的扫过车尾** + 2 s」。以前是前者，所以偶尔会出现「上色没扫完就开始凝结（车是灰的）」。现在扫光周期缩短到 7 s，保证每轮都能扫到车尾。

截图：`../screenshots/ab-strip.png`（纯粒子 → 25% → 70% → 完全实体）

---

## 3. 文件结构

```
viaduct_web/
├── demo/
│   ├── particles.html      主推页面：粒子聚合特效（带全部滑杆）
│   ├── particles.js        主逻辑（~990 行，含大量注释）
│   ├── particles-dissolve.html/.js   早期「崩解」版（存档，仅供参考）
│   ├── plan-d.html/.js     路径追踪版（three-gpu-pathtracer）
│   ├── scene.js            共享场景：天空 / 灯光 / 地面 / 载入 car.glb
│   └── README.md           简版说明
├── assets/car.glb          15 MB 车模型（Aston Martin V12 Vantage）
├── vendor/                 three r169、three-gpu-pathtracer、three-mesh-bvh 等
├── screenshots/            各阶段验收截图
└── docs/particles-effect.md    ← 本文档
```

---

## 4. 参数总表

### 4.1 页面滑杆（`particles.html`）

| 控件 id | 标签 | 范围 / 默认 | 对应的 state 字段 |
|---|---|---|---|
| `in-carcount` | 车身粒子 | 8/16/24/32/48/64 万，默认 **32 万** | `carCount` |
| `in-groundcount` | 地面粒子 | 2/5/8/12/20 万，默认 **8 万** | `groundCount` |
| `in-dur` | 聚合时长 | 1 – 10 s，默认 **5 s** | `duration` |
| `in-fuse` | 凝结时长 | 1 – 10 s，默认 **5 s** | `dissolveDuration` |
| `in-dir` | 进入方向 | 车头→车尾 / 车尾→车头 / 左→右 / 右→左 / 上→下 | `entry` |
| `in-ease` | 运动方式 | 匀速 / 缓出 / 缓入 / 缓入缓出 | `easeMode` |
| `in-beats` | 节拍数 | 1 – 20，默认 **1**（1 = 连续） | `beats` |
| `in-spread` | 飞行距离 | 0.3 – 6，默认 **0.3** | `travel` |
| `in-size` | 粒子大小 | 0.004 – 0.03，默认 **0.008** | `size` |
| `in-contrast` | 明暗对比 | 0.4 – 2.4，默认 **1.2** | `contrast` |
| `in-sweepw` | 光带宽度 | 0.08 – 1.2，默认 **0.08** | `sweepW` |
| `in-sweep` | 扫光开关 | 勾选 | `sweep` |
| `in-loop` | 循环 | 勾选 | `loop` |
| `in-progress` | 进度（手动） | 0 – 100 | `progress`（配合 `paused`） |

### 4.2 只在 `state` 里的参数（改代码）

| 字段 | 默认 | 作用 |
|---|---|---|
| `sweepPeriod` | 7000 ms | 扫光一轮的周期。**必须够短**，否则光带扫不到车尾、凝结永远等不到触发 |
| `holdAfterPaint` | 2000 ms | 上色完成后等多久开始凝结 |
| `sweepGain` | 1.15 | 光带亮度增益（60% 进度后才淡入） |
| `colorDuration` | 2600 ms | 上色节奏参考值（实际由扫光前沿推进） |
| `entryMode` | 0 | 0 轴向 / 1 外→里 / 2 里→外 |
| `count` | 400000 | 总数，tick 里用作密度补偿基准 |

---

## 5. 核心算法

### 5.1 车体表面采样：面积加权 + 重心坐标

思路：三角面面积越大，分到的粒子越多，保证表面密度均匀。

```js
// 1) 遍历三角面累加面积，生成 cdf
// 2) 用二分查找在 cdf 里定位一个面积区间 → 找到对应三角面
// 3) 在该三角面内用随机重心坐标取点 → 得到位置 + 插值法线 + 插值颜色
```

- 产物：`position`（世界坐标）、`normal`、`color`（glb 原始色，**线性空间**）
- 车身粒子的 `aCar = 1`，地面粒子 `aCar = 0`，后面所有「只作用于车身」的逻辑都靠它分流

### 5.2 地面采样：圆盘 + sqrt 修正

```js
const r = radius * Math.sqrt(Math.random());   // 不用 sqrt 会往圆心堆
```

半径 9（不是场景的 40）：地面粒子是用来「铺一张点云地毯」的，半径太大就会稀到看不见。

### 5.3 顺序归一化（谁先落）

每个粒子有一个 `aOrder ∈ [0,1]`，越小的先落。归一化在 JS 里做（`computeOrder()`），因为车和地面要用**各自的投影区间**：

```js
// 车：用包围盒 8 个角在入口方向上的投影
// 地面：用圆盘直径在水平方向的投影
const t = dot(position, entry)                 // 投影
order = clamp((t - min) / (max - min), 0, 1)
```

> 历史 bug：早期在着色器里只按车的包围盒归一化，地面半径 13 的点算出 ±5.9 后被 clamp 到两端 → 地面所有粒子都挤在第一个和最后一个节拍上。

**串行分段**（让地面先铺、车随后）：

```js
arr[i] = i < carN ? (0.55 + o * 0.45)    // 车：0.55 ~ 1
                  : (o * 0.55);          // 地面：0 ~ 0.55
```

**节拍（beats）**：把顺序值量化成 N 段，一段一段落

```glsl
if (uBeats > 1.5) { lag = floor(order*uBeats) * seg; dur = seg; }  // 分批
else              { lag = order * 0.55; dur = 0.45; }              // 连续
p = clamp((uProgress - lag) / dur, 0, 1);
```

### 5.4 单色光照：一种色相，全靠明暗

```glsl
float key  = max(0.0, dot(nrm, Lkey));    // 主光
float fill = max(0.0, dot(nrm, Lfill));   // 补光
float rim  = pow(1.0 - dot(V, nrm), 2.6); // 边缘光
float lum  = 0.055 + key*0.78 + fill*0.26 + rim*0.85 + 0.10;
lum = pow(clamp(lum, 0.0, 2.0), uContrast);
```

- 颜色只有 `uTint`（冷白 `#e7edf8`），**明暗信息全部来自光照**
- 亮的地方把点画大：`worldSize *= (0.62 + 0.75 * min(lum, 1.6))`
- 密度补偿：`uDensity = clamp(sqrt(200000/count), 0.45, 1.8)`，粒子越多单个越淡，避免加性混合糊成一片白

### 5.5 扫光：相位锚定「本轮开始时刻」

```js
const sweepPosNow = () => {
  if (state.sweepAt != null) return state.sweepAt;         // 调试：钉住
  const per = state.sweepPeriod;
  const ph  = ((now - state.startedAt) % per) / per;       // 每轮从 0 开始
  return 3.4 - ph * 6.8;                                   // +3.4 车头 → −3.4 车尾
};
```

- **为什么用 `now - state.startedAt`**：用绝对时间 `now` 的话，每轮循环起始相位是随机的 → 有时扫得完、有时扫不完（就是「有时上色没完成」的根因）
- 宽度与软边解耦：`soft = max(uSweepW * 2.2, 0.62)`，宽度调到最小也不会出现硬边
- 60% 进度后才淡入：`gate = smoothstep((progress-0.6)/0.08)`

### 5.6 上色：只减不增的「前沿」

```js
state.colorFront = Math.min(state.colorFront, sweepPos);   // 只减不增
```

```glsl
float ct = (aCar > 0.5)
  ? clamp((position.z - uColorFront) / uColorBand, 0.0, 1.0)
  : 0.0;                    // 地面永不参与上色
```

四段色阶（`ct` 0 → 1）：

| 阶段 | 效果 |
|---|---|
| 0 – 0.35 | 黑白（提亮 luminance） |
| 0.35 – 0.6 | 灰白 |
| 0.6 – 0.82 | 低饱和色（`mix(gray, full, 0.42)`） |
| 0.82 – 1.0 | 正常车漆色 |

**车漆色的坑**：glb 里的 base color 是**线性空间的深色**（绿漆 ≈ 0.03/0.10/0.08），直接乘会变近黑。所以先做色相归一化再上亮度：

```glsl
vec3 hue = aColor / max(1e-3, max(aColor.r, max(aColor.g, aColor.b)));
vec3 carCol = hue * (0.55 + 1.10 * min(lum, 1.6)) * boost;
```

### 5.7 凝结（方案 A）：一套噪声两边共用

这是效果「不穿帮」的关键——**实体和粒子用同一个噪声函数、同一个阈值**，所以粒子消失的边界和实体出现的边界严丝合缝。

```glsl
// 共享噪声：hash31 / vnoise3 / fbm3（0.62 / 0.26 / 0.12 三倍频）
float dissolveMask(vec3 p) {
  return clamp((fbm3(p) - 0.28) / 0.44, 0.0, 1.0);   // 重映射到 0~1，否则值挤在 0.5 附近
}
```

**实体侧**（`patchDissolveMaterial()` 用 `onBeforeCompile` 注入）：

```glsl
float dNz = dissolveMask(vWPos * uNoiseScale);
if (dNz > uDissolve - 0.002) discard;          // 噪声小的先露出来
float dEdge = 1.0 - smoothstep(0.0, 0.07, abs(dNz - uDissolve));
dEdge *= smoothstep(0.0, 0.08, uDissolve) * (1.0 - smoothstep(0.90, 1.0, uDissolve));
totalEmissiveRadiance += vec3(0.75, 0.85, 1.0) * dEdge * 0.55;   // 烧蚀边缘高光
```

**粒子侧**：同一套噪声，阈值 +0.03 让它早一点退场

```glsl
float pNz = dissolveMask(position * uNoiseScale);
vAlpha *= step(uDissolve + 0.03, pNz);
```

细节：
- `- 0.002` 是防呆：`uDissolve = 0` 时 `dNz > 0` 会把 `dNz == 0` 的像素留下 → 车身上出现黑斑
- 边缘高光两端淡出：否则噪声最大值处（`dNz ≈ 1`）恒落在光带里，凝结结束后车漆上会浮出一片片圆形白斑
- `uDissolve` 末端超调到 1.06，保证一个洞都不剩

### 5.8 吸附（方案 B）：凝结前 0.6 s 把边界粒子往表面吸

```glsl
float dS = pNz - uDissolve;                       // > 0 = 还没被吃掉
float b  = exp(-pow(dS / 0.12, 2.0)) * step(0.0, dS);   // 只作用于「边界附近」
suckBand = b * uSuck;
pos      += normalize(aNormal) * (-0.05 * suckBand);    // 往表面里收
lum      += suckBand * 1.2;                             // 边界处更亮
worldSize *= (1.0 - 0.6 * suckBand);                    // 边界处更小
```

`uSuck` 在 `progress = 1` 后 1.4 s 起、0.6 s 内从 0 → 1。

---

## 6. 状态机与触发（当前版本）

```js
// ① progress 首次到 1 → 记时间（吸附前摇以此为零点）
if (state.progress >= 0.999 && !state.progressOneAt) state.progressOneAt = now;

// ② 吸附前摇：+1.4 s 起，0.6 s 内 uSuck 0 → 1

// ③ 上色完成 = 光带真的扫过车尾
if (!state.sweep && state.progress >= 0.6) state.colorFront = -2.2;   // 扫光关掉 → 视为完成
if (state.progress >= 0.6 && state.colorFront <= -2.2 && !state.paintDoneAt)
  state.paintDoneAt = now;

// ④ 上色完成 + holdAfterPaint(2 s) → 开始凝结
if (state.paintDoneAt && now - state.paintDoneAt >= state.holdAfterPaint) {
  state.dissolveOn = true; state.dissolveStart = now;
  // 给车体每个材质 patchDissolveMaterial()，并把 mesh 显示出来
}

// ⑤ 凝结进度
state.dissolveT = Math.min(1, (now - state.dissolveStart) / state.dissolveDuration);

// ⑥ 循环：必须等凝结完成
const paintAt = state.paintDoneAt ? (state.paintDoneAt - state.startedAt) : state.duration;
const cycleMs = paintAt + state.holdAfterPaint + state.dissolveDuration + 600;
if (raw >= 1 && state.loop && dissolved && now - state.startedAt > cycleMs) restart();
```

---

## 7. 调试接口

```js
window.__particles = {
  get state(),              // 只读快照（23 个字段）
  set(obj),                 // 批量改 state，例如 set({ duration: 1500, loop: false })
  setProgress(p),           // 手动摆进度（同时置 paused）
  pause(), resume(), restart(),
  setSweep(x),              // 把扫光钉在某个世界 Z；传 null 恢复自动
};
window.__dbg = { scene, camera, car, carBox };
```

常用姿势：

```js
// 冻结相机看静止帧
window.__particles.set({ autoCam: false });
// 精确摆到凝结某一帧（dissolveDuration 拉长到 100000 再用时间戳摆位）
window.__particles.set({ dissolveDuration: 100000, dissolveStart: performance.now() - t * 100000 });
```

---

## 8. 历史与取舍（做过又删掉的东西）

| 做过的东西 | 结论 |
|---|---|
| **加密到 1000 万粒子** | 效果漂亮但 190 MB 内存、fps 掉到 16，用户要求删除 |
| **地面波纹（同心环）** | 试了 5 轮：加法提亮无效（地面 lum 已顶到白）→ 乘法压暗不像环 → 单环 + 点放大才可见；最终用户要求「删除地面现在的代码，改回串行方案」，整套移除 |
| **实体淡入淡出（reveal）** | 粒子淡出 + 车体淡入，用户认为多余，要求删除 |
| **B+A 组合（扫光提速 + 上色完成触发）** | 先实现后被回滚，最后只保留「扫光相位按轮重置」和「上色完成才凝结」两条 |
| **plan-a / plan-b（渐进解析、后处理噪点）** | 与最终方向无关，从 demo 删除，备份在 `/tmp/demo-plan-backup/` |
| **archify 生命周期图** | 解释「上色未完成就凝结」的图未通过 showcase 校验，暂缓 |

---

## 9. 坑与教训（省得再踩）

1. **TDZ**：`restart()` 里不能引用后面才 `const` 的变量（`u`、`dense`），否则整个模块直接抛错、页面白屏。
2. **bash+python 写文件**：`"\\n"` 会变成字面量 `\n` 写进源码，`node --check` 照样通过但浏览器崩。定点替换时用 `s.replace` 而不是拼字符串。
3. **headless 软件 GL 的帧率不能当真实性能**：40 万粒子 28–30 fps（软件渲染），真机 GPU 是 60。
4. **Playwright 截图**：`browser_take_screenshot` 只能写 `~/.dsh/profiles/desktop/`；要写项目目录得用 `page.screenshot({ path })` 的 unsafe 版本。
5. **glb 车漆颜色是线性空间深色**，直接拿来当顶点色会变黑，必须做色相归一化。
6. **玻璃透射不是溶解的锅**：曾怀疑 `discard` 破坏 transmission，实测把 `transmission` 设 0 后画面完全一样——车窗发白是模型 + 白色天空环境本身。
7. **加性混合过曝**：粒子越多越容易糊白，靠 `uDensity` + `min(lum, 1.05)` 压。
8. **扫光相位必须锚定本轮起始时刻**，否则每轮起始相位随机，表现为「有时上色没扫完」。

---

## 10. 想改某个效果，改哪里

| 想要 | 改什么 |
|---|---|
| 更密/更稀 | `carCount` / `groundCount`（滑杆已可调） |
| 落得更慢 | `duration`（滑杆 1–10 s） |
| 从车上砸下来而不是从前面推进 | `in-dir` 选「上→下」 |
| 一片一片落 | `beats` 调到 4–8 |
| 点更亮/更大 | `size`、`contrast` |
| 光带更细/更亮 | `sweepW`、`sweepGain` |
| 凝结更快 | `in-fuse`（1–10 s） |
| 凝结的斑块更大/更碎 | `uNoiseScale`（现在 4.0，越大越碎） |
| 上色更慢 | `state.sweepPeriod` 调大（默认 7000 ms） |
| 凝结前多等一会儿 | `state.holdAfterPaint`（默认 2000 ms） |
