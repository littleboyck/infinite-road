> 完整设计说明见 [docs/particles-effect.md](../docs/particles-effect.md)（参数表 / 六个核心算法 / 历史取舍 / 踩坑）

# viaduct_web · demo

一个车的 3D 场景（`../assets/car.glb`，Aston Martin Vantage）上的几组视觉效果实验。

| 页面 | 说明 |
|---|---|
| **`particles.html`** | **主推**：全场景粒子聚合 → 扫光上色 → 粒子吸附 → 凝结成实体（12.6 s / 轮，循环播放） |
| `particles-dissolve.html` | 存档：早期「实体被噪声崩解成 voxel 粒子」的版本（方向已弃用，留作参照） |
| `plan-d.html` | 真·路径追踪渐进收敛（`three-gpu-pathtracer`，用于出高质量静帧） |
| `../index.html` | 站点首页（不含本 demo 的入口） |

> 原先的 `plan-a`（路径追踪预览档）、`plan-b`（postprocessing 假噪点）、`plan-b-handwritten`（手写 shader 版）以及对比页 `demo/index.html` 已按需求删除，
> 需要追溯时看 `/tmp/demo-plan-backup/`。

## 跑起来

```bash
# 仓库根目录
python3 viaduct_web/serve.py 8777

#   http://127.0.0.1:8777/demo/particles.html            ← 主推
#   http://127.0.0.1:8777/demo/particles-dissolve.html   ← 存档
#   http://127.0.0.1:8777/demo/plan-d.html               ← 路径追踪
```

必须走 http（ES module + importmap，`file://` 打不开）。`serve.py` 带 no-store，改完刷新即可。

## particles.html —— 主推效果

一句话：整个场景先只由 40 万颗粒子表达，粒子按顺序从上方落位、被一条扫光点亮并上色、
然后边界粒子被表面「吸进去」、实体车从噪声斑块里长出来。

### 阶段时间线（默认参数，5.0 + 2.0 + 5.0 + 0.6 = 12.6 s / 轮）

| 时间 | 阶段 | 说明 |
|---|---|---|
| 0.0 – 5.0 s | 聚合 | `state.duration`，粒子按 `aOrder` 顺序落位（地面先、车身后） |
| 5.0 – 7.6 s | 上色 | 扫光前沿扫过 → 黑白 → 灰白 → 低饱和 → 车漆 |
| 6.4 – 7.0 s | 吸附（B） | 边界一圈粒子内收、变亮、缩小 |
| 7.0 – 12.0 s | 凝结（A） | 实体 `discard` 噪声生长，粒子同步退场 |
| 12.0 – 12.6 s | 停留 | 循环模式在此之后才 `restart()` |

### 可调参数（`state` 里的关键项 / 对应滑杆）

| 参数 | 滑杆 | 默认 | 作用 |
|---|---|---|---|
| `carCount` / `groundCount` | 车身/地面粒子 | 32 万 / 8 万 | 采样点数（改后重建，约 190 ms） |
| `duration` | 聚合时长 | 5000 ms | 落位时长 |
| `dissolveDuration` | 凝结时长 | 5000 ms | 粒子 → 实体 |
| `entry` / `entryMode` | 进入方向 | 车头→车尾 | 顺序推进方向（`in`/`out` 走径向） |
| `easeMode` | 运动方式 | 0 匀速 | 0/1/2/3 = 匀速/缓出/缓入/缓入缓出 |
| `beats` | 节拍数 | 1 | 1 = 连续推进，>1 分批 |
| `travel` | 飞行距离 | 0.3 | 下落高度 |
| `size` | 粒子大小 | 0.008 | 世界单位 |
| `contrast` | 明暗对比 | 1.2 | 对 `lum` 做 pow |
| `sweepW` / `sweep` | 光带宽度/开关 | 0.08 / 开 | 呼吸扫光 |

### 两个核心算法

**1）顺序归一化 + 串行（`computeOrder`）**

车与地面**各自**用最合适的投影区间归一化（车用包围盒 8 角投影，地面用圆盘直径投影），
再拼成串行区间：地面 `0 ~ 0.55`、车 `0.55 ~ 1`，于是「地面先铺开，车随后落」。

> 早期版本两者共用车的包围盒区间，地面粒子被 `clamp` 全挤到 0/1 两端 —— 地面只有第一拍和最后一拍有粒子。

**2）一套噪声两边共用（`dissolveMask` + `patchDissolveMaterial`）**

实体与粒子读**同一个** `fbm3` 噪声、同一个阈值 `uDissolve`，所以「粒子消失的边界」与「实体长出来的边界」严丝合缝：

```glsl
float dNz = dissolveMask(vWPos * uNoiseScale);
if (dNz > uDissolve - 0.002) discard;                    // 实体：只保留噪声低于阈值的部分
float dEdge = 1.0 - smoothstep(0.0, 0.07, abs(dNz - uDissolve));
dEdge *= smoothstep(0.0, 0.08, uDissolve) * (1.0 - smoothstep(0.90, 1.0, uDissolve));
totalEmissiveRadiance += vec3(0.75, 0.85, 1.0) * dEdge * 0.55;   // 边缘高光（两端淡出，避免残留白斑）
```

### 调试接口

```js
window.__particles.state                     // 只读快照（23 字段）
window.__particles.set({ duration: 1500 })   // 批量改参数
window.__particles.setProgress(1)            // 手动钉进度（配合 pause）
window.__particles.pause() / resume() / restart()
window.__particles.setSweep(-2.2)            // 把扫光钉在某个 Z（截图用）
window.__dbg = { scene, camera, car, carBox }
```

## plan-d.html —— 路径追踪

`three-gpu-pathtracer` 真·渐进收敛：每帧 `renderSample()`，噪点按 `1/√N` 自然收敛。
默认 128 采样、8 次反弹；软件 GL 下单采样约 150 ms，收敛约 19 s（真机 GPU 快得多）。

## 目录

```
demo/
├── particles.html / particles.js        主推：聚合 → 上色 → 吸附 → 凝结
├── particles-dissolve.html / .js        存档：噪声崩解成粒子
├── plan-d.html / plan-d.js              路径追踪渐进收敛
└── scene.js                             共用场景（GLB 载入 / 三点光 / 天空 / 相机 / 控制器）
```
